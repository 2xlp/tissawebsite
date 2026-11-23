/* TissAlternance — CV (import ou création) et PDF (CV + lettre de motivation).
   Le même calcul de mise en page sert au PDF (jsPDF, texte sélectionnable, lisible par les logiciels RH)
   et à l'aperçu à l'écran (canvas) : ce qu'on voit = ce qu'on télécharge. */
(function () {
  "use strict";
  var MM_PT = 0.3528;
  var COULEURS = { vert: "#0B5E43", bleu: "#1E3A5F", bordeaux: "#6B1F2A", noir: "#1B2420" };

  /* ---------- chargement de jsPDF à la demande ---------- */
  var pdfLib = null;
  function loadPdf() {
    if (window.jspdf) return Promise.resolve(window.jspdf);
    if (pdfLib) return pdfLib;
    pdfLib = new Promise(function (ok, ko) {
      var s = document.createElement("script"); s.src = "/alternance/vendor/jspdf.umd.min.js";
      s.onload = function () { ok(window.jspdf); }; s.onerror = function () { pdfLib = null; ko(new Error("Impossible de charger le module PDF (connexion ?)")); };
      document.head.appendChild(s);
    });
    return pdfLib;
  }

  /* ---------- texte compatible avec les polices PDF standard (Windows-1252) ---------- */
  var EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
  function safe(s) {
    s = String(s == null ? "" : s).normalize("NFC").replace(/[  ]/g, " ").replace(/…/g, "...");
    var o = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], c = s.charCodeAt(i);
      if (c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || EXTRA.indexOf(ch) >= 0) o += ch;
    }
    return o;
  }
  function hexMix(hex, k) { // éclaircit vers le blanc
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (x) { return Math.round(x + (255 - x) * k).toString(16).padStart(2, "0"); };
    return "#" + f(r) + f(g) + f(b);
  }

  /* ---------- enregistreur : dessine dans le PDF et garde les ordres pour l'aperçu ---------- */
  function painter(doc) {
    var ops = [], page = 0;
    function font(o) { doc.setFont("helvetica", o.bold ? "bold" : o.italic ? "italic" : "normal"); doc.setFontSize(o.size); }
    return {
      ops: ops,
      pages: function () { return page + 1; },
      addPage: function () { doc.addPage(); page++; },
      rect: function (x, y, w, h, c) { doc.setFillColor(c); doc.rect(x, y, w, h, "F"); ops.push({ k: "r", p: page, x: x, y: y, w: w, h: h, c: c }); },
      line: function (x1, y1, x2, y2, c, lw) { doc.setDrawColor(c); doc.setLineWidth(lw); doc.line(x1, y1, x2, y2); ops.push({ k: "l", p: page, x1: x1, y1: y1, x2: x2, y2: y2, c: c, lw: lw }); },
      img: function (src, x, y, w, h) { try { doc.addImage(src, "JPEG", x, y, w, h); ops.push({ k: "i", p: page, src: src, x: x, y: y, w: w, h: h }); } catch (e) {} },
      text: function (s, x, y, o) { s = safe(s); if (!s) return; font(o); doc.setTextColor(o.color || "#1B2420"); doc.text(s, x, y, { align: o.align || "left" }); ops.push({ k: "t", p: page, s: s, x: x, y: y, o: o }); },
      wrap: function (s, w, o) { font(o); return doc.splitTextToSize(safe(s), w); },
      width: function (s, o) { font(o); return doc.getTextWidth(safe(s)); },
    };
  }

  function lignes(s) { return String(s || "").split(/\n+/).map(function (x) { return x.replace(/^[\s•\-–*]+/, "").trim(); }).filter(Boolean); }
  function liste(s) { return String(s || "").split(/[,;\n]+/).map(function (x) { x = x.trim(); return x.charAt(0).toUpperCase() + x.slice(1); }).filter(Boolean); }
  function periode(a, b) { a = (a || "").trim(); b = (b || "").trim(); return a && b ? a + " – " + b : a || b; }

  /* ---------- mise en page du CV ---------- */
  function layoutCV(J, p, cv, k) {
    var doc = new J.jsPDF({ unit: "mm", format: "a4" });
    doc.setProperties({ title: "CV " + safe(p.prenom + " " + p.nom), author: safe(p.prenom + " " + p.nom), creator: "TissAlternance" });
    var P = painter(doc), C = COULEURS[cv.couleur] || COULEURS.vert;
    var nom = (p.prenom + " " + p.nom).trim();
    var titre = cv.titre || ("Recherche une alternance – " + (p.metier || ""));
    var sz = function (n) { return n * k; };
    var contact = [p.tel, p.email, p.ville, p.permis ? "Permis B" : ""].filter(Boolean);
    var side = [
      ["Compétences", liste(cv.competences)],
      ["Qualités", liste(p.qualites)],
      ["Langues", liste(cv.langues)],
      ["Logiciels", liste(cv.logiciels)],
      ["Centres d'intérêt", liste(cv.interets)],
    ].filter(function (s) { return s[1].length; });
    var recherche = ["Alternance " + (p.metier ? "– " + p.metier : ""), [p.duree, p.debut ? "à partir de " + p.debut : ""].filter(Boolean).join(", "), p.rythme || "", [p.formation, p.ecole].filter(Boolean).join(" – ")].filter(Boolean);

    if (cv.modele === "sobre") {
      var M = 18, W = 210 - 2 * M, y = 22, pw = cv.photo ? 30 : 0;
      if (cv.photo) P.img(cv.photo, 210 - M - 30, 14, 30, 30);
      P.text(nom, M, y, { size: sz(24), bold: 1, color: "#14201A" }); y += sz(8);
      P.wrap(titre, W - pw - 4, { size: sz(12), bold: 1 }).forEach(function (l) { P.text(l, M, y, { size: sz(12), bold: 1, color: C }); y += sz(5.4); });
      y += 1;
      P.wrap(contact.join("  ·  "), W - pw - 4, { size: sz(9.5) }).forEach(function (l) { P.text(l, M, y, { size: sz(9.5), color: "#4D5852" }); y += sz(4.6); });
      y = Math.max(y, cv.photo ? 48 : 0) + 3;
      P.line(M, y, M + W, y, C, 0.6); y += 8;
      var X = M, MW = W;
      var ensure = function (h) { if (y + h > 284) { P.addPage(); y = 20; } };
      var section = function (t) { ensure(sz(14)); P.text(t.toUpperCase(), X, y, { size: sz(10.5), bold: 1, color: C }); y += 2; P.line(X, y, X + MW, y, hexMix(C, 0.7), 0.3); y += sz(5.5); };
      body();
      var extras = side.map(function (s) { return [s[0], s[1].join(", ")]; });
      if (extras.length) {
        section("Compétences et centres d'intérêt");
        extras.forEach(function (e) {
          var lab = e[0] + " : ", lw = P.width(lab, { size: sz(9.5), bold: 1 });
          var ls = P.wrap(e[1], MW - lw, { size: sz(9.5) });
          ensure(ls.length * sz(4.6));
          P.text(lab, X, y, { size: sz(9.5), bold: 1, color: "#1B2420" });
          ls.forEach(function (l) { P.text(l, X + lw, y, { size: sz(9.5), color: "#33403A" }); y += sz(4.6); });
          y += 1;
        });
      }
      return { doc: doc, ops: P.ops, pages: P.pages() };
    }

    /* modèle « moderne » : colonne de couleur à gauche */
    var SB = 68, X = 78, MW = 210 - X - 12, y = 18;
    var drawSide = function () { P.rect(0, 0, SB, 297, C); };
    drawSide();
    var sy = 16, SX = 10, SW = SB - 20;
    if (cv.photo) { P.img(cv.photo, SX, sy, 34, 34); sy += 40; }
    P.wrap(nom, SW, { size: sz(19), bold: 1 }).forEach(function (l) { P.text(l, SX, sy + sz(6), { size: sz(19), bold: 1, color: "#FFFFFF" }); sy += sz(7.6); });
    sy += 2;
    P.wrap(titre, SW, { size: sz(10) }).forEach(function (l) { P.text(l, SX, sy + sz(3), { size: sz(10), color: hexMix(C, 0.78) }); sy += sz(4.8); });
    sy += 6;
    var sideTitle = function (t) { P.text(t.toUpperCase(), SX, sy, { size: sz(9.5), bold: 1, color: "#FFFFFF" }); sy += 2; P.line(SX, sy, SX + SW, sy, hexMix(C, 0.45), 0.3); sy += sz(5); };
    sideTitle("Contact");
    contact.forEach(function (c) { P.wrap(c, SW, { size: sz(9) }).forEach(function (l) { P.text(l, SX, sy, { size: sz(9), color: "#FFFFFF" }); sy += sz(4.4); }); sy += 0.8; });
    side.forEach(function (s) {
      sy += 4; sideTitle(s[0]);
      s[1].forEach(function (it) { P.wrap(it, SW - 4, { size: sz(9) }).forEach(function (l, i) { if (!i) P.text("•", SX, sy, { size: sz(9), color: hexMix(C, 0.6) }); P.text(l, SX + 3.5, sy, { size: sz(9), color: "#FFFFFF" }); sy += sz(4.4); }); sy += 0.6; });
    });
    var sideOverflow = sy > 290;
    var ensure = function (h) { if (y + h > 284) { P.addPage(); drawSide(); y = 18; } };
    var section = function (t) { ensure(sz(14)); P.text(t.toUpperCase(), X, y, { size: sz(11), bold: 1, color: C }); y += 2; P.line(X, y, X + MW, y, C, 0.5); y += sz(6); };
    body();
    return { doc: doc, ops: P.ops, pages: P.pages() + (sideOverflow ? 1 : 0) };

    /* contenu commun (profil, recherche, expériences, formation) */
    function body() {
      if (cv.accroche) {
        section("Profil");
        P.wrap(cv.accroche, MW, { size: sz(10) }).forEach(function (l) { ensure(sz(5)); P.text(l, X, y, { size: sz(10), color: "#33403A" }); y += sz(4.9); });
        y += 4;
      }
      section("Ce que je recherche");
      recherche.forEach(function (r, i) { P.wrap(r, MW, { size: sz(10), bold: !i }).forEach(function (l) { ensure(sz(5)); P.text(l, X, y, { size: sz(10), bold: !i, color: i ? "#33403A" : "#14201A" }); y += sz(4.9); }); });
      y += 4;
      var exps = (cv.exps || []).filter(function (e) { return e.poste || e.entreprise; });
      if (exps.length) {
        section("Expériences");
        exps.forEach(function (e) { bloc(e.poste || e.entreprise, periode(e.debut, e.fin), [e.poste ? e.entreprise : "", e.ville].filter(Boolean).join(" · "), lignes(e.missions)); });
      }
      var forms = (cv.forms || []).filter(function (f) { return f.diplome; });
      if (forms.length) {
        section("Formation");
        forms.forEach(function (f) { bloc(f.diplome, periode(f.debut, f.fin), [f.ecole, f.ville].filter(Boolean).join(" · "), lignes(f.details)); });
      }
    }
    function bloc(titreB, dates, sous, puces) {
      var dw = dates ? P.width(dates, { size: sz(9) }) + 4 : 0;
      var tl = P.wrap(titreB, MW - dw, { size: sz(10.5), bold: 1 });
      ensure(tl.length * sz(5) + sz(5) + Math.min(puces.length, 2) * sz(4.6));
      if (dates) P.text(dates, X + MW, y, { size: sz(9), color: "#5F6A64", align: "right" });
      tl.forEach(function (l) { P.text(l, X, y, { size: sz(10.5), bold: 1, color: "#14201A" }); y += sz(5); });
      if (sous) { P.text(sous, X, y, { size: sz(9.5), color: C }); y += sz(4.9); }
      puces.forEach(function (m) {
        P.wrap(m, MW - 4, { size: sz(9.5) }).forEach(function (l, i) { ensure(sz(4.6)); if (!i) P.text("•", X + 0.5, y, { size: sz(9.5), color: C }); P.text(l, X + 4, y, { size: sz(9.5), color: "#33403A" }); y += sz(4.6); });
      });
      y += 3.5;
    }
  }

  async function cvPdf(p, cv) {
    var J = await loadPdf(), r;
    var ks = [1, 0.95, 0.9, 0.86];
    for (var i = 0; i < ks.length; i++) { r = layoutCV(J, p, cv, ks[i]); if (r.pages === 1) break; }
    return r;
  }

  /* ---------- aperçu : rejoue les ordres sur des canvas ---------- */
  var imgs = {};
  function loadImg(src) { if (imgs[src]) return imgs[src]; return (imgs[src] = new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = src; })); }
  async function draw(box, r) {
    var n = r.ops.reduce(function (m, o) { return Math.max(m, o.p + 1); }, 1);
    var wpx = Math.min(box.clientWidth || 360, 820), dpr = Math.min(window.devicePixelRatio || 1, 2), k = (wpx * dpr) / 210;
    var srcs = r.ops.filter(function (o) { return o.k === "i"; }).map(function (o) { return o.src; });
    var loaded = {}; for (var i = 0; i < srcs.length; i++) loaded[srcs[i]] = await loadImg(srcs[i]);
    box.innerHTML = "";
    for (var p = 0; p < n; p++) {
      var cv = document.createElement("canvas"); cv.width = Math.round(210 * k); cv.height = Math.round(297 * k);
      cv.style.width = wpx + "px"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Aperçu du CV, page " + (p + 1));
      var c = cv.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height);
      r.ops.forEach(function (o) {
        if (o.p !== p) return;
        if (o.k === "r") { c.fillStyle = o.c; c.fillRect(o.x * k, o.y * k, o.w * k, o.h * k); }
        else if (o.k === "l") { c.strokeStyle = o.c; c.lineWidth = Math.max(1, o.lw * k); c.beginPath(); c.moveTo(o.x1 * k, o.y1 * k); c.lineTo(o.x2 * k, o.y2 * k); c.stroke(); }
        else if (o.k === "i" && loaded[o.src]) c.drawImage(loaded[o.src], o.x * k, o.y * k, o.w * k, o.h * k);
        else if (o.k === "t") { c.font = (o.o.bold ? "700 " : o.o.italic ? "italic 400 " : "400 ") + (o.o.size * MM_PT * k) + "px Helvetica, Arial, sans-serif"; c.fillStyle = o.o.color || "#1B2420"; c.textAlign = o.o.align || "left"; c.textBaseline = "alphabetic"; c.fillText(o.s, o.x * k, o.y * k); }
      });
      box.appendChild(cv);
    }
  }

  /* ---------- lettre de motivation en PDF ---------- */
  async function lettrePdf(texte, p) {
    var J = await loadPdf(), doc = new J.jsPDF({ unit: "mm", format: "a4" });
    doc.setProperties({ title: "Lettre de motivation " + safe(p.prenom + " " + p.nom), author: safe(p.prenom + " " + p.nom), creator: "TissAlternance" });
    var M = 22, W = 210 - 2 * M, y = 26, LH = 5.4;
    var paras = String(texte || "").replace(/\r/g, "").split(/\n\s*\n/);
    paras.forEach(function (para, i) {
      var right = (i === 1 || i === 2) && para.split("\n").length <= 4 && !/^(objet|madame|à l)/i.test(para);
      var isObj = /^objet\s*:/i.test(para);
      para.split("\n").forEach(function (line) {
        doc.setFont("helvetica", isObj ? "bold" : "normal"); doc.setFontSize(11); doc.setTextColor("#1B2420");
        var ls = doc.splitTextToSize(safe(line), right ? 80 : W);
        ls.forEach(function (l) {
          if (y > 280) { doc.addPage(); y = 24; }
          doc.text(l, right ? 210 - M : M, y, { align: right ? "right" : "left" }); y += LH;
        });
      });
      y += LH * 0.75;
    });
    return doc;
  }

  /* ---------- CV importé (PDF) : gardé dans le navigateur (IndexedDB) ---------- */
  function db() { return new Promise(function (ok, ko) { var r = indexedDB.open("tissalternance", 1); r.onupgradeneeded = function () { r.result.createObjectStore("fichiers"); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ko(r.error); }; }); }
  async function idb(mode, fn) { var d = await db(); return new Promise(function (ok, ko) { var t = d.transaction("fichiers", mode), st = t.objectStore("fichiers"), q = fn(st); t.oncomplete = function () { ok(q && q.result); }; t.onerror = function () { ko(t.error); }; }); }
  var fichiers = {
    get: function (k) { return idb("readonly", function (s) { return s.get(k); }).catch(function () { return null; }); },
    put: function (k, v) { return idb("readwrite", function (s) { return s.put(v, k); }); },
    del: function (k) { return idb("readwrite", function (s) { return s.delete(k); }).catch(function () {}); },
  };

  /* photo : recadrée en carré 360 px, JPEG léger */
  function photo(file) {
    return new Promise(function (ok, ko) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var s = Math.min(im.width, im.height), c = document.createElement("canvas"); c.width = c.height = 360;
          c.getContext("2d").drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 360, 360);
          ok(c.toDataURL("image/jpeg", 0.82));
        };
        im.onerror = function () { ko(new Error("Image illisible")); };
        im.src = fr.result;
      };
      fr.onerror = function () { ko(fr.error); };
      fr.readAsDataURL(file);
    });
  }

  window.TACV = { cvPdf: cvPdf, draw: draw, lettrePdf: lettrePdf, fichiers: fichiers, photo: photo, loadPdf: loadPdf, COULEURS: COULEURS };
})();
