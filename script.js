const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};

const S={lat:29.3909,lon:76.9635,name:'Panipat, Haryana',unit:store.get('unit','C'),wx:null,aq:null,H:[],now:0};
const WC={0:['Clear sky','☀️','🌙'],1:['Mostly clear','🌤','🌙'],2:['Partly cloudy','⛅','☁️'],3:['Overcast','☁️','☁️'],45:['Fog','🌫','🌫'],48:['Rime fog','🌫','🌫'],51:['Light drizzle','🌦','🌧'],53:['Drizzle','🌦','🌧'],55:['Heavy drizzle','🌧','🌧'],61:['Light rain','🌧','🌧'],63:['Rain','🌧','🌧'],65:['Heavy rain','🌧','🌧'],71:['Light snow','🌨','🌨'],73:['Snow','🌨','🌨'],75:['Heavy snow','❄️','❄️'],80:['Rain showers','🌦','🌧'],81:['Rain showers','🌧','🌧'],82:['Violent showers','⛈','⛈'],95:['Thunderstorm','⛈','⛈'],96:['Thunderstorm, hail','⛈','⛈'],99:['Severe thunderstorm','⛈','⛈']};
const wc=(c,day=true)=>{const w=WC[c]||['Unknown','🌡','🌡'];return{t:w[0],e:day?w[1]:w[2]}};
const T=c=>S.unit==='C'?Math.round(c):Math.round(c*9/5+32);
const U=()=>'°'+S.unit;
const fmtH=d=>d.toLocaleTimeString([], {hour:'numeric',minute:undefined}).replace(':00','');
const fmtT=d=>d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
const aqiLabel=a=>a>300?'Hazardous':a>200?'Very unhealthy':a>150?'Unhealthy':a>100?'Unhealthy for sensitive groups':a>50?'Moderate':'Good';

/* ---------- data ---------- */
async function load(){
  $('#place').textContent=S.name;
  try{
    const f=`https://api.open-meteo.com/v1/forecast?latitude=${S.lat}&longitude=${S.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation,pressure_msl&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,uv_index,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
    const a=`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${S.lat}&longitude=${S.lon}&current=us_aqi,pm2_5&hourly=us_aqi&timezone=auto&forecast_days=3`;
    const [w,q]=await Promise.all([fetch(f).then(r=>r.json()),fetch(a).then(r=>r.json()).catch(()=>null)]);
    S.wx=w;S.aq=q;buildHours();renderAll();
  }catch(e){toast('Could not load weather. Check your internet connection.')}
}
function buildHours(){
  const h=S.wx.hourly,cur=S.wx.current.time.slice(0,13);
  let i0=h.time.findIndex(t=>t.slice(0,13)===cur); if(i0<0)i0=0;
  S.H=[];
  for(let i=i0;i<i0+24&&i<h.time.length;i++){
    const t=h.time[i], ai=S.aq?.hourly?S.aq.hourly.time.indexOf(t):-1;
    S.H.push({time:new Date(t),feels:h.apparent_temperature[i],temp:h.temperature_2m[i],pop:h.precipitation_probability[i]||0,code:h.weather_code[i],wind:h.wind_speed_10m[i],uv:h.uv_index[i]||0,day:!!h.is_day[i],aqi:ai>=0?(S.aq.hourly.us_aqi[ai]||0):(S.aq?.current?.us_aqi||0)});
  }
}

/* ---------- scoring ---------- */
const IDEAL={run:18,cycle:20,walk:22,yoga:23};
function score(h,k){
  let s=100;const hr=h.time.getHours();
  s-=Math.max(0,Math.abs(h.feels-IDEAL[k])-4)*3;
  s-=h.pop*.5; if(h.code>=95)s-=40;
  if(h.aqi>50)s-=(h.aqi-50)*.35;
  if(h.uv>6)s-=(h.uv-6)*5;
  if(h.wind>25)s-=(h.wind-25)*1.5;
  if(hr<5||hr>=21)s-=30;else if(hr<6||hr>=20)s-=10;
  return Math.max(0,Math.round(s));
}
const lab=s=>s>=70?'Good':s>=45?'Fair':'Poor';
const col=s=>s>=70?'var(--good)':s>=45?'var(--fair)':'var(--poor)';
function bestWindow(k,len=2){
  let b=null;
  for(let i=0;i+len<=S.H.length;i++){
    let s=0;for(let j=0;j<len;j++)s+=score(S.H[i+j],k);s/=len;
    if(!b||s>b.s)b={i,s:Math.round(s)};
  }
  return b&&{start:S.H[b.i].time,end:new Date(S.H[b.i+len-1].time.getTime()+36e5),s:b.s};
}

/* ---------- risks ---------- */
function risks(){
  const r=[],H=S.H,mx=f=>H.reduce((a,h)=>f(h)>f(a)?h:a,H[0]);
  const A=mx(h=>h.aqi),F=mx(h=>h.feels),UV=mx(h=>h.uv),P=mx(h=>h.pop),W=mx(h=>h.wind),C=H.reduce((a,h)=>h.feels<a.feels?h:a,H[0]);
  const at=h=>' around '+fmtH(h.time);
  if(A.aqi>200)r.push({lv:'ext',e:'😷',key:'aqi-ext',t:'Extreme air pollution risk',d:`AQI up to ${A.aqi} (${aqiLabel(A.aqi)})${at(A)}. Wear an N95 mask outdoors and limit strenuous activity.`});
  else if(A.aqi>150)r.push({lv:'high',e:'😷',key:'aqi-high',t:'Unhealthy air',d:`AQI up to ${A.aqi}${at(A)}. Keep workouts indoors and wear a mask outside.`});
  else if(A.aqi>100)r.push({lv:'med',e:'🌫',key:'aqi-med',t:'Poor air for sensitive people',d:`AQI up to ${A.aqi}${at(A)}. Take it easy if you have asthma or allergies.`});
  if(F.feels>=40)r.push({lv:'ext',e:'🥵',key:'heat-ext',t:'Dangerous heat',d:`Feels like ${T(F.feels)}${U()}${at(F)}. Stay indoors at midday and drink water often.`});
  else if(F.feels>=35)r.push({lv:'high',e:'🌡',key:'heat',t:'Heat stress',d:`Feels like ${T(F.feels)}${U()}${at(F)}. Avoid hard exercise in the afternoon.`});
  if(C.feels<=3)r.push({lv:'high',e:'🥶',key:'cold',t:'Cold risk',d:`Feels like ${T(C.feels)}${U()}${at(C)}. Dress in layers.`});
  if(UV.uv>=8)r.push({lv:'high',e:'🧴',key:'uv',t:'Very high UV',d:`UV index ${Math.round(UV.uv)}${at(UV)}. Use sunscreen and cover up.`});
  if(H.some(h=>h.code>=95))r.push({lv:'ext',e:'⛈',key:'storm',t:'Thunderstorm possible',d:'Avoid open areas and unplug sensitive devices if it starts.'});
  else if(P.pop>=70)r.push({lv:'med',e:'☔',key:'rain',t:'Rain likely',d:`${P.pop}% chance${at(P)}. Carry an umbrella.`});
  if(W.wind>=40)r.push({lv:'high',e:'💨',key:'wind',t:'Strong wind',d:`Gusts near ${Math.round(W.wind)} km/h${at(W)}. Secure loose items.`});
  const o={ext:0,high:1,med:2};return r.sort((a,b)=>o[a.lv]-o[b.lv]);
}

/* ---------- render ---------- */
function renderAll(){
  const c=S.wx.current,d=S.wx.daily,w=wc(c.weather_code,!!c.is_day),aqi=S.aq?.current?.us_aqi;
  $('#ico').textContent=w.e;$('#temp').innerHTML=T(c.temperature_2m)+'<span style="font-size:40px;vertical-align:top">°</span>';
  $('#desc').textContent=w.t;$('#feels').textContent=`Feels like ${T(c.apparent_temperature)}°`;
  $('#hilo').textContent=`Today: high ${T(d.temperature_2m_max[0])}°, low ${T(d.temperature_2m_min[0])}°. ${d.precipitation_probability_max[0]}% chance of rain.`;
  const sr=new Date(d.sunrise[0]),ss=new Date(d.sunset[0]),mins=Math.round((ss-sr)/6e4);
  $('#stats').innerHTML=[['💧','Humidity',c.relative_humidity_2m+'%'],['💨','Wind',Math.round(c.wind_speed_10m)+' km/h'],['😷','Air quality',aqi!=null?`${Math.round(aqi)} · ${aqiLabel(aqi).split(' ')[0]}`:'n/a'],['🧴','UV max',Math.round(d.uv_index_max[0])],['🌅','Sunrise',fmtT(sr)],['🌇','Sunset',fmtT(ss)],['🕒','Daylight',`${Math.floor(mins/60)}h ${mins%60}m`]].map(x=>`<div><span class="mut">${x[0]} ${x[1]}</span><b>${x[2]}</b></div>`).join('');

  const R=risks();
  const al=$('#alert');
  if(R.length){al.style.display='block';al.className=R[0].lv==='ext'?'ext':R[0].lv==='med'?'med':'';al.innerHTML=`⚠ ${R[0].t} today — ${R[0].d}`+(R.length>1?`<small>+${R.length-1} more risk${R.length>2?'s':''} below</small>`:'')}
  else al.style.display='none';
  $('#risks').innerHTML=R.length?R.map(x=>`<div class="risk" style="--c:${x.lv==='med'?'var(--fair)':'var(--poor)'}"><div class="e">${x.e}</div><div><b>${x.t}</b><div class="mut">${x.d}</div></div></div>`).join(''):'<div class="risk" style="--c:var(--good)"><div class="e">✅</div><div><b>No major risks</b><div class="mut">Conditions look comfortable for the next 24 hours.</div></div></div>';
  notifyRisks(R);

  summary(R);hourly();activities();week();suggestions();drawMapMarker();
}
function summary(R){
  const H=S.H,c=S.wx.current,w=wc(c.weather_code,!!c.is_day);
  const wet=H.filter(h=>h.pop>=50),hot=H.reduce((a,h)=>h.temp>a.temp?h:a,H[0]),cool=H.reduce((a,h)=>h.temp<a.temp?h:a,H[0]);
  const run=bestWindow('run'),aqi=S.aq?.current?.us_aqi;
  let s=`${w.t} right now at ${T(c.temperature_2m)}${U()}. Expect it to peak near ${T(hot.temp)}${U()} at ${fmtH(hot.time)} and drop to ${T(cool.temp)}${U()} by ${fmtH(cool.time)}. `;
  s+=wet.length?`Rain is most likely ${fmtH(wet[0].time)}–${fmtH(new Date(wet[wet.length-1].time.getTime()+36e5))}. `:'Rain is unlikely today. ';
  if(aqi!=null)s+=`Air quality is ${aqiLabel(aqi).toLowerCase()} (AQI ${Math.round(aqi)}). `;
  if(run&&run.s>=45)s+=`Your best window for exercise is ${fmtH(run.start)}–${fmtH(run.end)}.`;
  else s+='Outdoor conditions are poor all day, so plan an indoor workout.';
  $('#summary').textContent=s;
}
function hourly(){
  $('#hours').innerHTML=S.H.map((h,i)=>{const w=wc(h.code,h.day),s=score(h,'walk');
    return `<div class="hr ${i===0?'now-h':''}"><div class="tm">${i===0?'Now':fmtH(h.time)}</div><div class="e">${w.e}</div><b>${T(h.temp)}°</b><div class="p">💧 ${h.pop}%</div><i style="background:${col(s)}" title="${lab(s)}"></i></div>`}).join('');
  // temp line chart
  const H=S.H,W=960,Ht=170,pad=26,ts=H.map(h=>h.temp),mn=Math.min(...ts)-1,mx=Math.max(...ts)+1;
  const x=i=>pad+i*(W-2*pad)/(H.length-1),y=v=>Ht-26-(v-mn)/(mx-mn)*(Ht-60);
  let g=`<g>`;
  H.forEach((h,i)=>{const bh=h.pop*.5;g+=`<rect x="${x(i)-9}" y="${Ht-26-bh}" width="18" height="${bh}" rx="3" fill="#6cb8ff" opacity=".35"/>`;if(i%3===0)g+=`<text x="${x(i)}" y="${Ht-8}" text-anchor="middle">${i===0?'Now':fmtH(h.time)}</text>`});
  g+=`<polyline fill="none" stroke="#ffd02b" stroke-width="3" stroke-linejoin="round" points="${H.map((h,i)=>x(i)+','+y(h.temp)).join(' ')}"/>`;
  [0,ts.indexOf(Math.max(...ts)),ts.indexOf(Math.min(...ts))].forEach(i=>g+=`<circle cx="${x(i)}" cy="${y(ts[i])}" r="5" fill="#ffd02b"/><text x="${x(i)}" y="${y(ts[i])-10}" text-anchor="middle" style="fill:var(--txt);font-weight:600">${T(ts[i])}°</text>`);
  $('#chart').innerHTML=g+'</g>';
}
function activities(){
  const A=[['🏃','Running','run'],['🚴','Cycling','cycle'],['🚶','Walking','walk'],['🧘','Outdoor yoga','yoga']];
  $('#acts').innerHTML=A.map(a=>{const b=bestWindow(a[2]);if(!b)return'';return `<div class="act"><span style="font-size:24px">${a[0]}</span><span class="n">${a[1]}</span><span class="tag ${lab(b.s)}">${lab(b.s)}</span><span class="sp mut">Best: ${fmtH(b.start)} – ${fmtH(b.end)}</span><button data-add="${a[1]}|${b.start.toISOString()}|run">+ Add to my day</button></div>`}).join('');
}
function week(){
  const d=S.wx.daily;
  $('#days').innerHTML=d.time.map((t,i)=>{const w=wc(d.weather_code[i]);return `<div class="hr"><div class="tm">${i===0?'Today':new Date(t).toLocaleDateString([], {weekday:'short'})}</div><div class="e">${w.e}</div><b>${T(d.temperature_2m_max[i])}°</b><div class="mut" style="font-size:13px">${T(d.temperature_2m_min[i])}°</div><div class="p">💧 ${d.precipitation_probability_max[i]}%</div></div>`}).join('');
}

/* ---------- planner / fit-watch ---------- */
const todayKey=()=>new Date().toISOString().slice(0,10);
let tasks=store.get('tasks',[]);
let fit=store.get('fit',{});if(fit.d!==todayKey())fit={d:todayKey(),water:0,food:[]};fit.food=fit.food||[];
const saveT=()=>store.set('tasks',tasks),saveF=()=>store.set('fit',fit);
const pad2=n=>String(n).padStart(2,'0');
const toLocalInput=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const isToday=t=>new Date(t.time).toDateString()===new Date().toDateString();

function suggestions(){
  const out=[],run=bestWindow('run'),walk=bestWindow('walk',1),yoga=bestWindow('yoga');
  const ok=b=>b&&b.s>=45;
  out.push(ok(run)?['🏃','Run or workout',run.start,`${fmtH(run.start)}–${fmtH(run.end)} · ${lab(run.s)} conditions`,'run']:['🏋️','Indoor workout',new Date(Date.now()+36e5),'Outdoor air or weather is poor today','in']);
  if(ok(walk))out.push(['🚶','Walk',walk.start,`${fmtH(walk.start)} · ${lab(walk.s)} conditions`,'out']);
  if(ok(yoga))out.push(['🧘','Yoga / stretching',yoga.start,`${fmtH(yoga.start)}–${fmtH(yoga.end)}`,'out']);
  const uv=S.H.reduce((a,h)=>h.uv>a.uv?h:a,S.H[0]);
  if(uv.uv>=6)out.push(['🧴','Apply sunscreen',new Date(uv.time.getTime()-36e5),`UV peaks at ${Math.round(uv.uv)} around ${fmtH(uv.time)}`,'out']);
  const hot=S.H.reduce((a,h)=>h.feels>a.feels?h:a,S.H[0]);
  if(hot.feels>=32)out.push(['💧','Drink water',new Date(hot.time.getTime()-36e5),`Hottest around ${fmtH(hot.time)}`,'in']);
  $('#suggest').innerHTML=out.map((o,i)=>`<div class="task"><span style="font-size:22px">${o[0]}</span><div><b>${o[1]}</b><div class="mut" style="font-size:13px">${o[3]}</div></div><button class="x" data-add="${o[1]}|${o[2].toISOString()}|${o[4]}">+ Add</button></div>`).join('');
}
function risky(t){
  const h=S.H.find(h=>h.time.getHours()===new Date(t.time).getHours()&&h.time.toDateString()===new Date(t.time).toDateString());
  if(!h||t.type==='in')return '';
  const k=t.type==='run'?'run':'walk',s=score(h,k),why=[];
  if(h.pop>=60)why.push('rain likely');if(h.aqi>150)why.push('unhealthy air');if(h.feels>=36)why.push('very hot');if(h.uv>=8)why.push('high UV');if(h.code>=95)why.push('thunderstorm');
  return s<45?`⚠ ${why.join(', ')||'poor conditions'} at this time`:'';
}
function renderTasks(){
  const list=tasks.filter(isToday).sort((a,b)=>new Date(a.time)-new Date(b.time));
  $('#tasks').innerHTML=list.length?list.map(t=>`<div class="task ${t.done?'done':''}"><input type="checkbox" data-done="${t.id}" ${t.done?'checked':''} aria-label="Done"><div><b>${t.title}</b><div class="mut" style="font-size:13px">${fmtT(new Date(t.time))}${t.remind?` · alarm ${t.remind} min before`:' · alarm at start'}</div><div class="w">${risky(t)}</div></div><button class="x" data-del="${t.id}" aria-label="Delete">✕</button></div>`).join(''):'<p class="mut">No tasks yet. Add one above or tap “+ Add” on a suggestion.</p>';
  const dn=list.filter(t=>t.done).length;
  const mins=list.filter(t=>t.done&&t.type==='run').length*45;
  setRing('#rTasks',list.length?dn/list.length:0);$('#vTasks').textContent=`${dn} / ${list.length}`;
  setRing('#rWater',fit.water/waterGoal());$('#vWater').textContent=`${fit.water} / ${waterGoal()}`;
  setRing('#rMove',mins/60);$('#vMove').textContent=`${mins} min`;
  renderWatch();
}
const setRing=(s,p)=>$(s).style.strokeDashoffset=251.3*(1-Math.min(1,p));
function addTask(title,time,type,remind=0){
  if(!title){toast('Enter a task name first.');return}
  let d=new Date(time);if(isNaN(d)){toast('Choose a date and time.');return}
  if(d<new Date())d=new Date(Date.now()+2*6e4);
  tasks.push({id:Date.now()+Math.random(),title,time:d.toISOString(),type,remind:+remind,fired:false,done:false});
  saveT();renderTasks();toast(`Scheduled “${title}” for ${fmtT(d)}`);
}

/* ---------- alarms & notifications ---------- */
let ac=null,alarmTimer=null,current=null;
function unlockAudio(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();ac.resume()}catch{}}
function beep(){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=880;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(.25,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.35);o.start();o.stop(ac.currentTime+.4)}
function startAlarm(){stopAlarm();beep();alarmTimer=setInterval(()=>{beep();setTimeout(beep,450)},1500)}
function stopAlarm(){clearInterval(alarmTimer);alarmTimer=null}
function notify(title,body){
  logNotif(title,body);
  if('Notification' in window&&Notification.permission==='granted'){try{new Notification(title,{body})}catch{}}
  toast(`<b>${title}</b><br>${body}`);
}
function ring(t){
  current=t;
  const warn=risky(t);
  $('#mTitle').textContent=t.title;
  $('#mBody').textContent=(t.remind?`Starts at ${fmtT(new Date(t.time))}. `:'It is time. ')+(warn?warn:'');
  $('#modal').classList.add('show');startAlarm();
  notify('⏰ '+t.title,(t.remind?`Starts at ${fmtT(new Date(t.time))}`:'It is time to start'));
}
function checkTasks(){
  const now=Date.now();
  for(const t of tasks){
    if(t.fired||t.done)continue;
    if(now>=new Date(t.time).getTime()-t.remind*6e4){t.fired=true;saveT();ring(t);break}
  }
}
function closeModal(){$('#modal').classList.remove('show');stopAlarm()}
$('#mClose').onclick=closeModal;
$('#mDone').onclick=()=>{if(current){current.done=true;saveT();renderTasks()}closeModal()};
$('#mSnooze').onclick=()=>{if(current){current.time=new Date(Date.now()+5*6e4).toISOString();current.remind=0;current.fired=false;saveT();renderTasks();toast('Snoozed for 5 minutes')}closeModal()};

function notifyRisks(R){
  const sent=store.get('sentRisks',{});let ch=false;
  for(const r of R){
    if(r.lv==='med')continue;
    const k=todayKey()+r.key+S.name;
    if(!sent[k]){sent[k]=1;ch=true;notify(`${r.e} ${r.t}`,r.d)}
  }
  if(ch)store.set('sentRisks',sent);
}
$('#enableAlerts').onclick=async()=>{
  unlockAudio();beep();
  if(!('Notification' in window)){toast('This browser does not support notifications. In-page alerts still work.');return}
  const p=await Notification.requestPermission();
  toast(p==='granted'?'Alerts are on. You will get risk warnings and task alarms.':'Notifications are blocked. Allow them in the site settings; in-page alarms still work.');
};
function toast(html){const d=document.createElement('div');d.className='toast';d.innerHTML=html;$('#toasts').append(d);setTimeout(()=>d.remove(),7000)}

/* ---------- drawer (left edge) ---------- */
const dr=$('#drawer');let pin=false,closeT;
const open=()=>{clearTimeout(closeT);dr.classList.add('open')},shut=()=>{closeT=setTimeout(()=>{if(!pin)dr.classList.remove('open')},350)};
$('#edge').addEventListener('mouseenter',open);
dr.addEventListener('mouseenter',open);dr.addEventListener('mouseleave',shut);
$('#handle').onclick=()=>{pin=true;open()};
$('#closeDrawer').onclick=()=>{pin=false;dr.classList.remove('open')};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){pin=false;dr.classList.remove('open')}});
$('#planDate').textContent=new Date().toLocaleDateString([], {weekday:'long',day:'numeric',month:'long'});
$('#tTime').value=toLocalInput(new Date(Date.now()+30*6e4));
$('#tAdd').onclick=()=>{addTask($('#tTitle').value.trim(),$('#tTime').value,$('#tType').value,$('#tRemind').value);$('#tTitle').value=''};
$('#addWater').onclick=()=>{fit.water=Math.min(30,fit.water+1);saveF();renderTasks()};
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-add]');
  if(a){const[t,time,type]=a.dataset.add.split('|');unlockAudio();addTask(t,time,type,10);if(!dr.classList.contains('open')){pin=true;open()}}
  const d=e.target.closest('[data-del]');if(d){tasks=tasks.filter(t=>t.id!=d.dataset.del);saveT();renderTasks()}
});
document.addEventListener('change',e=>{const c=e.target.closest('[data-done]');if(c){const t=tasks.find(t=>t.id==c.dataset.done);t.done=c.checked;saveT();renderTasks()}});

/* ---------- map ---------- */
let map,marker,base,overlay,radar=null,mode='radar',frames=[],fi=0,timer=null;
const BASE_OSM=()=>L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'});
const BASE_IMG=()=>L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Imagery © Esri'});
async function initMap(){
  map=L.map('map',{zoomControl:true,scrollWheelZoom:true,minZoom:2}).setView([S.lat,S.lon],6);
  base=BASE_OSM().addTo(map);
  marker=L.marker([S.lat,S.lon]).addTo(map);
  try{const j=await fetch('https://api.rainviewer.com/public/weather-maps.json').then(r=>r.json());
    radar={host:j.host,radar:[...j.radar.past,...(j.radar.nowcast||[])],sat:j.satellite?.infrared||[]}}catch{radar=null}
  setMode('radar');
}
function setMode(m){
  mode=m;stopPlay();$$('.maptools [data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  if(overlay){map.removeLayer(overlay);overlay=null}
  map.removeLayer(base);base=(m==='img'?BASE_IMG():BASE_OSM()).addTo(map);base.bringToBack();
  if(m==='img'){frames=[];$('#mapTs').textContent='Satellite imagery';return}
  frames=radar?(m==='radar'?radar.radar:radar.sat):[];
  if(!frames.length){$('#mapTs').textContent='Live overlay unavailable right now';$('#mapNote').textContent='The base map works. The live radar service did not respond, so try again later.';return}
  fi=m==='radar'?Math.max(0,radar.radar.findIndex(f=>f===radar.radar.filter(x=>x.time*1000<=Date.now()).pop())):frames.length-1;
  showFrame(fi);
}
function showFrame(i){
  fi=i;const f=frames[i];if(!f)return;
  const url=`${radar.host}${f.path}/256/{z}/{x}/{y}/${mode==='radar'?'2/1_1':'0/0_0'}.png`;
  const n=L.tileLayer(url,{opacity:.75,maxNativeZoom:7,maxZoom:18,zIndex:5}).addTo(map);
  if(overlay)setTimeout(o=>map.removeLayer(o),250,overlay);overlay=n;
  const d=new Date(f.time*1000);$('#mapTs').textContent=(d>new Date()?'Forecast ':'Observed ')+fmtT(d);
}
function stopPlay(){clearInterval(timer);timer=null;$('#play').textContent='▶ Play'}
$('#play').onclick=()=>{if(timer)return stopPlay();if(!frames.length)return;$('#play').textContent='⏸ Pause';timer=setInterval(()=>showFrame((fi+1)%frames.length),700)};
$$('.maptools [data-m]').forEach(b=>b.onclick=()=>setMode(b.dataset.m));
$('#mapFull').onclick=()=>{const b=$('#mapbox');b.classList.toggle('full');$('#mapFull').textContent=b.classList.contains('full')?'✕ Exit full screen':'⛶ Full screen';setTimeout(()=>map.invalidateSize(),100)};
$('#mapHome').onclick=()=>map.setView([S.lat,S.lon],8);
function drawMapMarker(){if(!map)return;marker.setLatLng([S.lat,S.lon]).bindPopup(`<b>${S.name}</b><br>${wc(S.wx.current.weather_code).t}, ${T(S.wx.current.temperature_2m)}${U()}`);map.setView([S.lat,S.lon],map.getZoom())}

/* ---------- search / controls ---------- */
let st;
$('#q').addEventListener('input',e=>{
  clearTimeout(st);const v=e.target.value.trim();if(v.length<2){$('#results').style.display='none';return}
  st=setTimeout(async()=>{
    try{const j=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(v)}&count=5`).then(r=>r.json());
      const R=$('#results');R.innerHTML=(j.results||[]).map(p=>`<div data-lat="${p.latitude}" data-lon="${p.longitude}" data-n="${[p.name,p.admin1,p.country].filter(Boolean).join(', ')}">${p.name}, <span class="mut">${[p.admin1,p.country].filter(Boolean).join(', ')}</span></div>`).join('')||'<div class="mut">No matches</div>';R.style.display='block'}catch{}
  },300);
});
$('#results').addEventListener('click',e=>{const d=e.target.closest('[data-lat]');if(!d)return;S.lat=+d.dataset.lat;S.lon=+d.dataset.lon;S.name=d.dataset.n;$('#results').style.display='none';$('#q').value='';load()});
$('#geo').onclick=()=>{
  if(!navigator.geolocation)return toast('Location is not supported in this browser.');
  navigator.geolocation.getCurrentPosition(async p=>{
    S.lat=p.coords.latitude;S.lon=p.coords.longitude;S.name='Your location';
    try{const j=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${S.lat}&lon=${S.lon}`).then(r=>r.json());const a=j.address||{};S.name=[a.city||a.town||a.village||a.county,a.state].filter(Boolean).join(', ')||'Your location'}catch{}
    load();
  },()=>toast('Location access was denied. Search for a place instead.'));
};
$('#unit').textContent='°'+S.unit;
$('#unit').onclick=()=>{S.unit=S.unit==='C'?'F':'C';store.set('unit',S.unit);$('#unit').textContent='°'+S.unit;if(S.wx){renderAll();renderTasks()}};
$('#theme').value=store.get('theme','dark');document.documentElement.dataset.theme=$('#theme').value;
$('#theme').onchange=e=>{document.documentElement.dataset.theme=e.target.value;store.set('theme',e.target.value)};
const tick=()=>$('#clock').textContent=new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
tick();setInterval(tick,30000);
document.addEventListener('click',unlockAudio,{once:true});
$$('nav a').forEach(a=>a.addEventListener('click',()=>{$$('nav a').forEach(x=>x.classList.remove('on'));a.classList.add('on')}));

/* =====================================================
   v2 FEATURES: notification centre, report download,
   fit-watch themes, diet planner & food log
   ===================================================== */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- notification centre (bell) ---------- */
let notifLog=store.get('notifLog',[]);
function logNotif(title,body){
  notifLog.unshift({t:Date.now(),title,body,read:false});
  notifLog=notifLog.slice(0,30);store.set('notifLog',notifLog);renderBell();
}
function glance(){
  const H=S.H,c=S.wx.current,f=c.apparent_temperature,out=[];
  const pop=Math.max(...H.map(h=>h.pop)),uv=Math.max(...H.map(h=>h.uv)),aqi=Math.max(...H.map(h=>h.aqi));
  out.push(pop>=50?['☔','Carry an umbrella',`${pop}% chance of rain in the next 24 hours`]:['🌤','No umbrella needed',`Only ${pop}% chance of rain`]);
  out.push(['👕',f>=30?'Wear light cotton clothes':f>=20?'A T-shirt is fine':f>=12?'Wear a light jacket':'Wear a warm jacket',`Feels like ${T(f)}${U()} right now`]);
  out.push(aqi>150?['😷','Wear a mask outside',`Air is unhealthy (AQI up to ${aqi})`]:aqi>100?['😷','Sensitive people: take care',`AQI up to ${aqi}`]:['🌿','Air is fine',`AQI up to ${aqi}`]);
  if(uv>=6)out.push(['🧴','Use sunscreen',`UV index up to ${Math.round(uv)}`]);
  const run=bestWindow('run');
  out.push(run&&run.s>=45?['🏃','Best time to exercise',`${fmtH(run.start)} – ${fmtH(run.end)}`]:['🏋️','Exercise indoors today','Outdoor conditions are poor']);
  out.push(['💧','Water goal today',`${waterGoal()} glasses`]);
  return out;
}
function renderBell(){
  const un=notifLog.filter(n=>!n.read).length,b=$('#badge');
  b.textContent=un>9?'9+':un;b.style.display=un?'flex':'none';
  const R=S.H.length?risks():[];
  $('#bell').classList.toggle('alerting',R.some(r=>r.lv!=='med'));
  if(S.wx&&!$('#notifPanel').hidden)renderNotifPanel(R);
}
function renderNotifPanel(R){
  const g=glance().map(x=>`<div class="gl"><span class="e">${x[0]}</span><div><b>${x[1]}</b><div class="mut">${x[2]}</div></div></div>`).join('');
  const al=R.length?R.map(r=>`<div class="gl al ${r.lv}"><span class="e">${r.e}</span><div><b>${r.t}</b><div class="mut">${r.d}</div></div></div>`).join(''):'<div class="mut" style="padding:6px 0">No weather alerts right now.</div>';
  const hist=notifLog.slice(0,8).map(n=>`<div class="gl ${n.read?'':'unread'}"><div><b>${n.title}</b><div class="mut">${n.body}</div><div class="mut" style="font-size:11px">${new Date(n.t).toLocaleString([], {day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</div></div></div>`).join('')||'<div class="mut" style="padding:6px 0">Nothing yet.</div>';
  $('#notifPanel').innerHTML=`<h4>Today at a glance</h4>${g}<h4>Weather alerts</h4>${al}<h4>Recent notifications</h4>${hist}<div class="bar" style="margin-top:12px"><button id="npRead">Mark all read</button><button id="npClear">Clear</button><button id="npOn" class="pri">Turn on alerts</button></div>`;
  $('#npRead').onclick=()=>{notifLog.forEach(n=>n.read=true);store.set('notifLog',notifLog);renderBell();renderNotifPanel(R)};
  $('#npClear').onclick=()=>{notifLog=[];store.set('notifLog',notifLog);renderBell();renderNotifPanel(R)};
  $('#npOn').onclick=()=>$('#enableAlerts').click();
}
$('#bell').onclick=e=>{
  e.stopPropagation();$('#dlMenu').hidden=true;
  const p=$('#notifPanel');p.hidden=!p.hidden;
  if(!p.hidden&&S.wx){renderNotifPanel(risks());setTimeout(()=>{notifLog.forEach(n=>n.read=true);store.set('notifLog',notifLog);const b=$('#badge');b.style.display='none'},1500)}
};
$('#notifPanel').onclick=e=>e.stopPropagation();

/* ---------- download whole-day report ---------- */
function dayRows(){
  const h=S.wx.hourly,day=S.wx.current.time.slice(0,10),rows=[];
  h.time.forEach((t,i)=>{
    if(t.slice(0,10)!==day)return;
    const ai=S.aq?.hourly?S.aq.hourly.time.indexOf(t):-1;
    const o={time:new Date(t),feels:h.apparent_temperature[i],temp:h.temperature_2m[i],pop:h.precipitation_probability[i]||0,code:h.weather_code[i],wind:h.wind_speed_10m[i],uv:h.uv_index[i]||0,day:!!h.is_day[i],aqi:ai>=0?(S.aq.hourly.us_aqi[ai]||0):0};
    o.s=score(o,'walk');rows.push(o);
  });
  return rows;
}
function saveFile(name,text,type){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}
function reportHTML(){
  const d=S.wx.daily,c=S.wx.current,R=risks(),rows=dayRows(),tg=dietTargets();
  const tl=tasks.filter(isToday).sort((a,b)=>new Date(a.time)-new Date(b.time));
  const sr=new Date(d.sunrise[0]),ss=new Date(d.sunset[0]);
  const day=new Date(c.time).toLocaleDateString([], {weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const trs=rows.map(r=>{const w=wc(r.code,r.day);return `<tr><td>${fmtT(r.time)}</td><td>${w.e} ${w.t}</td><td>${T(r.temp)}${U()}</td><td>${T(r.feels)}${U()}</td><td>${r.pop}%</td><td>${Math.round(r.wind)}</td><td>${Math.round(r.uv)}</td><td>${Math.round(r.aqi)}</td><td class="${lab(r.s)}">${lab(r.s)}</td></tr>`}).join('');
  const acts=[['Running','run',2],['Cycling','cycle',2],['Walking','walk',1],['Yoga','yoga',2]].map(a=>{const b=bestWindow(a[1],a[2]);return b?`<li>${a[0]}: ${fmtH(b.start)} – ${fmtH(b.end)} (${lab(b.s)})</li>`:''}).join('');
  const eaten=fit.food.reduce((s,x)=>({k:s.k+x.k*x.q,p:s.p+x.p*x.q,f:s.f+x.f*x.q}),{k:0,p:0,f:0});
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Day report - ${esc(S.name)}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:30px auto;padding:0 20px;color:#14183a}h1{margin:0}h2{margin:26px 0 8px;border-bottom:2px solid #ffd02b;padding-bottom:4px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #d3daf0;padding:6px 8px;text-align:left}th{background:#eef2fb}.Good{background:#d8f5df}.Fair{background:#fff3c4}.Poor{background:#ffd9d9}.r{padding:8px 12px;margin:6px 0;border-left:5px solid #e8383d;background:#fff0f0}.m{color:#5a628f}@media print{body{margin:0}}</style></head><body>
<h1>🌦 Day weather report</h1><p class="m">${esc(S.name)} · ${day}</p>
<h2>Summary</h2><p>${esc($('#summary').textContent)}</p>
<p>Now: ${wc(c.weather_code,!!c.is_day).t}, ${T(c.temperature_2m)}${U()} (feels ${T(c.apparent_temperature)}${U()}). High ${T(d.temperature_2m_max[0])}${U()}, low ${T(d.temperature_2m_min[0])}${U()}. Sunrise ${fmtT(sr)}, sunset ${fmtT(ss)}.</p>
<h2>Risks</h2>${R.length?R.map(r=>`<div class="r"><b>${r.e} ${r.t}</b><br>${r.d}</div>`).join(''):'<p>No major risks.</p>'}
<h2>Best times for activities</h2><ul>${acts}</ul>
<h2>Hour by hour</h2><table><tr><th>Time</th><th>Weather</th><th>Temp</th><th>Feels</th><th>Rain</th><th>Wind km/h</th><th>UV</th><th>AQI</th><th>Outdoors</th></tr>${trs}</table>
<h2>My plan for today</h2>${tl.length?'<ul>'+tl.map(t=>`<li>${fmtT(new Date(t.time))} – ${esc(t.title)} ${t.done?'(done)':''}</li>`).join('')+'</ul>':'<p>No tasks scheduled.</p>'}
${tg?`<h2>Nutrition targets</h2><p>${tg.kcal} kcal · protein ${tg.p} g · fibre ${tg.fi} g · carbs ${tg.c} g · fat ${tg.fa} g · water ${(tg.water/1000).toFixed(1)} L</p><p>Logged so far: ${Math.round(eaten.k)} kcal, protein ${Math.round(eaten.p)} g, fibre ${Math.round(eaten.f)} g.</p>`:''}
<p class="m" style="margin-top:30px;font-size:12px">Data: Open-Meteo. Generated ${new Date().toLocaleString()}. Tip: press Ctrl+P to save this page as PDF.</p></body></html>`;
}
function reportCSV(){
  const q=v=>`"${String(v).replace(/"/g,'""')}"`,L=[['Time','Weather','Temp '+U(),'Feels '+U(),'Rain %','Wind km/h','UV','AQI','Outdoors'].map(q).join(',')];
  dayRows().forEach(r=>L.push([fmtT(r.time),wc(r.code,r.day).t,T(r.temp),T(r.feels),r.pop,Math.round(r.wind),Math.round(r.uv),Math.round(r.aqi),lab(r.s)].map(q).join(',')));
  return L.join('\r\n');
}
$('#dl').onclick=e=>{e.stopPropagation();$('#notifPanel').hidden=true;$('#dlMenu').hidden=!$('#dlMenu').hidden};
$('#dlMenu').onclick=e=>{
  const b=e.target.closest('[data-dl]');if(!b)return;
  if(!S.wx)return toast('Weather is still loading. Try again in a moment.');
  const nm=S.name.replace(/[^a-z0-9]+/gi,'_')+'_'+todayKey();
  if(b.dataset.dl==='html')saveFile(`weather_report_${nm}.html`,reportHTML(),'text/html');
  else saveFile(`weather_hourly_${nm}.csv`,'\ufeff'+reportCSV(),'text/csv');
  $('#dlMenu').hidden=true;toast('Report downloaded. Check your Downloads folder.');
};
document.addEventListener('click',()=>{$('#notifPanel').hidden=true;$('#dlMenu').hidden=true});

/* ---------- drawer tabs ---------- */
$$('.tabs button').forEach(b=>b.onclick=()=>{
  $$('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
  $$('.pane').forEach(p=>p.hidden=p.id!==b.dataset.p);
});

/* ---------- diet planner ---------- */
const FOODS=[ // name, kcal, protein g, fibre g, carbs g, fat g, nonveg?
['Oats, 1 bowl (40 g dry)',150,5,4,27,3],['Roti, 1 medium',100,3,2.5,18,2],['Brown rice, 1 cup cooked',215,5,3.5,45,1.7],
['Moong dal, 1 katori',105,7,5,18,.5],['Chana (chickpeas), 1 katori',245,13,11,41,4],['Rajma, 1 katori',210,13,9,37,1],
['Paneer, 100 g',265,18,0,1.2,20],['Curd, 1 cup',120,7,0,9,6],['Milk, 1 glass (250 ml)',150,8,0,12,8],
['Soya chunks, 30 g dry',100,15,4,10,.5],['Sprouts salad, 1 cup',100,7,5,18,.7],['Mixed veg curry, 1 cup',120,3,4,14,6],
['Spinach sabzi, 1 cup',70,4,4,8,3],['Banana, 1',105,1.3,3,27,.4],['Apple, 1',95,.5,4.4,25,.3],
['Almonds, 10',70,2.6,1.6,2.6,6],['Peanuts, 30 g',170,7.7,2.4,4.7,14],['Salad (cucumber, tomato), 1 bowl',35,1.5,2,7,.3],
['Egg, boiled, 1',78,6,0,.6,5,1],['Chicken breast, 100 g cooked',165,31,0,0,3.6,1],['Fish, 100 g cooked',140,20,0,0,6,1]
];
const IDEAS={
  v:{b:['Oats with milk, banana and almonds','Moong dal chilla with curd','Vegetable poha with peanuts','Paneer sandwich on brown bread'],
     l:['2 rotis, dal, mixed veg and salad','Rajma or chana with brown rice and curd','Paneer bhurji, roti and sprouts salad','Soya chunk pulao with raita'],
     s:['Fruit and a handful of nuts','Roasted chana','Sprouts chaat','Buttermilk and a banana'],
     d:['Roti, moong dal and spinach sabzi','Veg soup with paneer tikka','Dal khichdi with curd and salad','Chana curry with 1 roti and salad']},
  n:{b:['2 boiled eggs with toast and fruit','Vegetable omelette with 1 roti','Oats with milk and banana','Egg bhurji with whole-wheat toast'],
     l:['Grilled chicken, 2 rotis, dal and salad','Fish curry with brown rice and veg','Chicken curry (light oil) with roti and salad','Egg curry, rice and a veg side'],
     s:['Boiled egg and a fruit','Roasted chana','Curd with nuts','Sprouts chaat'],
     d:['Grilled chicken or fish with sauteed veg','Chicken soup with 1 roti','Egg curry with roti and salad','Dal, roti and a big salad']}
};
const MEALS=[['🌅 Breakfast',.25,'b'],['🍛 Lunch',.35,'l'],['🍎 Snack',.1,'s'],['🌙 Dinner',.3,'d']];
const ACT_LABEL={1.2:'Little or no exercise',1.375:'Light (1–3 days/week)',1.55:'Moderate (3–5 days/week)',1.725:'Very active (6–7 days/week)'};
function dietTargets(){
  const p=store.get('dietProfile',null);if(!p)return null;
  const bmr=10*p.w+6.25*p.h-5*p.a+(p.s==='m'?5:-161);
  let kcal=bmr*p.act+(p.g==='lose'?-400:p.g==='gain'?350:0);
  kcal=Math.max(p.s==='m'?1500:1200,Math.round(kcal/10)*10);
  const perKg=(p.g==='gain'?2:p.g==='lose'?1.8:1.4)+(p.act>=1.55?.2:0);
  const protein=Math.round(p.w*perKg),fat=Math.round(kcal*.27/9),carbs=Math.max(0,Math.round((kcal-protein*4-fat*9)/4));
  const hot=S.H.length?Math.max(...S.H.map(h=>h.feels)):0,extra=hot>=38?800:hot>=32?500:0;
  const bmi=p.w/Math.pow(p.h/100,2);
  return{kcal,p:protein,fa:fat,c:carbs,fi:Math.max(25,Math.round(kcal/1000*14)),water:Math.round((p.w*35+extra)/50)*50,extra,bmi,prof:p};
}
const waterGoal=()=>{const t=dietTargets();return t?Math.max(6,Math.ceil(t.water/250)):8};
function foodsAllowed(){const p=store.get('dietProfile',null);return FOODS.filter(f=>!f[6]||(p&&p.t==='n'))}
function eatenTotals(){return fit.food.reduce((s,x)=>({k:s.k+x.k*x.q,p:s.p+x.p*x.q,f:s.f+x.f*x.q,c:s.c+x.c*x.q,fa:s.fa+x.fa*x.q}),{k:0,p:0,f:0,c:0,fa:0})}
function bmiLabel(b){return b<18.5?'Underweight range':b<25?'Healthy range':b<30?'Overweight range':'Higher range'}
function renderDiet(){
  const p=store.get('dietProfile',null),t=dietTargets();
  if(p){$('#dW').value=p.w;$('#dH').value=p.h;$('#dA').value=p.a;$('#dS').value=p.s;$('#dAct').value=p.act;$('#dG').value=p.g;$('#dT').value=p.t}
  const sel=$('#fSel');if(!sel.options.length)sel.innerHTML=foodsAllowed().map((f,i)=>`<option value="${FOODS.indexOf(f)}">${f[0]} · ${f[1]} kcal</option>`).join('');
  else{const cur=sel.value;sel.innerHTML=foodsAllowed().map(f=>`<option value="${FOODS.indexOf(f)}">${f[0]} · ${f[1]} kcal</option>`).join('');sel.value=cur}
  if(!t){$('#dRes').innerHTML='<p class="mut">Enter your details and press Calculate to get daily targets.</p>';$('#dMeals').innerHTML='';$('#fBars').innerHTML='';renderFoodLog();return}
  const wx=[];
  if(t.extra)wx.push(`It is hot today, so your water goal is +${t.extra} ml. Add curd, buttermilk, cucumber or coconut water.`);
  if(S.H.length&&Math.min(...S.H.map(h=>h.feels))<=10)wx.push('It is cold today. Warm dal, soups and herbal tea help you stay comfortable.');
  if(S.H.length&&Math.max(...S.H.map(h=>h.aqi))>150)wx.push('Air quality is poor. Eat plenty of fruit and vegetables and keep workouts indoors.');
  $('#dRes').innerHTML=`<div class="tg"><div><b>${t.kcal}</b><span>kcal</span></div><div><b>${t.p} g</b><span>Protein</span></div><div><b>${t.fi} g</b><span>Fibre</span></div><div><b>${t.c} g</b><span>Carbs</span></div><div><b>${t.fa} g</b><span>Fat</span></div><div><b>${(t.water/1000).toFixed(2)} L</b><span>Water</span></div></div>
  <p class="mut" style="font-size:13px">BMI ${t.bmi.toFixed(1)} · ${bmiLabel(t.bmi)}. BMI is only a rough guide. ${t.prof.g==='lose'?'Goal: gentle weight loss (about 0.4 kg per week).':t.prof.g==='gain'?'Goal: gradual weight gain.':'Goal: maintain weight.'}</p>${wx.map(x=>`<p class="tip">💡 ${x}</p>`).join('')}`;
  const type=t.prof.t==='n'?'n':'v';
  $('#dMeals').innerHTML=MEALS.map(m=>`<div class="meal"><b>${m[0]}</b> <span class="mut">~${Math.round(t.kcal*m[1])} kcal · ~${Math.round(t.p*m[1])} g protein</span><ul>${IDEAS[type][m[2]].slice(0,3).map(x=>`<li>${x}</li>`).join('')}</ul></div>`).join('');
  renderFoodLog();
}
function renderFoodLog(){
  const t=dietTargets(),e=eatenTotals();
  $('#fLog').innerHTML=fit.food.length?fit.food.map((x,i)=>`<div class="task"><div><b>${x.n}</b>${x.q!==1?` × ${x.q}`:''}<div class="mut" style="font-size:12px">${Math.round(x.k*x.q)} kcal · ${Math.round(x.p*x.q)} g protein · ${(x.f*x.q).toFixed(1)} g fibre</div></div><button class="x" data-fdel="${i}" aria-label="Remove">✕</button></div>`).join(''):'<p class="mut">Nothing logged yet today.</p>';
  if(!t){return}
  const bar=(n,v,g,u)=>`<div class="pb"><div class="pl"><span>${n}</span><span>${Math.round(v)} / ${g} ${u}</span></div><div class="pt"><i style="width:${Math.min(100,v/g*100)}%;${v>g*1.1?'background:var(--poor)':''}"></i></div></div>`;
  let left='';
  const pl=t.p-e.p,fl=t.fi-e.f;
  const pick=k=>foodsAllowed().filter(f=>f[1]>0).sort((a,b)=>b[k]/b[1]-a[k]/a[1]).slice(0,3).map(f=>f[0].split(',')[0]).join(', ');
  if(pl>10)left+=`<p class="tip">💪 ${Math.round(pl)} g protein left. Good picks: ${pick(2)}.</p>`;
  if(fl>5)left+=`<p class="tip">🌾 ${Math.round(fl)} g fibre left. Good picks: ${pick(3)}.</p>`;
  if(e.k>t.kcal*1.1)left+='<p class="tip">⚠ You have passed your calorie target for today.</p>';
  $('#fBars').innerHTML=bar('Calories',e.k,t.kcal,'kcal')+bar('Protein',e.p,t.p,'g')+bar('Fibre',e.f,t.fi,'g')+bar('Carbs',e.c,t.c,'g')+bar('Fat',e.fa,t.fa,'g')+left;
}
$('#dCalc').onclick=()=>{
  const p={w:+$('#dW').value,h:+$('#dH').value,a:+$('#dA').value,s:$('#dS').value,act:+$('#dAct').value,g:$('#dG').value,t:$('#dT').value};
  if(!(p.w>=30&&p.w<=250&&p.h>=120&&p.h<=230&&p.a>=10&&p.a<=90))return toast('Please enter a valid weight (30–250 kg), height (120–230 cm) and age.');
  if(p.a<18)return toast('This calculator is for adults (18+). Please ask a doctor or dietitian for a plan.');
  store.set('dietProfile',p);fit.water=Math.min(fit.water,40);renderDiet();renderTasks();
  toast('Your daily targets are ready.');
};
$('#fAdd').onclick=()=>{
  const f=FOODS[+$('#fSel').value],q=Math.max(.5,Math.min(10,+$('#fQty').value||1));
  fit.food.push({n:f[0],k:f[1],p:f[2],f:f[3],c:f[4],fa:f[5],q});saveF();renderFoodLog();renderWatch();
};
$('#fLog').addEventListener('click',e=>{const b=e.target.closest('[data-fdel]');if(b){fit.food.splice(+b.dataset.fdel,1);saveF();renderFoodLog();renderWatch()}});

/* ---------- fit watch ---------- */
const WTHEMES=[['classic','Classic','#ffd02b'],['neon','Neon','#ff2bd6'],['sport','Sport','#ff3b30'],['minimal','Minimal','#cccccc'],['forest','Forest','#66bb6a'],['sunset','Sunset','#ff7043']];
let watchTheme=store.get('watchTheme','classic');
$('#wthemes').innerHTML=WTHEMES.map(w=>`<button data-wt="${w[0]}" title="${w[1]}"><i style="background:${w[2]}"></i>${w[1]}</button>`).join('');
$('#wthemes').onclick=e=>{const b=e.target.closest('[data-wt]');if(!b)return;watchTheme=b.dataset.wt;store.set('watchTheme',watchTheme);renderWatch()};
function ringSet(id,r,p){const c=2*Math.PI*r,el=$(id);el.style.strokeDasharray=c;el.style.strokeDashoffset=c*(1-Math.min(1,Math.max(0,p)))}
function renderWatch(){
  const w=$('#watch');w.dataset.wt=watchTheme;
  $$('#wthemes button').forEach(b=>b.classList.toggle('on',b.dataset.wt===watchTheme));
  const now=new Date();
  $('#wTime').textContent=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  $('#wDate').textContent=now.toLocaleDateString([], {weekday:'short',day:'numeric',month:'short'});
  const list=tasks.filter(isToday),mins=list.filter(t=>t.done&&t.type==='run').length*45,t=dietTargets(),e=eatenTotals();
  ringSet('#wr1',44,mins/60);ringSet('#wr2',34,fit.water/waterGoal());ringSet('#wr3',24,t?e.k/t.kcal:0);
  $('#wM').textContent=`${mins} min`;$('#wW').textContent=`${fit.water}/${waterGoal()}`;$('#wC').textContent=t?`${Math.round(e.k)}/${t.kcal}`:'set up';
  if(S.wx){
    const c=S.wx.current;$('#wIcon').textContent=wc(c.weather_code,!!c.is_day).e;$('#wTemp').textContent=T(c.temperature_2m)+'°';
    const R=risks();$('#wRisk').textContent=R.length?`⚠ ${R[0].t}`:'✅ All clear';
  }
}
setInterval(renderWatch,15000);

/* ---------- re-render hooks ---------- */
const _renderAll=renderAll;
renderAll=function(){_renderAll();renderBell();renderDiet();renderWatch()};

/* ---------- start ---------- */
renderTasks();
initMap().then(load);
setInterval(checkTasks,5000);setInterval(load,15*60*1000);