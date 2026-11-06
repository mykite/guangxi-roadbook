const assert=require('node:assert/strict');
const E=require('../src/engine.js'),data=require('../data/roadbook.json');
let checks=0;
function eq(a,b){assert.deepEqual(a,b);checks++;}
function continuity(days){for(let i=1;i<days.length;i++)eq(days[i-1].toCity,days[i].fromCity);}
function fresh(){return E.sanitize(E.defaults(data),data);}
const base=fresh();
eq(E.totals(E.expand(data,base,'high')).km,[3490,4770]);
eq(E.totals(E.expand(data,base,'local')).km,[3965,5805]);
eq(E.totals(E.expand(data,base,'high')).hotels,5);
eq(E.totals(E.expand(data,base,'local')).hotels,7);
for(const mode of ['high','local']){
  const list=data.routes[mode];continuity(E.expand(data,base,mode));
  for(const d of list.filter(d=>d.fromCity!==d.toCity)){
    for(const stop of d.stops.slice(0,-1)){
      const s=fresh();s.start='2026-11-06';s.changes[d.id].stop=stop.city;s.changes[d.id].nights=2;
      const days=E.expand(data,s,mode),cut=days.find(x=>x.id===d.id),catchup=days.find(x=>x.id==='catchup:'+d.id);
      continuity(days);eq(cut.toCity,stop.city);eq(catchup.fromCity,stop.city);eq(catchup.toCity,d.toCity);
      eq(days.length,list.length+3);eq(days[cut.seq].toCity,stop.city);
      eq(days[cut.seq].type,'stay');eq(catchup.date,E.addDate(cut.date,3));
      for(let i=0;i<2;i++)eq(Math.round((cut.km[i]+catchup.km[i])*100),Math.round(d.km[i]*100));
    }
  }
  const s=fresh();for(const d of list.filter(d=>d.optional))s.changes[d.id].skip=true;
  const days=E.expand(data,s,mode);continuity(days);eq(days.length,list.length-list.filter(d=>d.optional).length);
}
let s=fresh();s.start='2026-11-06';s.changes['high-14'].stop='钦州';s.changes['high-14'].nights=1;
let days=E.expand(data,s);let i=days.findIndex(d=>d.id==='high-14');
eq(days.slice(i,i+4).map(d=>[d.fromCity,d.toCity]),[['北海','钦州'],['钦州','钦州'],['钦州','防城港'],['防城港','东兴']]);
eq(days[i+3].date,'2026-11-22');
for(const [id,city,next] of [['local-12','荔浦','鹿寨'],['local-16','宾阳','南宁'],['local-24','防城港','东兴'],['local-37','宜州','柳州'],['local-39','全州','东安']]){
 s=fresh();s.changes[id].stop=city;const c=E.expand(data,s,'local').find(d=>d.id==='catchup:'+id);eq([c.fromCity,c.toCity],[city,next]);
}
s=fresh();s.changes['high-26'].merge=true;days=E.expand(data,s);eq(days.length,29);continuity(days);eq(E.totals(days).km,[3490,4770]);eq(days.find(d=>d.id==='high-26').toCity,'柳州');
s.changes['high-27'].nights=1;eq(E.sanitize(s,data).changes['high-26'].merge,false);
s=fresh();s.activities['local-17']='local-18';s.activities['local-18']='local-17';s=E.sanitize(s,data);days=E.expand(data,s,'local');eq(days[16].am,data.routes.local[17].am);eq(E.totals(days).km,[3965,5805]);
s=fresh();s.activities['high-03']='high-12';eq(E.expand(data,E.sanitize(s,data))[2].activityId,'high-03');
const legacy={modelContent:{route:'local',day:24,start:'2026-11-06'},privateContent:{done:{high:[1,14],local:[1,2,24]}}};
s=E.sanitize(legacy,data);eq(s.route,'local');eq(s.selected.local,'local-24');eq(s.done,['high-01','high-14','local-01','local-02','local-24']);eq(s.start,'2026-11-06');
for(const bad of [null,[],{modelContent:{day:1.5,start:'2026-02-30'},privateContent:{done:{high:{},local:'bad'}}},{version:2,done:{},changes:[],budget:{electricShare:NaN},selected:{high:'x'}}]){const v=E.sanitize(bad,data);eq(E.expand(data,v).length,30);}
eq(E.validDate('2026-02-30'),false);eq(E.addDate('2026-12-31',1),'2027-01-01');eq(E.addDate('2028-02-28',1),'2028-02-29');
s=fresh();s.changes['high-14'].nights=1;let t=E.totals(E.expand(data,s));eq(t.carNights,25);eq(t.days,31);
s.lodging['stay:high-14:1']='hotel';t=E.totals(E.expand(data,s));eq(t.hotels,6);eq(t.carNights,24);
const b=E.budget(t,s.budget,'high');for(let n=0;n<2;n++)eq(Math.round(b.total[n]*100),Math.round(Object.values(b.items).reduce((sum,v)=>sum+v[n],0)*100));
eq(E.budget(t,s.budget,'local',true).items['餐饮'],[1500,1500]);
console.log(`PASS ${checks} checks: all stop splits, continuity, skipped days, dates, migration, swaps, merges and budgets`);
