/* TissAlternance — CV (6 modèles « design »), lettre de motivation en PDF, fichiers locaux.
   Un seul calcul de mise en page sert au PDF (jsPDF, polices intégrées, vrai texte lisible par les logiciels RH)
   et à l'aperçu (canvas, mêmes polices chargées depuis les mêmes fichiers) : ce qu'on voit = ce qu'on télécharge. */
(function () {
  "use strict";
  var MM_PT = 0.3528;
  var BASE = "/alternance/";
  var COULEURS = { vert: "#0B5E43", bleu: "#1F3B63", bordeaux: "#7A1F3D", terracotta: "#B4532A", violet: "#4B3B8F", noir: "#1B2420" };
  var MODELES = [
    { id: "emeraude", nom: "Émeraude", desc: "Colonne de couleur, photo ronde", couleur: "vert" },
    { id: "horizon", nom: "Horizon", desc: "Grand bandeau, frise des expériences", couleur: "bleu" },
    { id: "elegance", nom: "Élégance", desc: "Typo chic, fond crème", couleur: "bordeaux" },
    { id: "creatif", nom: "Créatif", desc: "Formes graphiques, photo carrée", couleur: "terracotta" },
    { id: "minimal", nom: "Minimal", desc: "Blanc, aéré, très lisible", couleur: "noir" },
    { id: "sobre", nom: "Sobre", desc: "Classique, idéal grands groupes", couleur: "bleu" },
    { id: "executif", nom: "Exécutif", desc: "Sérieux, colonne grise, titres serif", couleur: "bleu" },
    { id: "classique", nom: "Classique", desc: "Centré, traits fins, style cabinet", couleur: "noir" },
    { id: "corporate", nom: "Corporate", desc: "Bandeau sombre, très structuré", couleur: "bleu" },
    { id: "banque", nom: "Banque", desc: "Sobre et dense, colonne de dates", couleur: "bordeaux" },
  ];
  var FONTS = {
    body: { css: "TA Onest", w: { 400: "onest-400.ttf", 600: "onest-600.ttf", 700: "onest-700.ttf" } },
    display: { css: "TA Bricolage", w: { 700: "bricolage-700.ttf", 800: "bricolage-800.ttf" } },
    serif: { css: "TA DM Serif", w: { 400: "dmserif-400.ttf" } },
    black: { css: "TA Archivo Black", w: { 400: "archivoblack-400.ttf" } },
  };

  /* ---------- chargement : jsPDF + polices (une fois) ---------- */
  var ready = null, B64 = {};
  function script(src) { return new Promise(function (ok, ko) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { ko(new Error("Chargement impossible (connexion ?)")); }; document.head.appendChild(s); }); }
  function b64(buf) { var b = new Uint8Array(buf), s = "", CH = 0x8000; for (var i = 0; i < b.length; i += CH) s += String.fromCharCode.apply(null, b.subarray(i, i + CH)); return btoa(s); }
  function load() {
    if (ready) return ready;
    ready = (async function () {
      var jobs = [window.jspdf ? null : script(BASE + "vendor/jspdf.umd.min.js")];
      Object.keys(FONTS).forEach(function (k) {
        Object.keys(FONTS[k].w).forEach(function (w) {
          var file = FONTS[k].w[w];
          jobs.push(fetch(BASE + "fonts/" + file).then(function (r) { if (!r.ok) throw new Error("Police manquante"); return r.arrayBuffer(); }).then(function (buf) {
            B64[file] = b64(buf);
            if (window.FontFace) { var ff = new FontFace(FONTS[k].css, buf, { weight: String(w) }); document.fonts.add(ff); return ff.load(); }
          }));
        });
      });
      await Promise.all(jobs);
      return window.jspdf;
    })();
    ready.catch(function () { ready = null; });
    return ready;
  }
  function newDoc(J) {
    var doc = new J.jsPDF({ unit: "mm", format: "a4", compress: true });
    Object.keys(FONTS).forEach(function (k) { Object.keys(FONTS[k].w).forEach(function (w) { var f = FONTS[k].w[w]; doc.addFileToVFS(f, B64[f]); doc.addFont(f, k, "w" + w); }); });
    return doc;
  }

  /* ---------- outils ---------- */
  function clean(s) { return String(s == null ? "" : s).normalize("NFC").replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}️‍]/gu, "").replace(/…/g, "..."); }
  function mix(hex, k, to) { // k = 0 : couleur ; k = 1 : blanc (ou « to »)
    var a = parseInt(hex.slice(1), 16), b = parseInt((to || "#FFFFFF").slice(1), 16);
    var c = [16, 8, 0].map(function (s) { var x = (a >> s) & 255, y = (b >> s) & 255; return Math.round(x + (y - x) * k).toString(16).padStart(2, "0"); });
    return "#" + c.join("");
  }
  function lignes(s) { return String(s || "").split(/\n+/).map(function (x) { return x.replace(/^[\s•\-–*]+/, "").trim(); }).filter(Boolean); }
  function liste(s) { return String(s || "").split(/[,;\n]+/).map(function (x) { x = x.trim(); return x.charAt(0).toUpperCase() + x.slice(1); }).filter(Boolean); }
  function periode(a, b) { a = (a || "").trim(); b = (b || "").trim(); return a && b ? a + " – " + b : a || b; }
  function niveau(t) {
    t = (t || "").toLowerCase();
    if (/c2|natif|maternelle|bilingue/.test(t)) return 5;
    if (/c1|courant|avanc/.test(t)) return 4.5;
    if (/b2/.test(t)) return 4;
    if (/b1|interm/.test(t)) return 3;
    if (/a2|scolaire/.test(t)) return 2;
    if (/a1|notion|d[ée]butant/.test(t)) return 1;
    return null;
  }
  function langue(s) { var m = s.match(/^(.*?)\s*[(:\-–]\s*([^)]*?)\)?\s*$/); return m ? { nom: m[1], txt: m[2], niv: niveau(m[2]) } : { nom: s, txt: "", niv: null }; }

  /* ---------- photo : versions ronde et carrée arrondie (PNG transparent) ---------- */
  var shapes = {};
  function rr(x, a, b, w, h, r) { x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function photoShapes(src) {
    if (!src) return Promise.resolve(null);
    if (shapes[src]) return shapes[src];
    return (shapes[src] = new Promise(function (ok) {
      var im = new Image();
      im.onload = function () {
        var out = {}, S = 420;
        ["rond", "carre"].forEach(function (k) {
          var c = document.createElement("canvas"); c.width = c.height = S; var x = c.getContext("2d");
          x.beginPath();
          if (k === "rond") x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); else rr(x, 0, 0, S, S, S * 0.14);
          x.clip(); var m = Math.min(im.width, im.height);
          x.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, S, S);
          out[k] = c.toDataURL("image/png");
        });
        ok(out);
      };
      im.onerror = function () { ok(null); };
      im.src = src;
    }));
  }

  /* ---------- enregistreur (PDF + ordres pour l'aperçu) ---------- */
  function painter(doc) {
    var ops = [], page = 0;
    function F(o) { var f = o.f || "body", w = o.w || (f === "display" ? 800 : 400); doc.setFont(f, "w" + w); doc.setFontSize(o.size); return w; }
    function push(o) { o.p = page; ops.push(o); }
    return {
      ops: ops, page: function () { return page; },
      addPage: function () { doc.addPage(); page++; },
      rect: function (x, y, w, h, c) { doc.setFillColor(c); doc.rect(x, y, w, h, "F"); push({ k: "r", x: x, y: y, w: w, h: h, c: c }); },
      rrect: function (x, y, w, h, r, c) { r = Math.min(r, w / 2, h / 2); doc.setFillColor(c); doc.roundedRect(x, y, w, h, r, r, "F"); push({ k: "rr", x: x, y: y, w: w, h: h, r: r, c: c }); },
      circle: function (x, y, r, c) { doc.setFillColor(c); doc.circle(x, y, r, "F"); push({ k: "c", x: x, y: y, r: r, c: c }); },
      tri: function (a, b, c2, d, e, f, c) { doc.setFillColor(c); doc.triangle(a, b, c2, d, e, f, "F"); push({ k: "tri", pts: [a, b, c2, d, e, f], c: c }); },
      line: function (x1, y1, x2, y2, c, lw) { doc.setDrawColor(c); doc.setLineWidth(lw); doc.line(x1, y1, x2, y2); push({ k: "l", x1: x1, y1: y1, x2: x2, y2: y2, c: c, lw: lw }); },
      img: function (src, x, y, w, h) { if (!src) return; try { doc.addImage(src, /^data:image\/png/.test(src) ? "PNG" : "JPEG", x, y, w, h, undefined, "FAST"); push({ k: "i", src: src, x: x, y: y, w: w, h: h }); } catch (e) {} },
      text: function (s, x, y, o) { s = clean(s); if (!s) return; var w = F(o); doc.setTextColor(o.color || "#1B2420"); doc.text(s, x, y, { align: o.align || "left" }); push({ k: "t", s: s, x: x, y: y, f: o.f || "body", w: w, size: o.size, color: o.color || "#1B2420", align: o.align || "left" }); },
      width: function (s, o) { F(o); return doc.getTextWidth(clean(s)); },
      wrap: function (s, w, o) { F(o); return doc.splitTextToSize(clean(s), w); },
    };
  }

  /* ---------- données communes ---------- */
  function donnees(p, cv, ph) {
    var exps = (cv.exps || []).filter(function (e) { return e.poste || e.entreprise; }).map(function (e) {
      return { titre: e.poste || e.entreprise, dates: periode(e.debut, e.fin), sous: [e.poste ? e.entreprise : "", e.ville].filter(Boolean).join(" · "), puces: lignes(e.missions) };
    });
    var forms = (cv.forms || []).filter(function (f) { return f.diplome; }).map(function (f) {
      return { titre: f.diplome, dates: periode(f.debut, f.fin), sous: [f.ecole, f.ville].filter(Boolean).join(" · "), puces: lignes(f.details) };
    });
    return {
      prenom: (p.prenom || "").trim(), nom: (p.nom || "").trim(),
      titre: cv.titre || ("Alternance – " + (p.metier || "")),
      accroche: cv.accroche || "",
      contact: [{ ic: "tel", t: p.tel }, { ic: "mail", t: p.email }, { ic: "pin", t: p.ville }, p.permis ? { ic: "car", t: "Permis B" } : null].filter(function (c) { return c && c.t; }),
      comp: liste(cv.competences), qual: liste(p.qualites), log: liste(cv.logiciels), int: liste(cv.interets),
      lang: liste(cv.langues).map(langue),
      rech: { poste: p.metier ? "Alternance – " + p.metier : "Alternance", quand: [p.duree, p.debut ? "à partir de " + p.debut : ""].filter(Boolean).join(", "), rythme: p.rythme || "", ecole: [p.formation, p.ecole].filter(Boolean).join(" – ") },
      exps: exps, forms: forms,
      rond: ph && ph.rond, carre: ph && ph.carre,
      initiales: ((p.prenom || " ")[0] + (p.nom || " ")[0]).toUpperCase().trim(),
    };
  }

  /* ---------- mise en page ---------- */
  function layout(J, D, modele, C, k) {
    var doc = newDoc(J), P = painter(doc), maxY = 0, H = 297;
    doc.setProperties({ title: "CV " + clean(D.prenom + " " + D.nom), author: clean(D.prenom + " " + D.nom), creator: "TissAlternance" });
    var s = function (n) { return n * k; };
    var INK = "#16201B", TXT = "#3A4540", GREY = "#6B756F";
    var bgFn = function () {};
    var Y = 0;

    function t(str, x, y, o) { P.text(str, x, y, o); }
    function para(str, x, w, o, lh) { P.wrap(str, w, o).forEach(function (l) { ensure(lh); t(l, x, Y, o); Y += lh; }); }
    function spaced(str, x, y, o, gap) {
      str = clean(str); var tot = 0, ws = [];
      for (var i = 0; i < str.length; i++) { ws.push(P.width(str[i], o)); tot += ws[i] + (i ? gap : 0); }
      var cx = o.align === "center" ? x - tot / 2 : o.align === "right" ? x - tot : x;
      var oo = Object.assign({}, o, { align: "left" });
      for (i = 0; i < str.length; i++) { if (str[i] !== " ") t(str[i], cx, y, oo); cx += ws[i] + gap; }
      return tot;
    }
    function ensure(h) { if (Y + h > H - 12) { P.addPage(); bgFn(); Y = 18; } }
    function track(y) { if (y > maxY) maxY = y; }
    function chips(items, x, y, w, o, bg, fg) {
      var hgt = s(5.6), padX = s(2.6), gap = s(1.8), cx = x;
      items.forEach(function (it) {
        var tw = Math.min(P.width(it, o) + padX * 2, w);
        if (cx + tw > x + w + 0.1 && cx > x) { cx = x; y += hgt + gap; }
        P.rrect(cx, y, tw, hgt, hgt / 2, bg); t(it, cx + padX, y + hgt * 0.68, Object.assign({ color: fg }, o)); cx += tw + gap;
      });
      return y + hgt + gap;
    }
    function dots(n, x, y, r, on, off) { for (var i = 0; i < 5; i++) P.circle(x + i * r * 2.9, y, r, i < Math.round(n) ? on : off); }
    function bar(n, x, y, w, h, on, off) { P.rrect(x, y, w, h, h / 2, off); P.rrect(x, y, Math.max(h, w * n / 5), h, h / 2, on); }
    function icon(kind, cx, cy, r, bg, fg) {
      P.circle(cx, cy, r, bg); var q = r * 0.55;
      if (kind === "tel") { P.rrect(cx - q * 0.5, cy - q * 0.85, q, q * 1.7, q * 0.22, fg); P.rect(cx - q * 0.34, cy - q * 0.62, q * 0.68, q * 1.05, bg); }
      else if (kind === "mail") { P.rect(cx - q * 0.85, cy - q * 0.55, q * 1.7, q * 1.1, fg); P.line(cx - q * 0.85, cy - q * 0.55, cx, cy + q * 0.12, bg, r * 0.12); P.line(cx + q * 0.85, cy - q * 0.55, cx, cy + q * 0.12, bg, r * 0.12); }
      else if (kind === "pin") { P.circle(cx, cy - q * 0.25, q * 0.6, fg); P.tri(cx - q * 0.52, cy, cx + q * 0.52, cy, cx, cy + q * 0.9, fg); P.circle(cx, cy - q * 0.25, q * 0.24, bg); }
      else if (kind === "car") { P.rrect(cx - q * 0.95, cy - q * 0.2, q * 1.9, q * 0.7, q * 0.2, fg); P.rrect(cx - q * 0.55, cy - q * 0.65, q * 1.1, q * 0.6, q * 0.2, fg); P.circle(cx - q * 0.5, cy + q * 0.55, q * 0.26, bg); P.circle(cx + q * 0.5, cy + q * 0.55, q * 0.26, bg); }
    }
    function avatar(x, y, size, form, bg, fg, ring, ringW) {
      var src = form === "carre" ? D.carre : D.rond;
      if (ring) { if (form === "carre") P.rrect(x - ringW, y - ringW, size + 2 * ringW, size + 2 * ringW, size * 0.14 + ringW, ring); else P.circle(x + size / 2, y + size / 2, size / 2 + ringW, ring); }
      if (src) P.img(src, x, y, size, size);
      else { if (form === "carre") P.rrect(x, y, size, size, size * 0.14, bg); else P.circle(x + size / 2, y + size / 2, size / 2, bg); t(D.initiales, x + size / 2, y + size / 2 + size * 0.13, { f: "display", w: 800, size: size * 1.05, color: fg, align: "center" }); }
    }
    /* bloc expérience / formation */
    function bloc(e, x, w, st) {
      var dw = e.dates ? P.width(e.dates, st.date) + 3 : 0;
      var tl = P.wrap(e.titre, w - dw, st.title);
      ensure(tl.length * st.lhT + s(5) + Math.min(e.puces.length, 2) * st.lh);
      if (st.timeline) P.circle(st.timeline.x, Y - s(1.2), s(1.35), st.timeline.dot);
      if (e.dates) t(e.dates, x + w, Y, Object.assign({ align: "right" }, st.date));
      tl.forEach(function (l) { t(l, x, Y, st.title); Y += st.lhT; });
      if (e.sous) { t(e.sous, x, Y, st.sub); Y += st.lh; }
      e.puces.forEach(function (m) {
        P.wrap(m, w - s(3.6), st.body).forEach(function (l, i) { ensure(st.lh); if (!i) P.circle(x + s(1), Y - s(1.15), s(0.55), st.bullet); t(l, x + s(3.6), Y, st.body); Y += st.lh; });
      });
      Y += s(3.2);
    }
    function recherche(x, w, bg, accent, o) {
      var r = D.rech, rows = [r.quand, r.rythme, r.ecole].filter(Boolean);
      var lines = []; rows.forEach(function (row) { P.wrap(row, w - s(8), o).forEach(function (l) { lines.push(l); }); });
      var bo = Object.assign({}, o, { w: 700, color: INK });
      var tl = P.wrap(r.poste, w - s(8), bo);
      var h = s(6) + tl.length * s(5) + lines.length * s(4.6);
      ensure(h);
      P.rrect(x, Y - s(4), w, h, s(2.2), bg); P.rect(x, Y - s(4) + s(1.5), s(1.1), h - s(3), accent);
      var yy = Y + s(0.8);
      tl.forEach(function (l) { t(l, x + s(5), yy, bo); yy += s(5); });
      lines.forEach(function (l) { t(l, x + s(5), yy, o); yy += s(4.6); });
      Y += h + s(2);
    }
    var body = { f: "body", w: 400, size: s(9.3), color: TXT };
    var stdBloc = function (c, tl) {
      return { title: { f: "body", w: 700, size: s(10.3), color: INK }, sub: { f: "body", w: 600, size: s(9.2), color: c }, date: { f: "body", w: 400, size: s(8.6), color: GREY }, body: body, bullet: c, lhT: s(4.9), lh: s(4.55), timeline: tl };
    };
    function listeCol(items, x, w, o, bulletC, yv, lh) {
      items.forEach(function (it) { P.wrap(it, w - 4, o).forEach(function (l, i) { if (!i) P.circle(x + 1.1, yv - s(1.15), s(0.6), bulletC); t(l, x + 4, yv, o); yv += lh; }); yv += s(0.7); });
      return yv;
    }

    /* =============== modèles =============== */
    if (modele === "emeraude") {
      var SB = 72, X = 82, W = 210 - X - 14;
      bgFn = function () { P.rect(0, 0, SB, H, C); P.circle(SB, H, 26, mix(C, 0.14, "#000000")); };
      bgFn();
      var sy = 14;
      avatar(SB / 2 - 21, sy, 42, "rond", mix(C, 0.22), "#FFFFFF", "#FFFFFF", 1.1); sy += 56;
      var lightT = { f: "body", w: 400, size: s(8.8), color: "#FFFFFF" };
      var side = function (title) { spaced(title.toUpperCase(), 12, sy, { f: "body", w: 700, size: s(8.6), color: "#FFFFFF" }, s(0.55)); sy += s(2.2); P.line(12, sy, SB - 12, sy, mix(C, 0.35), 0.3); sy += s(5.4); };
      side("Contact");
      D.contact.forEach(function (c) { icon(c.ic, 14.6, sy - s(1.2), s(2.6), mix(C, 0.2), "#FFFFFF"); P.wrap(c.t, SB - 34, lightT).forEach(function (l) { t(l, 20.5, sy, lightT); sy += s(4.3); }); sy += s(1.8); });
      if (D.comp.length) { sy += s(3); side("Compétences"); sy = chips(D.comp, 12, sy - s(4), SB - 24, { f: "body", w: 600, size: s(8) }, mix(C, 0.2), "#FFFFFF") + s(3); }
      if (D.lang.length) { sy += s(1); side("Langues"); D.lang.forEach(function (l) { t(l.nom, 12, sy, { f: "body", w: 600, size: s(8.8), color: "#FFFFFF" }); if (l.niv) dots(l.niv, SB - 12 - s(12.6), sy - s(1.1), s(1.05), "#FFFFFF", mix(C, 0.3)); else if (l.txt) t(l.txt, SB - 12, sy, Object.assign({ align: "right" }, lightT)); sy += s(5.4); }); sy += s(1.5); }
      [["Qualités", D.qual], ["Logiciels", D.log], ["Centres d'intérêt", D.int]].forEach(function (g) {
        if (!g[1].length) return; sy += s(2); side(g[0]);
        sy = listeCol(g[1], 12, SB - 24, lightT, mix(C, 0.55), sy, s(4.3)) + s(1.5);
      });
      track(sy);
      Y = 30;
      t(D.prenom, X, Y, { f: "display", w: 800, size: s(30), color: INK }); Y += s(11);
      P.wrap(D.nom.toUpperCase(), W, { f: "display", w: 800, size: s(30) }).forEach(function (l) { t(l, X, Y, { f: "display", w: 800, size: s(30), color: C }); Y += s(11); });
      Y += s(0.5);
      P.wrap(D.titre, W, { f: "body", w: 600, size: s(10.5) }).forEach(function (l) { t(l, X, Y, { f: "body", w: 600, size: s(10.5), color: GREY }); Y += s(5); });
      Y += s(2); P.rect(X, Y, 16, 1.3, C); Y += s(10);
      var sec = function (title) { ensure(s(14)); P.rrect(X, Y - s(3.9), s(4.6), s(4.6), s(1.1), C); t(title, X + s(7.5), Y, { f: "display", w: 700, size: s(13), color: INK }); Y += s(7.5); };
      if (D.accroche) { sec("Profil"); para(D.accroche, X, W, body, s(4.6)); Y += s(5); }
      sec("Ce que je recherche"); recherche(X, W, mix(C, 0.93), C, body); Y += s(4);
      var tlx = X + s(1.4);
      [["Expériences", D.exps], ["Formation", D.forms]].forEach(function (g) {
        if (!g[1].length) return; sec(g[0]); var y0 = Y, p0 = P.page();
        g[1].forEach(function (e) { bloc(e, X + s(6), W - s(6), stdBloc(C, { x: tlx, dot: C })); });
        if (P.page() === p0) P.line(tlx, y0 - s(1), tlx, Y - s(6), mix(C, 0.75), 0.4); Y += s(2);
      });
      track(Y);
    }

    else if (modele === "horizon") {
      var BH = 64;
      P.rect(0, 0, 210, BH, C);
      P.circle(214, -8, 48, mix(C, 0.1)); P.circle(132, 12, 5, mix(C, 0.15));
      P.rect(0, BH, 210, 1.6, mix(C, 0.45));
      bgFn = function () { P.rect(0, 0, 210, 8, C); };
      var nameW = 124, yy = 25;
      P.wrap(D.prenom + " " + D.nom, nameW, { f: "display", w: 800, size: s(28) }).forEach(function (l) { t(l, 18, yy, { f: "display", w: 800, size: s(28), color: "#FFFFFF" }); yy += s(10.5); });
      P.wrap(D.titre.toUpperCase(), nameW, { f: "body", w: 600, size: s(9) }).forEach(function (l) { spaced(l, 18, yy, { f: "body", w: 600, size: s(9), color: mix(C, 0.72) }, s(0.4)); yy += s(4.6); });
      var cx = 18, cy = Math.max(yy + s(5), BH - 9), ct = { f: "body", w: 400, size: s(8.4), color: "#FFFFFF" };
      D.contact.forEach(function (c) { var w = P.width(c.t, ct) + s(7.5); if (cx + w > 144) { cx = 18; cy += s(6); } icon(c.ic, cx + s(2.3), cy - s(1.1), s(2.3), mix(C, 0.22), "#FFFFFF"); t(c.t, cx + s(5.6), cy, ct); cx += w + s(3); });
      avatar(150, 9, 46, "rond", mix(C, 0.25), "#FFFFFF", "#FFFFFF", 1.6);
      var LX = 16, LW = 58, RX = 90, RW = 104, sy2 = Math.max(BH, cy + 4) + 14;
      var lsec = function (title) { spaced(title.toUpperCase(), LX, sy2, { f: "body", w: 700, size: s(8.8), color: C }, s(0.5)); sy2 += s(2.2); P.rect(LX, sy2, 8, 0.8, C); sy2 += s(5.4); };
      var ltx = { f: "body", w: 400, size: s(8.8), color: TXT };
      if (D.comp.length) { lsec("Compétences"); sy2 = chips(D.comp, LX, sy2 - s(4), LW, { f: "body", w: 600, size: s(8) }, mix(C, 0.88), C) + s(5); }
      if (D.lang.length) { lsec("Langues"); D.lang.forEach(function (l) { t(l.nom, LX, sy2, { f: "body", w: 600, size: s(8.8), color: INK }); if (l.niv) bar(l.niv, LX + 26, sy2 - s(2), LW - 26, s(1.8), C, mix(C, 0.85)); else t(l.txt, LX + LW, sy2, Object.assign({ align: "right" }, ltx)); sy2 += s(5.6); }); sy2 += s(4); }
      [["Qualités", D.qual], ["Logiciels", D.log], ["Centres d'intérêt", D.int]].forEach(function (g) {
        if (!g[1].length) return; lsec(g[0]); sy2 = listeCol(g[1], LX, LW, ltx, C, sy2, s(4.4)) + s(4);
      });
      track(sy2);
      Y = sy2 > 0 ? Math.max(BH, cy + 4) + 14 : BH + 16;
      P.line(RX - 7, Y - 6, RX - 7, H - 14, "#E1E5E8", 0.3);
      var rsec = function (title) { ensure(s(14)); spaced(title.toUpperCase(), RX, Y, { f: "body", w: 700, size: s(9.8), color: INK }, s(0.6)); Y += s(2.4); P.rect(RX, Y, 10, 0.9, C); Y += s(6); };
      if (D.accroche) { rsec("Profil"); para(D.accroche, RX, RW, body, s(4.6)); Y += s(5); }
      rsec("Ce que je recherche"); recherche(RX, RW, mix(C, 0.93), C, body); Y += s(4);
      var tl2 = RX + s(1.4);
      [["Expériences", D.exps], ["Formation", D.forms]].forEach(function (g) {
        if (!g[1].length) return; rsec(g[0]); var y0 = Y, p0 = P.page();
        g[1].forEach(function (e) { bloc(e, RX + s(6), RW - s(6), stdBloc(C, { x: tl2, dot: C })); });
        if (P.page() === p0) P.line(tl2, y0 - s(1), tl2, Y - s(6), mix(C, 0.75), 0.4); Y += s(2);
      });
      track(Y);
    }

    else if (modele === "elegance") {
      var CREME = "#F8F4EE";
      bgFn = function () { P.rect(0, 0, 210, H, CREME); P.line(12, 12, 198, 12, mix(C, 0.6), 0.3); P.line(12, H - 12, 198, H - 12, mix(C, 0.6), 0.3); };
      bgFn();
      Y = 22;
      if (D.rond) { avatar(105 - 17, Y - 4, 34, "rond", mix(C, 0.3), "#FFFFFF", mix(C, 0.55), 0.8); Y += 44; } else Y += 10;
      t(D.prenom + " " + D.nom, 105, Y, { f: "serif", w: 400, size: s(32), color: "#1E1B18", align: "center" }); Y += s(8);
      spaced(D.titre.toUpperCase(), 105, Y, { f: "body", w: 600, size: s(8.4), color: C, align: "center" }, s(0.9)); Y += s(6.5);
      P.wrap(D.contact.map(function (c) { return c.t; }).join("   ·   "), 160, { f: "body", size: s(8.6) }).forEach(function (l) { t(l, 105, Y, { f: "body", w: 400, size: s(8.6), color: GREY, align: "center" }); Y += s(4.4); });
      Y += s(3); P.line(22, Y, 188, Y, mix(C, 0.55), 0.3); P.line(22, Y + 1.1, 188, Y + 1.1, mix(C, 0.55), 0.3); Y += s(11);
      var LX3 = 22, LW3 = 54, RX3 = 88, RW3 = 100, top = Y, sy3 = Y;
      var esec = function (title, x, yv) { t(title, x, yv, { f: "serif", w: 400, size: s(15), color: C }); return yv + s(2.4); };
      var lt3 = { f: "body", w: 400, size: s(8.8), color: TXT };
      [["Compétences", D.comp], ["Qualités", D.qual], ["Langues", D.lang], ["Logiciels", D.log], ["Centres d'intérêt", D.int]].forEach(function (g) {
        if (!g[1].length) return;
        sy3 = esec(g[0], LX3, sy3); P.line(LX3, sy3, LX3 + 12, sy3, C, 0.4); sy3 += s(5.6);
        g[1].forEach(function (it) {
          if (g[0] === "Langues") { t(it.nom, LX3, sy3, { f: "body", w: 600, size: s(8.8), color: INK }); if (it.niv) dots(it.niv, LX3 + LW3 - s(12.6), sy3 - s(1.1), s(1.0), C, mix(C, 0.8, CREME)); else t(it.txt, LX3 + LW3, sy3, Object.assign({ align: "right" }, lt3)); sy3 += s(5.2); return; }
          P.wrap(it, LW3, lt3).forEach(function (l) { t(l, LX3, sy3, lt3); sy3 += s(4.4); }); sy3 += s(0.8);
        });
        sy3 += s(5);
      });
      track(sy3);
      P.line(RX3 - 8, top - s(4), RX3 - 8, H - 24, mix(C, 0.7, CREME), 0.3);
      Y = top;
      var rsec3 = function (title) { ensure(s(14)); Y = esec(title, RX3, Y); P.line(RX3, Y, RX3 + 12, Y, C, 0.4); Y += s(6); };
      if (D.accroche) { rsec3("Profil"); para(D.accroche, RX3, RW3, body, s(4.7)); Y += s(5); }
      rsec3("Ce que je recherche"); recherche(RX3, RW3, mix(C, 0.9, CREME), C, body); Y += s(4);
      var st3 = stdBloc(C, null); st3.bullet = mix(C, 0.3);
      if (D.exps.length) { rsec3("Expériences"); D.exps.forEach(function (e) { bloc(e, RX3, RW3, st3); }); Y += s(2); }
      if (D.forms.length) { rsec3("Formation"); D.forms.forEach(function (e) { bloc(e, RX3, RW3, st3); }); }
      track(Y);
    }

    else if (modele === "creatif") {
      bgFn = function () { P.tri(210, H, 150, H, 210, H - 46, mix(C, 0.82)); P.tri(210, H, 186, H, 210, H - 70, mix(C, 0.55)); };
      P.tri(0, 0, 118, 0, 0, 44, C); P.tri(0, 0, 46, 0, 0, 96, mix(C, 0.45)); P.circle(132, 14, 3.2, mix(C, 0.5));
      bgFn();
      P.rrect(155, 25, 42, 42, 42 * 0.14, mix(C, 0.3));
      avatar(150, 20, 42, "carre", mix(C, 0.15, "#000000"), "#FFFFFF", null, 0);
      Y = 62;
      P.wrap(D.prenom.toUpperCase(), 126, { f: "black", size: s(27) }).forEach(function (l) { t(l, 18, Y, { f: "black", w: 400, size: s(27), color: INK }); Y += s(10); });
      P.wrap(D.nom.toUpperCase(), 126, { f: "black", size: s(27) }).forEach(function (l) { t(l, 18, Y, { f: "black", w: 400, size: s(27), color: C }); Y += s(10); });
      Y += s(0.5);
      P.wrap(D.titre, 126, { f: "body", w: 600, size: s(10.5) }).forEach(function (l) { t(l, 18, Y, { f: "body", w: 600, size: s(10.5), color: TXT }); Y += s(5); });
      Y = Math.max(Y + s(4), 76);
      var cx5 = 18, ct5 = { f: "body", w: 600, size: s(8.2), color: INK }, hh = s(6.4);
      D.contact.forEach(function (c) { var w = P.width(c.t, ct5) + s(10); if (cx5 + w > 194) { cx5 = 18; Y += hh + s(2); } P.rrect(cx5, Y - hh * 0.7, w, hh, hh / 2, mix(C, 0.9)); icon(c.ic, cx5 + s(3.3), Y - hh * 0.2, s(2.2), C, "#FFFFFF"); t(c.t, cx5 + s(6.6), Y, ct5); cx5 += w + s(2); });
      Y += s(13);
      var top5 = Y, RX5 = 146, RW5 = 48, MX = 18, MW5 = 118, sy5 = top5;
      var csec = function (title, x, yv) { t(title.toUpperCase(), x, yv, { f: "black", w: 400, size: s(11), color: INK }); P.rect(x, yv + s(1.8), 9, 1.4, C); return yv + s(8); };
      var rt5 = { f: "body", w: 400, size: s(8.7), color: TXT };
      if (D.comp.length) { sy5 = csec("Atouts", RX5, sy5); sy5 = chips(D.comp, RX5, sy5 - s(4), RW5, { f: "body", w: 600, size: s(7.8) }, C, "#FFFFFF") + s(5); }
      if (D.lang.length) { sy5 = csec("Langues", RX5, sy5); D.lang.forEach(function (l) { t(l.nom + (l.txt && !l.niv ? " – " + l.txt : ""), RX5, sy5, { f: "body", w: 600, size: s(8.6), color: INK }); sy5 += s(2.4); if (l.niv) { bar(l.niv, RX5, sy5, RW5, s(2), C, mix(C, 0.85)); sy5 += s(6); } else sy5 += s(3); }); sy5 += s(3); }
      [["Qualités", D.qual], ["Logiciels", D.log], ["Passions", D.int]].forEach(function (g) {
        if (!g[1].length) return; sy5 = csec(g[0], RX5, sy5);
        g[1].forEach(function (it) { P.wrap(it, RW5 - 4, rt5).forEach(function (l, i) { if (!i) P.rect(RX5, sy5 - s(2), s(1.3), s(1.3), C); t(l, RX5 + 3.5, sy5, rt5); sy5 += s(4.3); }); sy5 += s(0.6); });
        sy5 += s(4);
      });
      track(sy5);
      Y = top5;
      var msec = function (title) { ensure(s(14)); Y = csec(title, MX, Y); };
      if (D.accroche) { msec("Profil"); para(D.accroche, MX, MW5, body, s(4.6)); Y += s(5); }
      msec("Je recherche"); recherche(MX, MW5, mix(C, 0.92), C, body); Y += s(4);
      var st5 = stdBloc(C, null);
      if (D.exps.length) { msec("Expériences"); D.exps.forEach(function (e) { bloc(e, MX, MW5, st5); }); Y += s(2); }
      if (D.forms.length) { msec("Formation"); D.forms.forEach(function (e) { bloc(e, MX, MW5, st5); }); }
      track(Y);
    }

    else if (modele === "minimal") {
      bgFn = function () { P.rect(0, 0, 210, 3.5, C); };
      bgFn();
      var LX6 = 20, CX6 = 62, CW6 = 128;
      Y = 28;
      var nw = D.rond ? 120 : 170;
      P.wrap(D.prenom + " " + D.nom, nw, { f: "display", w: 800, size: s(30) }).forEach(function (l) { t(l, LX6, Y, { f: "display", w: 800, size: s(30), color: INK }); Y += s(11); });
      P.wrap(D.titre, nw, { f: "body", w: 600, size: s(11.5) }).forEach(function (l) { t(l, LX6, Y, { f: "body", w: 600, size: s(11.5), color: C }); Y += s(5.5); });
      if (D.rond) avatar(156, 12, 34, "rond", mix(C, 0.85), C, null, 0);
      Y = Math.max(Y + s(4), D.rond ? 56 : 0);
      var cx6 = LX6, ct6 = { f: "body", w: 400, size: s(8.7), color: TXT };
      D.contact.forEach(function (c) { var w = P.width(c.t, ct6) + s(6.5); if (cx6 + w > 190) { cx6 = LX6; Y += s(6); } icon(c.ic, cx6 + s(2), Y - s(1.1), s(2.1), mix(C, 0.88), C); t(c.t, cx6 + s(5.2), Y, ct6); cx6 += w + s(4); });
      Y += s(8); P.line(LX6, Y, 190, Y, "#E3E6E8", 0.3); Y += s(9);
      var row = function (label, fn) { ensure(s(12)); spaced(label.toUpperCase(), LX6, Y, { f: "body", w: 700, size: s(8.2), color: C }, s(0.5)); fn(); Y += s(4); P.line(LX6, Y - s(3), 190, Y - s(3), "#EEF0F1", 0.25); Y += s(3); };
      if (D.accroche) row("Profil", function () { para(D.accroche, CX6, CW6, body, s(4.6)); });
      row("Recherche", function () { recherche(CX6, CW6, mix(C, 0.94), C, body); Y -= s(2); });
      var st6 = stdBloc(C, null);
      if (D.exps.length) row("Expériences", function () { D.exps.forEach(function (e) { bloc(e, CX6, CW6, st6); }); Y -= s(3); });
      if (D.forms.length) row("Formation", function () { D.forms.forEach(function (e) { bloc(e, CX6, CW6, st6); }); Y -= s(3); });
      if (D.comp.length) row("Compétences", function () { Y = chips(D.comp, CX6, Y - s(4), CW6, { f: "body", w: 600, size: s(8) }, mix(C, 0.9), C) + s(2); });
      if (D.lang.length) row("Langues", function () { var lx = CX6; D.lang.forEach(function (l) { var lo = { f: "body", w: 600, size: s(9), color: INK }, w = P.width(l.nom, lo); t(l.nom, lx, Y, lo); if (l.niv) { dots(l.niv, lx + w + s(3), Y - s(1.1), s(1), C, mix(C, 0.85)); lx += w + s(20); } else { t(l.txt, lx + w + s(2), Y, body); lx += w + P.width(l.txt, body) + s(8); } }); Y += s(5); });
      [["Qualités", D.qual], ["Logiciels", D.log], ["Intérêts", D.int]].forEach(function (g) { if (g[1].length) row(g[0], function () { para(g[1].join("  ·  "), CX6, CW6, body, s(4.6)); }); });
      track(Y);
    }

    else if (modele === "executif") {
      var GR = "#F1F3F5", SX = 140, SW = 54, MX8 = 18, MW8 = 112;
      bgFn = function () { P.rect(SX - 6, 0, 210 - SX + 6, H, GR); P.rect(0, 0, 210, 2.2, C); };
      bgFn();
      Y = 26;
      P.wrap(D.prenom + " " + D.nom, MW8, { f: "serif", size: s(28) }).forEach(function (l) { t(l, MX8, Y, { f: "serif", w: 400, size: s(28), color: INK }); Y += s(10); });
      P.wrap(D.titre.toUpperCase(), MW8, { f: "body", w: 600, size: s(8.8) }).forEach(function (l) { spaced(l, MX8, Y, { f: "body", w: 600, size: s(8.8), color: C }, s(0.5)); Y += s(4.6); });
      Y += s(3); P.line(MX8, Y, MX8 + MW8, Y, "#D5DADF", 0.35); Y += s(9);
      var sy8 = 20;
      if (D.rond) { avatar(SX + SW / 2 - 17, sy8, 34, "rond", mix(C, 0.85), C, null, 0); sy8 += 44; } else sy8 += 6;
      var ssec8 = function (title) { t(title.toUpperCase(), SX, sy8, { f: "body", w: 700, size: s(8.4), color: C }); sy8 += s(2); P.line(SX, sy8, SX + SW, sy8, "#C9CFD5", 0.3); sy8 += s(5.2); };
      var st8 = { f: "body", w: 400, size: s(8.6), color: TXT };
      ssec8("Contact");
      D.contact.forEach(function (c) { P.wrap(c.t, SW, st8).forEach(function (l) { t(l, SX, sy8, st8); sy8 += s(4.2); }); sy8 += s(1); });
      sy8 += s(3);
      if (D.comp.length) { ssec8("Compétences"); sy8 = listeCol(D.comp, SX, SW, st8, C, sy8, s(4.2)) + s(3); }
      if (D.lang.length) { ssec8("Langues"); D.lang.forEach(function (l) { t(l.nom, SX, sy8, { f: "body", w: 600, size: s(8.6), color: INK }); if (l.txt) t(l.txt, SX + SW, sy8, Object.assign({ align: "right" }, st8)); sy8 += s(4.8); }); sy8 += s(3); }
      [["Qualités", D.qual], ["Logiciels", D.log], ["Centres d'intérêt", D.int]].forEach(function (g) { if (!g[1].length) return; ssec8(g[0]); sy8 = listeCol(g[1], SX, SW, st8, C, sy8, s(4.2)) + s(3); });
      track(sy8);
      var msec8 = function (title) { ensure(s(14)); t(title, MX8, Y, { f: "serif", w: 400, size: s(14), color: INK }); Y += s(2.2); P.rect(MX8, Y, 10, 0.7, C); Y += s(6); };
      if (D.accroche) { msec8("Profil"); para(D.accroche, MX8, MW8, body, s(4.6)); Y += s(5); }
      msec8("Objectif"); recherche(MX8, MW8, mix(C, 0.94), C, body); Y += s(3);
      var b8 = stdBloc(C, null); b8.sub = { f: "body", w: 600, size: s(9.2), color: GREY };
      if (D.exps.length) { msec8("Expérience professionnelle"); D.exps.forEach(function (e) { bloc(e, MX8, MW8, b8); }); Y += s(2); }
      if (D.forms.length) { msec8("Formation"); D.forms.forEach(function (e) { bloc(e, MX8, MW8, b8); }); }
      track(Y);
    }

    else if (modele === "classique") {
      var M9 = 20, W9 = 170;
      Y = 26;
      t((D.prenom + " " + D.nom).toUpperCase(), 105, Y, { f: "serif", w: 400, size: s(24), color: INK, align: "center" }); Y += s(7);
      t(D.titre, 105, Y, { f: "body", w: 600, size: s(10), color: C, align: "center" }); Y += s(5.5);
      P.wrap(D.contact.map(function (c) { return c.t; }).join("  |  "), W9, { f: "body", size: s(8.8) }).forEach(function (l) { t(l, 105, Y, { f: "body", w: 400, size: s(8.8), color: GREY, align: "center" }); Y += s(4.4); });
      Y += s(2); P.line(M9, Y, M9 + W9, Y, INK, 0.5); Y += s(8);
      var sec9 = function (title) { ensure(s(14)); spaced(title.toUpperCase(), M9, Y, { f: "serif", w: 400, size: s(11.5), color: INK }, s(0.8)); Y += s(2); P.line(M9, Y, M9 + W9, Y, "#9AA19D", 0.25); Y += s(5.6); };
      if (D.accroche) { sec9("Profil"); para(D.accroche, M9, W9, body, s(4.6)); Y += s(4); }
      sec9("Objectif");
      [D.rech.poste, D.rech.quand, D.rech.rythme, D.rech.ecole].filter(Boolean).forEach(function (r, i) { para(r, M9, W9, Object.assign({}, body, { w: i ? 400 : 700, color: i ? TXT : INK }), s(4.6)); }); Y += s(4);
      var b9 = stdBloc(INK, null); b9.sub = { f: "body", w: 400, size: s(9.2), color: GREY }; b9.bullet = INK;
      b9.sub = Object.assign({}, b9.sub); b9.title = { f: "body", w: 700, size: s(10.2), color: INK };
      if (D.forms.length) { sec9("Formation"); D.forms.forEach(function (e) { bloc(e, M9, W9, b9); }); }
      if (D.exps.length) { sec9("Expérience professionnelle"); D.exps.forEach(function (e) { bloc(e, M9, W9, b9); }); }
      var ex9 = [["Compétences", D.comp], ["Langues", D.lang.map(function (l) { return l.nom + (l.txt ? " (" + l.txt + ")" : ""); })], ["Informatique", D.log], ["Qualités", D.qual], ["Centres d'intérêt", D.int]].filter(function (g) { return g[1].length; });
      if (ex9.length) {
        sec9("Compétences et informations");
        ex9.forEach(function (g) {
          var lab = g[0] + " : ", lo = { f: "body", w: 700, size: s(9.3), color: INK }, lw = P.width(lab, lo);
          var ls = P.wrap(g[1].join(", "), W9 - lw, body); ensure(ls.length * s(4.6));
          t(lab, M9, Y, lo); ls.forEach(function (l) { t(l, M9 + lw, Y, body); Y += s(4.6); }); Y += s(0.8);
        });
      }
      track(Y);
    }

    else if (modele === "corporate") {
      var BH10 = 46, M10 = 18, W10 = 174;
      P.rect(0, 0, 210, BH10, mix(C, 0.15, "#000000"));
      P.rect(0, BH10, 210, 1.2, C);
      bgFn = function () { P.rect(0, 0, 210, 6, mix(C, 0.15, "#000000")); };
      var ph10 = D.rond ? 30 : 0;
      if (D.rond) avatar(M10, 8, 30, "carre", mix(C, 0.3), "#FFFFFF", null, 0);
      var nx10 = M10 + (ph10 ? ph10 + 8 : 0), yy10 = 21;
      t(D.prenom + " " + D.nom, nx10, yy10, { f: "body", w: 700, size: s(22), color: "#FFFFFF" }); yy10 += s(7.5);
      P.wrap(D.titre, 120, { f: "body", w: 400, size: s(10.5) }).forEach(function (l) { t(l, nx10, yy10, { f: "body", w: 400, size: s(10.5), color: mix(C, 0.75) }); yy10 += s(5); });
      Y = BH10 + s(8);
      var cx10 = M10, ct10 = { f: "body", w: 400, size: s(8.6), color: TXT };
      D.contact.forEach(function (c) { var w = P.width(c.t, ct10) + s(6.5); if (cx10 + w > 192) { cx10 = M10; Y += s(6); } icon(c.ic, cx10 + s(2), Y - s(1.1), s(2.1), C, "#FFFFFF"); t(c.t, cx10 + s(5.2), Y, ct10); cx10 += w + s(4); });
      Y += s(5); P.line(M10, Y, M10 + W10, Y, "#DDE1E5", 0.3); Y += s(8);
      var LW10 = 40, CX10 = M10 + LW10 + 4, CW10 = W10 - LW10 - 4;
      var row10 = function (label, fn) { ensure(s(12)); var yl = Y; P.wrap(label.toUpperCase(), LW10 - 2, { f: "body", w: 700, size: s(8.6) }).forEach(function (l) { t(l, M10, yl, { f: "body", w: 700, size: s(8.6), color: C }); yl += s(4); }); fn(); Y = Math.max(Y, yl) + s(3); };
      var b10 = stdBloc(C, null); b10.sub = { f: "body", w: 600, size: s(9.1), color: GREY };
      if (D.accroche) row10("Profil", function () { para(D.accroche, CX10, CW10, body, s(4.6)); Y += s(2); });
      row10("Objectif", function () { [D.rech.poste, D.rech.quand, D.rech.rythme, D.rech.ecole].filter(Boolean).forEach(function (r, i) { para(r, CX10, CW10, Object.assign({}, body, { w: i ? 400 : 700, color: i ? TXT : INK }), s(4.6)); }); Y += s(2); });
      if (D.exps.length) row10("Expérience", function () { D.exps.forEach(function (e) { bloc(e, CX10, CW10, b10); }); Y -= s(1); });
      if (D.forms.length) row10("Formation", function () { D.forms.forEach(function (e) { bloc(e, CX10, CW10, b10); }); Y -= s(1); });
      if (D.comp.length) row10("Compétences", function () { Y = chips(D.comp, CX10, Y - s(4), CW10, { f: "body", w: 600, size: s(8) }, mix(C, 0.9), C) + s(1); });
      if (D.lang.length) row10("Langues", function () { para(D.lang.map(function (l) { return l.nom + (l.txt ? " (" + l.txt + ")" : ""); }).join("  ·  "), CX10, CW10, body, s(4.6)); Y += s(1); });
      [["Informatique", D.log], ["Qualités", D.qual], ["Intérêts", D.int]].forEach(function (g) { if (g[1].length) row10(g[0], function () { para(g[1].join("  ·  "), CX10, CW10, body, s(4.6)); Y += s(1); }); });
      track(Y);
    }

    else if (modele === "banque") {
      var M11 = 18, W11 = 174, DW = 34;
      bgFn = function () { P.rect(M11, 10, W11, 0.4, C); };
      Y = 22;
      var nw11 = D.rond ? W11 - 34 : W11;
      if (D.rond) avatar(210 - M11 - 26, 12, 26, "carre", mix(C, 0.85), C, null, 0);
      t(D.nom.toUpperCase() + " " + D.prenom, M11, Y, { f: "body", w: 700, size: s(20), color: INK }); Y += s(6.5);
      P.wrap(D.titre, nw11, { f: "body", w: 600, size: s(10.5) }).forEach(function (l) { t(l, M11, Y, { f: "body", w: 600, size: s(10.5), color: C }); Y += s(5); });
      P.wrap(D.contact.map(function (c) { return c.t; }).join("  ·  "), nw11, { f: "body", size: s(8.8) }).forEach(function (l) { t(l, M11, Y, { f: "body", w: 400, size: s(8.8), color: GREY }); Y += s(4.4); });
      Y = Math.max(Y, D.rond ? 40 : 0) + s(2); P.rect(M11, Y, W11, 0.9, C); Y += s(8);
      var sec11 = function (title) { ensure(s(14)); P.rect(M11, Y - s(4), W11, s(6), mix(C, 0.92)); t(title.toUpperCase(), M11 + s(2.5), Y, { f: "body", w: 700, size: s(9.4), color: C }); Y += s(7); };
      var dated = function (e) {
        ensure(s(10));
        var y0 = Y; P.wrap(e.dates || "", DW - 3, { f: "body", w: 600, size: s(8.6) }).forEach(function (l, i) { t(l, M11, y0 + i * s(4.2), { f: "body", w: 600, size: s(8.6), color: GREY }); });
        var x = M11 + DW, w = W11 - DW;
        P.wrap(e.titre, w, { f: "body", w: 700, size: s(10) }).forEach(function (l) { t(l, x, Y, { f: "body", w: 700, size: s(10), color: INK }); Y += s(4.8); });
        if (e.sous) { t(e.sous, x, Y, { f: "body", w: 400, size: s(9.1), color: C }); Y += s(4.6); }
        e.puces.forEach(function (m) { P.wrap(m, w - s(3.4), body).forEach(function (l, i) { ensure(s(4.5)); if (!i) t("–", x, Y, body); t(l, x + s(3.4), Y, body); Y += s(4.45); }); });
        Y += s(2.8);
      };
      if (D.accroche) { sec11("Profil"); para(D.accroche, M11, W11, body, s(4.6)); Y += s(4); }
      sec11("Objectif");
      [D.rech.poste, D.rech.quand, D.rech.rythme, D.rech.ecole].filter(Boolean).forEach(function (r, i) { para(r, M11, W11, Object.assign({}, body, { w: i ? 400 : 700, color: i ? TXT : INK }), s(4.6)); }); Y += s(4);
      if (D.exps.length) { sec11("Expérience professionnelle"); D.exps.forEach(dated); }
      if (D.forms.length) { sec11("Formation"); D.forms.forEach(dated); }
      var ex11 = [["Compétences", D.comp], ["Langues", D.lang.map(function (l) { return l.nom + (l.txt ? " (" + l.txt + ")" : ""); })], ["Informatique", D.log], ["Qualités", D.qual], ["Intérêts", D.int]].filter(function (g) { return g[1].length; });
      if (ex11.length) {
        sec11("Compétences");
        ex11.forEach(function (g) {
          var ls = P.wrap(g[1].join(", "), W11 - DW, body); ensure(ls.length * s(4.6));
          t(g[0], M11, Y, { f: "body", w: 600, size: s(8.8), color: GREY }); ls.forEach(function (l) { t(l, M11 + DW, Y, body); Y += s(4.6); }); Y += s(1.2);
        });
      }
      track(Y);
    }

    else { /* sobre : une colonne, idéal pour les logiciels de recrutement */
      var M = 18, W7 = 174;
      Y = 24;
      if (D.rond) avatar(210 - M - 28, 12, 28, "rond", mix(C, 0.85), C, null, 0);
      var nw7 = D.rond ? W7 - 34 : W7;
      t(D.prenom + " " + D.nom, M, Y, { f: "body", w: 700, size: s(24), color: INK }); Y += s(8);
      P.wrap(D.titre, nw7, { f: "body", w: 600, size: s(11.5) }).forEach(function (l) { t(l, M, Y, { f: "body", w: 600, size: s(11.5), color: C }); Y += s(5.4); });
      P.wrap(D.contact.map(function (c) { return c.t; }).join("  ·  "), nw7, { f: "body", size: s(9) }).forEach(function (l) { t(l, M, Y, { f: "body", w: 400, size: s(9), color: GREY }); Y += s(4.5); });
      Y = Math.max(Y, D.rond ? 44 : 0) + s(3); P.line(M, Y, M + W7, Y, C, 0.6); Y += s(8);
      var sec7 = function (title) { ensure(s(14)); t(title.toUpperCase(), M, Y, { f: "body", w: 700, size: s(10.3), color: C }); Y += s(2); P.line(M, Y, M + W7, Y, mix(C, 0.75), 0.25); Y += s(5.5); };
      if (D.accroche) { sec7("Profil"); para(D.accroche, M, W7, body, s(4.6)); Y += s(4); }
      sec7("Ce que je recherche");
      [D.rech.poste, D.rech.quand, D.rech.rythme, D.rech.ecole].filter(Boolean).forEach(function (r, i) { para(r, M, W7, Object.assign({}, body, { w: i ? 400 : 700, color: i ? TXT : INK }), s(4.6)); }); Y += s(4);
      var st7 = stdBloc(C, null);
      if (D.exps.length) { sec7("Expériences"); D.exps.forEach(function (e) { bloc(e, M, W7, st7); }); }
      if (D.forms.length) { sec7("Formation"); D.forms.forEach(function (e) { bloc(e, M, W7, st7); }); }
      var ex = [["Compétences", D.comp], ["Qualités", D.qual], ["Langues", D.lang.map(function (l) { return l.nom + (l.txt ? " (" + l.txt + ")" : ""); })], ["Logiciels", D.log], ["Centres d'intérêt", D.int]].filter(function (g) { return g[1].length; });
      if (ex.length) {
        sec7("Compétences et centres d'intérêt");
        ex.forEach(function (g) {
          var lab = g[0] + " : ", lo = { f: "body", w: 700, size: s(9.3), color: INK }, lw = P.width(lab, lo);
          var ls = P.wrap(g[1].join(", "), W7 - lw, body); ensure(ls.length * s(4.6));
          t(lab, M, Y, lo); ls.forEach(function (l) { t(l, M + lw, Y, body); Y += s(4.6); }); Y += s(0.8);
        });
      }
      track(Y);
    }
    return { doc: doc, ops: P.ops, pages: P.page() + 1, overflow: P.page() > 0 || maxY > H - 8 };
  }

  async function cvPdf(p, cv) {
    var J = await load(), ph = await photoShapes(cv.photo);
    var D = donnees(p, cv, ph), C = COULEURS[cv.couleur] || COULEURS.vert, m = cv.modele || "emeraude", r;
    var ks = [1, 0.95, 0.9, 0.85, 0.8];
    for (var i = 0; i < ks.length; i++) { r = layout(J, D, m, C, ks[i]); if (!r.overflow) break; }
    return r;
  }

  /* ---------- aperçu canvas ---------- */
  var imgs = {};
  function loadImg(src) { if (imgs[src]) return imgs[src]; return (imgs[src] = new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = src; })); }
  async function canvases(r, wpx, maxPages) {
    var n = Math.min(maxPages || 9, r.ops.reduce(function (m, o) { return Math.max(m, o.p + 1); }, 1));
    var dpr = Math.min(window.devicePixelRatio || 1, 2), k = (wpx * dpr) / 210, out = [];
    var srcs = r.ops.filter(function (o) { return o.k === "i"; }).map(function (o) { return o.src; }), L = {};
    for (var i = 0; i < srcs.length; i++) L[srcs[i]] = await loadImg(srcs[i]);
    for (var p = 0; p < n; p++) {
      var cv = document.createElement("canvas"); cv.width = Math.round(210 * k); cv.height = Math.round(297 * k); cv.style.width = wpx + "px";
      var c = cv.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height);
      r.ops.forEach(function (o) {
        if (o.p !== p) return;
        c.fillStyle = o.c || "#000"; c.strokeStyle = o.c || "#000";
        if (o.k === "r") c.fillRect(o.x * k, o.y * k, o.w * k, o.h * k);
        else if (o.k === "rr") { c.beginPath(); rr(c, o.x * k, o.y * k, o.w * k, o.h * k, o.r * k); c.fill(); }
        else if (o.k === "c") { c.beginPath(); c.arc(o.x * k, o.y * k, o.r * k, 0, Math.PI * 2); c.fill(); }
        else if (o.k === "tri") { var q = o.pts; c.beginPath(); c.moveTo(q[0] * k, q[1] * k); c.lineTo(q[2] * k, q[3] * k); c.lineTo(q[4] * k, q[5] * k); c.closePath(); c.fill(); }
        else if (o.k === "l") { c.lineWidth = Math.max(1, o.lw * k); c.beginPath(); c.moveTo(o.x1 * k, o.y1 * k); c.lineTo(o.x2 * k, o.y2 * k); c.stroke(); }
        else if (o.k === "i" && L[o.src]) c.drawImage(L[o.src], o.x * k, o.y * k, o.w * k, o.h * k);
        else if (o.k === "t") { c.font = o.w + " " + (o.size * MM_PT * k) + 'px "' + FONTS[o.f].css + '"'; c.fillStyle = o.color; c.textAlign = o.align; c.textBaseline = "alphabetic"; c.fillText(o.s, o.x * k, o.y * k); }
      });
      out.push(cv);
    }
    return out;
  }
  async function draw(box, r) {
    var w = Math.min(box.clientWidth || 360, 820), cs = await canvases(r, w);
    box.innerHTML = ""; cs.forEach(function (c, i) { c.setAttribute("role", "img"); c.setAttribute("aria-label", "Aperçu du CV, page " + (i + 1)); box.appendChild(c); });
  }
  async function vignette(p, cv, wpx) { var r = await cvPdf(p, cv); return (await canvases(r, wpx, 1))[0]; }

  /* ---------- exemple (personne fictive, avatar dessiné) ---------- */
  var demoPhoto = null;
  function avatarDemo() {
    if (demoPhoto) return demoPhoto;
    var c = document.createElement("canvas"); c.width = c.height = 400; var x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, "#E9DCCB"); g.addColorStop(1, "#D6C3AC"); x.fillStyle = g; x.fillRect(0, 0, 400, 400);
    x.fillStyle = "#3B2A20"; x.beginPath(); x.ellipse(200, 200, 112, 140, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#2F4858"; x.beginPath(); x.ellipse(200, 440, 165, 135, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#E8B896"; x.fillRect(176, 250, 48, 66); x.beginPath(); x.ellipse(200, 190, 76, 92, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#3B2A20"; x.beginPath(); x.ellipse(200, 122, 86, 44, 0, Math.PI, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(165, 122, 58, 28, -0.45, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#2B1E17"; x.beginPath(); x.arc(172, 192, 6, 0, 7); x.arc(228, 192, 6, 0, 7); x.fill();
    x.strokeStyle = "#B5654F"; x.lineWidth = 5; x.lineCap = "round"; x.beginPath(); x.arc(200, 222, 22, 0.25, Math.PI - 0.25); x.stroke();
    return (demoPhoto = c.toDataURL("image/jpeg", 0.85));
  }
  function exemple() {
    return {
      p: { prenom: "Léa", nom: "Martin", email: "lea.martin@mail.fr", tel: "06 12 34 56 78", ville: "Dijon", permis: true, genre: "f", formation: "BTS MCO", ecole: "Pigier Dijon", metier: "conseillère de vente", debut: "septembre 2027", duree: "2 ans", rythme: "2 jours en formation, 3 jours en entreprise", qualites: "Souriante, organisée, à l'écoute" },
      cv: {
        titre: "Alternance – Conseillère de vente", photo: avatarDemo(),
        accroche: "Étudiante en BTS MCO, je recherche une alternance de 2 ans en tant que conseillère de vente à partir de septembre 2027. Souriante et organisée, j'aime le contact client et je veux apprendre le métier sur le terrain.",
        exps: [
          { poste: "Vendeuse (job d'été)", entreprise: "Boulangerie Le Fournil", ville: "Dijon", debut: "juil. 2026", fin: "août 2026", missions: "Accueil et conseil des clients\nEncaissement et gestion de la caisse\nMise en place de la vitrine" },
          { poste: "Stage de vente", entreprise: "Magasin de sport", ville: "Quetigny", debut: "janv. 2026", fin: "févr. 2026", missions: "Conseil client au rayon running\nRéassort et étiquetage" },
        ],
        forms: [{ diplome: "BTS MCO", ecole: "Pigier", ville: "Dijon", debut: "2025", fin: "en cours" }, { diplome: "Bac STMG", ecole: "Lycée Carnot", ville: "Dijon", debut: "", fin: "2025" }],
        competences: "Vente, Encaissement, Merchandising, Relation client", langues: "Anglais (B2), Espagnol (A2)", logiciels: "Excel, Canva", interets: "Danse, Photo, Bénévolat associatif",
      },
    };
  }

  /* ---------- lettre de motivation assortie au CV ---------- */
  async function lettrePdf(texte, p, cv) {
    var J = await load(), doc = newDoc(J);
    cv = cv || {};
    var C = COULEURS[cv.couleur] || COULEURS.vert, disp = cv.modele === "elegance" || cv.modele === "executif" || cv.modele === "classique" ? "serif" : cv.modele === "creatif" ? "black" : "display";
    doc.setProperties({ title: "Lettre de motivation " + clean(p.prenom + " " + p.nom), author: clean(p.prenom + " " + p.nom), creator: "TissAlternance" });
    var M = 22, W = 210 - 2 * M, y = 24, LH = 5.3;
    doc.setFillColor(C); doc.rect(0, 0, 210, 3.5, "F");
    doc.setFont(disp, disp === "display" ? "w800" : "w400"); doc.setFontSize(20); doc.setTextColor("#16201B"); doc.text(clean(p.prenom + " " + p.nom), M, y);
    y += 6.5; doc.setFont("body", "w400"); doc.setFontSize(9.5); doc.setTextColor("#6B756F");
    doc.text(clean([p.tel, p.email, p.ville].filter(Boolean).join("   ·   ")), M, y);
    y += 5; doc.setFillColor(C); doc.rect(M, y, 14, 1.1, "F"); y += 14;
    var paras = String(texte || "").replace(/\r/g, "").split(/\n\s*\n/);
    if (paras.length && p.email && paras[0].indexOf(p.email) >= 0) paras.shift();
    paras.forEach(function (para, i) {
      var right = (i === 0 || i === 1) && para.split("\n").length <= 4 && !/^(objet|madame|à l)/i.test(para);
      var isObj = /^objet\s*:/i.test(para);
      para.split("\n").forEach(function (line) {
        doc.setFont("body", isObj ? "w700" : "w400"); doc.setFontSize(10.5); doc.setTextColor(isObj ? "#16201B" : "#2A332F");
        doc.splitTextToSize(clean(line), right ? 80 : W).forEach(function (l) {
          if (y > 280) { doc.addPage(); y = 24; }
          doc.text(l, right ? 210 - M : M, y, { align: right ? "right" : "left" }); y += LH;
        });
      });
      y += LH * 0.75;
    });
    return doc;
  }

  /* ---------- CV importé : IndexedDB ---------- */
  function db() { return new Promise(function (ok, ko) { var r = indexedDB.open("tissalternance", 1); r.onupgradeneeded = function () { r.result.createObjectStore("fichiers"); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ko(r.error); }; }); }
  async function idb(mode, fn) { var d = await db(); return new Promise(function (ok, ko) { var t = d.transaction("fichiers", mode), st = t.objectStore("fichiers"), q = fn(st); t.oncomplete = function () { ok(q && q.result); }; t.onerror = function () { ko(t.error); }; }); }
  var fichiers = {
    get: function (k) { return idb("readonly", function (s) { return s.get(k); }).catch(function () { return null; }); },
    put: function (k, v) { return idb("readwrite", function (s) { return s.put(v, k); }); },
    del: function (k) { return idb("readwrite", function (s) { return s.delete(k); }).catch(function () {}); },
  };
  function photo(file) {
    return new Promise(function (ok, ko) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () { var m = Math.min(im.width, im.height), c = document.createElement("canvas"); c.width = c.height = 420; c.getContext("2d").drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 420, 420); ok(c.toDataURL("image/jpeg", 0.85)); };
        im.onerror = function () { ko(new Error("Image illisible")); };
        im.src = fr.result;
      };
      fr.onerror = function () { ko(fr.error); };
      fr.readAsDataURL(file);
    });
  }

  window.TACV = { cvPdf: cvPdf, draw: draw, vignette: vignette, exemple: exemple, lettrePdf: lettrePdf, fichiers: fichiers, photo: photo, load: load, COULEURS: COULEURS, MODELES: MODELES };
})();
