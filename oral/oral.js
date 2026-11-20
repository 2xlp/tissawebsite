
{
const facts=[["Nom commercial","TissaWeb"],["Associés","Hugo Thirion & Clémence Bolot"],["Forme juridique","Micro-entreprise (×2)"],["Création","20 octobre 2026"],["Siège","Dijon (Côte-d'Or)"],["Code APE","62.01Z"],["Secteur","Logiciel de prospection"],["TVA","Non applicable (293 B)"]];
document.getElementById('facts').innerHTML=facts.map(([k,v])=>`<div class="card" style="padding:14px 18px"><div class="k" style="margin:0 0 4px;font-size:13px">${k}</div><div style="font-size:20px;font-weight:700">${v}</div></div>`).join('');
const adv=[["Déjà prouvé","L'outil tourne déjà pour notre propre prospection."],["Prix imbattable","Peu de charges : dès 49 €/mois et 65 % de marge."],["Fait pour les artisans","Simple et en français, pas pour des équipes commerciales."],["Clé en main","On fait la mise en place : rien à configurer."],["Double expertise","Sites + prospection : on vend les deux en pack."],["RGPD intégré","Source des données, refus respectés, mails pro."]];
const adv2=[["L'IA écrit chaque mail","Personnalisé selon le métier et le site du prospect."],["L'IA lit les réponses","Elle résume, classe et propose un rendez-vous."],["Les données apprennent","Les objets et horaires qui marchent, par métier."],["Délivrabilité au top","Boîtes réchauffées, envois étalés, suivi des spams."],["Écoute des clients","Avis chaque mois, nouveautés chaque trimestre."],["Partenaires locaux","CCI, chambres des métiers et comptables."]];
const tileRow=(a)=>a.map(([t,d],i)=>`<div class="card" style="min-height:178px"><span class="dot" style="margin-bottom:14px">${i+1}</span><h3>${t}</h3><p class="mute">${d}</p></div>`).join('');
document.getElementById('adv').innerHTML=tileRow(adv);
document.getElementById('adv2').innerHTML=tileRow(adv2);

const steps=[...document.querySelectorAll('.step')];
const CH=[['Fichiers prospects (Scrap.io)',390,'formule de base, ~35 $/mois','#45D6F5'],['Base de données Supabase Pro',280,'25 $/mois dès les premiers clients','#3DDC97'],['Marketing : cartes, salons, démos',200,'estimation','#FFC15A'],['Assurance RC Pro',180,'~100 à 250 €/an','#FF8A72'],['IA pour personnaliser les mails',120,'estimation, ~10 €/mois','#B9F26B'],['Mails pro OVH',26,'1,82 € HT/mois/compte','#9FB3FF'],['Noms de domaine',20,'tissaweb.fr + .cloud','#FF6FB5'],['Médiateur de la consommation',10,'~30 € pour 3 ans','#FFFFFF']];
{const tot=CH.reduce((a,c)=>a+c[1],0),R=125,L=2*Math.PI*R;let off=0,i=0,out=`<circle cx="165" cy="165" r="${R}" stroke="rgba(255,255,255,.06)"/>`;
for(const [n,v,,c] of CH){const len=v/tot*L;out+=`<circle class="seg" cx="165" cy="165" r="${R}" stroke="${c}" stroke-dasharray="${Math.max(0,len-3).toFixed(1)} ${L.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" style="--dl:${400+i*120}ms"/>`;off+=len;i++}
document.getElementById('donut').innerHTML=out;
document.getElementById('lines').innerHTML=CH.map(([n,v,d,c])=>`<div><i style="background:${c}"></i><span>${n}<small>${d}</small></span><em>${v} €/an</em></div>`).join('');}
{const h=document.querySelector('.title3d');h.innerHTML=[...h.textContent].map((ch,i)=>`<span style="--i:${i}">${ch}</span>`).join('')}

const names=["Accueil","Sommaire","Notre histoire","Fiche d'identité","Offre et tarifs","L'application","Modèle économique","Facteurs clés de succès","Nos avantages","Nos concurrents","Pourquoi nous","Substitution","Questions du jury","L'équipe","Chiffres","Charges","Scénarios","Chronogramme","Vision 3 · 5 · 10 ans","Longueur d'avance","Merci"];
document.getElementById('tiles').innerHTML=names.slice(2).map((t,i)=>`<button class="card tile" data-go="${i+2}"><b>${String(i+1).padStart(2,'0')}</b>${t}</button>`).join('');

const P=steps.map((_,i)=>({x:Math.round(Math.sin(i*0.75)*2300),y:Math.round(Math.cos(i*1.3)*220),z:-i*2100,ry:+(-Math.sin(i*0.75)*30).toFixed(1)}));
const canvas=document.getElementById('canvas'),root=document.getElementById('root');
const place=(el,x,y,z,extra='')=>el.style.transform=`translate(-50%,-50%) translate3d(${x}px,${y}px,${z}px) ${extra}`;
steps.forEach((el,i)=>{const p=P[i];place(el,p.x,p.y,p.z,`rotateY(${p.ry}deg)`)});
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const NEAR=IOS?1:2;
const LITE=IOS||matchMedia('(pointer:coarse)').matches;let flat=LITE;if(IOS)document.documentElement.classList.add('ios');if(LITE)document.documentElement.classList.add('lite');try{const v=localStorage.getItem('tw3d-flat');if(v!==null)flat=v==='1'}catch(e){}
let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
const bits=[];P.forEach((p,i)=>{for(let k=0;k<(IOS?1:3);k++){const b=document.createElement('div');b.className='bit';const s=(0.4+rnd()*1.2);place(b,p.x+(rnd()-.5)*3200,p.y-200-rnd()*700,p.z-400+(rnd()-.5)*1600,`rotateX(${rnd()*90}deg) rotateY(${rnd()*90}deg) scale(${s})`);b.dataset.i=i;canvas.appendChild(b);bits.push(b)}});

let cur=0,over=false;
const fit=()=>Math.min(innerWidth/1260,(innerHeight-80)/760);
function camera(){
  const f=fit();
  document.body.classList.toggle('flat',flat);
  document.getElementById('mode').textContent=flat?'Mode 3D':'Mode simple';
  document.body.classList.toggle('thumbs',over&&LITE);
  if(over&&LITE){steps.forEach(el=>el.classList.add('far'));bits.forEach(el=>el.classList.add('far'));applyRing();}
  else if(flat&&!over){
    root.style.transform=`scale(${f})`;
    steps.forEach((el,i)=>{el.style.transform='translate(-50%,-50%)';el.classList.toggle('on',i===cur);el.classList.toggle('far',i!==cur)});
    bits.forEach(el=>el.classList.add('far'));
  }else{
    if(over){
      const s=f*0.42;
      root.style.transform=`perspective(${1700/s}px) scale(${s})`;
      steps.forEach((el,i)=>{el.style.transform=`translate(-50%,-50%) rotateY(${i*RSTEP}deg) translateZ(${RR}px)`});
      applyRing();
    }else{
      const p=P[cur];
      root.style.transform=`perspective(${1100/f}px) scale(${f})`;
      canvas.style.transform=`rotateY(${-p.ry}deg) translate3d(${-p.x}px,${-p.y}px,${-p.z}px)`;
    }
    if(!over){
    steps.forEach((el,i)=>{const p=P[i];el.style.transform=`translate(-50%,-50%) translate3d(${p.x}px,${p.y}px,${p.z}px) rotateY(${p.ry}deg)`;el.classList.toggle('on',i===cur);el.classList.toggle('far',Math.abs(i-cur)>NEAR)});
    }
    bits.forEach(el=>el.classList.toggle('far',over||Math.abs(el.dataset.i-cur)>1));
  }
  {const [m]=ACC[ORDER[cur]||'mint'];document.getElementById('view').style.setProperty('--m',m)}
  document.getElementById('gridl').style.backgroundPositionX=`${Math.round(-P[cur].x/6)}px`;
  document.getElementById('pg').textContent=over?'Carrousel':`${cur+1} / ${steps.length}`;
  document.body.classList.toggle('ringm',over);
  document.getElementById('bar').style.width=`${(cur)/(steps.length-1)*100}%`;
}

const RSTEP=360/steps.length,RR=Math.round(1240*steps.length/(2*Math.PI));
let ang=0,front=-1,ringHold=0,drag=null,moved=false;
const tring=document.getElementById('tring'),RT=Math.round(285*steps.length/(2*Math.PI));
let ths=[];function buildThumbs(){if(ths.length)return;tring.innerHTML=steps.map((st,i)=>`<div class="th" data-go="${i}" style="--c:${ACC[ORDER[i]||'mint'][0]};transform:rotateY(${i*RSTEP}deg) translateZ(${RT}px)"><b>${String(i+1).padStart(2,'0')}</b><span>${names[i]}</span></div>`).join('');ths=[...tring.children]}const REL=()=>LITE?tring:canvas;
function applyRing(){if(LITE){buildThumbs();tring.style.transform=`translateZ(${-RT}px) rotateX(-6deg) rotateY(${-ang}deg)`}else canvas.style.transform=`translateY(-430px) translateZ(${-RR}px) rotateX(-7deg) rotateY(${-ang}deg)`;
  const k=((Math.round(ang/RSTEP)%steps.length)+steps.length)%steps.length;
  if(k!==front){front=k;if(LITE)ths.forEach((el,i)=>el.classList.toggle('on',i===k));else steps.forEach((el,i)=>{el.classList.toggle('on',i===k);el.classList.remove('far')});const c=document.getElementById('capt');c.textContent=`${String(k+1).padStart(2,'0')} · ${names[k]}`;c.classList.remove('pop');void c.offsetWidth;c.classList.add('pop')}}
function overview(){
  if(!over){over=true;front=-1;ang=cur*RSTEP;REL().style.transition=LITE?'none':'transform 1.4s cubic-bezier(.65,0,.35,1)';camera();ringHold=performance.now()+1600;setTimeout(()=>{if(over)REL().style.transition='none'},1450)}
  else{const k=front<0?cur:front;canvas.style.transition='';go(k)}}
function snapTo(a){REL().style.transition='transform .6s cubic-bezier(.2,.8,.2,1)';ang=a;applyRing();setTimeout(()=>{if(over&&!drag)REL().style.transition='none'},620);ringHold=performance.now()+3500}
let goLock=0,goPend=null,goT=null,merciT=[];
function go(i){const now=performance.now(),cd=(flat||over)?220:520;if(now<goLock){goPend=i;clearTimeout(goT);goT=setTimeout(()=>{const k=goPend;goPend=null;goLock=0;go(k)},goLock-now);return}goLock=now+cd;merciT.forEach(clearTimeout);merciT=[];canvas.style.transition='';const was=cur;cur=Math.max(0,Math.min(steps.length-1,i));over=false;if(was!==cur)flyFx();if(steps[cur].dataset.id==='merci'&&!RM&&was!==cur)merciT.push(setTimeout(()=>{for(let k=0;k<3;k++)merciT.push(setTimeout(()=>burst(innerWidth*(.25+k*.25),innerHeight*.35,IOS?40:80,['#3DDC97','#45D6F5','#FFC15A','#FF8A72','#B9F26B','#fff'],9),k*250))},1200));if(was!==cur){const st=steps[cur];clearTimeout(cuT);cuT=setTimeout(()=>{if(steps[cur]===st)countUp(st)},flat?100:900)}try{history.replaceState(null,'','#'+steps[cur].dataset.id)}catch(e){}camera()}

document.getElementById('next').onclick=()=>go(cur+1);
document.getElementById('prev').onclick=()=>go(cur-1);
let ovL=0;const thr=f=>()=>{const t=performance.now();if(t<ovL)return;ovL=t+450;f()};
document.getElementById('ov').onclick=thr(overview);
document.getElementById('mode').onclick=thr(()=>{flat=!flat;over=false;try{localStorage.setItem('tw3d-flat',flat?'1':'0')}catch(e){}camera()});
document.getElementById('fs').onclick=()=>{try{const d=document.documentElement;document.fullscreenElement?document.exitFullscreen():(d.requestFullscreen||d.webkitRequestFullscreen).call(d)}catch(e){}};
document.addEventListener('click',e=>{const t=e.target.closest('[data-go]');if(t){e.stopPropagation();if(moved&&over){moved=false;return}go(+t.dataset.go);return}if(moved&&over){moved=false;return}const s=e.target.closest('.step');if(s&&(over||!s.classList.contains('on')))go(steps.indexOf(s))});
addEventListener('keydown',e=>{if(over&&['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();if(e.key==='Enter'||e.key===' ')go(front);else snapTo((Math.round(ang/RSTEP)+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1))*RSTEP);return}if(['ArrowRight','ArrowDown','PageDown',' '].includes(e.key)){e.preventDefault();go(cur+1)}else if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key)){e.preventDefault();go(cur-1)}else if(e.key==='o'||e.key==='O'||e.key==='Escape')thr(overview)();else if(e.key==='Home')go(0)});
const view=document.getElementById('view');
document.getElementById('view');
const ACC={mint:['#3DDC97','#0B7A55'],cyan:['#45D6F5','#0A6E8C'],gold:['#FFC15A','#9A5A06'],coral:['#FF8A72','#A83526'],lime:['#B9F26B','#4A7A10']};
const ORDER=['mint','cyan','mint','cyan','gold','cyan','mint','cyan','lime','coral','gold','cyan','lime','cyan','mint','coral','gold','cyan','lime','coral','mint'];
steps.forEach((st,i)=>{const [m,g]=ACC[ORDER[i]||'mint'];st.style.setProperty('--m',m);st.style.setProperty('--g',g)});
const cv=document.getElementById('stars'),cx=cv.getContext('2d');let W=0,H=0,DPR=Math.min(1.5,devicePixelRatio||1);
function rs(){W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;cx.setTransform(DPR,0,0,DPR,0,0)}rs();addEventListener('resize',rs);
const NS=LITE?45:140,stars=[];const SC=['#ffffff','#dfe9ef','#c9d8e2','#ffffff'];
for(let k=0;k<NS;k++)stars.push({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random(),c:SC[k%4]});
let speed=.03,target=.03,last=performance.now();const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
let odd=false;function frame(t){if(LITE){odd=!odd;if(odd){requestAnimationFrame(frame);return}}const dt=Math.min(.1,(t-last)/1000);last=t;speed+=(target-speed)*Math.min(1,dt*3);
 cx.fillStyle='rgba(3,11,16,'+(speed>.3?.35:1)+')';cx.clearRect(0,0,W,H);
 const f=Math.max(W,H)*.5;
 for(const s of stars){const pz=s.z;s.z-=speed*dt*(RM?0:1);if(s.z<=.02){s.z=1;s.x=Math.random()*2-1;s.y=Math.random()*2-1;continue}
  const sx=W/2+s.x/s.z*f,sy=H*.42+s.y/s.z*f,px=W/2+s.x/pz*f,py=H*.42+s.y/pz*f;if(sx<-50||sx>W+50||sy<-50||sy>H+50){s.z=1;continue}
  const a=Math.min(.55,(1-s.z)*.8);cx.strokeStyle=s.c;cx.globalAlpha=a;cx.lineWidth=Math.max(.5,(1-s.z)*1.6);cx.beginPath();cx.moveTo(px,py);cx.lineTo(sx+.1,sy+.1);cx.stroke()}
 cx.globalAlpha=1;if(over&&(LITE||!flat)&&!drag&&!RM&&t>ringHold){ang+=dt*6;applyRing()}requestAnimationFrame(frame)}
requestAnimationFrame(frame);
const SEL='.k,h1,h2,.card,.art,.tl>div,tbody tr,.qa>div,.intro p,.btn,.scene,table.cmp thead';
steps.forEach(st=>{let k=0;st.querySelectorAll(SEL).forEach(el=>{if(el.closest('.anim'))return;el.classList.add('anim');el.style.setProperty('--d',(k++*70)+'ms')})});
const fmt=new Intl.NumberFormat('fr-FR');
let cuT;function countUp(st){st.querySelectorAll('[data-n]').forEach(el=>{const n=+el.dataset.n,suf=el.dataset.s||'',t0=performance.now(),D=1300,tok=(el._tok=(el._tok||0)+1);const tick=t=>{if(el._tok!==tok)return;const p=Math.min(1,(t-t0)/D),e=1-Math.pow(1-p,3);el.textContent=fmt.format(Math.round(n*e)).replace(/\u202f/g,' ')+suf;if(p<1)requestAnimationFrame(tick)};el.textContent='0'+suf;requestAnimationFrame(tick)})}
const tilt=document.getElementById('tilt');
if(!IOS)view.addEventListener('pointermove',e=>{if(flat||over)return;const x=e.clientX/innerWidth-.5,y=e.clientY/innerHeight-.5;tilt.style.transform=`rotateY(${x*6}deg) rotateX(${-y*4}deg)`});

const fxc=document.getElementById('fx'),fx=fxc.getContext('2d');let parts=[];
function fxSize(){fxc.width=innerWidth*DPR;fxc.height=innerHeight*DPR;fx.setTransform(DPR,0,0,DPR,0,0)}fxSize();addEventListener('resize',fxSize);
function burst(x,y,n,cols,spd){n=Math.min(n,Math.max(0,(IOS?160:350)-parts.length));for(let k=0;k<n;k++){const a=Math.random()*Math.PI*2,v=(spd||5)*(0.4+Math.random());parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(spd?2:0),life:1,c:cols[k%cols.length],s:2+Math.random()*4,g:spd?.12:0})}if(!fxRun){fxRun=true;requestAnimationFrame(fxLoop)}}
let fxRun=false;function fxLoop(){fx.clearRect(0,0,innerWidth,innerHeight);parts=parts.filter(p=>p.life>0);for(const p of parts){p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.vx*=.98;p.life-=.016;fx.globalAlpha=Math.max(0,p.life);fx.fillStyle=p.c;fx.fillRect(p.x,p.y,p.s,p.s)}fx.globalAlpha=1;if(parts.length)requestAnimationFrame(fxLoop);else fxRun=false}
let lastB=0;view.addEventListener('pointerdown',e=>{const t=performance.now();if(t-lastB<120)return;lastB=t;if(!RM)burst(e.clientX,e.clientY,IOS?14:24,[getComputedStyle(steps[cur]).getPropertyValue('--m')||'#3DDC97','#ffffff'],4)});
let flyT;function flyFx(){view.classList.add('fly');target=.5;clearTimeout(flyT);flyT=setTimeout(()=>{view.classList.remove('fly');target=.03},1300)}
let sx=null,sy=null;
view.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;if(over){drag={x:e.clientX,a:ang};moved=false;REL().style.transition='none'}});
view.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>6)moved=true;ang=drag.a-dx*0.12;applyRing()});
const thumbsEl=document.getElementById('thumbs');
thumbsEl.addEventListener('pointerdown',e=>{drag={x:e.clientX,a:ang};moved=false;tring.style.transition='none'});
thumbsEl.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>6)moved=true;ang=drag.a-dx*0.25;applyRing()});
thumbsEl.addEventListener('pointerup',e=>{if(drag){const was=moved;drag=null;if(was)snapTo(Math.round(ang/RSTEP)*RSTEP)}});
view.addEventListener('wheel',e=>{if(!over)return;e.preventDefault();ang+=(e.deltaY+e.deltaX)*0.08;REL().style.transition='none';applyRing();ringHold=performance.now()+2500},{passive:false});
view.addEventListener('pointerup',e=>{if(drag){const was=moved;drag=null;if(was){snapTo(Math.round(ang/RSTEP)*RSTEP);sx=null;return}}if(over){sx=null;return}if(sx===null)return;const dx=e.clientX-sx,dy=e.clientY-sy;sx=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy))go(cur+(dx<0?1:-1))});
addEventListener('resize',camera);
const start=steps.findIndex(s=>'#'+s.dataset.id===location.hash);
cur=start>0?start:0;camera();
addEventListener('hashchange',()=>{const k=steps.findIndex(s=>'#'+s.dataset.id===location.hash);if(k>=0&&k!==cur)go(k)});
}
