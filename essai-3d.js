/* TissaWeb — « Construction en 3D » : le visiteur regarde son site se monter pièce par pièce,
   avec l'explication de chaque étape, puis la caméra plonge dedans.
   TWEssai.cinema({ nom, metier, cta: { text, href, onClick } })   (nécessite essai.js) */
(function () {
  var E = window.TWEssai; if (!E) return;
  var CSS = '.tw3d{position:fixed;inset:0;z-index:9999;background:#070B09;color:#fff;overflow:hidden;font-family:"Onest",system-ui,sans-serif;opacity:0;transition:opacity .5s ease}' +
    '.tw3d.on{opacity:1}' +
    '@property --rx{syntax:"<angle>";inherits:true;initial-value:58deg}@property --ry{syntax:"<angle>";inherits:true;initial-value:0deg}@property --rz{syntax:"<angle>";inherits:true;initial-value:-28deg}@property --s{syntax:"<number>";inherits:true;initial-value:.8}@property --ty{syntax:"<length>";inherits:true;initial-value:0px}' +
    '.t3-sky{position:absolute;inset:0;background:radial-gradient(1200px 700px at 50% 40%,var(--sky) 0%,#070B09 72%);}' +
    '.t3-floor{position:absolute;left:-50%;right:-50%;bottom:-30%;height:90%;background-image:linear-gradient(color-mix(in srgb,var(--ac) 18%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--ac) 18%,transparent) 1px,transparent 1px);background-size:70px 70px;transform:perspective(700px) rotateX(72deg);transform-origin:50% 0;mask-image:linear-gradient(transparent,#000 30%,#000 60%,transparent);-webkit-mask-image:linear-gradient(transparent,#000 30%,#000 60%,transparent);animation:t3Floor 6s linear infinite}' +
    '@keyframes t3Floor{to{background-position:0 70px}}' +
    '.t3-cam{position:absolute;inset:0;display:grid;place-items:center;perspective:1700px;perspective-origin:50% 38%}' +
    '.t3-world{position:relative;width:min(64vw,880px);aspect-ratio:16/10;transform-style:preserve-3d;transform:translateY(var(--ty)) rotateX(var(--rx)) rotateY(var(--ry)) rotateZ(var(--rz)) scale(var(--s));transition:--rx 1.1s cubic-bezier(.65,0,.25,1),--ry 1.1s cubic-bezier(.65,0,.25,1),--rz 1.1s cubic-bezier(.65,0,.25,1),--s 1.1s cubic-bezier(.65,0,.25,1),--ty 1.1s cubic-bezier(.65,0,.25,1)}' +
    '.tw3d.dive .t3-world{transition:transform 1.4s cubic-bezier(.7,0,.3,1),opacity .6s ease .9s;transform:translateY(0) rotateX(0) rotateZ(0) scale(3.2);opacity:0}' +
    '.t3-l{position:absolute;inset:0;transform-style:preserve-3d;transform:var(--tf,translate3d(0,0,900px));opacity:var(--o,0);transition:transform 1s cubic-bezier(.3,1.2,.4,1),opacity .6s ease}' +
    '.t3-prop{position:absolute;left:-24%;bottom:40%;width:26%;height:46%;transform-style:preserve-3d;transform:translateZ(var(--prz,900px));opacity:var(--pro,0);transition:transform 1.2s cubic-bezier(.3,1.3,.4,1),opacity .6s ease;pointer-events:none}' +
    '.t3-pb{position:absolute;inset:0;transform-origin:50% 100%;transform:rotateZ(calc(var(--rz) * -1)) rotateY(calc(var(--ry) * -1)) rotateX(calc(var(--rx) * -1))}' +
    '.t3-pb .g-3d{width:100%;height:100%;perspective:60vw}.t3-pb .g-m i{transform:translateZ(calc((4.5 - var(--k)) * .45vw))}.t3-pb .g-3d::after{bottom:-6%}' +
    '.t3-l .gsite{border-radius:6px}' +
    '.t3-l[data-l=base] .gsite{box-shadow:0 0 0 1px color-mix(in srgb,var(--ac) 55%,transparent),0 60px 120px -30px rgba(0,0,0,.9)}' +
    '.t3-l:not([data-l=base]) .gsite{background:transparent!important;overflow:visible}' +
    '.t3-l .g-in>*,.t3-l .g-call{visibility:hidden}' +
    '.t3-l[data-l=nav] .g-nav,.t3-l[data-l=nav] .g-top{visibility:visible}' +
    '.t3-l[data-l=title] .g-kick,.t3-l[data-l=title] .g-h,.t3-l[data-l=title] .g-p{visibility:visible}' +
    '.t3-l[data-l=act] .g-act{visibility:visible}' +
    '.t3-l[data-l=vis] .g-vis{visibility:visible}' +
    '.t3-l[data-l=rev] .g-rev{visibility:visible}' +
    '.t3-l.hl .gsite{filter:drop-shadow(0 0 18px color-mix(in srgb,var(--ac) 60%,transparent))}' +
    '.t3-wire{position:absolute;inset:0;border-radius:6px;background-image:linear-gradient(color-mix(in srgb,var(--ac) 28%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--ac) 28%,transparent) 1px,transparent 1px);background-size:5% 8%;opacity:var(--w,1);transition:opacity 1s ease;pointer-events:none}' +
    '.t3-tag{position:absolute;left:100%;top:8%;margin-left:14px;white-space:nowrap;font:700 12px/1 "Onest",sans-serif;color:#0C1310;background:var(--ac);padding:6px 9px;border-radius:6px;opacity:0;transform:translateZ(2px);transition:opacity .4s}' +
    '.t3-l.hl .t3-tag{opacity:1}' +
    '.t3-url{position:absolute;left:0;right:0;bottom:100%;margin-bottom:18px;transform:translateZ(var(--uz,900px));opacity:var(--uo,0);transition:transform 1.2s cubic-bezier(.3,1.25,.4,1),opacity .6s;display:flex;justify-content:center}' +
    '.t3-url span{font:600 clamp(14px,1.6vw,22px)/1 "Onest",sans-serif;background:#fff;color:#0C1310;padding:12px 20px;border-radius:99px;box-shadow:0 20px 40px -18px rgba(0,0,0,.8)}' +
    '.t3-url b{color:#0B7A55}' +
    '.t3-phone{position:absolute;right:-8%;bottom:-6%;width:24%;aspect-ratio:9/19;border-radius:22px;background:#0A0F0D;padding:6px;box-shadow:0 0 0 1px rgba(255,255,255,.15),0 50px 90px -30px #000;transform:translateZ(var(--pz,900px)) rotateY(var(--pr,0deg));opacity:var(--po,0);transition:transform 1.4s cubic-bezier(.3,1.2,.4,1),opacity .6s;transform-style:preserve-3d}' +
    '.t3-ps{position:relative;height:100%;border-radius:17px;overflow:hidden}' +
    '.t3-cap{position:absolute;left:50%;bottom:clamp(18px,5vh,54px);transform:translateX(-50%);width:min(680px,92vw);text-align:center;pointer-events:none}' +
    '.t3-n{display:inline-block;font:800 12px/1 "Schibsted Grotesk",Arial,sans-serif;letter-spacing:.16em;color:#0C1310;background:var(--ac);border-radius:6px;padding:6px 9px;margin-bottom:12px}' +
    '.t3-cap h3{font:800 clamp(24px,3.4vw,44px)/1.05 "Schibsted Grotesk",Arial,sans-serif;letter-spacing:-.03em;margin:0 0 10px;color:#fff;text-shadow:0 4px 30px rgba(0,0,0,.6)}' +
    '.t3-cap p{font-size:clamp(15px,1.4vw,19px);line-height:1.5;color:#C9D3CD;margin:0;text-shadow:0 2px 20px rgba(0,0,0,.8)}' +
    '.t3-cap .in{animation:t3Cap .7s cubic-bezier(.2,.8,.2,1) both}' +
    '@keyframes t3Cap{from{opacity:0;transform:translateY(16px);filter:blur(6px)}}' +
    '.t3-dots{display:flex;gap:6px;justify-content:center;margin-top:16px}.t3-dots i{width:22px;height:3px;border-radius:3px;background:rgba(255,255,255,.18);transition:background .4s}.t3-dots i.on{background:var(--ac)}' +
    '.t3-bar{position:absolute;top:16px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;gap:10px;z-index:3}' +
    '.t3-brand{font:800 15px/1 "Schibsted Grotesk",Arial,sans-serif;color:#fff;opacity:.85}.t3-brand em{font-style:normal;color:var(--ac)}' +
    '.t3-bar button{font:600 14px "Onest",sans-serif;color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:99px;padding:9px 16px;cursor:pointer;backdrop-filter:blur(8px)}' +
    '.t3-bar button:hover{background:rgba(255,255,255,.16)}' +
    '.t3-end{position:absolute;inset:0;display:grid;opacity:0;pointer-events:none;transition:opacity .8s ease}' +
    '.tw3d.done .t3-end{opacity:1;pointer-events:auto}.tw3d.done [data-t3=skip]{display:none}.tw3d.done .t3-brand{display:none}.t3-bar>div{display:flex;gap:8px;margin-left:auto}' +
    '.t3-full{position:absolute;inset:0}' +
    '.t3-full .gsite{border-radius:0}' +
    '.t3-panel{position:absolute;left:50%;bottom:clamp(16px,4vh,40px);transform:translateX(-50%);width:min(640px,92vw);background:rgba(10,15,13,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:22px 24px;text-align:center;box-shadow:0 40px 80px -30px #000;animation:t3Cap .8s cubic-bezier(.2,.8,.2,1) .4s both}' +
    '.t3-panel h2{font:800 clamp(22px,2.6vw,32px)/1.1 "Schibsted Grotesk",Arial,sans-serif;letter-spacing:-.03em;margin:0 0 8px;color:#fff}' +
    '.t3-panel p{color:#C9D3CD;margin:0 0 16px;font-size:15px}' +
    '.t3-panel .row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}' +
    '.t3-cta{display:inline-flex;align-items:center;justify-content:center;font:700 16px "Onest",sans-serif;color:#fff;background:#0B7A55;border-radius:12px;padding:14px 22px;text-decoration:none;border:0;cursor:pointer;box-shadow:0 14px 30px -12px rgba(11,122,85,.9)}' +
    '.t3-cta:hover{background:#08603F}' +
    '.t3-ghost{font:600 15px "Onest",sans-serif;color:#fff;background:transparent;border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:13px 18px;cursor:pointer}' +
    '@media (max-width:560px){.t3-full{left:50%;right:auto;width:330px;transform:translateX(-50%);box-shadow:0 0 0 1px rgba(255,255,255,.1)}.t3-brand{display:none}.t3-bar button{padding:7px 12px;font-size:13px}.t3-panel{padding:18px}}'+
    '@media (max-width:760px){.t3-world{width:88vw}.t3-prop{left:30%;bottom:104%;width:40%;height:70%}.t3-phone{width:30%;right:-4%}.t3-tag{display:none}.t3-cap{bottom:24px}}' +
    '@media (prefers-reduced-motion:reduce){.t3-floor{animation:none}.t3-world,.t3-l,.t3-phone,.t3-url{transition:none}}';

  /* Mise en scène propre à chaque métier : couleurs, arrivée des pièces, caméra, textes */
  var P = {
    boulangerie: { ac: "#E8B04A", sky: "#2C1D0D", mir: 0, from: "translate3d(0,0,900px) rotateZ(0deg) scale(1)",
      s: [["« " , "Commander pour demain » en un clic", "Le client réserve sa baguette la veille, vous préparez juste ce qu'il faut."], ["Vos produits, vos horaires", "Pains, viennoiseries, ouverture du dimanche : tout est clair avant qu'il passe."], ["Fait maison, et ça se voit", "Vos photos et vos avis Google donnent envie de pousser la porte."]] },
    restaurant: { ac: "#E2A23B", sky: "#2B170E", mir: 1, from: "translate3d(0,-160%,40px) rotateZ(0deg) scale(.9)",
      s: [["", "Réserver une table, sans appeler", "Le bouton est là, même à 23 h quand le service est fini."], ["Votre carte toujours à jour", "Menu du jour, plats, prix : fini la photo floue du tableau noir."], ["On a faim rien qu'en regardant", "Vos plats en photo, vos étoiles Google : la salle se remplit."]] },
    barbier: { ac: "#C9A45C", sky: "#1F1A10", mir: 1, from: "translate3d(-150%,0,80px) rotateZ(-28deg) scale(1)",
      s: [["", "Rendez-vous en 30 secondes", "Il voit le prochain créneau et réserve sans vous déranger pendant une coupe."], ["Vos tarifs, nets et précis", "Coupe, barbe, rasage : il connaît le prix avant de s'asseoir."], ["Le style de votre salon", "Fond sombre, touches dorées : votre ambiance, en ligne."]] },
    beaute: { ac: "#EBA0B4", sky: "#2A1720", mir: 0, from: "translate3d(0,0,180px) rotateZ(0deg) scale(.55)",
      s: [["", "Réserver un soin à toute heure", "Vos clientes réservent le soir, tranquillement depuis leur canapé."], ["La carte des soins en un coup d'œil", "Visage, mains, épilation : chaque soin avec son prix."], ["Un cadre calme, dès l'écran", "Couleurs douces et avis 5 étoiles : elle se sent déjà bien."]] },
    artisan: { ac: "#F08A30", sky: "#0D2236", mir: 1, from: "translate3d(0,0,520px) rotateZ(180deg) scale(.8)",
      s: [["", "Le bouton « Appeler » en premier", "Une fuite, une panne : il vous appelle direct, sans chercher."], ["Vos services et votre zone", "Dépannage, rénovation, communes couvertes : il sait que vous venez chez lui."], ["Le devis gratuit qui rassure", "Avis Google et garantie bien visibles : il vous fait confiance."]] },
    coach: { ac: "#FF5A2A", sky: "#2A0F06", mir: 0, from: "translate3d(0,0,-600px) rotateZ(0deg) scale(1.5)",
      s: [["", "La 1re séance offerte, en gros", "La meilleure façon de transformer un curieux en client."], ["Vos formules et objectifs", "Perte de poids, remise en forme : il se reconnaît tout de suite."], ["Une énergie qui donne envie", "Noir, orange, gros titres : ça donne envie de s'y mettre."]] },
    boutique: { ac: "#86C9B1", sky: "#0F261F", mir: 1, from: "translate3d(150%,0,120px) rotateZ(14deg) scale(1)",
      s: [["", "Vos nouveautés en vitrine", "La nouvelle collection en premier, comme dans votre vitrine."], ["Votre boutique, votre adresse", "Créateurs, horaires, accès : on a envie de passer voir."], ["Votre univers, en ligne", "Une boutique qui a du style mérite un site qui en a aussi."]] }
  };
  P.boulangerie.s[0] = ["", "« Commander pour demain » en un clic", P.boulangerie.s[0][2]];
  var LAYERS = [["base", "Fond"], ["nav", "Menu"], ["title", "Titre"], ["act", "Bouton d'appel"], ["vis", "Photos & tarifs"], ["rev", "Avis Google"]];
  function steps(nom, d, t) {
    var slug = E.slug(nom), p = P[t] || P.boutique, m = p.mir ? -1 : 1;
    function c(o) { return { rx: o.rx, ry: (o.ry || 0) * m, rz: o.rz * m, s: o.s, ty: o.ty }; }
    return [
      { cap: "Votre adresse et votre nom", p: slug + ".fr, à votre nom. Le client sait tout de suite qu'il est chez vous.", show: ["base", "nav"], url: 1, prop: 1, cam: c({ rx: 55, rz: -24, s: .8 }), hl: "nav" },
      { cap: p.s[0][1], p: p.s[0][2], show: ["title", "act"], cam: c({ rx: 46, rz: -10, s: .86 }), hl: "act" },
      { cap: p.s[1][1], p: p.s[1][2], show: ["vis", "rev"], cam: c({ rx: 44, rz: 8, s: .86 }), hl: "vis" },
      { cap: p.s[2][1], p: p.s[2][2], explode: 1, cam: c({ rx: 50, ry: 6, rz: 24, s: .7 }) },
      { cap: "Parfait sur téléphone", p: "« " + d.call + " » reste sous le pouce.", phone: 1, cam: c({ rx: 18, rz: -6, s: .9 }) },
      { cap: "En ligne en 7 jours", p: "Assemblé, testé et visible sur Google.", flat: 1, cam: { rx: 0, rz: 0, s: 1, ty: 0 } }
    ];
  }

  function cinema(opt) {
    E.css(); if (!document.getElementById("tw3d-css")) { var st = document.createElement("style"); st.id = "tw3d-css"; st.textContent = CSS; document.head.appendChild(st); }
    var nom = (opt.nom || "").trim() || "Votre commerce", t = E.T[opt.metier] ? opt.metier : "boutique", d = E.T[t];
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var pp = P[t] || P.boutique, S = steps(nom, d, t), Z = { base: 0, nav: 40, title: 80, act: 120, vis: 60, rev: 160 }, ZX = { base: 0, nav: 110, title: 160, act: 210, vis: 70, rev: 260 };
    var el = document.createElement("div"); el.className = "tw3d"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Construction du site de " + nom);
    el.innerHTML = '<div class="t3-sky"></div><div class="t3-floor"></div>' +
      '<div class="t3-bar"><span class="t3-brand">Tissa<em>Web</em> · construction en direct</span><div><button type="button" data-t3="skip">Passer</button> <button type="button" data-t3="close" aria-label="Fermer">Fermer</button></div></div>' +
      '<div class="t3-cam"><div class="t3-world">' +
      '<div class="t3-url"><span>https://<b></b>.fr</span></div>' +
      '<div class="t3-prop"><div class="t3-pb">' + (E.model && E.M[t] ? E.model(t) : '') + '</div></div>' +
      LAYERS.map(function (l) { return '<div class="t3-l" data-l="' + l[0] + '"><div class="t3-gs"></div>' + (l[0] === "base" ? '<div class="t3-wire"></div>' : '') + '<span class="t3-tag">' + l[1] + '</span></div>'; }).join("") +
      '<div class="t3-phone"><div class="t3-ps"><div class="t3-gs"></div></div></div>' +
      '</div></div>' +
      '<div class="t3-cap" aria-live="polite"><div class="in"><span class="t3-n"></span><h3></h3><p></p></div><div class="t3-dots">' + S.map(function () { return "<i></i>"; }).join("") + '</div></div>' +
      '<div class="t3-end"><div class="t3-full"><div class="t3-gs"></div></div><div class="t3-panel"><h2></h2><p>Ce site peut être en ligne dans 7 jours, à prix fixe. Avec vos vraies photos et vos vrais textes.</p><div class="row"><a class="t3-cta" data-t3="cta"></a><button type="button" class="t3-ghost" data-t3="replay">Revoir la construction</button></div></div></div>';
    el.style.setProperty("--ac", pp.ac); el.style.setProperty("--sky", pp.sky);
    document.body.appendChild(el); document.documentElement.style.overflow = "hidden";
    el.querySelector(".t3-url b").textContent = E.slug(nom);
    el.querySelectorAll(".t3-l .t3-gs, .t3-phone .t3-gs").forEach(function (g) { E.render(g, t, nom); });
    var world = el.querySelector(".t3-world"), cap = el.querySelector(".t3-cap .in"), dots = el.querySelectorAll(".t3-dots i");
    var L = {}; el.querySelectorAll(".t3-l").forEach(function (l) { L[l.dataset.l] = l; });
    var shown = {}, timer = 0, i = -1, closed = false;
    var cta = el.querySelector("[data-t3=cta]"), c = opt.cta || {};
    cta.textContent = c.text || "Je veux ce site"; cta.href = c.href || "#contact";
    el.querySelector(".t3-panel h2").textContent = "Voilà le site de " + nom + ".";

    function cam(o) { world.style.setProperty("--rx", (o.rx || 0) + "deg"); world.style.setProperty("--ry", (o.ry || 0) + "deg"); world.style.setProperty("--rz", (o.rz || 0) + "deg"); world.style.setProperty("--s", o.s || 1); world.style.setProperty("--ty", (o.ty === 0 ? 0 : -4) + "vh"); }
    function layer(k, z, o) { var l = L[k]; l.style.setProperty("--tf", "translate3d(0,0," + z + "px) rotateZ(0deg) scale(1)"); l.style.setProperty("--o", o); }
    Object.keys(L).forEach(function (k) { L[k].style.setProperty("--tf", pp.from); });
    cam(S[0].cam);
    function go(n) {
      if (closed) return; i = n; var s = S[n]; if (!s) return finish();
      cap.classList.remove("in"); void cap.offsetWidth; cap.classList.add("in");
      cap.querySelector(".t3-n").textContent = "ÉTAPE " + (n + 1) + " / " + S.length; cap.querySelector("h3").textContent = s.cap; cap.querySelector("p").textContent = s.p;
      dots.forEach(function (dt, k) { dt.classList.toggle("on", k <= n); });
      cam(s.cam);
      Object.keys(L).forEach(function (k) { L[k].classList.toggle("hl", s.hl === k); });
      (s.show || []).forEach(function (k) { shown[k] = 1; });
      Object.keys(L).forEach(function (k) { if (shown[k]) layer(k, s.explode ? ZX[k] : s.flat ? 0 : Z[k], 1); });
      if (s.url) { world.style.setProperty("--uz", "40px"); world.style.setProperty("--uo", 1); }
      if (s.prop) { world.style.setProperty("--prz", "60px"); world.style.setProperty("--pro", 1); }
      if (s.explode) world.style.setProperty("--prz", "110px");
      if (s.phone) world.style.setProperty("--prz", "60px");
      if (s.flat) world.style.setProperty("--pro", 0);
      if (s.explode) world.style.setProperty("--uz", "300px");
      if (s.phone) world.style.setProperty("--uz", "40px");
      if (s.phone || s.flat) { world.style.setProperty("--pz", s.flat ? "60px" : "140px"); world.style.setProperty("--po", 1); world.style.setProperty("--pr", s.flat ? "0deg" : "-18deg"); }
      if (s.flat) { world.style.setProperty("--uz", "0px"); world.style.setProperty("--uo", 0); el.querySelector(".t3-wire").style.setProperty("--w", 0); }
      timer = setTimeout(function () { go(n + 1); }, s.flat ? 1300 : 1700);
    }
    function finish() {
      if (closed) return; clearTimeout(timer);
      E.render(el.querySelector(".t3-full .t3-gs"), t, nom);
      el.classList.add("dive");
      timer = setTimeout(function () { el.classList.add("done"); }, reduce ? 0 : 900);
      try { window.twTrack && window.twTrack("essai_3d_fin", t); } catch (e) {}
    }
    function close() { closed = true; clearTimeout(timer); el.classList.remove("on"); document.documentElement.style.overflow = ""; document.removeEventListener("keydown", key); setTimeout(function () { el.remove(); }, 500); }
    function key(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", key);
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-t3]"); if (!b) return;
      var a = b.dataset.t3;
      if (a === "close") close();
      if (a === "skip") { clearTimeout(timer); Object.keys(L).forEach(function (k) { shown[k] = 1; }); go(S.length - 1); setTimeout(finish, 900); }
      if (a === "replay") { close(); setTimeout(function () { cinema(opt); }, 520); }
      if (a === "cta") { if (c.onClick) { e.preventDefault(); c.onClick(); } close(); }
    });
    requestAnimationFrame(function () { el.classList.add("on"); });
    try { window.twTrack && window.twTrack("essai_3d", t); } catch (e) {}
    if (reduce) { Object.keys(L).forEach(function (k) { shown[k] = 1; layer(k, 0, 1); }); finish(); return { close: close }; }
    setTimeout(function () { go(0); }, 150);
    return { close: close };
  }
  E.cinema = cinema;
})();
