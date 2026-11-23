/* TissaWeb — appli alternance.
   Profil, textes et suivi : gardés uniquement dans ce navigateur (localStorage, clé tw-alt).
   Serveur (fonction tw-alternance) : reçoit seulement secteur + ville + mot-clé pour la recherche.
   Si la rédaction IA est activée côté serveur, le profil est envoyé pour écrire le texte (rien n'est stocké). */
(function () {
  "use strict";
  var API = "https://fhfnwvhhpmvmbqmlhruk.supabase.co/functions/v1/tw-alternance";
  var KEY = "tw-alt";
  var RELANCE_J = 7;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- état ---------- */
  var S = { profil: null, suivi: {}, masques: {}, zone: "ville" };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) S = Object.assign(S, saved); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var R = { data: null, page: 1, items: [], taille: "tout", loading: false };
  var IA = false;

  /* ---------- outils ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(t) { var el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2600); }
  function jours(iso) { return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5); }
  function dateFr(iso) { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }); }
  function nomCourt(n) { var s = String(n || "").replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*$/, "").trim(); return s || n; }
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function low1(s) { s = String(s || ""); return s.charAt(0).toLowerCase() + s.slice(1); }
  async function api(action, body) {
    var r = await fetch(API + "?action=" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(d.error || "Erreur " + r.status); e.status = r.status; throw e; }
    return d;
  }

  /* ---------- onglets ---------- */
  function tab(name, focus) {
    $$(".tabs [data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === name)); b.tabIndex = b.dataset.tab === name ? 0 : -1; });
    $$(".view").forEach(function (v) { v.hidden = v.id !== "v-" + name; });
    if (name === "suivi") renderSuivi();
    if (name === "recherche" && S.profil && !R.data && !R.loading) search(1);
    if (focus) { var top = $("#app").getBoundingClientRect().top + scrollY - 70; scrollTo({ top: top, behavior: "smooth" }); }
  }
  $$(".tabs [data-tab]").forEach(function (b) { b.addEventListener("click", function () { tab(b.dataset.tab, true); }); });
  $$("[data-go]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); tab(S.profil ? "recherche" : a.dataset.go, true); }); });

  /* ---------- profil ---------- */
  var F = $("#f-profil");
  function fillForm() {
    var p = S.profil || {};
    $$("input,select,textarea", F).forEach(function (el) {
      if (!(el.name in p)) return;
      if (el.type === "radio") el.checked = p[el.name] === el.value;
      else if (el.type === "checkbox") el.checked = !!p[el.name];
      else el.value = p[el.name];
    });
    kw();
  }
  function kw() { $(".kw", F).hidden = F.secteur.value !== "autre"; }
  F.secteur.addEventListener("change", kw);
  F.addEventListener("submit", function (e) {
    e.preventDefault();
    var p = {}, bad = [];
    $$("input,select,textarea", F).forEach(function (el) {
      if (el.type === "radio") { if (el.checked) p[el.name] = el.value; return; }
      p[el.name] = el.type === "checkbox" ? el.checked : el.value.trim();
      var ko = el.required && !p[el.name] || el.type === "email" && p[el.name] && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p[el.name]);
      el.setAttribute("aria-invalid", ko ? "true" : "false");
      if (ko) bad.push(el);
    });
    if (p.secteur === "autre" && !p.q) { bad.push(F.q); F.q.setAttribute("aria-invalid", "true"); }
    var err = $("#err-profil");
    if (bad.length) { err.textContent = "Il manque quelques infos (en rouge)."; err.hidden = false; bad[0].focus(); return; }
    err.hidden = true;
    var changed = !S.profil || ["secteur", "ville", "q"].some(function (k) { return S.profil[k] !== p[k]; });
    S.profil = p; save();
    if (changed) R.data = null;
    tab("recherche", true);
  });

  /* ---------- recherche ---------- */
  $$("[data-zone]").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.dataset.zone === S.zone));
    b.addEventListener("click", function () { S.zone = b.dataset.zone; save(); $$("[data-zone]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); search(1); });
  });
  $$("[data-taille]").forEach(function (b) {
    b.addEventListener("click", function () { R.taille = b.dataset.taille; $$("[data-taille]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); renderList(); });
  });
  $("#r-more").addEventListener("click", function () { search(R.page + 1); });

  async function search(page) {
    var p = S.profil; if (!p) { tab("profil"); return; }
    R.loading = true;
    var list = $("#r-list");
    if (page === 1) { R.items = []; list.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div>'; $("#r-resume").textContent = "Recherche en cours…"; }
    $("#r-more").disabled = true;
    try {
      var d = await api("search", { secteur: p.secteur, ville: p.ville, q: p.secteur === "autre" ? p.q : "", zone: S.zone, page: page });
      R.data = d; R.page = d.page;
      var seen = {}; R.items.forEach(function (x) { seen[x.siret || x.siren] = 1; });
      d.results.forEach(function (x) { if (!seen[x.siret || x.siren]) R.items.push(x); });
      $("#r-resume").innerHTML = "<b>" + d.total.toLocaleString("fr-FR") + "</b> entreprise" + (d.total > 1 ? "s" : "") + " en " + esc(low1(d.secteur)) + (S.zone === "dep" ? " dans le département " + esc(d.commune.dep) : " à " + esc(d.commune.nom)) + ", classées de la plus proche à la plus loin.";
      $("#r-more").hidden = d.page >= d.pages;
      renderList();
    } catch (e) {
      if (page === 1) list.innerHTML = '<div class="empty"><b>Oups</b>' + esc(e.message) + '</div>';
      else toast(e.message);
      $("#r-resume").textContent = "La recherche n'a pas marché.";
    } finally { R.loading = false; $("#r-more").disabled = false; }
  }

  function cardHtml(x, mode) {
    var id = x.siret || x.siren, s = S.suivi[id];
    var court = nomCourt(x.nom);
    var tags = [];
    if (x.km != null) tags.push('<span class="tag">' + (x.km < 1 ? "moins de 1 km" : String(x.km).replace(".", ",") + " km") + "</span>");
    if (x.effectif) tags.push('<span class="tag">' + esc(x.effectif) + "</span>");
    if (!x.groupe) tags.push('<span class="tag g">PME</span>');
    if (s && mode !== "suivi") tags.push('<span class="tag g">' + esc(LABELS[s.statut] || "Postulé") + "</span>");
    return '<article class="card' + (s ? " done" : "") + '" data-id="' + esc(id) + '">' +
      "<div><h3>" + esc(court) + "</h3>" + (court !== x.nom ? '<p class="full">' + esc(x.nom) + "</p>" : "") + "</div>" +
      '<div class="meta"><span class="tag">' + esc(x.activite) + "</span>" + tags.join("") + "</div>" +
      '<p class="addr">' + esc(x.adresse) + "</p>" +
      (x.dirigeant ? '<p class="who">Dirigeant : <b>' + esc(x.dirigeant.nom) + "</b>" + (x.dirigeant.qualite ? ", " + esc(low1(x.dirigeant.qualite)) : "") + "</p>" : "") +
      (mode === "suivi" ? suiviBloc(id, s) :
        '<div class="card-act"><button class="btn btn-accent" data-open="' + esc(id) + '">' + (s ? "Revoir ma candidature" : "Préparer ma candidature") + '</button><button class="btn btn-ghost" data-hide="' + esc(id) + '" aria-label="Masquer ' + esc(court) + '">Masquer</button></div>') +
      "</article>";
  }
  function renderList() {
    var list = $("#r-list");
    var items = R.items.filter(function (x) {
      if (S.masques[x.siret || x.siren]) return false;
      if (R.taille === "petit") return !x.groupe;
      if (R.taille === "groupe") return x.groupe;
      return true;
    });
    list.innerHTML = items.length ? items.map(function (x) { return cardHtml(x); }).join("") :
      '<div class="empty"><b>Aucune entreprise ici</b>' + (S.zone === "ville" ? "Essaie « Mon département » pour élargir." : "Essaie un autre secteur ou un mot-clé.") + "</div>";
  }
  $("#r-list").addEventListener("click", function (e) {
    var o = e.target.closest("[data-open]"), h = e.target.closest("[data-hide]");
    if (o) openSheet(findItem(o.dataset.open), S.suivi[o.dataset.open] ? (S.suivi[o.dataset.open].doc || "mail") : "mail");
    if (h) { S.masques[h.dataset.hide] = 1; save(); renderList(); toast("Entreprise masquée"); }
  });
  function findItem(id) {
    for (var i = 0; i < R.items.length; i++) if ((R.items[i].siret || R.items[i].siren) === id) return R.items[i];
    return S.suivi[id] && S.suivi[id].e;
  }

  /* ---------- textes ---------- */
  function T(p) {
    var f = p.genre === "f";
    return {
      inscrit: f ? "inscrite" : "inscrit", etudiant: f ? "Étudiante" : "Étudiant", ravi: f ? "ravie" : "ravi",
      motive: f ? "motivée" : "motivé", disponible: "disponible",
    };
  }
  function ecoleTxt(p) { return p.ecole ? " à " + p.ecole : ""; }
  function signature(p) { return p.prenom + " " + p.nom + "\n" + p.tel + "\n" + p.email; }
  function qualitesTxt(p) {
    var q = (p.qualites || "").split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 3);
    if (!q.length) return "";
    return q.length === 1 ? q[0] : q.slice(0, -1).join(", ") + " et " + q[q.length - 1];
  }
  function phraseExp(p) {
    var x = (p.experience || "").trim().replace(/[.\s]+$/, "");
    if (!x) return "";
    return /^(j'|je |j’)/i.test(x) ? x.charAt(0).toUpperCase() + x.slice(1) + "." : "Mon expérience : " + low1(x) + ".";
  }
  function ouverture(x) { return x.dirigeant ? "À l'attention de " + x.dirigeant.nom + "\n\nMadame, Monsieur," : "Madame, Monsieur,"; }
  var GENERIQUE = /^(commerce|banque, assurance|industrie|construction)$|\//i;
  function actPrecise(x) { return x.activite && !GENERIQUE.test(x.activite) ? low1(x.activite) : ""; }

  function texteMail(p, x) {
    var t = T(p), n = nomCourt(x.nom), act = actPrecise(x), v = x.ville || "";
    var intros = [
      "Actuellement " + t.inscrit + " en " + p.formation + ecoleTxt(p) + ", je recherche une entreprise pour effectuer mon alternance à partir de " + p.debut + ", sur un poste de " + p.metier + ". " + n + (v ? ", à " + v + "," : "") + " correspond exactement au type d'entreprise dans laquelle je souhaite progresser.",
      "Je me permets de vous adresser ma candidature pour un contrat en alternance en tant que " + p.metier + ", dans le cadre de ma formation " + p.formation + ecoleTxt(p) + ", à partir de " + p.debut + ". " + (act ? "Votre activité (" + act + ") m'intéresse particulièrement" : "Votre entreprise m'intéresse particulièrement") + ", et j'aimerais apprendre le métier au sein de " + n + ".",
      t.etudiant + " en " + p.formation + ecoleTxt(p) + ", je souhaite rejoindre " + n + " pour mon alternance" + (p.duree ? " de " + p.duree : "") + " à partir de " + p.debut + ", sur un poste de " + p.metier + ". Une entreprise comme la vôtre" + (v ? ", implantée à " + v + "," : "") + " est l'endroit idéal pour apprendre sur le terrain.",
    ];
    var parts = [ouverture(x), "", intros[hash(x.siren) % intros.length]];
    var mid = [];
    if (p.rythme) mid.push("Le rythme de ma formation est le suivant : " + low1(p.rythme).replace(/[.\s]+$/, "") + ".");
    var e = phraseExp(p); if (e) mid.push(e);
    var q = qualitesTxt(p);
    mid.push(q ? "On me décrit comme " + q + ", et j'ai envie de m'investir concrètement auprès de votre équipe." : "Je suis " + t.motive + " et j'ai envie de m'investir concrètement auprès de votre équipe.");
    if (p.permis) mid.push("Je suis titulaire du permis B.");
    parts.push("", mid.join(" "));
    parts.push("", "Pour vous, l'alternance est aussi un moyen de former une personne à vos méthodes : le coût de la formation est pris en charge par votre OPCO, et une aide de l'État à l'embauche d'un alternant peut s'appliquer selon les conditions en vigueur.");
    parts.push("", "Vous trouverez mon CV en pièce jointe. Je serais " + t.ravi + " d'échanger avec vous, par téléphone ou dans vos locaux, au moment qui vous conviendra.");
    parts.push("", "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.", "", signature(p));
    return parts.join("\n");
  }
  function texteLettre(p, x) {
    var t = T(p), n = nomCourt(x.nom), act = actPrecise(x), v = x.ville || "";
    var q = qualitesTxt(p), e = phraseExp(p);
    var d = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    return [
      p.prenom + " " + p.nom, p.tel, p.email, "",
      n, x.adresse || "", "",
      (v || p.ville) + ", le " + d, "",
      "Objet : candidature pour un contrat en alternance – " + p.metier, "",
      ouverture(x), "",
      "Votre entreprise, " + n + (v ? ", installée à " + v : "") + (act ? " (activité : " + act + ")" : "") + ", est précisément le type de structure dans laquelle je souhaite apprendre le métier de " + p.metier + " : au contact des clients, des équipes et des vraies situations du quotidien.",
      "",
      "Actuellement " + t.inscrit + " en " + p.formation + ecoleTxt(p) + ", je recherche une entreprise pour une alternance" + (p.duree ? " de " + p.duree : "") + " à partir de " + p.debut + "." + (p.rythme ? " Le rythme prévu est le suivant : " + low1(p.rythme).replace(/[.\s]+$/, "") + "." : "") + (e ? " " + e : "") + (q ? " Je suis " + q + ", des qualités que je souhaite mettre au service de votre équipe." : "") + (p.permis ? " Je suis titulaire du permis B." : ""),
      "",
      "Rejoindre " + n + " me permettrait de mettre en pratique ma formation et de vous apporter une aide réelle, tout en me formant à vos méthodes. Le coût de ma formation est pris en charge par votre OPCO, et une aide de l'État à l'embauche d'un alternant peut s'appliquer selon les conditions en vigueur.",
      "",
      "Je serais " + t.ravi + " de vous présenter ma motivation lors d'un entretien, à la date qui vous conviendra.",
      "",
      "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
      "", p.prenom + " " + p.nom,
    ].join("\n");
  }
  function texteRelance(p, x, s) {
    var n = nomCourt(x.nom);
    return [ouverture(x), "",
      "Je me permets de revenir vers vous au sujet de ma candidature pour un contrat en alternance au poste de " + p.metier + ", que je vous ai adressée le " + dateFr(s.date) + ".",
      "", "Mon intérêt pour " + n + " est toujours le même, et je reste " + T(p).disponible + " pour un échange, même court, par téléphone ou dans vos locaux. Je vous joins à nouveau mon CV.",
      "", "Je vous remercie par avance pour votre retour et vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
      "", signature(p)].join("\n");
  }
  function objet(p, doc) {
    return (doc === "relance" ? "Relance – " : "") + "Candidature en alternance – " + p.metier + " – " + p.prenom + " " + p.nom;
  }

  /* ---------- panneau ---------- */
  var cur = null, curDoc = "mail";
  function openSheet(x, doc) {
    if (!x) return;
    cur = x; var id = x.siret || x.siren, s = S.suivi[id];
    $("#sh-title").textContent = nomCourt(x.nom);
    $("#sh-sub").textContent = [x.activite, x.ville].filter(Boolean).join(" · ");
    $("#sh-to").value = s && s.to || "";
    $('[data-doc="relance"]').hidden = !s;
    var q = encodeURIComponent('"' + nomCourt(x.nom) + '" ' + (x.ville || "") + " contact");
    $("#sh-links").innerHTML =
      '<a href="https://www.google.com/search?q=' + q + '" target="_blank" rel="noopener">Trouver son mail ou son site ↗</a>' +
      '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(nomCourt(x.nom) + " " + (x.adresse || "")) + '" target="_blank" rel="noopener">Voir sur la carte ↗</a>' +
      '<a href="https://annuaire-entreprises.data.gouv.fr/entreprise/' + encodeURIComponent(x.siren) + '" target="_blank" rel="noopener">Fiche officielle ↗</a>';
    $("#sh-done").textContent = s ? "Enregistrer" : "J'ai envoyé ma candidature";
    $("#sheet").hidden = false; document.body.style.overflow = "hidden";
    setDoc(doc || "mail");
    setTimeout(function () { $(".x", $("#sheet")).focus(); }, 50);
  }
  function closeSheet() { $("#sheet").hidden = true; document.body.style.overflow = ""; cur = null; }
  $$("[data-close]").forEach(function (b) { b.addEventListener("click", closeSheet); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
  $$("[data-doc]").forEach(function (b) { b.addEventListener("click", function () { setDoc(b.dataset.doc); }); });

  async function setDoc(doc) {
    curDoc = doc;
    $$("[data-doc]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.doc === doc)); });
    var p = S.profil, x = cur, id = x.siret || x.siren, s = S.suivi[id] || {};
    $("#sh-kind").textContent = doc === "relance" ? "Relance" : doc === "lettre" ? "Lettre de motivation" : "Candidature par mail";
    $("#sh-objet").value = objet(p, doc);
    var saved = s.textes && s.textes[doc];
    if (saved) { $("#sh-texte").value = saved; $("#sh-gen").innerHTML = "Ton texte enregistré."; majMail(); return; }
    var modele = doc === "lettre" ? texteLettre(p, x) : doc === "relance" ? texteRelance(p, x, s) : texteMail(p, x);
    $("#sh-texte").value = modele;
    $("#sh-gen").innerHTML = "Écrit pour <b>" + esc(nomCourt(x.nom)) + "</b> avec ton profil. Relis-le avant d'envoyer.";
    majMail();
    if (IA) {
      $("#sh-gen").innerHTML = "<b>L'IA écrit ton texte…</b>";
      try {
        var d = await api("rediger", { type: doc, profil: p, entreprise: { nom: nomCourt(x.nom), activite: x.activite, ville: x.ville, effectif: x.effectif, dirigeant: x.dirigeant } });
        if (cur === x && curDoc === doc && d.texte) { $("#sh-texte").value = d.texte + (doc !== "lettre" && d.texte.indexOf(p.tel) < 0 ? "\n" + p.tel + "\n" + p.email : ""); $("#sh-gen").innerHTML = "<b>Rédigé par l'IA</b> pour " + esc(nomCourt(x.nom)) + ". Relis-le avant d'envoyer."; majMail(); }
      } catch (e) { if (cur === x) $("#sh-gen").innerHTML = "Écrit pour <b>" + esc(nomCourt(x.nom)) + "</b> avec ton profil. Relis-le avant d'envoyer."; }
    }
  }
  function majMail() {
    var to = $("#sh-to").value.trim();
    var body = $("#sh-texte").value;
    if (curDoc === "lettre") body = "Madame, Monsieur,\n\nVeuillez trouver ci-joint ma candidature (CV et lettre de motivation) pour un contrat en alternance.\n\nJe vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\n" + signature(S.profil);
    $("#sh-mail").href = "mailto:" + encodeURIComponent(to).replace(/%40/g, "@") + "?subject=" + encodeURIComponent($("#sh-objet").value) + "&body=" + encodeURIComponent(body);
  }
  ["#sh-to", "#sh-texte", "#sh-objet"].forEach(function (s) { $(s).addEventListener("input", majMail); });
  $("#sh-copy").addEventListener("click", async function () {
    var t = $("#sh-texte").value;
    try { await navigator.clipboard.writeText(t); toast("Texte copié"); }
    catch (e) { $("#sh-texte").select(); document.execCommand && document.execCommand("copy"); toast("Texte sélectionné, copie-le"); }
  });
  $("#sh-mail").addEventListener("click", function () { if (!$("#sh-to").value.trim()) toast("Ajoute l'adresse de l'entreprise dans ta boîte mail"); });
  $("#sh-done").addEventListener("click", function () {
    var x = cur, id = x.siret || x.siren, s = S.suivi[id];
    if (!s) s = S.suivi[id] = { e: x, statut: "envoye", date: new Date().toISOString(), textes: {} };
    s.to = $("#sh-to").value.trim();
    s.doc = curDoc === "relance" ? "mail" : curDoc;
    s.textes = s.textes || {}; s.textes[curDoc] = $("#sh-texte").value;
    if (curDoc === "relance") { s.relance = new Date().toISOString(); s.statut = "relance"; }
    save(); closeSheet(); renderList(); badge();
    toast(curDoc === "relance" ? "Relance notée" : s.date && jours(s.date) === 0 ? "Bravo ! On te rappelle de relancer dans " + RELANCE_J + " jours." : "Enregistré");
  });

  /* ---------- suivi ---------- */
  var LABELS = { envoye: "Envoyée", relance: "Relancée", entretien: "Entretien", refus: "Refus", accepte: "Acceptée 🎉" };
  function aRelancer(s) { return (s.statut === "envoye" && jours(s.date) >= RELANCE_J) || (s.statut === "relance" && s.relance && jours(s.relance) >= 14); }
  function suiviBloc(id, s) {
    var info = "Envoyée le " + dateFr(s.date) + (s.relance ? " · relancée le " + dateFr(s.relance) : "");
    var opts = Object.keys(LABELS).map(function (k) { return '<option value="' + k + '"' + (k === s.statut ? " selected" : "") + ">" + LABELS[k] + "</option>"; }).join("");
    return '<p class="who">' + info + (aRelancer(s) ? ' · <b style="color:var(--warn)">à relancer</b>' : "") + "</p>" +
      '<div class="card-act">' + (aRelancer(s) ? '<button class="btn btn-accent" data-relance="' + esc(id) + '">Relancer</button>' : '<button class="btn btn-ghost" data-voir="' + esc(id) + '">Voir</button>') +
      '<select class="status" style="flex:1" aria-label="Statut de la candidature" data-statut="' + esc(id) + '">' + opts + "</select></div>";
  }
  function renderSuivi() {
    var ids = Object.keys(S.suivi);
    var arr = ids.map(function (id) { return [id, S.suivi[id]]; });
    var n = arr.length, rel = arr.filter(function (a) { return aRelancer(a[1]); }).length;
    var ent = arr.filter(function (a) { return a[1].statut === "entretien"; }).length;
    var ok = arr.filter(function (a) { return a[1].statut === "accepte"; }).length;
    $("#s-stats").innerHTML =
      '<div class="stat"><b>' + n + "</b><span>envoyées</span></div>" +
      '<div class="stat' + (rel ? " hot" : "") + '"><b>' + rel + "</b><span>à relancer</span></div>" +
      '<div class="stat"><b>' + ent + "</b><span>entretiens</span></div>" +
      '<div class="stat win"><b>' + ok + "</b><span>acceptées</span></div>";
    var ordre = { relance: 1, envoye: 1, entretien: 0, accepte: 0, refus: 3 };
    arr.sort(function (a, b) { return (aRelancer(b[1]) - aRelancer(a[1])) || (ordre[a[1].statut] - ordre[b[1].statut]) || (new Date(b[1].date) - new Date(a[1].date)); });
    $("#s-list").innerHTML = n ? arr.map(function (a) { return cardHtml(a[1].e, "suivi"); }).join("") :
      '<div class="empty"><b>Pas encore de candidature</b>Va dans « Entreprises », prépare ta première candidature et clique sur « J\'ai envoyé ».</div>';
  }
  $("#s-list").addEventListener("click", function (e) {
    var r = e.target.closest("[data-relance]"), v = e.target.closest("[data-voir]");
    if (r) openSheet(S.suivi[r.dataset.relance].e, "relance");
    if (v) openSheet(S.suivi[v.dataset.voir].e, S.suivi[v.dataset.voir].doc || "mail");
  });
  $("#s-list").addEventListener("change", function (e) {
    var sel = e.target.closest("[data-statut]"); if (!sel) return;
    S.suivi[sel.dataset.statut].statut = sel.value; save(); renderSuivi(); badge();
    if (sel.value === "accepte") toast("Félicitations ! 🎉");
    if (sel.value === "entretien") toast("Bien joué, prépare-toi bien !");
  });
  function badge() {
    var n = Object.keys(S.suivi).filter(function (id) { return aRelancer(S.suivi[id]); }).length;
    var b = $("#badge-suivi"); b.hidden = !n; b.textContent = n;
  }

  $("#reset").addEventListener("click", function () {
    if (!confirm("Effacer ton profil, tes textes et ton suivi de ce navigateur ?")) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  });

  /* ---------- démarrage ---------- */
  fillForm(); badge();
  var start = location.hash === "#suivi" ? "suivi" : S.profil ? "recherche" : "profil";
  tab(start);
  api("info").then(function (d) { IA = !!d.ia; }).catch(function () {});
})();
