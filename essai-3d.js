/* TissaWeb — « Construction en 3D » : le visiteur regarde son site se monter pièce par pièce,
   avec l'explication de chaque étape, puis la caméra plonge dedans.
   TWEssai.cinema({ nom, metier, cta: { text, href, onClick } })   (nécessite essai.js) */
(function () {
  var E = window.TWEssai; if (!E) return;
  var CSS = '.tw3d{position:fixed;inset:0;z-index:9999;background:#070B09;color:#fff;overflow:hidden;font-family:"Onest",system-ui,sans-serif;opacity:0;transition:opacity .5s ease}' +
    '.tw3d.on{opacity:1}' +
    '.t3-sky{position:absolute;inset:0;background:radial-gradient(1200px 700px at 50% 40%,#12261C 0%,#070B09 70%);}' +
    '.t3-floor{position:absolute;left:-50%;right:-50%;bottom:-30%;height:90%;background-image:linear-gradient(rgba(61,220,151,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(61,220,151,.16) 1px,transparent 1px);background-size:70px 70px;transform:perspective(700px) rotateX(72deg);transform-origin:50% 0;mask-image:linear-gradient(transparent,#000 30%,#000 60%,transparent);-webkit-mask-image:linear-gradient(transparent,#000 30%,#000 60%,transparent);animation:t3Floor 6s linear infinite}' +
    '@keyframes t3Floor{to{background-position:0 70px}}' +
    '.t3-cam{position:absolute;inset:0;display:grid;place-items:center;perspective:1700px;perspective-origin:50% 38%}' +
    '.t3-world{position:relative;width:min(64vw,880px);aspect-ratio:16/10;transform-style:preserve-3d;transform:translateY(var(--ty,-4vh)) rotateX(var(--rx,58deg)) rotateY(var(--ry,0deg)) rotateZ(var(--rz,-28deg)) scale(var(--s,.8));transition:transform 1.6s cubic-bezier(.65,0,.25,1)}' +
    '.tw3d.dive .t3-world{transition:transform 1.4s cubic-bezier(.7,0,.3,1),opacity .6s ease .9s;transform:translateY(0) rotateX(0) rotateZ(0) scale(3.2);opacity:0}' +
    '.t3-l{position:absolute;inset:0;transform-style:preserve-3d;transform:translateZ(var(--z,900px));opacity:var(--o,0);transition:transform 1.3s cubic-bezier(.3,1.25,.4,1),opacity .6s ease}' +
    '.t3-l .gsite{border-radius:6px}' +
    '.t3-l[data-l=base] .gsite{box-shadow:0 0 0 1px rgba(61,220,151,.5),0 60px 120px -30px rgba(0,0,0,.9)}' +
    '.t3-l:not([data-l=base]) .gsite{background:transparent!important;overflow:visible}' +
    '.t3-l .g-in>*,.t3-l .g-call{visibility:hidden}' +
    '.t3-l[data-l=nav] .g-nav,.t3-l[data-l=nav] .g-top{visibility:visible}' +
    '.t3-l[data-l=title] .g-kick,.t3-l[data-l=title] .g-h,.t3-l[data-l=title] .g-p{visibility:visible}' +
    '.t3-l[data-l=act] .g-act{visibility:visible}' +
    '.t3-l[data-l=vis] .g-vis{visibility:visible}' +
    '.t3-l[data-l=rev] .g-rev{visibility:visible}' +
    '.t3-l.hl .gsite{filter:drop-shadow(0 0 18px rgba(61,220,151,.55))}' +
    '.t3-wire{position:absolute;inset:0;border-radius:6px;background-image:linear-gradient(rgba(61,220,151,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(61,220,151,.25) 1px,transparent 1px);background-size:5% 8%;opacity:var(--w,1);transition:opacity 1s ease;pointer-events:none}' +
    '.t3-tag{position:absolute;left:100%;top:8%;margin-left:14px;white-space:nowrap;font:700 12px/1 "Onest",sans-serif;color:#0C1310;background:#3DDC97;padding:6px 9px;border-radius:6px;opacity:0;transform:translateZ(2px);transition:opacity .4s}' +
    '.t3-l.hl .t3-tag{opacity:1}' +
    '.t3-url{position:absolute;left:0;right:0;bottom:100%;margin-bottom:18px;transform:translateZ(var(--uz,900px));opacity:var(--uo,0);transition:transform 1.2s cubic-bezier(.3,1.25,.4,1),opacity .6s;display:flex;justify-content:center}' +
    '.t3-url span{font:600 clamp(14px,1.6vw,22px)/1 "Onest",sans-serif;background:#fff;color:#0C1310;padding:12px 20px;border-radius:99px;box-shadow:0 20px 40px -18px rgba(0,0,0,.8)}' +
    '.t3-url b{color:#0B7A55}' +
    '.t3-phone{position:absolute;right:-8%;bottom:-6%;width:24%;aspect-ratio:9/19;border-radius:22px;background:#0A0F0D;padding:6px;box-shadow:0 0 0 1px rgba(255,255,255,.15),0 50px 90px -30px #000;transform:translateZ(var(--pz,900px)) rotateY(var(--pr,0deg));opacity:var(--po,0);transition:transform 1.4s cubic-bezier(.3,1.2,.4,1),opacity .6s;transform-style:preserve-3d}' +
    '.t3-ps{position:relative;height:100%;border-radius:17px;overflow:hidden}' +
    '.t3-cap{position:absolute;left:50%;bottom:clamp(18px,5vh,54px);transform:translateX(-50%);width:min(680px,92vw);text-align:center;pointer-events:none}' +
    '.t3-n{display:inline-block;font:800 12px/1 "Schibsted Grotesk",Arial,sans-serif;letter-spacing:.16em;color:#0C1310;background:#3DDC97;border-radius:6px;padding:6px 9px;margin-bottom:12px}' +
    '.t3-cap h3{font:800 clamp(24px,3.4vw,44px)/1.05 "Schibsted Grotesk",Arial,sans-serif;letter-spacing:-.03em;margin:0 0 10px;color:#fff;text-shadow:0 4px 30px rgba(0,0,0,.6)}' +
    '.t3-cap p{font-size:clamp(15px,1.4vw,19px);line-height:1.5;color:#C9D3CD;margin:0;text-shadow:0 2px 20px rgba(0,0,0,.8)}' +
    '.t3-cap .in{animation:t3Cap .7s cubic-bezier(.2,.8,.2,1) both}' +
    '@keyframes t3Cap{from{opacity:0;transform:translateY(16px);filter:blur(6px)}}' +
    '.t3-dots{display:flex;gap:6px;justify-content:center;margin-top:16px}.t3-dots i{width:22px;height:3px;border-radius:3px;background:rgba(255,255,255,.18);transition:background .4s}.t3-dots i.on{background:#3DDC97}' +
    '.t3-bar{position:absolute;top:16px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;gap:10px;z-index:3}' +
    '.t3-brand{font:800 15px/1 "Schibsted Grotesk",Arial,sans-serif;color:#fff;opacity:.85}.t3-brand em{font-style:normal;color:#3DDC97}' +
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
    '@media (max-width:760px){.t3-world{width:88vw}.t3-phone{width:30%;right:-4%}.t3-tag{display:none}.t3-cap{bottom:24px}}' +
    '@media (prefers-reduced-motion:reduce){.t3-floor{animation:none}.t3-world,.t3-l,.t3-phone,.t3-url{transition:none}}';

  var LAYERS = [["base", "Fond"], ["nav", "Menu"], ["title", "Titre"], ["act", "Bouton d'appel"], ["vis", "Photos & tarifs"], ["rev", "Avis Google"]];
  function steps(nom, d) {
    var slug = E.slug(nom);
    return [
      { cap: "On réserve votre adresse", p: slug + ".fr : l'adresse que vos clients taperont. Elle est à votre nom, et elle vous appartient.", show: ["base"], url: 1, cam: { rx: 58, rz: -28, s: .78 }, hl: "base" },
      { cap: "Votre nom, tout en haut", p: "Dès la première seconde, le client sait qu'il est chez vous. Le menu l'emmène où il veut.", show: ["nav"], cam: { rx: 52, rz: -22, s: .82 }, hl: "nav" },
      { cap: "Un titre qui dit tout", p: "En quelques secondes, il comprend ce que vous faites et pourquoi venir chez vous plutôt qu'ailleurs.", show: ["title"], cam: { rx: 48, rz: -14, s: .86 }, hl: "title" },
      { cap: "Le bouton qui fait sonner votre téléphone", p: "« " + d.b1 + " » : le geste le plus important du site. Toujours visible, en un seul clic.", show: ["act"], cam: { rx: 44, rz: -8, s: .9 }, hl: "act" },
      { cap: "Votre univers", p: "Vos photos, vos prix, vos spécialités. Le client se projette avant même de venir.", show: ["vis"], cam: { rx: 42, rz: 4, s: .88 }, hl: "vis" },
      { cap: "Vos avis Google", p: "Les étoiles rassurent : la plupart des clients lisent les avis avant de choisir un commerce.", show: ["rev"], cam: { rx: 46, rz: 12, s: .86 }, hl: "rev" },
      { cap: "Chaque pièce a un rôle", p: "Tout est pensé pour une seule chose : que le visiteur vous appelle, réserve ou passe vous voir.", explode: 1, cam: { rx: 50, ry: 0, rz: 24, s: .7 } },
      { cap: "Et parfait sur téléphone", p: "Une grande partie des recherches se fait sur mobile, souvent juste avant d'appeler. Le bouton reste sous le pouce.", phone: 1, cam: { rx: 18, rz: -6, s: .9 } },
      { cap: "Votre site est prêt", p: "Assemblé, testé, mis en ligne et visible sur Google. Comptez 7 jours.", flat: 1, cam: { rx: 0, rz: 0, s: 1, ty: 0 } }
    ];
  }

  function cinema(opt) {
    E.css(); if (!document.getElementById("tw3d-css")) { var st = document.createElement("style"); st.id = "tw3d-css"; st.textContent = CSS; document.head.appendChild(st); }
    var nom = (opt.nom || "").trim() || "Votre commerce", t = E.T[opt.metier] ? opt.metier : "boutique", d = E.T[t];
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var S = steps(nom, d), Z = { base: 0, nav: 40, title: 80, act: 120, vis: 60, rev: 160 }, ZX = { base: 0, nav: 110, title: 160, act: 210, vis: 70, rev: 260 };
    var el = document.createElement("div"); el.className = "tw3d"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Construction du site de " + nom);
    el.innerHTML = '<div class="t3-sky"></div><div class="t3-floor"></div>' +
      '<div class="t3-bar"><span class="t3-brand">Tissa<em>Web</em> · construction en direct</span><div><button type="button" data-t3="skip">Passer</button> <button type="button" data-t3="close" aria-label="Fermer">Fermer</button></div></div>' +
      '<div class="t3-cam"><div class="t3-world">' +
      '<div class="t3-url"><span>https://<b></b>.fr</span></div>' +
      LAYERS.map(function (l) { return '<div class="t3-l" data-l="' + l[0] + '"><div class="t3-gs"></div>' + (l[0] === "base" ? '<div class="t3-wire"></div>' : '') + '<span class="t3-tag">' + l[1] + '</span></div>'; }).join("") +
      '<div class="t3-phone"><div class="t3-ps"><div class="t3-gs"></div></div></div>' +
      '</div></div>' +
      '<div class="t3-cap" aria-live="polite"><div class="in"><span class="t3-n"></span><h3></h3><p></p></div><div class="t3-dots">' + S.map(function () { return "<i></i>"; }).join("") + '</div></div>' +
      '<div class="t3-end"><div class="t3-full"><div class="t3-gs"></div></div><div class="t3-panel"><h2></h2><p>Ce site peut être en ligne dans 7 jours, à prix fixe. Avec vos vraies photos et vos vrais textes.</p><div class="row"><a class="t3-cta" data-t3="cta"></a><button type="button" class="t3-ghost" data-t3="replay">Revoir la construction</button></div></div></div>';
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
    function layer(k, z, o) { var l = L[k]; l.style.setProperty("--z", z + "px"); l.style.setProperty("--o", o); }
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
      if (s.explode) world.style.setProperty("--uz", "300px");
      if (s.phone) world.style.setProperty("--uz", "40px");
      if (s.phone || s.flat) { world.style.setProperty("--pz", s.flat ? "60px" : "140px"); world.style.setProperty("--po", 1); world.style.setProperty("--pr", s.flat ? "0deg" : "-18deg"); }
      if (s.flat) { world.style.setProperty("--uz", "0px"); world.style.setProperty("--uo", 0); el.querySelector(".t3-wire").style.setProperty("--w", 0); }
      timer = setTimeout(function () { go(n + 1); }, s.flat ? 2600 : n === 0 ? 3200 : 3000);
    }
    function finish() {
      if (closed) return; clearTimeout(timer);
      E.render(el.querySelector(".t3-full .t3-gs"), t, nom);
      el.classList.add("dive");
      timer = setTimeout(function () { el.classList.add("done"); }, reduce ? 0 : 1100);
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
    setTimeout(function () { go(0); }, 350);
    return { close: close };
  }
  E.cinema = cinema;
})();
