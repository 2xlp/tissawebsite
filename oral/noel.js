/* Mode Noël : neige, guirlande, bonnet, musique */
(function(){
  const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Guirlande
  const L=document.createElement('div');L.className='lights';L.setAttribute('aria-hidden','true');
  const C=['#FF5A6A','#FFD36B','#3DDC97','#6FB7FF'];
  L.innerHTML=Array.from({length:14},(_,i)=>`<i style="--c:${C[i%4]};--d:${(i%4)*.4}s"></i>`).join('');
  document.body.appendChild(L);
  // Bonnet sur le cube + bandeau
  const sc=document.querySelector('[data-id="accueil"] .scene');
  if(sc){sc.style.position='relative';sc.insertAdjacentHTML('beforeend',`<svg class="noel-hat" viewBox="0 0 120 100" aria-hidden="true"><path d="M14 78 C30 30 70 6 104 22 C92 34 86 52 92 78 Z" fill="#D7193A"/><path d="M14 78 C30 30 70 6 104 22 C96 30 90 40 88 52 C70 40 40 50 14 78Z" fill="#FF4058" opacity=".55"/><rect x="6" y="72" width="94" height="20" rx="10" fill="#fff"/><circle cx="106" cy="22" r="12" fill="#fff"/></svg>`);}
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
  const a=new Audio();a.preload='none';a.src='musique.mp3';a.loop=true;a.volume=.45;
  const b=document.createElement('button');b.id='music';b.type='button';
  const lab=()=>{b.innerHTML=`<span class="eq" aria-hidden="true"><b></b><b></b><b></b></span>${a.paused?'Musique':'Couper'}`;b.classList.toggle('on',!a.paused);b.setAttribute('aria-pressed',String(!a.paused))};
  b.addEventListener('click',e=>{e.stopPropagation();if(a.paused)a.play().catch(()=>{b.textContent='Musique indisponible'});else a.pause();lab()});
  a.addEventListener('play',lab);a.addEventListener('pause',lab);
  lab();document.body.appendChild(b);
  // Démarre au premier clic / touche (les navigateurs bloquent la lecture automatique)
  const go=()=>{if(a.paused&&!b.dataset.muted)a.play().catch(()=>{});};
  b.addEventListener('click',()=>{b.dataset.muted=a.paused?'1':''});
  addEventListener('pointerdown',go,{once:true});addEventListener('keydown',go,{once:true});
})();
