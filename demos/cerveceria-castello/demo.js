/* Cervecería Castello */
(function(){
'use strict';
const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const WA='34629052551';

/* ---------- Hora de Madrid y estado ---------- */
function madridNow(){
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',weekday:'short',hour:'2-digit',minute:'2-digit',year:'numeric',month:'2-digit',day:'2-digit',hour12:false}).formatToParts(new Date());
  const g=t=>p.find(x=>x.type===t).value;
  const wd={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[g('weekday')];
  return {wd,h:+g('hour')%24,m:+g('minute'),y:+g('year'),mo:+g('month'),d:+g('day')};
}
const now=madridNow();
(function status(){
  const el=$('#status'),t=$('#statusTxt');
  if(now.wd===1){el.classList.add('closed');t.textContent='Hoy lunes cerramos · mañana desde las 9:00';}
  else if(now.h<9){el.classList.add('closed');t.textContent='Hoy abrimos a las 9:00';}
  else{el.classList.add('open');t.textContent='Abierto hoy desde las 9:00';}
  const row=$(`#hoursTable tr[data-d="${now.wd}"]`);if(row)row.classList.add('today');
  $('#year').textContent=now.y;
})();

/* ---------- Navegación ---------- */
const nav=$('#nav');
addEventListener('scroll',()=>nav.classList.toggle('small',scrollY>40),{passive:true});
const burger=$('#burger'),menu=$('#menu');
function setMenu(o){menu.classList.toggle('open',o);burger.setAttribute('aria-expanded',o);menu.setAttribute('aria-hidden',!o);burger.setAttribute('aria-label',o?'Cerrar menú':'Abrir menú');document.body.style.overflow=o?'hidden':'';}
burger.addEventListener('click',()=>setMenu(!menu.classList.contains('open')));
$$('#menu a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});
const links=$$('.links a');
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){links.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id))}}),{rootMargin:'-45% 0px -50% 0px'});
['cana','pizarra','dia','opiniones','contacto'].forEach(id=>io.observe(document.getElementById(id)));

/* ---------- Hero: cinemagraph de la caña ---------- */
const cine=$('.cine'),cv=$('.cine-video');
if(reduce){cv.removeAttribute('autoplay');cv.pause();}
function reveal(){cine.classList.add('in')}
if(document.readyState==='complete')setTimeout(reveal,250);else addEventListener('load',()=>setTimeout(reveal,250));
setTimeout(reveal,2500);

/* ---------- Ticker ---------- */
const tk=$('#ticker');tk.innerHTML+=tk.innerHTML;

/* ---------- Juego: tira tu caña ---------- */
const game=$('#game'),gBtn=$('#gBtn'),gMsg=$('#gMsg'),gPct=$('#gPct'),gCount=$('#gCount'),gPerf=$('#gPerfect'),gAgain=$('#gAgain');
let T=0,raf=0,last=0,holding=false,done=false,count=0,perfect=0;
function draw(){
  const f=Math.min(.3,.11*Math.min(T,1)+(T>.86?(T-.86)*.9:0));
  const tv=Math.min(T,1),beer=Math.max(0,tv-f),foam=tv-beer;
  game.style.setProperty('--gb',beer.toFixed(4));game.style.setProperty('--gf',foam.toFixed(4));game.style.setProperty('--lvl',tv.toFixed(4));
  gPct.textContent=Math.min(100,Math.round(T*100))+' %';
}
function loop(t){const dt=Math.min(.05,(t-last)/1000);last=t;T+=dt*(.30+T*.06);draw();if(T>1.04)game.classList.add('over');raf=requestAnimationFrame(loop)}
function down(e){
  if(e)e.preventDefault();
  if(holding)return;
  if(done)reset();
  holding=true;game.classList.add('on');gMsg.textContent='Chorro limpio… con calma…';
  last=performance.now();raf=requestAnimationFrame(loop);
}
function up(){
  if(!holding)return;holding=false;cancelAnimationFrame(raf);game.classList.remove('on');done=true;count++;
  let m;
  if(T<.7)m='Te has quedado corto. Eso es un culín.';
  else if(T<.84)m='Casi. Le falta un dedo para ser caña.';
  else if(T<.93){m='¡Caña perfecta! Dos dedos de espuma, como aquí.';perfect++;}
  else if(T<=1.02)m='Mucha espuma. Aquí la dejaríamos asentar.';
  else m='¡Que se sale! Se te ha desbordado.';
  gMsg.textContent=m;gCount.textContent=count;gPerf.textContent=perfect;gAgain.hidden=false;
}
function reset(){T=0;done=false;game.classList.remove('over');draw();gAgain.hidden=true;gMsg.textContent='Vaso nuevo y helado. Cuando quieras.'}
gBtn.addEventListener('pointerdown',down);
['pointerup','pointerleave','pointercancel'].forEach(ev=>gBtn.addEventListener(ev,up));
gBtn.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat)down(e)});
gBtn.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')up()});
gBtn.addEventListener('contextmenu',e=>e.preventDefault());
gAgain.addEventListener('click',reset);
draw();

/* ---------- Pizarra ---------- */
const CARTA=[
  [ {n:'Patatas bravas',d:'Con su salsa brava, para mojar pan',img: 'bravas',pos:'center 85%'},
    {n:'Croquetas caseras',d:'Cremosas por dentro, crujientes por fuera',img: 'croquetas'},
    {n:'Pincho de tortilla',d:'De patata, jugosa, recién hecha',img: 'tortilla'},
    {n:'Tapa del día',d:'Pregunta en la barra qué sale hoy',img: 'barra',t:'Con tu caña'} ],
  [ {n:'Tosta de solomillo',d:'La que más se nombra en las reseñas',img: 'tosta',t:'La favorita'},
    {n:'Tosta caliente de la casa',d:'Pan tostado, buen relleno y su salsa',img: 'tosta2'},
    {n:'Tostas para compartir',d:'Para pedir unas cuantas y probar de todo',img: 'barra',pos:'center 30%'} ],
  [ {n:'Raciones para el centro',d:'Para la terraza, con amigos y sin prisa',img: 'mesa-tapas'},
    {n:'Croquetas por ración',d:'Media o entera, según el hambre',img: 'croquetas2'},
    {n:'Tortilla de patata entera',d:'Para la mesa, para compartir',img: 'tortilla',pos:'center 40%'} ],
  [ {n:'Café con tostada',d:'Desde las 9:00, de martes a domingo',img: 'desayuno',t:'Desde las 9'},
    {n:'Tostada con tomate y aceite',d:'El desayuno de toda la vida',img: 'cafe',pos:'center 20%'},
    {n:'Pincho de tortilla y café',d:'Para empezar el día en la barra',img: 'tortilla'} ]
];
const list=$('#chalkList'),pol=$('#polaroid'),polImg=$('#polImg'),polCap=$('#polCap');
function showItem(it){
  pol.classList.add('swap');
  setTimeout(()=>{polImg.src='assets/images/'+it.img+'.webp';polImg.style.objectPosition=it.pos||'';polImg.alt=it.n;polCap.textContent=it.n;pol.classList.remove('swap')},200);
}
function showCat(c){
  $$('.bt').forEach(b=>{const on=+b.dataset.c===c;b.classList.toggle('active',on);b.setAttribute('aria-selected',on)});
  list.innerHTML=CARTA[c].map((it,i)=>`<li><button type="button" data-i="${i}"${i===0?' class="on"':''}><b>${it.n}</b><em>${it.d}</em>${it.t?`<span class="tag">${it.t}</span>`:''}</button></li>`).join('');
  $$('button',list).forEach(b=>b.addEventListener('click',()=>{$$('button',list).forEach(x=>x.classList.remove('on'));b.classList.add('on');showItem(CARTA[c][+b.dataset.i])}));
  showItem(CARTA[c][0]);
}
$$('.bt').forEach(b=>b.addEventListener('click',()=>showCat(+b.dataset.c)));
showCat(0);

/* ---------- Un día en Castello ---------- */
const DIA=[
  {h:'9:00',t:'El desayuno',x:'Café, tostada con tomate y la prensa del día. Abrimos a las nueve.',img: 'desayuno',sky:'linear-gradient(180deg,#F7B57A,#FBD9A6 45%,#9CCBE3)',sx:'6%',sy:'30%',moon:0},
  {h:'13:00',t:'El aperitivo',x:'La primera caña del día, bien fría, con su tapa.',img: 'grifo',sky:'linear-gradient(180deg,#3E8FC7,#8CC6E6 60%,#CDE9F5)',sx:'44%',sy:'6%',moon:0},
  {h:'15:00',t:'Comer de tapas',x:'Tostas y raciones al centro para comer sin prisa.',img: 'mesa-tapas',sky:'linear-gradient(180deg,#4A97CC,#9FD0EA 60%,#E3F2F8)',sx:'64%',sy:'10%',moon:0},
  {h:'19:00',t:'La terraza',x:'Cuando baja el sol se llena la terraza amplia de la calle República Dominicana.',img: 'terraza',sky:'linear-gradient(180deg,#5B4A8C,#E0735A 55%,#F7B267)',sx:'86%',sy:'30%',moon:0},
  {h:'22:00',t:'Con los amigos',x:'Ruta de la tapa, cena de raciones o la última caña de la noche.',img: 'brindis',sky:'linear-gradient(180deg,#06182A,#13324C 60%,#2A4F73)',sx:'82%',sy:'8%',moon:1}
];
const range=$('#diaRange'),sky=$('#diaSky'),dA=$('#diaA'),dB=$('#diaB'),sun=$('#diaSun'),ticks=$$('.clock-ticks span');
let front=dA;
function setDia(i){
  const d=DIA[i];
  $('#diaTime').textContent=d.h;$('#diaTitle').textContent=d.t;$('#diaText').textContent=d.x;
  sky.style.setProperty('--sky',d.sky);
  const back=front===dA?dB:dA;back.src='assets/images/'+d.img+'.webp';back.alt=d.t;
  const sw=()=>{back.classList.remove('off');front.classList.add('off');front=back};
  if(back.complete)sw();else back.onload=sw;
  sun.style.setProperty('--sx',d.sx);sun.style.setProperty('--sy',d.sy);sun.classList.toggle('moon',!!d.moon);
  ticks.forEach((t,j)=>t.classList.toggle('on',j===i));
}
range.addEventListener('input',()=>setDia(+range.value));
ticks.forEach((t,j)=>t.addEventListener('click',()=>{range.value=j;setDia(j)}));
setDia(0);

/* ---------- Reserva + posavasos ---------- */
const DN=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],DL=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MN=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const st={pax:4,day:null,hour:'14:00',zone:'Terraza'};
const daysEl=$('#days'),hoursEl=$('#hours');
const base=new Date(Date.UTC(now.y,now.mo-1,now.d));
let dHtml='';
for(let i=0;i<7;i++){
  const dt=new Date(base.getTime()+i*864e5),wd=dt.getUTCDay(),lab=i===0?'Hoy':i===1?'Mañana':DN[wd];
  const full=`${DL[wd]} ${dt.getUTCDate()} de ${MN[dt.getUTCMonth()]}`;
  dHtml+=`<button type="button" class="chip" data-full="${full}"${wd===1?' disabled title="Los lunes cerramos"':''}>${lab}<small>${dt.getUTCDate()} ${MN[dt.getUTCMonth()]}</small></button>`;
}
daysEl.innerHTML=dHtml;
hoursEl.innerHTML=['13:30','14:00','14:30','20:30','21:00','21:30'].map(h=>`<button type="button" class="chip${h===st.hour?' on':''}" data-h="${h}">${h}</button>`).join('');
const coaster=$('#coaster');
function bump(){coaster.classList.remove('bump');void coaster.offsetWidth;coaster.classList.add('bump');clearTimeout(bump.t);bump.t=setTimeout(()=>coaster.classList.remove('bump'),500)}
function paint(){
  $('#pax').textContent=st.pax;$('#cPax').textContent=st.pax;
  $('#cPax').parentNode.lastChild.textContent=st.pax===1?' persona':' personas';
  $('#cDay').textContent=st.day?st.day.replace(/ de \w+$/,''):'—';
  $('#cHour').textContent=st.hour;$('#cZone').textContent=st.zone;
  const n=$('#nm').value.trim();$('#cName').textContent=n?'a nombre de '+n:'a nombre de…';
}
const firstOpen=$$('.chip:not(:disabled)',daysEl)[0];firstOpen.classList.add('on');st.day=firstOpen.dataset.full;
function chipGroup(el,fn){el.addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b||b.disabled)return;$$('.chip',el).forEach(x=>x.classList.remove('on'));b.classList.add('on');fn(b);paint();bump()})}
chipGroup(daysEl,b=>st.day=b.dataset.full);
chipGroup(hoursEl,b=>st.hour=b.dataset.h);
chipGroup($('#zones'),b=>st.zone=b.dataset.z);
$$('.stepper button').forEach(b=>b.addEventListener('click',()=>{st.pax=Math.max(1,Math.min(30,st.pax+ +b.dataset.d));paint();bump()}));
$('#nm').addEventListener('input',paint);
$('#resForm').addEventListener('submit',e=>{
  e.preventDefault();
  const n=$('#nm').value.trim(),err=$('#formErr');
  if(!n){err.textContent='Escribe tu nombre para la reserva.';$('#nm').focus();return}
  err.textContent='';
  const msg=`¡Hola! Quería reservar mesa en Cervecería Castello.\nDía: ${st.day}\nHora: ${st.hour}\nPersonas: ${st.pax}\nZona: ${st.zone}\nNombre: ${n}\n¡Gracias!`;
  window.open('https://wa.me/'+WA+'?text='+encodeURIComponent(msg),'_blank','noopener');
});
paint();

/* ---------- Temas de las reseñas ---------- */
const tp=$('#topics');
new IntersectionObserver((es,o)=>es.forEach(e=>{if(e.isIntersecting){tp.classList.add('seen');o.disconnect()}}),{threshold:.4}).observe(tp);
})();
