/* Pure itinerary calculations, shared by browser and regression checks. */
(function (root) {
  'use strict';
  const modes = ['high', 'local'];
  const range = (a, b) => a.map((v, i) => v + b[i]);
  const scale = (a, n) => a.map(v => Math.round(v * n * 100) / 100);
  const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const integer = (v, min, max, fallback) => Number.isInteger(v) && v >= min && v <= max ? v : fallback;
  function validDate(s) {
    if (typeof s !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T12:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  function addDate(s, days) {
    if (!validDate(s)) return '';
    const date = new Date(s + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function chinaToday() {
    return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }
  function defaults(data) {
    return {version:2, route:'high', start:'', selected:{high:'high-01',local:'local-01'}, done:[], changes:{}, activities:{}, lodging:{}, places:{}, budget:{...data.budget}};
  }
  function swapCandidates(data, mode, id) {
    const list = data.routes[mode], index = list.findIndex(d => d.id === id), day = list[index];
    if (!day || day.fromCity !== day.toCity) return [];
    let lo = index, hi = index;
    while (lo > 0 && list[lo - 1].fromCity === day.toCity && list[lo - 1].toCity === day.toCity) lo--;
    while (hi + 1 < list.length && list[hi + 1].fromCity === day.toCity && list[hi + 1].toCity === day.toCity) hi++;
    return list.slice(lo, hi + 1).filter(d => d.id !== id);
  }
  function sanitize(raw, data) {
    const out = defaults(data), s = object(raw);
    if (s.version !== 2) {
      const m = object(s.modelContent || s), p = object(s.privateContent || s);
      out.route = modes.includes(m.route) ? m.route : 'high';
      out.start = validDate(m.start) ? m.start : '';
      const day = integer(m.day, 1, data.routes[out.route].length, 1);
      out.selected[out.route] = `${out.route}-${String(day).padStart(2,'0')}`;
      for (const mode of modes) {
        const done = object(p.done)[mode];
        if (Array.isArray(done)) out.done.push(...done.filter(n => integer(n,1,data.routes[mode].length,0)).map(n=>`${mode}-${String(n).padStart(2,'0')}`));
      }
      return out;
    }
    const all = modes.flatMap(m=>data.routes[m]), ids = new Set(all.map(d=>d.id));
    const legalId = id => typeof id === 'string' && (ids.has(id) || /^(stay|catchup):(high|local)-\d{2}(?::\d{1,2})?$/.test(id) && ids.has(id.split(':')[1]));
    out.route = modes.includes(s.route) ? s.route : 'high';
    out.start = validDate(s.start) ? s.start : '';
    for (const mode of modes) if (legalId(object(s.selected)[mode]) && object(s.selected)[mode].includes(mode)) out.selected[mode] = s.selected[mode];
    out.done = Array.isArray(s.done) ? [...new Set(s.done.filter(legalId))] : [];
    for (const d of all) {
      const c = object(object(s.changes)[d.id]), stop = d.stops.find(p=>p.city===c.stop);
      out.changes[d.id] = {stop:stop ? stop.city : d.toCity, nights:integer(c.nights,0,30,0), skip:!!c.skip && d.optional, merge:!!c.merge && !!d.mergeNext};
      if (out.changes[d.id].skip) out.changes[d.id].nights = 0;
    }
    for (const mode of modes) {
      const list = data.routes[mode];
      for (let i=0;i<list.length;i++) {
        const d=list[i], c=out.changes[d.id], next=list[i+1];
        if (c.merge && (c.stop!==d.toCity || c.nights || !next || out.changes[next.id].nights || out.changes[next.id].stop!==next.toCity)) c.merge=false;
      }
      // Accept only a permutation inside a contiguous same-city group.
      for (const d of list) {
        const group=[d,...swapCandidates(data,mode,d.id)], groupIds=group.map(x=>x.id);
        const mapped=group.map(x=>object(s.activities)[x.id]||x.id);
        if (new Set(mapped).size===group.length && mapped.every(id=>groupIds.includes(id))) out.activities[d.id]=object(s.activities)[d.id]||d.id;
      }
    }
    for (const [id, value] of Object.entries(object(s.lodging))) if (legalId(id) && ['car','hotel'].includes(value)) out.lodging[id]=value;
    for (const city of Object.keys(data.cities)) {
      const p=object(object(s.places)[city]);
      out.places[city]={};
      for (const key of ['charge','chargeBackup','sleep','sleepBackup']) {
        const v=object(p[key]);
        out.places[city][key]={name:typeof v.name==='string'?v.name.slice(0,120):'',note:typeof v.note==='string'?v.note.slice(0,200):'',checked:!!v.checked,at:validDate(v.at)?v.at:''};
      }
    }
    const limits={meal:[0,500],hotel:[0,2000],park:[0,300],misc:[0,500],ticket:[0,20000],electricShare:[0,100],kwh100:[1,100],kwhPrice:[.1,10],litres100:[1,30],fuelPrice:[1,20],nightKwh:[0,100],tollKm:[0,3],highwayShare:[0,100],localToll:[0,10000]};
    for (const [k,[lo,hi]] of Object.entries(limits)) {
      const v=object(s.budget)[k];
      if (typeof v==='number' && Number.isFinite(v) && v>=lo && v<=hi) out.budget[k]=v;
    }
    return out;
  }
  function expand(data, state, mode=state.route) {
    const list=data.routes[mode], days=[];
    const append = d => {
      d.seq=days.length+1; d.date=addDate(state.start,days.length);
      d.hotel=d.home ? false : (state.lodging[d.id] ? state.lodging[d.id]==='hotel' : d.hotel);
      d.complete=(d.members||[d.id]).every(id=>state.done.includes(id));
      days.push(d);
    };
    for (let i=0;i<list.length;i++) {
      const base=list[i], c=state.changes[base.id]||{}, activity=list.find(d=>d.id===(state.activities[base.id]||base.id))||base;
      if (c.skip && base.optional) continue;
      const merged=!!c.merge && base.mergeNext, next=merged?list[i+1]:null;
      const end=next?next.toCity:base.toCity, stop=merged?end:(c.stop||end);
      const fraction=merged?1:(base.stops.find(p=>p.city===stop)?.fraction??1);
      const cut=fraction<1 && base.fromCity!==end;
      const km=next?range(base.km,next.km):activity.km, hours=next?range(base.hours,next.hours):activity.hours;
      const day={...base, title:merged?`${base.fromCity}→${base.toCity}→${end}：合并转场`:activity.title,
        id:base.id, baseId:base.id, type:'base', members:next?[base.id,next.id]:[base.id],
        toCity:stop, plannedTo:end, activityId:activity.id, cut, merged,
        km:scale(km,fraction),hours:scale(hours,fraction),
        hotel:next?next.hotel:base.hotel,home:!cut && i+(merged?2:1)===list.length,
        am:activity.am,pm:next?`在${base.toCity}午饭与休息后，白天完成到${end}的转场；取消重复散步，抵达后补给。`:activity.pm,rain:activity.rain};
      if (cut) {
        day.title=`${base.fromCity===stop?'原地休整':base.fromCity+'→'+stop} · 提前落脚`;
        day.am=`以实际抵达${stop}为本日安排；取消尚未到达地区的活动。原计划目的地为${end}。`;
        day.pm=`在${stop}吃饭、查充电与夜宿，剩余路段已单独排入后续。未完成的景点需在抵达后按时间重新选择。`;
      }
      append(day);
      for (let n=1;n<=(c.nights||0);n++) append({id:`stay:${base.id}:${n}`,baseId:base.id,type:'stay',kind:'休整',title:`${stop} · 多留一天`,fromCity:stop,toCity:stop,plannedTo:stop,km:[0,20],hours:[0,.8],hotel:day.hotel,home:false,am:'睡足后吃饭，检查天气和下一段路况；有余力再补一个附近未完成的项目。',pm:'洗衣、采购、充电，下午确认今晚停车与夜间厕所。新增日只预留城区补给里程。',rain:'留在城区休整，睡眠不足、被褥潮湿或天气不适合车宿时改酒店。',why:'主动给天气和身体留出余地；后续行程日期已顺延。'});
      if (cut) append({id:`catchup:${base.id}`,baseId:base.id,type:'catchup',kind:'转场',title:`补齐路段 · ${stop}→${end}`,fromCity:stop,toCity:end,plannedTo:end,km:scale(km,1-fraction),hours:scale(hours,1-fraction),hotel:base.hotel,home:i===list.length-1,am:`从实际落脚点${stop}出发，白天补齐到${end}的路段。当天导航复核时间后再出发。`,pm:`抵达后先安顿。原计划「${base.title}」中的未完成景点按时间选择；全天项目可在下一同城日之前再加住一天。`,rain:'若仍不能转场，在前一落脚日继续增加停留天数；本补齐路段跟随后移。',why:'衔接实际位置与后续出发点。拆分比例为规划占位，导航结果优先。'});
      if (merged) i++;
    }
    return days;
  }
  function totals(days) {
    return {days:days.length,km:days.reduce((s,d)=>range(s,d.km),[0,0]),hours:days.reduce((s,d)=>range(s,d.hours),[0,0]),hotels:days.filter(d=>d.hotel&&!d.home).length,carNights:days.filter(d=>!d.hotel&&!d.home).length};
  }
  function budget(t, p, mode, normalized=false) {
    const days=normalized?30:t.days, hotels=normalized?5:t.hotels, cars=normalized?24:t.carNights;
    const electric=p.electricShare/100, rate=electric*p.kwh100/100*p.kwhPrice+(1-electric)*p.litres100/100*p.fuelPrice;
    const items={餐饮:[days*p.meal,days*p.meal],酒店:[hotels*p.hotel,hotels*p.hotel],车宿停车:[cars*p.park,cars*p.park],洗衣杂项:[days*p.misc,days*p.misc],门票预留:[p.ticket,p.ticket],行驶油电:scale(t.km,rate),车宿用电:[cars*p.nightKwh*p.kwhPrice,cars*p.nightKwh*p.kwhPrice],通行费:mode==='high'?scale(t.km,p.highwayShare/100*p.tollKm):[p.localToll,p.localToll]};
    const total=Object.values(items).reduce(range,[0,0]);
    return {items,total,withBuffer:scale(total,1.1),rate};
  }
  root.Roadbook={defaults,sanitize,expand,totals,budget,addDate,validDate,chinaToday,swapCandidates};
  if (typeof module!=='undefined') module.exports=root.Roadbook;
})(typeof globalThis!=='undefined'?globalThis:this);
