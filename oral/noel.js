/* Mode Noël : neige, guirlande, bonnet, musique */
(function(){
  const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Guirlande
  const L=document.createElement('div');L.className='lights';L.setAttribute('aria-hidden','true');
  const C=['#FF5A6A','#FFD36B','#3DDC97','#6FB7FF'];
  L.innerHTML=Array.from({length:14},(_,i)=>`<i style="--c:${C[i%4]};--d:${(i%4)*.4}s"></i>`).join('');
  document.body.appendChild(L);
  // Bandeau
  const k=document.querySelector('[data-id="accueil"] .k');
  if(k)k.insertAdjacentHTML('beforebegin','<div class="noel-ribbon">🎄 Édition de Noël</div>');
  // Neige
  if(!RM){
    const cv=document.createElement('canvas');cv.id='snow';cv.setAttribute('aria-hidden','true');document.body.appendChild(cv);
    const x=cv.getContext('2d');let W,H;const D=Math.min(1.5,devicePixelRatio||1);
    const rs=()=>{W=cv.width=innerWidth*D;H=cv.height=innerHeight*D};rs();addEventListener('resize',rs);
    const N=innerWidth<700?60:130,f=[];
    for(let i=0;i<N;i++)f.push({x:Math.random(),y:Math.random(),r:.6+Math.random()*2.2,s:.02+Math.random()*.05,o:Math.random()*6});
    let t0=performance.now();
    (function loop(t){const dt=Math.min(50,t-t0)/1000;t0=t;x.clearRect(0,0,W,H);x.fillStyle='rgba(255,255,255,.85)';
      for(const p of f){p.y+=p.s*dt;p.o+=dt;if(p.y>1.02){p.y=-.02;p.x=Math.random()}
        x.beginPath();x.arc((p.x+Math.sin(p.o)*.01)*W,p.y*H,p.r*D,0,7);x.fill()}
      requestAnimationFrame(loop)})(t0);
  }
  // Musique : fichier musique.mp3 dans le même dossier
  const a=new Audio();a.preload='none';a.src='musique.mp3?v=suno1';a.loop=true;
  const b=document.createElement('button');b.id='music';b.type='button';
  const lab=()=>{b.innerHTML=`<span class="eq" aria-hidden="true"><b></b><b></b><b></b></span>${a.paused?'Musique':'Couper'}`;b.classList.toggle('on',!a.paused);b.setAttribute('aria-pressed',String(!a.paused))};
  b.addEventListener('click',e=>{e.stopPropagation();if(a.paused)a.play().catch(()=>{b.textContent='Musique indisponible'});else a.pause();lab()});
  a.addEventListener('play',lab);a.addEventListener('pause',lab);
  lab();
  const wrap=document.createElement('div');wrap.id='musicbox';
  const vol=document.createElement('input');vol.type='range';vol.min='0';vol.max='100';vol.id='vol';vol.setAttribute('aria-label','Volume de la musique');
  let v=45;try{const s=localStorage.getItem('tw-oral-vol');if(s!==null)v=+s}catch(e){}
  vol.value=v;a.volume=v/100;vol.style.setProperty('--v',v+'%');
  vol.addEventListener('input',()=>{a.volume=vol.value/100;vol.style.setProperty('--v',vol.value+'%');try{localStorage.setItem('tw-oral-vol',vol.value)}catch(e){}});
  ['pointerdown','click','touchstart'].forEach(t=>wrap.addEventListener(t,e=>e.stopPropagation()));
  vol.addEventListener('keydown',e=>e.stopPropagation());
  wrap.appendChild(vol);wrap.appendChild(b);document.body.appendChild(wrap);
  // Démarre au premier clic / touche (les navigateurs bloquent la lecture automatique)
  const go=(e)=>{if(e&&e.target&&e.target.closest&&e.target.closest('#music'))return;if(a.paused&&!b.dataset.muted)a.play().catch(()=>{});};
  b.addEventListener('click',()=>{b.dataset.muted=a.paused?'1':''});
  const first=(e)=>{if(e.target&&e.target.closest&&e.target.closest('#music'))return;removeEventListener('pointerdown',first);removeEventListener('keydown',first);go(e)};addEventListener('pointerdown',first);addEventListener('keydown',first);
  // Menu « Aller à » : accès direct à n'importe quelle diapo
  const steps=[...document.querySelectorAll('.step')];
  const nm=(s,i)=>(window.TWN&&TWN[i])||(s.dataset.id==='accueil'?'Accueil':((s.querySelector('.k')||{}).textContent||s.dataset.id).trim());
  const nav=document.querySelector('.ctl');
  const mb=document.createElement('button');mb.id='gomenu';mb.type='button';mb.setAttribute('aria-haspopup','true');mb.setAttribute('aria-expanded','false');
  mb.innerHTML='☰ <span>Aller à</span>';
  nav.insertBefore(mb,document.getElementById('pg'));
  const pop=document.createElement('div');pop.id='gopop';pop.hidden=true;pop.setAttribute('role','menu');
  pop.innerHTML='<b>Aller à la diapo</b><div>'+steps.map((s,i)=>`<button type="button" role="menuitem" data-go="${i}"><em>${String(i+1).padStart(2,'0')}</em>${nm(s,i)}</button>`).join('')+'</div>';
  document.body.appendChild(pop);
  const close=()=>{pop.hidden=true;mb.setAttribute('aria-expanded','false')};
  mb.addEventListener('click',e=>{e.stopPropagation();const open=pop.hidden;pop.hidden=!open;mb.setAttribute('aria-expanded',String(open));
    if(open){const c=(parseInt((document.getElementById('pg').textContent||'1'),10)||1)-1;pop.querySelectorAll('button').forEach((x,i)=>x.classList.toggle('cur',i===c));const cb=pop.querySelectorAll('button')[c];if(cb)cb.scrollIntoView({block:'center'});}});
  pop.addEventListener('click',e=>{if(e.target.closest('[data-go]'))setTimeout(close,0)});
  ['pointerdown','touchstart','wheel'].forEach(t=>pop.addEventListener(t,e=>e.stopPropagation(),{passive:true}));
  document.addEventListener('click',e=>{if(!pop.hidden&&!e.target.closest('#gopop,#gomenu'))close()});
  addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
