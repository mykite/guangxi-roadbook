(() => {
  'use strict';
  const data=JSON.parse(document.getElementById('gx-trip-data').textContent), E=Roadbook;
  const KEY='guangxi-roadbook:v2', LEGACY='guangxi-roadbook:v1';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>Math.round(v).toLocaleString('zh-CN');
  const interval=(v,decimals=0)=>v.map(n=>Number(n.toFixed(decimals)).toLocaleString('zh-CN')).join('–');
  const money=v=>'¥'+v.map(n=>number(Math.ceil(n/10)*10)).join('–');
  const modeName=m=>m==='high'?'高速优先':'不走高速';
  const mapURL=(city,query)=>'https://uri.amap.com/search?'+new URLSearchParams({keyword:`${data.cities[city].name} ${query}`,city:data.cities[city].name,src:'guangxi-roadbook',callnative:'0'});
  const link=(url,label,cls='')=>`<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  const mapLink=(city,q,label,cls='button')=>link(mapURL(city,q),label,cls);
  let state, storageProblem='', toastTimer, weatherGeneration=0;
  try {
    const saved=localStorage.getItem(KEY), legacy=localStorage.getItem(LEGACY);
    try { state=E.sanitize(JSON.parse(saved||legacy||'null'),data); }
    catch {state=E.sanitize(JSON.parse(legacy||'null'),data);storageProblem='新版保存数据无法读取，已尝试恢复旧版进度。请导出备份后检查。';}
  } catch {state=E.defaults(data);storageProblem='浏览器无法读取本地保存。当前可临时使用，离开前请导出备份。';}
  state=E.sanitize(state,data);
  function warn(text) {$('#storage-warning').textContent=text;$('#storage-warning').hidden=!text;}
  function toast(text) {$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
  function persist() {
    state=E.sanitize(state,data);
    try {localStorage.setItem(KEY,JSON.stringify(state));if(!storageProblem)warn('');}
    catch {storageProblem='本地保存失败。本次修改只在当前页面有效，请立即导出备份。';warn(storageProblem);}
  }
  function plan() {return E.expand(data,state);}
  function selected(days=plan()) {return days.find(d=>d.id===state.selected[state.route]||d.members?.includes(state.selected[state.route]))||days[0];}
  function baseFor(day) {return data.routes[state.route].find(d=>d.id===day.baseId);}
  function changeFor(base) {return state.changes[base.id]||(state.changes[base.id]={stop:base.toCity,nights:0,skip:false,merge:false});}
  function clearChangedProgress(baseId) {state.done=state.done.filter(id=>id!==baseId&&!id.startsWith('catchup:'+baseId)&&!id.startsWith('stay:'+baseId+':'));}
  function update(message, scroll=false) {persist();render();if(message)toast(message);if(scroll)$('#daily').scrollIntoView({block:'start'});}
  function dateLabel(date) {
    if(!date)return '未定日期';
    const day=new Date(date+'T12:00:00Z').getUTCDay();
    return `${date} · 周${'日一二三四五六'[day]}`;
  }
  function pickToday() {
    const days=plan(), today=E.chinaToday();
    const d=days.find(d=>d.date===today)||days.find(d=>!d.complete)||days[days.length-1];
    state.selected[state.route]=d.id;
  }
  function renderAdjust(day) {
    const base=baseFor(day), c=changeFor(base), candidates=E.swapCandidates(data,state.route,base.id).filter(d=>!state.changes[d.id]?.skip);
    const stops=base.stops.length>1?`<label class="field">实际停在哪里<select id="actual-stop" ${c.merge?'disabled':''}>${base.stops.map(s=>`<option value="${esc(s.city)}" ${c.stop===s.city?'selected':''}>${esc(s.city)}${s.city===base.toCity?'（原计划）':s.city===base.fromCity?'（当天未转场）':'（中途落脚）'}</option>`).join('')}</select></label><p class="hint">选择中途城市后，会插入剩余转场。拆分里程按粗略比例分摊，出发前用导航复核。如果实际去了列表外的地方，需要重新核对连接路段。</p>`:'';
    return `<details id="adjust"><summary>调整这段行程</summary><div class="form-stack">${day.type!=='base'?`<p class="hint">此日附属于参考 D${base.n}。下方调整会作用于这整段行程。</p>`:''}${stops}
      <div class="field inline"><span>在 ${esc(c.stop||base.toCity)} 额外停留</span><button data-action="stay-minus" aria-label="减少一天停留" ${!c.nights?'disabled':''}>−</button><b id="stay-count">${c.nights||0} 天</b><button data-action="stay-plus" aria-label="多住一晚" ${c.nights>=30||c.merge||day.home?'disabled':''}>＋ 多住一晚</button></div>
      <p class="hint">停留日安排在实际落脚之后、剩余转场之前，后续日期自动顺延。已返家日不增加车宿。</p>
      ${!day.home?`<label class="field">这个晚上住哪里<select id="lodging"><option value="car" ${!day.hotel?'selected':''}>车宿 · 先核实允许过夜</option><option value="hotel" ${day.hotel?'selected':''}>酒店 · 洗澡、洗衣、睡整觉</option></select></label>`:''}
      ${day.type==='base'&&candidates.length?`<label class="field">与相邻同城日交换游玩内容<select id="swap-with"><option value="">选择同城日…</option>${candidates.map(d=>`<option value="${d.id}">参考 D${d.n} · ${esc(d.title)}</option>`).join('')}</select></label><p class="hint">交换上午、下午、雨天方案与游览里程；住宿日期保留。仅支持同一次停留里的同城日。</p>`:''}
      ${base.optional?`<button data-action="skip">删去这个同城可选日</button><p class="hint">后续提前一天；若有额外停留，会一并移除。已安排的酒店需自行处理。</p>`:''}
      ${base.mergeNext?`<label class="done-label"><input type="checkbox" id="merge" ${c.merge?'checked':''}>合并下一天，宜州午休后直接到柳州</label><p class="hint">原两天合计约 160–240 公里、3–4.5 小时纯驾驶。合并前需移除这两天的额外停留、恢复原落脚地，并核对当天导航。</p>`:''}
    </div></details>`;
  }
  function renderNight(day) {
    if(day.home)return `<div class="night"><strong>今晚 · 回到长沙</strong><p>接近家时也按疲劳和路况决定是否继续。提前停下可在“调整这段行程”中记录。</p></div>`;
    const city=day.toCity;
    return `<div class="night"><div class="row between"><strong>今晚 · ${esc(city)}</strong><span class="badge">${day.hotel?'酒店休整':'车宿候选'}</span></div><p>${day.hotel?'先核实停车、热水和洗烘条件；报价以入住日期为准。':'优先城区有人管理的地面停车场。确认允许人在车内过夜、厕所夜间开放、能随时离场；未找到合适场地就改酒店。'}</p><div class="links">${mapLink(city,'充电站','找充电')}${mapLink(city,day.hotel?'酒店 停车':'地面停车场','找落脚点')}${mapLink(city,'酒店 停车','酒店备选')}</div><p class="hint">以上打开地图搜索，需自行选择具体地点；未确认空闲枪位、营业和车宿许可。</p></div>`;
  }
  function renderPlaces(day) {
    const city=day.toCity,p=state.places[city]||{};
    const entries=[['charge','主选充电站','充电站'],['chargeBackup','备用充电站','充电站'],['sleep','主选夜宿点','地面停车场'],['sleepBackup','备用夜宿点','酒店 停车']];
    return `<details id="places"><summary>${esc(city)} · 保存主选与备用点</summary><p class="hint">从地图找到候选后记录在这里。核实标记只代表你填写当日的确认，不代表持续可用。</p><form id="places-form"><input type="hidden" name="city" value="${esc(city)}">${entries.map(([k,title,q])=>{const v=p[k]||{};return `<div class="candidate"><div class="row between"><b>${title}</b>${mapLink(city,v.name||q,'地图搜索','')}</div><label class="field">地点名称<input type="text" name="${k}" value="${esc(v.name)}" maxlength="120" placeholder="还未选定具体地点"></label><label class="field">核实备注<input type="text" name="${k}Note" value="${esc(v.note)}" maxlength="200" placeholder="营业、接口/过夜许可、厕所、费用"></label><label><input type="checkbox" name="${k}Checked" ${v.checked?'checked':''}> 我已电话或现场核实</label><br><small>${v.checked&&v.at?'上次记录 '+esc(v.at)+'，抵达前再次确认':'待核实'}</small></div>`}).join('')}<button class="primary" type="submit" style="margin-top:12px">保存 ${esc(city)} 的候选点</button></form></details>`;
  }
  function renderWeather(day) {
    const cities=[...new Set([day.fromCity,day.toCity])];
    return `<section class="card side-card"><h3>沿途天气</h3><p class="hint">北京时间 ${E.chinaToday()}<br>当前查看 ${day.date||'未设日期的参考行程'}</p><label class="field" style="margin-top:10px">查询地点<select id="weather-city">${cities.map(city=>`<option value="${esc(city)}" ${city===day.toCity?'selected':''}>${esc(data.cities[city].name)}${city===day.toCity?' · 今晚':''}</option>`).join('')}</select></label><button data-action="weather" class="small" style="margin-top:10px">查询此地近期预报</button><div id="weather-output" class="weather-result"><p class="hint">按需获取未来 7 天。出发城市和夜宿地分别查看；临行再查沿途县区预警。未设置出发日时仅显示近期天气，不对应行程日。</p></div><div class="links" style="margin-top:12px">${link('https://gx.weather.com.cn/','广西天气')}${link('https://hunan.weather.com.cn/','湖南天气')}${link('https://www.12379.cn/','官方预警')}</div></section>`;
  }
  const budgetFields=[['meal','餐饮 / 天','元'],['hotel','酒店 / 晚','元'],['park','车宿停车 / 晚','元'],['misc','洗衣杂项 / 天','元'],['ticket','全程门票预留','元'],['electricShare','行驶里程纯电占比','%'],['kwh100','电耗 / 百公里','kWh'],['kwhPrice','综合电价','元/kWh'],['litres100','用油里程油耗 / 百公里','L'],['fuelPrice','油价','元/L'],['nightKwh','每个车宿夜用电','kWh'],['tollKm','高速每公里通行费','元'],['highwayShare','高速版计费里程占比','%'],['localToll','国道版其他收费合计','元']];
  function renderBudget() {
    const estimates={};for(const mode of ['high','local']){const t=E.totals(E.expand(data,state,mode));estimates[mode]={t,b:E.budget(t,state.budget,mode),normal:E.budget(t,state.budget,mode,true)};}
    const {high:h,local:l}=estimates;
    return `<section class="card wide-card"><div class="section-head"><h2>预算跟着行程走</h2><span class="badge">一人 · 参数可改</span></div><p class="hint">两条线共用油电占比、生活与门票参数。实际计划比较包含不同天数；同天数测算统一为 30 天、5 晚酒店、24 晚车宿，仅用来分离里程与通行费影响，不能证明景点完全一致。</p><div class="table-wrap"><table><thead><tr><th>测算项目</th><th class="num">高速优先</th><th class="num">不走高速</th></tr></thead><tbody><tr><td>当前天数 / 酒店晚数</td><td class="num">${h.t.days} / ${h.t.hotels}</td><td class="num">${l.t.days} / ${l.t.hotels}</td></tr><tr><td>行程里程 · 公里</td><td class="num">${interval(h.t.km)}</td><td class="num">${interval(l.t.km)}</td></tr><tr><td>当前计划合计</td><td class="num"><b>${money(h.b.total)}</b></td><td class="num"><b>${money(l.b.total)}</b></td></tr><tr><td>加 10% 机动金</td><td class="num">${money(h.b.withBuffer)}</td><td class="num">${money(l.b.withBuffer)}</td></tr><tr><td>统一 30 天生活参数</td><td class="num">${money(h.normal.total)}</td><td class="num">${money(l.normal.total)}</td></tr></tbody></table></div><p class="hint">不含车辆折旧、保险、维修与装备。区间只反映规划里程范围，房价、天气与能耗波动另用机动金覆盖；不是报价。车宿夜耗默认 6 kWh 是占位假设，请用实测替换。</p><details id="budget-details"><summary>查看费用明细与公式</summary><table><thead><tr><th>项目</th><th class="num">高速</th><th class="num">国道</th></tr></thead><tbody>${Object.keys(h.b.items).map(k=>`<tr><td>${k}</td><td class="num">${money(h.b.items[k])}</td><td class="num">${money(l.b.items[k])}</td></tr>`).join('')}</tbody></table><p class="hint">行驶油电 = 总里程 × [纯电占比 × 电耗 ÷ 100 × 电价 + 用油占比 × 油耗 ÷ 100 × 油价]。高速费 = 里程 × 计费占比 × 每公里收费。车宿用电单独计入。当前行驶油电约 ${h.b.rate.toFixed(2)} 元/公里。</p></details><details id="budget-settings"><summary>修改预算参数</summary><form id="budget-form"><div class="budget-grid">${budgetFields.map(([k,name,unit])=>`<label class="field">${name}（${unit}）<input type="number" name="${k}" value="${state.budget[k]}" min="0" step="any" required></label>`).join('')}</div><div class="actions" style="margin-top:14px"><button type="submit" class="primary">重新计算</button><button type="button" data-action="budget-reset">恢复默认假设</button></div></form></details></section>`;
  }
  function render() {
    weatherGeneration++;
    const open=new Set([...document.querySelectorAll('details[open]')].map(n=>n.id));
    const days=plan(), day=selected(days), t=E.totals(days), b=E.budget(t,state.budget,state.route), next=days[day.seq];
    state.selected[state.route]=day.id;
    const done=days.filter(d=>d.complete).length, swapped=day.activityId&&day.activityId!==day.baseId;
    $('#app').innerHTML=`<div class="wrap"><header class="masthead"><div><div class="eyebrow">A slow road south · 南行手记</div><h1>广西，自在走</h1><p class="sub">长沙出发 · 一人 · 深蓝 SL03 增程</p></div><div class="header-actions"><button data-action="today" class="small">今天 / 待走</button><button data-action="outline" class="small">全程</button></div></header><div class="settings-bar"><div class="tabs" role="group" aria-label="路线选择">${['high','local'].map(m=>`<button data-route="${m}" aria-pressed="${state.route===m}">${modeName(m)} <small>· ${E.expand(data,state,m).length} 天</small></button>`).join('')}</div><label class="date-field">出发日期，可随时更改<input type="date" id="start-date" value="${esc(state.start)}" min="2020-01-01" max="2099-12-31"></label></div><div class="layout"><section class="card day-card" id="daily"><div class="row between day-top"><span>当前查看 · ${dateLabel(day.date)}</span><span>第 ${day.seq} / ${days.length} 天</span></div><div class="row"><span class="badge">${day.kind}</span>${day.optional?'<span class="badge warm">同城可选</span>':''}${day.type==='base'?`<span class="muted">参考 D${baseFor(day).n}${day.merged?'＋D'+(baseFor(day).n+1):''}</span>`:'<span class="badge warm">调整后新增</span>'}${swapped?'<span class="badge warm">已交换游玩内容</span>':''}</div><h2 class="day-title">${esc(swapped?data.routes[state.route].find(d=>d.id===day.activityId).title:day.title)}</h2><div class="route-line"><span>从 <strong>${esc(day.fromCity)}</strong></span><span>→</span><span>${day.home?'回到':'落脚'} <strong>${esc(day.toCity)}</strong></span></div><div class="drive"><span>约 <b>${interval(day.km)}</b> 公里</span><span>纯驾驶 <b>${interval(day.hours,1)}</b> 小时</span></div><p class="why">${esc(day.why)}</p><p class="hint">里程与车时为规划估算，未实时算路；不含充电、吃饭、游览、拥堵。</p>${renderNight(day)}<div class="timeline"><div class="period"><span>上午</span><p>${esc(day.am)}</p></div><div class="period"><span>下午</span><p>${esc(day.pm)}</p></div></div><div class="rain"><b>天气不好时</b><br>${esc(day.rain)}</div>${day.date&&new Date(day.date+'T12:00:00Z').getUTCDay()===1&&/博物馆|纪念馆/.test(day.am+day.pm+day.rain)?'<p class="hint">这天是周一，博物馆可能闭馆。先核对馆方公告；可交换相邻同城内容或原地休整。</p>':''}<div class="links">${mapLink(day.toCity,'','在地图选目的地')}${link(data.cities[day.toCity].province==='湖南'?'https://hunan.weather.com.cn/':'https://gx.weather.com.cn/','天气与预警')}</div><p class="hint">地图打开后选择具体地点，并手动设置“${state.route==='high'?'高速优先':'不走高速；如需再勾选避免收费'}”。不预设小路捷径。</p>${renderAdjust(day)}${renderPlaces(day)}<div class="day-footer"><label class="done-label"><input type="checkbox" id="day-done" ${day.complete?'checked':''}> 这一天已完成</label><div class="actions"><button data-action="prev" ${day.seq===1?'disabled':''}>← 上一天</button><button data-action="next" ${day.seq===days.length?'disabled':''}>下一天 →</button></div></div><p class="next-leg">${next?'下一段 · '+esc(next.fromCity)+' → '+esc(next.toCity)+' · '+(next.date||'日期待定'):'已经到环线终点，可导出备份保存这次旅行。'}</p></section><aside class="sidebar"><section class="card side-card"><div class="row between"><h3>这次环线</h3><span class="badge">${modeName(state.route)}</span></div><div class="stat-grid"><div class="stat"><strong>${t.days} 天</strong><span>参考表可增减</span></div><div class="stat"><strong>${t.hotels} 晚酒店</strong><span>${t.carNights} 晚车宿</span></div><div class="stat"><strong>${interval(t.km)}</strong><span>公里 · 逐日汇总估算</span></div><div class="stat"><strong>${money(b.total)}</strong><span>当前参数预算</span></div></div><p class="hint">预计返程 ${days.at(-1).date||'等你确定出发日期'}<br>纯驾驶合计 ${interval(t.hours,1)} 小时</p><progress value="${done}" max="${t.days}" aria-label="行程完成进度"></progress><p class="hint">已打卡 ${done} / ${t.days} 天 · 仅本浏览器保存</p></section>${renderWeather(day)}</aside></div><section class="card wide-card" id="outline"><div class="section-head"><h2>整趟行程</h2><span class="muted">点击跳到某一天</span></div><p class="hint" style="margin-bottom:14px">原始 30 / 42 天是参考节奏。游玩、转场、休整分别标明；160 公里纯电续航不决定每天必须在哪里过夜。</p><div class="outline-grid">${days.map(d=>`<button class="day-chip ${d.complete?'completed':''}" data-day="${d.id}" aria-current="${d.id===day.id}" aria-label="第${d.seq}天 ${esc(d.title)}"><b>${d.complete?'✓ ':''}第 ${d.seq} 天</b>${esc(d.toCity)}<span class="chip-date">${d.date?d.date.slice(5):d.kind}${d.type==='stay'?' · 加住':d.type==='catchup'?' · 补路':''}</span></button>`).join('')}</div><div class="skipped">${data.routes[state.route].filter(d=>state.changes[d.id]?.skip).map(d=>`<button class="small" data-restore="${d.id}">恢复参考 D${d.n} · ${esc(d.toCity)}</button>`).join('')}</div></section>${renderBudget()}<section class="card wide-card"><div class="section-head"><h2>车宿与补能的底线</h2><span class="muted">2022 款，车机版本待核对</span></div><div class="vehicle-grid"><div><h3>白天把油、电安排好</h3><p>160 公里按你反馈的纯电实际续航理解，高速、降温和暖风会改变它。用车辆支持的混动 / 保电设置行驶，在吃饭、采购时补电；不要为追求全程纯电频繁绕路。</p></div><div><h3>用实测夜耗决定余量</h3><p>先在熟悉场地试住，记录温度、空调、睡前与起床电量。睡前可用电量应覆盖整晚实测用量、次晨到充电点用量和余量，不使用统一充至 70%–90% 的承诺。</p></div><div><h3>先核对自己的露营模式</h3><p>在深蓝 App / 车机说明书核对当前版本是否禁用增程器、低电量退出行为和锁门方式。尚未核实这些条件时，安排酒店；不依赖睡眠中发动机自动启动补电。</p></div><div><h3>下午就落实过夜地点</h3><p>16 点起找点，天黑前决定。地面场地需获准车宿，远离河滩、低地、山崖和海堤外；不在封闭空间开着发动机睡觉。潮湿、疲劳或天气恶劣时增加酒店。</p></div></div><details id="routine"><summary>每天只做这几件事</summary><p class="hint">早上查目的地与沿途县区 24–72 小时预报、官方预警和道路通行；中午吃饭兼补能；下午确认主选与备用夜宿。近期预报之外只保留行程顺序，未来天气不作承诺。冬季返湘关注低温、雨雾及道路结冰风险；海边活动另看风浪与现场管理。</p></details></section><section class="card wide-card"><h3>把路书带走</h3><p class="hint">日期、打卡、实际落脚与候选地点保存在这个浏览器。换手机、清除浏览数据前导出 JSON，另一设备可导入恢复；网站不会自动跨设备同步。</p><div class="backup"><button data-action="export">导出当前计划与进度</button><button data-action="import">导入备份</button><button data-action="download-plan">下载调整后的逐日计划</button></div><div class="links" style="margin-top:12px">${link('./guide/daily-plan.md','完整参考文字版')}${link('./guide/overview.md','路线与用车说明')}${link('https://github.com/mykite/guangxi-roadbook','GitHub 项目')}</div></section><footer><p>南行手记 · 数据整理 ${data.updated} · 没有规定必须哪天抵达</p><p>路线、费用、候选点均需临行复核。天气由 ${link('https://open-meteo.com/','Open-Meteo')} 提供，${link('https://creativecommons.org/licenses/by/4.0/','CC BY 4.0')}；官方预警优先。请求天气时会将所选城镇的近似中心坐标发送给该服务。</p></footer></div>`;
    for(const id of open){const detail=document.getElementById(id);if(detail?.tagName==='DETAILS')detail.open=true;}
    warn(storageProblem);
  }
  const weatherCache=new Map();
  function weatherLabel(code) {
    if(typeof code!=='number'||!Number.isFinite(code))return '天气状况暂无数据';
    if(code===0)return '晴';if([1,2,3].includes(code))return '多云 / 阴';if([45,48].includes(code))return '雾';if([51,53,55,56,57].includes(code))return '毛毛雨 / 冻毛毛雨';if([61,63,65,66,67,80,81,82].includes(code))return '雨 / 阵雨';if([71,73,75,77,85,86].includes(code))return '雪 / 阵雪';if([95,96,99].includes(code))return '雷暴';return '天气代码 '+code;
  }
  async function loadWeather() {
    const day=selected(), city=$('#weather-city').value, loc=data.cities[city], token=++weatherGeneration, target=day.date, output=$('#weather-output'), today=E.chinaToday();
    if(target&&(target<today||target>E.addDate(today,6))){output.innerHTML=`<p>行程日期 ${esc(target)} ${target<today?'已过去，当前预报不能作为历史实况':'超出未来 7 天查询范围'}。请临近出行时再查。</p><p class="hint">本页不为这个行程日编造天气。</p>`;return;}
    output.innerHTML='<p>正在获取 '+esc(loc.name)+' 的预报…</p>';
    try {
      let result=weatherCache.get(city);
      if(!result||Date.now()-result.time>30*60*1000||result.today!==today){
        const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),12000);
        let response;
        try {response=await fetch('https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:loc.lat,longitude:loc.lon,daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_gusts_10m_max',timezone:'Asia/Shanghai',forecast_days:'7',wind_speed_unit:'kmh'}),{signal:controller.signal});}
        finally {clearTimeout(timer);}
        if(!response.ok)throw new Error('HTTP '+response.status);
        const json=await response.json();
        if(!Array.isArray(json.daily?.time))throw new Error('缺少预报日期');
        result={json,time:Date.now(),today};weatherCache.set(city,result);
      }
      if(token!==weatherGeneration)return;
      const d=result.json.daily, start=target?d.time.indexOf(target):0;
      if(start<0){output.innerHTML='<p>服务返回的预报未覆盖这个行程日，请临近日期再查。</p>';return;}
      const v=(field,i,unit)=>typeof d[field]?.[i]==='number'?`${d[field][i]}${unit}`:'暂无数据';
      const indices=target?[start]:d.time.map((_,i)=>i).slice(0,3);
      output.innerHTML=`<p><b>${esc(loc.name)} · ${target?'行程日预报':'近期 3 天，未对应行程'}</b></p>${indices.map(i=>`<div class="weather-row">${esc(d.time[i])} · ${weatherLabel(d.weather_code?.[i])}<br><strong>${v('temperature_2m_min',i,'')}–${v('temperature_2m_max',i,'℃')}</strong><br>降水概率 ${v('precipitation_probability_max',i,'%')} · 降水量 ${v('precipitation_sum',i,' mm')}<br>最大阵风 ${v('wind_gusts_10m_max',i,' km/h')}</div>`).join('')}<p class="hint">获取时间 ${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(result.time))}（北京时间）<br>来源 Open-Meteo · 城镇近似中心点的模式预报，不代表山区、海面或整条路况；获取时间不是模式发布时间。先看官方预警，再决定转场或多住一天。</p>`;
    }catch{if(token===weatherGeneration)output.innerHTML='<p>暂时无法取得预报，请使用下方官方天气与预警入口。</p><p class="hint">网络失败不会用旧天气冒充最新结果；可以稍后重新查询。</p>';}
  }
  function download(name,text,type) {
    const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('#app').addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.route){state.route=b.dataset.route;update();return;}
    if(b.dataset.day){state.selected[state.route]=b.dataset.day;update('',true);return;}
    if(b.dataset.restore){changeFor(data.routes[state.route].find(d=>d.id===b.dataset.restore)).skip=false;update('已恢复参考日，后续日期已更新');return;}
    const day=selected(), base=baseFor(day), c=changeFor(base);
    switch(b.dataset.action){
      case 'today':pickToday();update('已定位今天的计划；未在行程日期内时显示首个待完成日',true);break;
      case 'outline':$('#outline').scrollIntoView();break;
      case 'next':case 'prev':{const list=plan(), index=day.seq-1+(b.dataset.action==='next'?1:-1);if(list[index])state.selected[state.route]=list[index].id;update('',true);break;}
      case 'stay-plus':if(c.nights<30&&!c.merge&&!day.home){c.nights++;update('已多留一天，后续日期与预算同步更新');}break;
      case 'stay-minus':if(c.nights>0){state.done=state.done.filter(id=>id!==`stay:${base.id}:${c.nights}`);c.nights--;update('已减少一天停留');}break;
      case 'skip':if(base.optional){c.skip=true;c.nights=0;clearChangedProgress(base.id);const days=plan();state.selected[state.route]=days[Math.min(day.seq-1,days.length-1)].id;update('已移除同城可选日，可在全程列表下方恢复');}break;
      case 'weather':loadWeather();break;
      case 'budget-reset':state.budget={...data.budget};update('已恢复默认预算假设');break;
      case 'export':download('广西路书备份-'+E.chinaToday()+'.json',JSON.stringify({app:'guangxi-roadbook',exportedAt:new Date().toISOString(),state},null,2),'application/json');toast('已导出计划；备份包含你填写的地点');break;
      case 'import':$('#import-file').click();break;
      case 'download-plan':{
        const days=plan(),t=E.totals(days),b=E.budget(t,state.budget,state.route);
        const lines=[`# 广西自驾 · ${modeName(state.route)} · 我的调整计划`,`导出日期 ${E.chinaToday()}。出发 ${state.start||'未定'}；${t.days} 天；约 ${interval(t.km)} 公里；参数预算 ${money(b.total)}。`,`里程、时长为估算，非实时导航。候选点与天气需临行复核。`,...days.map(d=>`## 第 ${d.seq} 天 · ${dateLabel(d.date)} · ${d.title}\n\n${d.fromCity} → ${d.toCity}；约 ${interval(d.km)} 公里 / ${interval(d.hours,1)} 小时。\n\n上午：${d.am}\n\n下午：${d.pm}\n\n今晚：${d.home?'回家':d.toCity+' · '+(d.hotel?'酒店':'车宿，需获准')}\n\n天气不好：${d.rain}\n\n进度：${d.complete?'已完成':'待完成'}`)];
        download('广西逐日计划-'+E.chinaToday()+'.md',lines.join('\n\n'),'text/markdown;charset=utf-8');break;
      }
    }
  });
  $('#app').addEventListener('change',event=>{
    const el=event.target,day=selected(),base=baseFor(day),c=changeFor(base);
    if(el.id==='start-date'){state.start=E.validDate(el.value)?el.value:'';update('已更新全程日期');}
    if(el.id==='day-done'){const ids=day.members||[day.id];state.done=state.done.filter(id=>!ids.includes(id));if(el.checked)state.done.push(...ids);update();}
    if(el.id==='actual-stop'){c.stop=el.value;clearChangedProgress(base.id);state.selected[state.route]=base.id;update('已按实际落脚点连接剩余路段；这段进度需重新确认');}
    if(el.id==='lodging'){state.lodging[day.id]=el.value;update('已更新今晚住宿与预算');}
    if(el.id==='swap-with'&&el.value){const other=el.value,current=state.activities[base.id]||base.id;state.activities[base.id]=state.activities[other]||other;state.activities[other]=current;state.done=state.done.filter(id=>![base.id,other].includes(id));update('已交换同城内容与里程，相关打卡已清除以便重新确认');}
    if(el.id==='merge'){c.merge=el.checked;const clean=E.sanitize(state,data);if(el.checked&&!clean.changes[base.id].merge){c.merge=false;update('请先恢复这两天原落脚地，并移除额外停留');}else{state=clean;update('已更新合并转场与全程日期');}}
    if(el.id==='weather-city'){weatherGeneration++;$('#weather-output').innerHTML='<p class="hint">地点已更换，点击上方按钮重新查询。</p>';}
  });
  $('#app').addEventListener('submit',event=>{
    event.preventDefault();const form=event.target,values=new FormData(form);
    if(form.id==='budget-form'){
      const wanted={};for(const [k] of budgetFields)wanted[k]=Number(values.get(k));
      const valid=E.sanitize({...state,budget:wanted},data).budget;
      if(Object.keys(wanted).some(k=>valid[k]!==wanted[k])){toast('部分数值超出合理输入范围，请检查金额、百分比和能耗');return;}
      state.budget=valid;update('预算已按两条路线的共同参数重新计算');
    }
    if(form.id==='places-form'){
      const city=values.get('city');state.places[city]={};
      for(const key of ['charge','chargeBackup','sleep','sleepBackup']){const name=String(values.get(key)).trim(),note=String(values.get(key+'Note')).trim(),checked=!!name&&values.get(key+'Checked')==='on';state.places[city][key]={name,note,checked,at:checked?E.chinaToday():''};}
      update('已保存候选地点；抵达前请再次核实');
    }
  });
  $('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try {
      if(file.size>1000000)throw new Error('备份文件过大');
      const parsed=JSON.parse(await file.text()),raw=parsed.state||parsed;
      if(!raw||Array.isArray(raw)||typeof raw!=='object'||!(raw.version===2||raw.modelContent||['high','local'].includes(raw.route)))throw new Error('不是可识别的路书备份');
      const imported=E.sanitize(raw,data),days=E.expand(data,imported);
      if(window.confirm(`导入${modeName(imported.route)}计划（${days.length} 天，出发 ${imported.start||'未定'}）？将替换当前浏览器计划；建议先导出当前备份。`)){state=imported;update('备份已导入');}
    }catch(error){toast('导入失败：'+error.message);}
    event.target.value='';
  });
  window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue){try{state=E.sanitize(JSON.parse(event.newValue),data);render();toast('已同步本浏览器另一页面的修改');}catch{warn('另一页面写入的进度无法读取，已保留当前计划。');}}});
  render();
})();
