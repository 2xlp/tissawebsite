/* TissaWeb — appli alternance.
   Profil, textes et suivi : dans ce navigateur (localStorage, clé tw-alt) + sauvegarde dans le compte (alt_comptes, actions compte / compte_save).
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
  function store() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function save() { S.maj = Date.now(); store(); if (S.compte) { clearTimeout(save.t); save.t = setTimeout(pousse, 2500); } }
  var R = { data: null, page: 1, items: [], taille: "tout", loading: false };
  var IA = false, FL = {}, infoP = null;
  function keyOf(x) { return x.siret || x.id || x.siren; }
  function getInfo() { return infoP || (infoP = api("info").then(function (d) { FL = d || {}; IA = !!FL.ia; majSource(); majGmail(); majPass(); return FL; }).catch(function () { return FL; })); }

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
    if (name === "cv") renderCv();
    if (name === "recherche" && S.profil && !R.data && !R.loading) search(1);
    if (focus) { var top = $("#app").getBoundingClientRect().top + scrollY - 70; scrollTo({ top: top, behavior: "smooth" }); }
  }
  $$(".tabs [data-tab]").forEach(function (b) { b.addEventListener("click", function () { tab(b.dataset.tab, true); }); });
  $$("[data-go]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); tab(!S.profil ? "profil" : !S.cvMode ? "cv" : "recherche", true); }); });

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
    tab(S.cvMode ? "recherche" : "cv", true);
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
  function source() { return FL.lba && S.source !== "sirene" ? "lba" : "sirene"; }
  function majSource() {
    $("#src-chips").hidden = !FL.lba;
    $$("[data-source]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.source === source())); });
    $("#tip-src").innerHTML = source() === "lba" ? "<b>Entreprises qui recrutent en alternance</b> (service public La bonne alternance) : offres publiées et entreprises qui embauchent souvent des alternants." : "<b>Astuce :</b> les PME répondent plus souvent aux candidatures spontanées. Les grands groupes passent plutôt par leur site carrières.";
  }
  $$("[data-source]").forEach(function (b) { b.addEventListener("click", function () { S.source = b.dataset.source; save(); majSource(); search(1); }); });

  async function search(page) {
    var p = S.profil; if (!p) { tab("profil"); return; }
    R.loading = true;
    await getInfo();
    var list = $("#r-list");
    if (page === 1) { R.items = []; list.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div>'; $("#r-resume").textContent = "Recherche en cours…"; }
    $("#r-more").disabled = true;
    try {
      var d = await api("search", { source: source(), secteur: p.secteur, ville: p.ville, q: p.secteur === "autre" ? p.q : "", zone: S.zone, page: page });
      R.data = d; R.page = d.page;
      var seen = {}; R.items.forEach(function (x) { seen[keyOf(x)] = 1; });
      d.results.forEach(function (x) { if (!seen[keyOf(x)]) R.items.push(x); });
      var nOff = d.results.filter(function (x) { return x.type === "offre"; }).length;
      $("#r-resume").innerHTML = d.source === "lba" ? "<b>" + d.total + "</b> entreprise" + (d.total > 1 ? "s" : "") + " qui recrute" + (d.total > 1 ? "nt" : "") + " en alternance" + (nOff ? " (dont <b>" + nOff + "</b> offre" + (nOff > 1 ? "s" : "") + " publiée" + (nOff > 1 ? "s" : "") + ")" : "") + (S.zone === "dep" ? " autour de " : " près de ") + esc(d.commune.nom) + ", les offres d'abord." : "<b>" + d.total.toLocaleString("fr-FR") + "</b> entreprise" + (d.total > 1 ? "s" : "") + " en " + esc(low1(d.secteur)) + (S.zone === "dep" ? " dans le département " + esc(d.commune.dep) : " à " + esc(d.commune.nom)) + ", classées de la plus proche à la plus loin.";
      $("#r-more").hidden = d.page >= d.pages;
      renderList();
    } catch (e) {
      if (page === 1) list.innerHTML = '<div class="empty"><b>Oups</b>' + esc(e.message) + '</div>';
      else toast(e.message);
      $("#r-resume").textContent = "La recherche n'a pas marché.";
    } finally { R.loading = false; $("#r-more").disabled = false; }
  }

  function cardHtml(x, mode) {
    var id = keyOf(x), s = S.suivi[id];
    var court = nomCourt(x.nom);
    var tags = [];
    if (x.type === "offre") tags.push('<span class="tag hot">Offre d\'alternance</span>');
    if (x.type === "recrute") tags.push('<span class="tag g">Recrute des alternants</span>');
    if (x.debut) tags.push('<span class="tag">Début ' + esc(new Date(x.debut).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })) + "</span>");
    if (x.duree) tags.push('<span class="tag">' + esc(x.duree) + "</span>");
    if (x.km != null) tags.push('<span class="tag">' + (x.km < 1 ? "moins de 1 km" : String(x.km).replace(".", ",") + " km") + "</span>");
    if (x.effectif) tags.push('<span class="tag">' + esc(x.effectif) + "</span>");
    if (!x.groupe && x.type !== "recrute") tags.push('<span class="tag g">PME</span>');
    if (s && mode !== "suivi") tags.push('<span class="tag g">' + esc(LABELS[s.statut] || "Postulé") + "</span>");
    return '<article class="card' + (s ? " done" : "") + '" data-id="' + esc(id) + '">' +
      (x.titre ? "<div><h3>" + esc(x.titre) + '</h3><p class="full"><b>' + esc(court) + "</b></p></div>" : "<div><h3>" + esc(court) + "</h3>" + (court !== x.nom ? '<p class="full">' + esc(x.nom) + "</p>" : "") + "</div>") +
      '<div class="meta"><span class="tag">' + esc(x.activite) + "</span>" + tags.join("") + "</div>" +
      '<p class="addr">' + esc(x.adresse) + "</p>" +
      (x.description && mode !== "suivi" ? '<p class="desc">' + esc(x.description) + "</p>" : "") +
      (x.dirigeant ? '<p class="who">Dirigeant : <b>' + esc(x.dirigeant.nom) + "</b>" + (x.dirigeant.qualite ? ", " + esc(low1(x.dirigeant.qualite)) : "") + "</p>" : "") +
      (mode === "suivi" ? suiviBloc(id, s) :
        '<div class="card-act"><button class="btn btn-accent" data-open="' + esc(id) + '">' + (s ? "Revoir ma candidature" : "Préparer ma candidature") + '</button><button class="btn btn-ghost" data-hide="' + esc(id) + '" aria-label="Masquer ' + esc(court) + '">Masquer</button></div>') +
      "</article>";
  }
  function renderList() {
    var list = $("#r-list");
    var items = R.items.filter(function (x) {
      if (S.masques[keyOf(x)]) return false;
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
    for (var i = 0; i < R.items.length; i++) if (keyOf(R.items[i]) === id) return R.items[i];
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
    if (x.type === "offre" && x.titre) intros = ["Je vous adresse ma candidature pour votre offre d'alternance « " + x.titre + " ». Actuellement " + t.inscrit + " en " + p.formation + ecoleTxt(p) + ", je suis disponible à partir de " + p.debut + " et ce poste correspond exactement à ce que je souhaite apprendre."];
    var parts = [ouverture(x), "", intros[hash(keyOf(x)) % intros.length]];
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
  function texteRelance(p, x, s, auto) {
    var n = nomCourt(x.nom);
    return [ouverture(x), "",
      "Je me permets de revenir vers vous au sujet de ma candidature pour un contrat en alternance au poste de " + p.metier + ", que je vous ai adressée le " + dateFr(s.date) + ".",
      "", "Mon intérêt pour " + n + " est toujours le même, et je reste " + T(p).disponible + " pour un échange, même court, par téléphone ou dans vos locaux." + (auto ? "" : " Je vous joins à nouveau mon CV."),
      "", "Je vous remercie par avance pour votre retour et vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
      "", signature(p)].join("\n");
  }
  function objet(p, doc, x) {
    return (doc === "relance" ? "Relance – " : "") + "Candidature en alternance – " + (x && x.titre ? x.titre : p.metier) + " – " + p.prenom + " " + p.nom;
  }

  /* ---------- panneau ---------- */
  var cur = null, curDoc = "mail";
  function openSheet(x, doc) {
    if (!x) return;
    cur = x; var id = keyOf(x), s = S.suivi[id];
    $("#sh-title").textContent = nomCourt(x.nom);
    $("#sh-sub").textContent = [x.activite, x.ville].filter(Boolean).join(" · ");
    $("#sh-to").value = s && s.to || "";
    $('[data-doc="relance"]').hidden = !s;
    var q = encodeURIComponent('"' + nomCourt(x.nom) + '" ' + (x.ville || "") + " contact");
    $("#sh-links").innerHTML =
      '<a href="https://www.google.com/search?q=' + q + '" target="_blank" rel="noopener">Trouver son mail ou son site ↗</a>' +
      '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(nomCourt(x.nom) + " " + (x.adresse || "")) + '" target="_blank" rel="noopener">Voir sur la carte ↗</a>' +
      (x.siren ? '<a href="https://annuaire-entreprises.data.gouv.fr/entreprise/' + encodeURIComponent(x.siren) + '" target="_blank" rel="noopener">Fiche officielle ↗</a>' : "") +
      (x.apply && x.apply.url ? '<a href="' + esc(x.apply.url) + '" target="_blank" rel="noopener">' + (x.type === "offre" ? "Voir l'offre ↗" : "Sa page La bonne alternance ↗") + "</a>" : "") +
      (x.apply && x.apply.phone ? '<a href="tel:' + esc(x.apply.phone.replace(/[^\d+]/g, "")) + '">Appeler ' + esc(x.apply.phone) + "</a>" : "");
    $("#sh-done").textContent = s ? "Enregistrer" : "J'ai envoyé ma candidature moi-même";
    $("#sheet").hidden = false; document.body.style.overflow = "hidden";
    setDoc(doc || "mail").then(prepare);
    setTimeout(function () { $(".x", $("#sheet")).focus(); }, 50);
  }
  function closeSheet() { $("#sheet").hidden = true; document.body.style.overflow = ""; cur = null; PJ = { cv: null, lettre: null }; }
  $$("[data-close]").forEach(function (b) { b.addEventListener("click", closeSheet); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
  $$("[data-doc]").forEach(function (b) { b.addEventListener("click", function () { setDoc(b.dataset.doc).then(prepare); }); });

  async function setDoc(doc) {
    curDoc = doc;
    $$("[data-doc]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.doc === doc)); });
    var p = S.profil, x = cur, id = keyOf(x), s = S.suivi[id] || {};
    $("#sh-kind").textContent = doc === "relance" ? "Relance" : doc === "lettre" ? "Lettre de motivation" : "Candidature par mail";
    $("#sh-objet").value = objet(p, doc, x);
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
  $("#sh-to").addEventListener("input", function () { majAuto(); });
  $("#sh-texte").addEventListener("input", function () { clearTimeout(prepare.t); prepare.t = setTimeout(prepare, 600); });

  /* pièces jointes prêtes à l'avance : le partage doit partir tout de suite au toucher */
  var PJ = { cv: null, lettre: null }, canFiles = false;
  try { canFiles = !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "t.pdf", { type: "application/pdf" })] })); } catch (e) {}
  async function prepare() {
    if (!cur) return;
    var x = cur, pj = $("#sh-pj");
    pj.innerHTML = "<span>Préparation des PDF…</span>";
    try {
      var r = await Promise.all([cvFichier(), lettreFichier()]);
      if (cur !== x) return;
      PJ = { cv: r[0], lettre: r[1] };
      pj.innerHTML = (PJ.cv ? "<span>CV : " + esc(PJ.cv.name) + "</span>" : '<span class="ko">Pas de CV : ajoute-le dans l\'onglet CV</span>') + "<span>Lettre : " + esc(PJ.lettre.name) + "</span>";
    } catch (e) { pj.innerHTML = '<span class="ko">' + esc(e.message) + "</span>"; }
    $("#sh-share").hidden = !canFiles;
    majAuto();
    $("#sh-share").textContent = PJ.cv ? "Envoyer avec mon CV et ma lettre" : "Envoyer avec ma lettre";
  }
  $("#sh-share").addEventListener("click", function () {
    var files = [PJ.cv, PJ.lettre].filter(Boolean);
    if (!files.length) return toast("Les PDF sont en préparation, réessaie dans une seconde");
    var body = decodeURIComponent(($("#sh-mail").href.split("&body=")[1] || ""));
    navigator.share({ files: files, title: $("#sh-objet").value, text: body })
      .then(function () { toast("Envoyé ? Clique sur « J'ai envoyé ma candidature »"); })
      .catch(function (e) { if (e && e.name !== "AbortError") toast("Partage impossible ici : télécharge les PDF"); });
  });
  $("#sh-dl-lettre").addEventListener("click", async function () { try { var f = PJ.lettre || await lettreFichier(); dl(f, f.name); } catch (e) { toast(e.message); } });
  $("#sh-dl-cv").addEventListener("click", async function () { try { var f = PJ.cv || await cvFichier(); if (!f) { closeSheet(); tab("cv", true); return toast("Ajoute d'abord ton CV"); } dl(f, f.name); } catch (e) { toast(e.message); } });
  $("#sh-copy-objet").addEventListener("click", async function () { try { await navigator.clipboard.writeText($("#sh-objet").value); toast("Objet copié"); } catch (e) { toast("Copie impossible"); } });
  $("#sh-copy").addEventListener("click", async function () {
    var t = $("#sh-texte").value;
    try { await navigator.clipboard.writeText(t); toast("Texte copié"); }
    catch (e) { $("#sh-texte").select(); document.execCommand && document.execCommand("copy"); toast("Texte sélectionné, copie-le"); }
  });
  $("#sh-mail").addEventListener("click", function () { if (!$("#sh-to").value.trim()) toast("Ajoute l'adresse de l'entreprise dans ta boîte mail"); });
  $("#sh-done").addEventListener("click", function () {
    var x = cur, id = keyOf(x), s = S.suivi[id];
    if (!s && suiviPlein()) { paywall("suivi"); return; }
    if (!s) s = S.suivi[id] = { e: x, statut: "envoye", date: new Date().toISOString(), textes: {} };
    s.to = $("#sh-to").value.trim();
    s.doc = curDoc === "relance" ? "mail" : curDoc;
    s.textes = s.textes || {}; s.textes[curDoc] = $("#sh-texte").value;
    if (curDoc === "relance") { s.relance = new Date().toISOString(); s.statut = "relance"; }
    save(); closeSheet(); renderList(); badge();
    toast(curDoc === "relance" ? "Relance notée" : s.date && jours(s.date) === 0 ? "Bravo ! On te rappelle de relancer dans " + RELANCE_J + " jours." : "Enregistré");
  });




  /* ---------- Pass payant (Essentiel 4,99 € / Pro 9,99 €) ---------- */
  var SUIVI_MAX = 10;
  function tier() { return S.pass && S.pass.v ? S.pass.tier : ""; }
  function isEss() { return !FL.pay || tier() === "essentiel" || tier() === "pro"; }
  function isPro() { return !FL.pay || tier() === "pro"; }
  function lienPay(u) { if (!u) return "#"; var em = (S.profil && S.profil.email) || ""; return u + (u.indexOf("?") < 0 ? "?" : "&") + (em ? "prefilled_email=" + encodeURIComponent(em) + "&" : "") + "locale=fr"; }
  var PW_WHY = {
    modele: "Ce modèle fait partie des 8 modèles premium, inclus dès l'offre Essentiel.",
    suivi: "Tu suis déjà " + SUIVI_MAX + " candidatures, le maximum de l'offre gratuite.",
    envoi: "Tu as utilisé tes 3 envois automatiques du mois. Avec Pro, l'appli envoie et relance pour toi sans limite.",
    menu: "Garde l'offre gratuite ou passe à la vitesse supérieure.",
    export: "L'export Excel de ton suivi est inclus dès l'offre Essentiel.",
    kit: "Le kit entretien fait partie de l'offre Pro.",
  };
  var OFFRES = { gratuit: { n: "Gratuit", p: "0 €", r: 0 }, essentiel: { n: "Essentiel", p: "4,99 €", r: 1 }, pro: { n: "Pro", p: "9,99 €", r: 2 } };
  var ofChoix = "pro", ofWhy = "menu";
  function ofRang() { return S.pass && S.pass.admin ? 2 : OFFRES[tier() || "gratuit"].r; }
  function ofMaj() {
    var r = ofRang();
    $("#of-compte").addEventListener("click", function () { $("#paywall").hidden = true; ouvreCompte(); });
  $$(".of-plan").forEach(function (c) {
      var k = c.dataset.plan, o = OFFRES[k];
      var bloque = o.r < r || (k === "essentiel" && (ofWhy === "envoi" || ofWhy === "kit"));
      c.setAttribute("aria-checked", String(k === ofChoix));
      c.disabled = bloque && o.r !== r;
      c.classList.toggle("is-cur", o.r === r);
      $(".of-cur", c).hidden = o.r !== r;
      var tag = $(".of-tag:not(.of-cur)", c); if (tag) tag.hidden = o.r === r;
    });
    $$("[data-col]").forEach(function (el) { el.classList.toggle("sel", el.dataset.col === ofChoix); });
    var o = OFFRES[ofChoix], go = $("#of-go");
    $("#of-sum-n").textContent = o.n;
    if (o.r <= r) {
      $("#of-sum-p").textContent = o.r === r ? "C'est ton offre actuelle" : "Déjà inclus dans ton offre";
      go.textContent = "Continuer"; go.removeAttribute("href"); go.dataset.close = "1";
    } else {
      $("#of-sum-p").textContent = o.p + " · une fois, à vie";
      go.textContent = "Payer " + o.p; go.href = lienPay(FL.links && FL.links[ofChoix]); delete go.dataset.close;
    }
  }
  function paywall(why) {
    if (!FL.pay) return;
    ofWhy = why || "menu";
    $("#pw-why").textContent = PW_WHY[ofWhy] || PW_WHY.menu;
    var r = ofRang();
    ofChoix = r >= 2 ? "pro" : ofWhy === "envoi" || ofWhy === "kit" || r === 1 ? "pro" : ofWhy === "modele" || ofWhy === "suivi" || ofWhy === "export" ? "essentiel" : "pro";
    if (ofWhy === "menu" && r === 0) ofChoix = "pro";
    $("#pw-err").hidden = true; $("#pw-restore-box").hidden = true;
    $("#of-warn").hidden = !!S.compte;
    ofMaj();
    $("#paywall").hidden = false; document.body.style.overflow = "hidden";
  }
  $$(".of-plan").forEach(function (c) { c.addEventListener("click", function () { if (c.disabled) return; ofChoix = c.dataset.plan; ofMaj(); }); });
  $("#of-go").addEventListener("click", function (e) { if (this.dataset.close) { e.preventDefault(); $("#paywall").hidden = true; document.body.style.overflow = ""; } });
  $$("[data-close-pw]").forEach(function (b) { b.addEventListener("click", function () { $("#paywall").hidden = true; document.body.style.overflow = ""; }); });
  $("#pw-restore").addEventListener("click", function () { $("#pw-restore-box").hidden = false; $("#pw-mail").value = (S.profil && S.profil.email) || ""; $("#pw-mail").focus(); });
  $("#pw-restore-go").addEventListener("click", async function () {
    var b = this; b.disabled = true; $("#pw-err").hidden = true;
    try { var d = await api("restaurer", { email: $("#pw-mail").value.trim() }); S.pass = { tier: d.tier, email: d.email, v: d.jeton }; save(); majPass(); $("#paywall").hidden = true; document.body.style.overflow = ""; toast("Offre " + (d.tier === "pro" ? "Pro" : "Essentiel") + " récupérée ✓"); }
    catch (e) { $("#pw-err").textContent = e.message; $("#pw-err").hidden = false; } finally { b.disabled = false; }
  });
  function majPass() {
    var b = $("#pass-btn"); if (!b) return;
    b.hidden = !FL.pay;
    if (FL.pay) { $("#free").hidden = true; var t = tier(); b.textContent = S.pass && S.pass.admin ? "Admin ✓" : S.pass && S.pass.invite ? "Accès offert ✓" : t === "pro" ? "Offre Pro ✓" : t === "essentiel" ? "Offre Essentiel ✓" : "Voir les offres"; b.classList.toggle("on", !!t); }
    if (galFait) galerie();
    if (cur) majAuto();
    majOutils();
  }
  $("#pass-btn").addEventListener("click", function () { paywall("menu"); });
  function suiviPlein() { return !isEss() && Object.keys(S.suivi).length >= SUIVI_MAX; }
  (function () {
    var q = new URLSearchParams(location.search);
    if (q.get("pass") === "ok") { history.replaceState(null, "", location.pathname + location.hash); setTimeout(function () { toast(S.pass ? "Merci ! Pass " + (S.pass.tier === "pro" ? "Pro" : "Essentiel") + " activé ✓" : "Pass activé"); }, 400); }
  })();

  /* ---------- envoi automatique ---------- */
  /* ---------- Gmail de l'étudiant ---------- */
  var GREDIR = "https://tissaweb.fr/alternance/google.html";
  function gmailOk() { return !!(FL.gmail && S.gmail && S.gmail.v); }
  function gmailConnect() {
    if (!FL.gclient) { toast("Connexion Gmail indisponible pour le moment"); return; }
    var st = Array.from(crypto.getRandomValues(new Uint8Array(16)), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    try { sessionStorage.setItem("tw-alt-gstate", st); } catch (e) {}
    var em = (S.profil && S.profil.email) || "";
    location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: FL.gclient, redirect_uri: GREDIR, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true",
      scope: "openid email https://www.googleapis.com/auth/gmail.send", state: st, login_hint: /@(gmail|googlemail)\.com$/i.test(em) ? em : "" }).toString();
  }
  function majGmail() {
    var box = $("#gm-box"); if (!box) return;
    box.hidden = !FL.gmail;
    var on = gmailOk();
    box.classList.toggle("on", on);
    $("#gm-go").hidden = on; $("#gm-off").hidden = !on; $("#gm-alt").hidden = on; if (on) $("#gm-alt-box").hidden = true;
    $("#gm-etat").innerHTML = on ? "Connecté : tes candidatures et relances partent de <b>" + esc(S.gmail.email) + "</b>. L'appli peut seulement envoyer, jamais lire tes mails."
      : "Connecte ton Gmail : l'appli envoie tes candidatures et tes relances depuis ta propre adresse. Elle peut seulement envoyer, jamais lire tes mails.";
    if (cur) majAuto();
  }
  $("#gm-go").addEventListener("click", gmailConnect);
  $("#gm-alt").addEventListener("click", function () { var bx = $("#gm-alt-box"); bx.hidden = !bx.hidden; if (!bx.hidden) { $("#gm-alt-mail").value = $("#gm-alt-mail").value || (S.profil && S.profil.email) || ""; $("#gm-alt-mail").focus(); } });
  $("#gm-alt-go").addEventListener("click", async function () {
    var b = this; b.disabled = true; b.textContent = "Vérification…";
    try {
      var d = await api("gsmtp", { email: $("#gm-alt-mail").value.trim(), mdp: $("#gm-alt-mdp").value });
      S.gmail = { email: d.email, v: d.jeton }; save(); $("#gm-alt-mdp").value = ""; majGmail(); toast("Gmail connecté ✓");
    } catch (e) { toast(e.message); } finally { b.disabled = false; b.textContent = "Connecter mon Gmail"; }
  });
  $("#sh-gmail").addEventListener("click", function () { toast("Connexion à Google…"); gmailConnect(); });
  $("#gm-off").addEventListener("click", async function () {
    var b = this; b.disabled = true;
    try { await api("gdeconnect", { jeton: S.gmail.v }); } catch (e) {}
    delete S.gmail; save(); majGmail(); b.disabled = false; toast("Gmail déconnecté");
  });
  (function () {
    var q = new URLSearchParams(location.search);
    if (q.get("gmail") === "ok") { history.replaceState(null, "", location.pathname + location.hash); setTimeout(function () { toast(S.gmail ? "Gmail connecté : " + S.gmail.email : "Gmail connecté"); }, 400); }
  })();

  function modeAuto() {
    if (!cur) return "";
    if (cur.apply && cur.apply.recipient_id && FL.postuler) return "lba";
    if ((FL.envoi || gmailOk()) && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test($("#sh-to").value.trim())) return "mail";
    return "";
  }
  function majAuto() {
    var m = modeAuto(), box = $("#sh-auto"), lba = cur && cur.apply && cur.apply.recipient_id && FL.postuler;
    var besoinGmail = !lba && FL.gmail && !gmailOk() && !FL.envoi;
    box.hidden = !m && !((FL.envoi || FL.gmail) && cur && !lba);
    $("#sh-auto-go").hidden = !m;
    $("#sh-gmail").hidden = !besoinGmail;
    $("#sh-auto-rel").hidden = m !== "mail";
    var adr = gmailOk() ? S.gmail.email : S.profil.email;
    $("#sh-auto-info").innerHTML = m === "lba" ? "Ta candidature (texte + CV) part directement chez le recruteur par <b>La bonne alternance</b>. Il te répondra sur <b>" + esc(S.profil.email) + "</b>."
      : m === "mail" && gmailOk() ? "L'appli envoie ton mail avec ton CV et ta lettre en PDF depuis <b>ton Gmail (" + esc(adr) + ")</b>. Tu le retrouveras dans tes « Envoyés » et les réponses arrivent directement chez toi." + (isPro() ? "" : " <br><small>" + ((FL.gratuit && FL.gratuit.envois) || 3) + " envois automatiques gratuits par mois, illimités avec le Pass Pro.</small>")
      : m === "mail" ? "L'appli envoie ton mail avec ton CV et ta lettre en PDF depuis <b>candidatures@tissaweb.fr</b>, à ton nom. Les réponses arrivent sur <b>" + esc(adr) + "</b>."
      : besoinGmail ? "Connecte ton Gmail une fois : ensuite, l'appli envoie tes candidatures depuis ta propre adresse, avec relance automatique au bout de 7 jours."
      : "Ajoute l'adresse mail de l'entreprise ci-dessus et l'appli enverra ta candidature à ta place, avec relance automatique.";
  }
  function dataUrl(f) { return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(String(r.result).replace(/^data:[^;]*;/, "data:application/pdf;")); }; r.onerror = function () { ko(r.error); }; r.readAsDataURL(f); }); }
  function corpsMail() {
    return curDoc === "lettre" ? "Madame, Monsieur,\n\nVeuillez trouver ci-joint ma candidature (CV et lettre de motivation) pour un contrat en alternance.\n\nJe vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\n" + signature(S.profil) : $("#sh-texte").value;
  }
  /* vérification de l'adresse de l'étudiant */
  var verifOk = null;
  function jetonValide() { return S.jeton && S.jeton.email === (S.profil.email || "").toLowerCase() ? S.jeton.v : null; }
  function demanderVerif() {
    return new Promise(function (ok) {
      verifOk = ok;
      $("#vf-mail").textContent = S.profil.email; $("#vf-code").value = ""; $("#vf-step2").hidden = true; $("#vf-err").hidden = true;
      $("#verif").hidden = false; setTimeout(function () { $("#vf-send").focus(); }, 50);
    });
  }
  function finVerif(v) { $("#verif").hidden = true; if (verifOk) { var f = verifOk; verifOk = null; f(v); } }
  $$("[data-close-verif]").forEach(function (b) { b.addEventListener("click", function () { finVerif(null); }); });
  $("#vf-send").addEventListener("click", async function () {
    var b = this; b.disabled = true;
    try { await api("code", { email: S.profil.email }); $("#vf-step2").hidden = false; $("#vf-code").focus(); toast("Code envoyé sur " + S.profil.email); }
    catch (e) { $("#vf-err").textContent = e.message; $("#vf-err").hidden = false; } finally { b.disabled = false; }
  });
  $("#vf-ok").addEventListener("click", async function () {
    var b = this; b.disabled = true;
    try { var d = await api("verif", { email: S.profil.email, code: $("#vf-code").value.trim() }); S.jeton = { email: S.profil.email.toLowerCase(), v: d.jeton }; save(); finVerif(d.jeton); }
    catch (e) { $("#vf-err").textContent = e.message; $("#vf-err").hidden = false; } finally { b.disabled = false; }
  });
  $("#sh-auto-go").addEventListener("click", async function () {
    var m = modeAuto(), btn = this, x = cur; if (!m) return;
    if (!PJ.cv) { toast("Ajoute d'abord ton CV (onglet CV)"); return; }
    if (!S.suivi[keyOf(x)] && suiviPlein()) { paywall("suivi"); return; }
    btn.disabled = true; var old = btn.textContent; btn.textContent = "Envoi en cours…";
    try {
      var id = keyOf(x), s = S.suivi[id] || (S.suivi[id] = { e: x, statut: "envoye", date: new Date().toISOString(), textes: {} });
      if (m === "lba") {
        var msg = curDoc === "lettre" ? $("#sh-texte").value : (s.textes && s.textes.lettre) || texteLettre(S.profil, x);
        await api("postuler", { recipient_id: x.apply.recipient_id, profil: S.profil, cv: { name: PJ.cv.name, content: await dataUrl(PJ.cv) }, message: $("#sh-texte").value || msg });
        s.via = "lba";
      } else {
        var j = gmailOk() ? S.gmail.v : jetonValide() || await demanderVerif();
        if (!j) throw new Error("Adresse non vérifiée, envoi annulé");
        var rel = $("#sh-auto-rel-cb").checked ? { subject: "Relance – " + $("#sh-objet").value, text: texteRelance(S.profil, x, { date: new Date().toISOString() }, true) } : null;
        var d = await api("envoyer", { jeton: j, profil: S.profil, to: $("#sh-to").value.trim(), to_name: nomCourt(x.nom), subject: $("#sh-objet").value, text: corpsMail(), pass: S.pass && S.pass.v,
          attachments: [{ name: PJ.cv.name, content: await dataUrl(PJ.cv) }, { name: PJ.lettre.name, content: await dataUrl(PJ.lettre) }], relance: rel });
        s.via = d.via === "gmail" ? "gmail" : "auto"; s.envoiId = d.id; s.relanceAuto = d.relance_at || null;
      }
      s.statut = "envoye"; s.date = s.date || new Date().toISOString(); s.to = $("#sh-to").value.trim();
      s.doc = curDoc === "relance" ? "mail" : curDoc; s.textes = s.textes || {}; s.textes[curDoc] = $("#sh-texte").value;
      save(); closeSheet(); renderList(); badge();
      toast(m === "lba" ? "Candidature envoyée ! Le recruteur te répondra par mail." : "Candidature envoyée" + (s.via === "gmail" ? " depuis ton Gmail" : "") + " !" + (s.relanceAuto ? " Relance auto dans 7 jours." : ""));
    } catch (e) {
      if (e.status === 402) { if (S.pass && S.pass.invite) { delete S.pass; save(); majPass(); } paywall("envoi"); return; }
      if (/reconnecte ton gmail/i.test(e.message)) { delete S.gmail; save(); majGmail(); }
      else if (e.status === 401 || /vérifie à nouveau/i.test(e.message)) { if (gmailOk()) delete S.gmail; else delete S.jeton; save(); majGmail(); }
      toast(e.message);
    } finally { btn.disabled = false; btn.textContent = old; }
  });

  /* ---------- CV ---------- */
  var CV = window.TACV;
  S.cv = S.cv || { modele: "emeraude", couleur: "violet", exps: [{}], forms: [] };
  if (!S.cv.modele || S.cv.modele === "moderne") S.cv.modele = "emeraude";
  if (!CV.COULEURS[S.cv.couleur]) S.cv.couleur = "vert";
  var vue = "moi";
  function cap1(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function ascii(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function cvNom() { return "CV-" + ascii(S.profil.prenom + " " + S.profil.nom) + ".pdf"; }
  function dl(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 30000);
  }
  function cvDefaults() {
    var p = S.profil; if (!p) return;
    if (!S.cv.forms || !S.cv.forms.length) S.cv.forms = [{ diplome: p.formation, ecole: p.ecole, ville: p.ville, debut: "", fin: "En cours" }];
    if (!S.cv.exps || !S.cv.exps.length) S.cv.exps = [{}];
    if (!S.cv.titre) S.cv.titre = "Alternance – " + cap1(p.metier);
  }
  function accroche(p) {
    var q = qualitesTxt(p);
    return (p.genre === "f" ? "Étudiante" : "Étudiant") + " en " + p.formation + ecoleTxt(p) + ", je recherche une alternance" + (p.duree ? " de " + p.duree : "") + " en tant que " + p.metier + " à partir de " + p.debut + ". " +
      (q ? cap1(q) + ", j'ai" : "J'ai") + " envie d'apprendre sur le terrain et de m'investir pleinement dans une équipe.";
  }
  var FIELDS = {
    exps: [["poste", "Poste", "ex. Vendeur en boulangerie"], ["entreprise", "Entreprise", "ex. Maison Martin"], ["ville", "Ville", "ex. Dijon"], ["debut", "Début", "ex. juin 2025"], ["fin", "Fin", "ex. août 2025"], ["missions", "Missions (une par ligne)", "Accueil et conseil des clients\nEncaissement\nMise en rayon"]],
    forms: [["diplome", "Diplôme", "ex. Bac STMG"], ["ecole", "Établissement", "ex. Lycée Carnot"], ["ville", "Ville", "ex. Dijon"], ["debut", "Début", "ex. 2022"], ["fin", "Fin", "ex. 2025"]],
  };
  function renderReps(kind) {
    var box = $(kind === "exps" ? "#cv-exps" : "#cv-forms");
    box.innerHTML = (S.cv[kind] || []).map(function (it, i) {
      var f = FIELDS[kind], inp = function (d) {
        var v = esc(it[d[0]] || "");
        return d[0] === "missions" ? '<label>' + d[1] + '<textarea rows="3" data-k="' + kind + '" data-i="' + i + '" data-f="' + d[0] + '" placeholder="' + esc(d[2]) + '">' + v + "</textarea></label>"
          : '<label>' + d[1] + '<input data-k="' + kind + '" data-i="' + i + '" data-f="' + d[0] + '" value="' + v + '" placeholder="' + esc(d[2]) + '"></label>';
      };
      return '<div class="item"><button type="button" class="del" data-del="' + kind + '" data-i="' + i + '">Supprimer</button>' +
        inp(f[0]) + '<div class="row2">' + inp(f[1]) + inp(f[2]) + "</div>" + '<div class="row2">' + inp(f[3]) + inp(f[4]) + "</div>" + (f[5] ? inp(f[5]) : "") + "</div>";
    }).join("") || '<p class="opt">Rien pour l\'instant.</p>';
  }
  function setPressed(sel, attr, val) { $$(sel).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset[attr] === val)); }); }
  async function renderCv() {
    if (!S.profil) { $("#cv-genere").hidden = $("#cv-import").hidden = true; $(".choix").hidden = true; $("#cv-next").hidden = true; $("#v-cv .vhead p").textContent = "Remplis d'abord ton profil (onglet 1)."; return; }
    $(".choix").hidden = false; $("#v-cv .vhead p").textContent = "Mets ton CV ou crée-le ici en 5 minutes. Il sera joint à tes candidatures.";
    setPressed("[data-mode]", "mode", S.cvMode || "");
    $("#cv-import").hidden = S.cvMode !== "import";
    $("#cv-genere").hidden = S.cvMode !== "genere";
    $("#cv-next").hidden = !S.cvMode;
    if (S.cvMode === "import") fileInfo();
    if (S.cvMode === "genere") {
      cvDefaults();
      var f = $("#f-cv");
      ["titre", "accroche", "competences", "langues", "logiciels", "interets"].forEach(function (n) { f[n].value = S.cv[n] || ""; });
      renderReps("exps"); renderReps("forms");
      setPressed("[data-couleur]", "couleur", S.cv.couleur);
      galerie(); thumb(); preview();
    }
  }
  $$("[data-mode]").forEach(function (b) { b.addEventListener("click", function () { S.cvMode = b.dataset.mode; save(); renderCv(); }); });
  $("#cv-next").addEventListener("click", function () { tab("recherche", true); });

  /* CV importé */
  async function fileInfo() {
    var rec = await CV.fichiers.get("cv"), box = $("#cv-file-info");
    box.innerHTML = rec ? '<div class="file"><span class="file-ic">PDF</span><div><b>' + esc(rec.name) + "</b><small>" + Math.round(rec.size / 1024) + ' Ko · ajouté le ' + dateFr(rec.date) + '</small></div><button class="btn btn-ghost btn-sm" id="cv-voir">Voir</button><button class="linklike" id="cv-suppr">Supprimer</button></div>'
      : "<p class=\"opt\">Aucun CV pour l'instant. Choisis ton fichier PDF (8 Mo maximum).</p>";
    if (!rec) return;
    $("#cv-voir").onclick = function () { var u = URL.createObjectURL(rec.blob); window.open(u, "_blank"); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); };
    $("#cv-suppr").onclick = async function () { await CV.fichiers.del("cv"); fileInfo(); toast("CV supprimé"); };
  }
  $("#cv-file").addEventListener("change", async function () {
    var f = this.files[0]; this.value = "";
    if (!f) return;
    if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return toast("Choisis un fichier PDF");
    if (f.size > 8 * 1024 * 1024) return toast("Fichier trop lourd (8 Mo maximum)");
    try { await CV.fichiers.put("cv", { name: f.name, size: f.size, date: new Date().toISOString(), blob: f }); toast("CV enregistré"); fileInfo(); }
    catch (e) { toast("Impossible d'enregistrer le fichier sur cet appareil"); }
  });

  /* CV créé */
  var pvT = null, pvN = 0;
  function preview() { clearTimeout(pvT); pvT = setTimeout(async function () {
    var n = ++pvN;
    try {
      var src = vue === "exemple" ? CV.exemple() : { p: S.profil, cv: S.cv };
      if (vue === "exemple") { src.cv.modele = S.cv.modele; src.cv.couleur = S.cv.couleur; }
      var r = await CV.cvPdf(src.p, src.cv); if (n === pvN) await CV.draw($("#cv-prev"), r);
    }
    catch (e) { $("#cv-prev").innerHTML = '<div class="empty"><b>Aperçu indisponible</b>' + esc(e.message) + "</div>"; }
  }, 300); }
  function thumb() { var t = $("#cv-photo-prev"); t.style.backgroundImage = S.cv.photo ? "url(" + S.cv.photo + ")" : ""; t.textContent = S.cv.photo ? "" : "Photo"; $("#cv-photo-del").hidden = !S.cv.photo; }
  $("#f-cv").addEventListener("input", function (e) {
    var el = e.target;
    if (el.dataset.k) S.cv[el.dataset.k][+el.dataset.i][el.dataset.f] = el.value;
    else if (el.name) S.cv[el.name] = el.value;
    else return;
    save(); preview();
  });
  $("#f-cv").addEventListener("click", function (e) {
    var d = e.target.closest("[data-del]"), a = e.target.closest("[data-add]");
    if (d) { S.cv[d.dataset.del].splice(+d.dataset.i, 1); save(); renderReps(d.dataset.del); preview(); }
    if (a) { var k = a.dataset.add; (S.cv[k] = S.cv[k] || []).push({}); save(); renderReps(k); var ins = $$("[data-k=" + k + "]"); if (ins.length) ins[ins.length - FIELDS[k].length].focus(); }
  });
  $("#cv-accroche").addEventListener("click", function () { S.cv.accroche = accroche(S.profil); $("#f-cv").accroche.value = S.cv.accroche; save(); preview(); toast("Accroche écrite, tu peux la modifier"); });
  $("#cv-photo").addEventListener("change", async function () {
    var f = this.files[0]; this.value = ""; if (!f) return;
    try { S.cv.photo = await CV.photo(f); save(); thumb(); preview(); } catch (e) { toast(e.message); }
  });
  $("#cv-photo-del").addEventListener("click", function () { delete S.cv.photo; save(); thumb(); preview(); });
  var galFait = false;
  async function galerie() {
    var box = $("#cv-gal");
    if (!galFait) {
      galFait = true;
      box.innerHTML = CV.MODELES.map(function (m) { return '<button class="tpl" role="radio" data-tpl="' + m.id + '"><span class="ph"></span><b>' + esc(m.nom) + "</b><small>" + esc(m.desc) + "</small></button>"; }).join("");
      for (var i = 0; i < CV.MODELES.length; i++) {
        var m = CV.MODELES[i], ex = CV.exemple(); ex.cv.modele = m.id; ex.cv.couleur = m.couleur;
        try { var c = await CV.vignette(ex.p, ex.cv, 140); var ph = $('[data-tpl="' + m.id + '"] .ph', box); if (ph) ph.replaceWith(c); } catch (e) {}
      }
    }
    $$(".tpl", box).forEach(function (b) {
      b.setAttribute("aria-checked", String(b.dataset.tpl === S.cv.modele));
      var m = CV.MODELES.filter(function (x) { return x.id === b.dataset.tpl; })[0];
      b.classList.toggle("locked", !!(m && m.premium && !isEss()));
    });
  }
  $("#cv-gal").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tpl]"); if (!b) return;
    var m = CV.MODELES.filter(function (x) { return x.id === b.dataset.tpl; })[0];
    if (m && m.premium && !isEss()) { paywall("modele"); return; }
    S.cv.modele = b.dataset.tpl;
    if (!S.cv.couleurChoisie && m) S.cv.couleur = m.couleur;
    save(); galerie(); setPressed("[data-couleur]", "couleur", S.cv.couleur); preview();
  });
  $$("[data-vue]").forEach(function (b) { b.addEventListener("click", function () { vue = b.dataset.vue; setPressed("[data-vue]", "vue", vue); $("#cv-ex-note").hidden = vue !== "exemple"; preview(); }); });
  $$("[data-couleur]").forEach(function (b) { b.addEventListener("click", function () { S.cv.couleur = b.dataset.couleur; S.cv.couleurChoisie = true; save(); setPressed("[data-couleur]", "couleur", S.cv.couleur); preview(); }); });
  $("#cv-voir-haut").addEventListener("click", function () { $("#cv-prev").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#cv-dl").addEventListener("click", async function () {
    var btn = this; btn.disabled = true;
    try { var r = await CV.cvPdf(S.profil, S.cv); if (!isEss()) CV.marque(r.doc); dl(r.doc.output("blob"), cvNom()); toast(r.pages > 1 ? "CV téléchargé (" + r.pages + " pages : raccourcis un peu pour tenir sur 1 page)" : "CV téléchargé"); }
    catch (e) { toast(e.message); } finally { btn.disabled = false; }
  });

  /* fichiers joints aux candidatures */
  async function cvFichier() {
    if (S.cvMode === "import") { var rec = await CV.fichiers.get("cv"); return rec ? new File([rec.blob], rec.name, { type: "application/pdf" }) : null; }
    if (S.cvMode === "genere") { cvDefaults(); var r = await CV.cvPdf(S.profil, S.cv); if (!isEss()) CV.marque(r.doc); return new File([r.doc.output("blob")], cvNom(), { type: "application/pdf" }); }
    return null;
  }
  function lettreTexte() {
    var id = keyOf(cur), s = S.suivi[id];
    if (curDoc === "lettre") return $("#sh-texte").value;
    return (s && s.textes && s.textes.lettre) || texteLettre(S.profil, cur);
  }
  async function lettreFichier() {
    var d = await CV.lettrePdf(lettreTexte(), S.profil, S.cvMode === "genere" ? S.cv : null);
    if (!isEss()) CV.marque(d);
    return new File([d.output("blob")], "Lettre-motivation-" + ascii(S.profil.prenom + " " + S.profil.nom) + "-" + ascii(nomCourt(cur.nom)).slice(0, 40) + ".pdf", { type: "application/pdf" });
  }

  /* ---------- suivi ---------- */
  var LABELS = { envoye: "Envoyée", relance: "Relancée", entretien: "Entretien", refus: "Refus", accepte: "Acceptée 🎉" };
  function aRelancer(s) { if (s.relanceAuto) return false; return (s.statut === "envoye" && jours(s.date) >= RELANCE_J) || (s.statut === "relance" && s.relance && jours(s.relance) >= 14); }
  function suiviBloc(id, s) {
    var info = "Envoyée le " + dateFr(s.date) + (s.via === "lba" ? " via La bonne alternance" : s.via === "auto" ? " par l'appli" : s.via === "gmail" ? " depuis ton Gmail" : "") + (s.relance ? " · relancée le " + dateFr(s.relance) : "");
    if (s.relanceAuto) info += new Date(s.relanceAuto) > new Date() ? ' · <b>relance auto le ' + dateFr(s.relanceAuto) + '</b> <button class="linklike" data-annuler="' + esc(id) + '">annuler</button>' : " · relance auto envoyée le " + dateFr(s.relanceAuto);
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
    var r = e.target.closest("[data-relance]"), v = e.target.closest("[data-voir]"), an = e.target.closest("[data-annuler]");
    if (an) { var sv = S.suivi[an.dataset.annuler]; api("annuler", { jeton: (sv.via === "gmail" && S.gmail ? S.gmail.v : null) || jetonValide() || (S.gmail && S.gmail.v), id: sv.envoiId }).then(function () { sv.relanceAuto = null; save(); renderSuivi(); badge(); toast("Relance automatique annulée"); }).catch(function (er) { toast(er.message); }); return; }
    if (r) openSheet(S.suivi[r.dataset.relance].e, "relance");
    if (v) openSheet(S.suivi[v.dataset.voir].e, S.suivi[v.dataset.voir].doc || "mail");
  });
  $("#s-list").addEventListener("change", function (e) {
    var sel = e.target.closest("[data-statut]"); if (!sel) return;
    S.suivi[sel.dataset.statut].statut = sel.value; save(); renderSuivi(); badge();
    if (sel.value === "accepte") toast("Félicitations ! 🎉");
    if (sel.value === "entretien") toast(isPro() ? "Bien joué ! Ouvre le kit entretien pour te préparer" : "Bien joué, prépare-toi bien !");
  });
  function majOutils() { $$(".tool .lock").forEach(function (l) { l.hidden = !FL.pay || (l.dataset.lock === "pro" ? isPro() : isEss()); }); }
  function csvCell(v) { v = String(v == null ? "" : v).replace(/\s+/g, " ").trim(); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  var STATUTS = { envoye: "Envoyée", relance: "Relancée", entretien: "Entretien", accepte: "Acceptée", refus: "Refusée" };
  $("#s-export").addEventListener("click", function () {
    if (!isEss()) { paywall("export"); return; }
    var ids = Object.keys(S.suivi); if (!ids.length) { toast("Ton suivi est vide pour l'instant"); return; }
    var lignes = [["Entreprise", "Activité", "Ville", "Adresse", "Contact", "Date d'envoi", "Statut", "Relance"].join(";")];
    ids.forEach(function (id) { var a = S.suivi[id], e = a.e || {};
      lignes.push([nomCourt(e.nom), e.activite, e.ville, e.adresse, e.dirigeant ? e.dirigeant.nom : "", a.date ? new Date(a.date).toLocaleDateString("fr-FR") : "", STATUTS[a.statut] || a.statut, a.relanceAuto ? "Automatique" : ""].map(csvCell).join(";")); });
    dl(new Blob(["\ufeff" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8" }), "Suivi-alternance.csv");
    toast("Tableau téléchargé : ouvre-le avec Excel");
  });
  function kitMail() {
    var p = S.profil || {};
    return "Objet : Merci pour notre entretien\n\nMadame, Monsieur,\n\nJe vous remercie pour le temps que vous m'avez accordé aujourd'hui. Notre échange m'a confirmé mon envie de rejoindre votre équipe en alternance" + (p.formation ? " dans le cadre de mon " + p.formation : "") + ".\n\nJe reste disponible pour tout complément d'information et serais ravi(e) de mettre ma motivation au service de votre entreprise.\n\nBien cordialement,\n" + ((p.prenom || "") + " " + (p.nom || "")).trim() + (p.tel ? "\n" + p.tel : "");
  }
  $("#s-kit").addEventListener("click", function () {
    if (!isPro()) { paywall("kit"); return; }
    $("#kit-mail").value = kitMail(); $("#kit").hidden = false; document.body.style.overflow = "hidden";
  });
  $$("[data-close-kit]").forEach(function (b) { b.addEventListener("click", function () { $("#kit").hidden = true; document.body.style.overflow = ""; }); });
  $("#kit-copy").addEventListener("click", function () { navigator.clipboard.writeText($("#kit-mail").value).then(function () { toast("Mail copié ✓"); }, function () { $("#kit-mail").select(); }); });
  function badge() {
    var n = Object.keys(S.suivi).filter(function (id) { return aRelancer(S.suivi[id]); }).length;
    var b = $("#badge-suivi"); b.hidden = !n; b.textContent = n;
  }

  $("#reset").addEventListener("click", function () {
    if (!confirm(S.compte ? "Supprimer ton compte et toutes tes données (profil, CV, textes, suivi) ? C'est définitif." : "Effacer ton profil, ton CV, tes textes et ton suivi de cet appareil ?")) return;
    var fin = function () { try { localStorage.removeItem(KEY); } catch (e) {} CV.fichiers.del("cv").finally(function () { location.reload(); }); };
    if (S.compte) api("compte_suppr", { cjeton: S.compte.cj }).then(fin, function (e) { toast(e.message); }); else fin();
  });

  /* ---------- compte (sauvegarde sur le serveur) ---------- */
  function donnees() { var d = JSON.parse(JSON.stringify(S)); delete d.compte; delete d.pass; delete d.maj; return d; }
  function localVide() { return !S.profil && !Object.keys(S.suivi || {}).length && !S.cvMode; }
  function appliquePass(p) {
    if (!p || !p.v) return;
    if (S.pass && S.pass.v === p.v && !!S.pass.admin === !!p.admin) return;
    S.pass = { tier: p.tier, email: p.email, v: p.v, invite: !!p.invite, admin: !!p.admin }; store(); majPass(); if (S.compte) majCompte();
  }
  function syncTxt(t) { var el = $("#cp-sync"); if (el) el.textContent = t; }
  async function pousse() {
    if (!S.compte) return;
    syncTxt("Sauvegarde…");
    try {
      var d = await api("compte_save", { cjeton: S.compte.cj, data: donnees(), pass: S.pass && S.pass.v });
      S.maj = Date.parse(d.maj) || S.maj; store(); appliquePass(d.pass); syncTxt("Tout est sauvegardé ✓");
    } catch (e) { if (e.status === 401) deconnexion(true); else syncTxt("Pas de connexion : sauvegarde au prochain changement"); }
  }
  // arrivée d'un compte (connexion ou ouverture de l'appli) : on garde la version la plus récente
  function recoit(d, nouveau) {
    S.compte = { email: d.email, cj: d.cjeton || S.compte.cj, google: !!d.google };
    var serveur = d.maj ? Date.parse(d.maj) : 0;
    if (d.data && (localVide() || serveur > (S.maj || 0) + 1000)) {
      var garde = { compte: S.compte, pass: S.pass };
      S = Object.assign({ profil: null, suivi: {}, masques: {}, zone: "ville" }, d.data, garde, { maj: serveur });
      appliquePass(d.pass); store();
      sessionStorage.setItem("tw-alt-toast", nouveau ? "Content de te revoir ! Tes données sont récupérées ✓" : "");
      location.replace(location.pathname + location.hash); return true;
    }
    if (!d.pass && S.pass && (S.pass.invite || S.pass.admin)) { delete S.pass; majPass(); }
    store(); appliquePass(d.pass); majCompte();
    if (nouveau || !d.data || (S.maj || 0) > serveur + 1000) pousse();
    return false;
  }
  function deconnexion(expire) {
    try { localStorage.removeItem(KEY); } catch (e) {}
    CV.fichiers.del("cv").finally(function () {
      if (expire) sessionStorage.setItem("tw-alt-toast", "Ta session a expiré, reconnecte-toi");
      location.replace(location.pathname);
    });
  }
  var cpMode = "new";
  function majCompte() {
    var on = !!S.compte;
    $("#acc-btn").hidden = false; $("#acc-btn").textContent = on ? "Mon compte" : "Se connecter";
    $("#adm-btn").hidden = !(on && S.pass && S.pass.admin);
    $("#cp-out").hidden = on; $("#cp-on").hidden = !on; $("#cp-reset").hidden = true;
    $("#cp-x").hidden = !on && !S.sansCompte; $(".cp-skip").hidden = on || !!S.sansCompte;
    $("#cp-t").textContent = on ? "Ton compte" : cpMode === "login" ? "Content de te revoir" : "Crée ton compte, c'est gratuit";
    $("#cp-sub").hidden = on;
    if (on) { $("#cp-email").textContent = S.compte.email; $("#cp-av").textContent = S.compte.email.charAt(0).toUpperCase(); }
  }
  function ouvreCompte() { $("#cp-err").hidden = true; majCompte(); $("#compte").hidden = false; document.body.style.overflow = "hidden"; }
  function fermeCompte() { if (!S.compte && !S.sansCompte) return; $("#compte").hidden = true; document.body.style.overflow = ""; }
  $$("[data-close-cp]").forEach(function (b) { b.addEventListener("click", fermeCompte); });
  $("#acc-btn").addEventListener("click", ouvreCompte);
  $$("[data-cpm]").forEach(function (b) { b.addEventListener("click", function () {
    cpMode = b.dataset.cpm;
    $$("[data-cpm]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    $("#cp-go").textContent = cpMode === "login" ? "Se connecter" : "Créer mon compte";
    $("#cp-hint").hidden = cpMode === "login"; $("#cp-oubli").hidden = cpMode !== "login";
    $("#cp-mdp").autocomplete = cpMode === "login" ? "current-password" : "new-password";
    $("#cp-err").hidden = true; majCompte();
  }); });
  $("#cp-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var b = $("#cp-go"); b.disabled = true; $("#cp-err").hidden = true;
    try {
      var d = await api(cpMode === "login" ? "connexion" : "inscription", { email: $("#cp-mail").value.trim(), mdp: $("#cp-mdp").value, nom: S.profil ? ((S.profil.prenom || "") + " " + (S.profil.nom || "")).trim() : "" });
      if (!recoit(d, true)) { $("#compte").hidden = true; document.body.style.overflow = ""; toast(cpMode === "login" ? "Connecté ✓" : "Compte créé ✓ Tout est sauvegardé"); }
    } catch (err) { $("#cp-err").textContent = err.message; $("#cp-err").hidden = false; }
    finally { b.disabled = false; }
  });
  $("#cp-google").addEventListener("click", async function () {
    await getInfo();
    if (!FL.gclient) { $("#cp-err").textContent = "Connexion Google indisponible pour le moment, utilise ton adresse mail"; $("#cp-err").hidden = false; return; }
    var st = "L" + Array.from(crypto.getRandomValues(new Uint8Array(16)), function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    try { sessionStorage.setItem("tw-alt-gstate", st); } catch (e) {}
    location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: FL.gclient, redirect_uri: GREDIR, response_type: "code", scope: "openid email profile", state: st, prompt: "select_account" }).toString();
  });
  function vueReset(on) {
    $("#cp-out").hidden = on; $("#cp-reset").hidden = !on; $("#cp-err").hidden = true;
    $("#cp-t").textContent = on ? "Nouveau mot de passe" : cpMode === "login" ? "Content de te revoir" : "Crée ton compte, c'est gratuit";
    $("#cp-sub").hidden = on;
    if (on) { $("#cp-r1").hidden = false; $("#cp-r2").hidden = true; $("#cp-r-mail").value = $("#cp-mail").value; $("#cp-r-mail").focus(); }
  }
  function cpErr(m) { $("#cp-err").textContent = m; $("#cp-err").hidden = false; }
  $("#cp-oubli-go").addEventListener("click", async function () {
    await getInfo();
    if (!FL.mail) { cpErr("Pour récupérer ton compte, écris à contact@tissaweb.fr depuis l'adresse de ton compte."); return; }
    vueReset(true);
  });
  $("#cp-r-back").addEventListener("click", function () { vueReset(false); });
  $("#cp-r1").addEventListener("submit", async function (e) {
    e.preventDefault(); var b = $("#cp-r1-go"); b.disabled = true; $("#cp-err").hidden = true;
    try {
      var m = $("#cp-r-mail").value.trim();
      await api("mdp_oubli", { email: m });
      $("#cp-r2-txt").textContent = "Si un compte existe avec " + m + ", un code vient d'y être envoyé (regarde aussi dans les spams).";
      $("#cp-r1").hidden = true; $("#cp-r2").hidden = false; $("#cp-r-code").focus();
    } catch (err) { cpErr(err.message); } finally { b.disabled = false; }
  });
  $("#cp-r2").addEventListener("submit", async function (e) {
    e.preventDefault(); var b = $("#cp-r2-go"); b.disabled = true; $("#cp-err").hidden = true;
    try {
      var d = await api("mdp_reset", { email: $("#cp-r-mail").value.trim(), code: $("#cp-r-code").value, mdp: $("#cp-r-mdp").value });
      if (!recoit(d, true)) { $("#compte").hidden = true; document.body.style.overflow = ""; toast("Mot de passe changé, tu es connecté ✓"); }
    } catch (err) { cpErr(err.message); } finally { b.disabled = false; }
  });
  $("#cp-skip").addEventListener("click", function () { S.sansCompte = true; store(); fermeCompte(); majCompte(); toast("OK, tes infos restent sur ce téléphone"); });
  $("#cp-logout").addEventListener("click", function () {
    if (!confirm("Te déconnecter ? Tes données restent sauvegardées dans ton compte et seront retirées de cet appareil.")) return;
    deconnexion(false);
  });
  /* ---------- espace admin ---------- */
  var ADM = { list: [], f: "tous" };
  function dateCourte(d) { return d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""; }
  function admRender() {
    var q = $("#adm-q").value.trim().toLowerCase();
    var l = ADM.list.filter(function (c) {
      if (ADM.f === "gratuit" && (c.offert || c.paye || c.admin)) return false;
      if (ADM.f === "offert" && !c.offert) return false;
      if (ADM.f === "paye" && !c.paye) return false;
      return !q || (c.email + " " + c.nom + " " + c.ville + " " + c.formation).toLowerCase().indexOf(q) >= 0;
    });
    $("#adm-list").innerHTML = l.length ? l.map(function (c) {
      var statut = c.admin ? '<span class="tag g">Admin</span>' : c.paye ? '<span class="tag hot">Payé ' + (c.paye === "pro" ? "Pro" : "Essentiel") + "</span>" : c.offert ? '<span class="tag g">Offert ' + (c.offert === "pro" ? "Pro" : "Essentiel") + "</span>" : '<span class="tag">Gratuit</span>';
      return '<div class="adm-c"><div class="adm-h"><span class="cp-av">' + esc((c.nom || c.email).charAt(0).toUpperCase()) + '</span><div><b>' + esc(c.nom || "Sans nom") + '</b><small>' + esc(c.email) + "</small></div></div>" +
        '<div class="meta">' + statut + (c.google ? '<span class="tag">Google</span>' : "") + (c.ville ? '<span class="tag">' + esc(c.ville) + "</span>" : "") + (c.formation ? '<span class="tag">' + esc(c.formation) + "</span>" : "") + '<span class="tag">' + c.suivi + " candidature" + (c.suivi > 1 ? "s" : "") + '</span><span class="tag">Inscrit le ' + esc(dateCourte(c.cree)) + "</span></div>" +
        (c.admin ? "" : '<div class="adm-seg" role="group" aria-label="Offre offerte à ' + esc(c.email) + '">' + ["", "essentiel", "pro"].map(function (t) { return '<button type="button" data-ae="' + esc(c.email) + '" data-at="' + t + '" aria-pressed="' + String((c.offert || "") === t) + '">' + (t === "" ? "Rien d'offert" : t === "pro" ? "Offrir Pro" : "Offrir Essentiel") + "</button>"; }).join("") + "</div>") + "</div>";
    }).join("") : '<div class="empty"><b>Aucun compte</b>Personne ne correspond.</div>';
  }
  async function admOuvre() {
    $("#admin").hidden = false; document.body.style.overflow = "hidden"; $("#adm-stats").textContent = "Chargement…";
    try {
      var d = await api("admin_comptes", { cjeton: S.compte.cj }); ADM.list = d.comptes || [];
      var n = ADM.list.length, of = ADM.list.filter(function (c) { return c.offert; }).length, pa = ADM.list.filter(function (c) { return c.paye; }).length;
      var sem = ADM.list.filter(function (c) { return Date.now() - Date.parse(c.cree) < 7 * 86400000; }).length;
      $("#adm-stats").textContent = n + " compte" + (n > 1 ? "s" : "") + " · " + sem + " cette semaine · " + pa + " payé" + (pa > 1 ? "s" : "") + " · " + of + " offert" + (of > 1 ? "s" : "");
      admRender();
    } catch (e) { $("#adm-stats").textContent = e.message; }
  }
  $("#adm-btn").addEventListener("click", admOuvre);
  $$("[data-close-adm]").forEach(function (b) { b.addEventListener("click", function () { $("#admin").hidden = true; document.body.style.overflow = ""; }); });
  $("#adm-q").addEventListener("input", admRender);
  $$("[data-af]").forEach(function (b) { b.addEventListener("click", function () { ADM.f = b.dataset.af; $$("[data-af]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); admRender(); }); });
  $("#adm-list").addEventListener("click", async function (e) {
    var b = e.target.closest("[data-ae]"); if (!b || b.getAttribute("aria-pressed") === "true") return;
    var em = b.dataset.ae, t = b.dataset.at;
    try {
      await api("admin_offrir", { cjeton: S.compte.cj, email: em, tier: t });
      ADM.list.forEach(function (c) { if (c.email === em) c.offert = t; }); admRender();
      toast(t ? "Offre " + (t === "pro" ? "Pro" : "Essentiel") + " offerte à " + em + " ✓" : "Offre retirée pour " + em);
    } catch (er) { toast(er.message); }
  });

  function demarreCompte() {
    var t = sessionStorage.getItem("tw-alt-toast"); if (t) { sessionStorage.removeItem("tw-alt-toast"); setTimeout(function () { toast(t); }, 500); }
    var g = sessionStorage.getItem("tw-alt-login");
    if (g) { sessionStorage.removeItem("tw-alt-login"); try { if (recoit(JSON.parse(g), true)) return; toast("Connecté avec Google ✓"); } catch (e) {} }
    majCompte();
    if (!S.compte) { if (!S.sansCompte) ouvreCompte(); return; }
    api("compte", { cjeton: S.compte.cj, pass: S.pass && S.pass.v }).then(function (d) { recoit(d, false); })
      .catch(function (e) { if (e.status === 401) deconnexion(true); });
  }

  /* ---------- démarrage ---------- */
  fillForm(); badge();
  var start = location.hash === "#suivi" ? "suivi" : !S.profil ? "profil" : location.hash === "#cv" || !S.cvMode ? "cv" : "recherche";
  if (location.hash === "#cv" && !S.profil) toast("Remplis d'abord ton profil, ensuite on fait ton CV");
  tab(start);
  getInfo();
  demarreCompte();

  /* ---------- appli installable ---------- */
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/alternance/sw.js", { scope: "/alternance/" }).catch(function () {});
  var promptEv = null;
  var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function showInstall(on) { $("#install").hidden = !on; $("#free").hidden = on || !!FL.pay; }
  addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); promptEv = e; showInstall(true); });
  addEventListener("appinstalled", function () { showInstall(false); toast("TissAlternance est installée"); });
  if (ios && !standalone) showInstall(true);
  $("#install").addEventListener("click", function () {
    if (promptEv) { promptEv.prompt(); promptEv.userChoice.finally(function () { promptEv = null; showInstall(false); }); }
    else if (ios) { $("#ios-help").hidden = false; }
  });
  $$("[data-close-ios]").forEach(function (b) { b.addEventListener("click", function () { $("#ios-help").hidden = true; }); });
})();
