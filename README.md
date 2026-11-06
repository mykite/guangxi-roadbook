# 南行手记 · 广西自驾路书

长沙出发，一人、一辆增程车，慢慢看广西。

**在线访问：https://mykite.github.io/guangxi-roadbook/**

## 功能

- 高速优先 30 天、不走高速 42 天为起始参考，游玩、转场、休整分别标明。
- 逐日上午、下午、补能夜宿与雨天调整，出发日可自行设置。
- 实际落脚地提前时插入剩余转场，多住一晚自动顺延日期。
- 删减同城可选日、相邻同城内容交换、逐晚切换车宿或酒店；宜州返程两日可合并。
- 里程、车时、夜宿晚数、预算从同一份行程数据计算；两条线共用能耗和生活参数。
- 按需获取 Open-Meteo 近期预报，显示地点、有效日期、获取时间；附官方天气与预警入口。
- 地图搜索入口，记录主选/备用充电与夜宿候选、用户自行核实日期和备注。
- 自动兼容旧版出发日和打卡；支持 JSON 导出/导入及下载调整后的逐日 Markdown。
- 手机与桌面布局，随系统浅色/深色；无外部脚本依赖。

## 信息范围

行程整理于 **2026-11-06**。路线里程与中途拆分是规划估算，没有实时算路。30 / 42 天不是固定旅行时长。

天气请求使用近似城镇中心点，不能替代沿途县区、山区、海面的官方预警。超出未来 7 天或过去的行程日期不生成天气。天气查询需要网络，页面关闭后不会后台监测。

充电余位、停车过夜许可、厕所开放、酒店价格和车辆当前露营模式仍需核实。夜耗、油耗、电价等默认值只是测算假设。预算区间主要反映里程范围，另列 10% 机动金。

## 数据与本地保存

唯一行程源是 `data/roadbook.json`。浏览器和两份文字攻略均由其生成。

- `src/engine.js`：日期、路线连接、统计、预算与旧状态迁移。
- `src/app.js`：界面、存储、天气、候选点和备份。
- `src/style.css`、`src/shell.html`：样式与独立页面外壳。
- `scripts/build.py`：构建自包含的根目录 `index.html`，生成 `guide/daily-plan.md` 与 `guide/overview.md`。
- `tests/engine.cjs`：路线连接、日期、迁移与预算回归检查。

旧数据键 `guangxi-roadbook:v1` 保留，新版使用 `guangxi-roadbook:v2`。数据只存在当前浏览器，不跨设备自动同步。导出备份包含手动填写的候选地点。GitHub 仓库不包含用户行程进度。

## 本地构建与预览

```sh
python3 scripts/build.py
node tests/engine.cjs
python3 -m http.server 8000
```

访问 `http://localhost:8000/`。将生成的 `index.html` 与数据、源码、指南一起提交。GitHub Pages 从 `main` 根目录发布。

## 阅读与来源

- [完整逐日参考](guide/daily-plan.md)
- [路线、预算与用车说明](guide/overview.md)
- [Open-Meteo 文档](https://open-meteo.com/en/docs)，天气数据 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，免费接口仅用于非商业用途。
- [高德 URI 地点搜索文档](https://lbs.amap.com/api/uri-api/guide/search/search)。
