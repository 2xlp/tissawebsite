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
    modele: "Ce modèle fait partie des 8 modèles premium. Débloque-les avec le Pass.",
    suivi: "Tu suis déjà " + SUIVI_MAX + " candidatures, la limite gratuite. Passe au Pass pour en suivre autant que tu veux.",
    envoi: "Tu as utilisé tes envois automatiques gratuits du mois. Avec le Pass Pro, l'appli envoie et relance pour toi sans limite.",
    menu: "Un petit coup de pouce à 4,99 € ou 9,99 €, une seule fois, et c'est à vie.",
  };
  function paywall(why) {
    if (!FL.pay) return;
    $("#pw-why").textContent = PW_WHY[why] || PW_WHY.menu;
    $("#pw-ess").href = lienPay(FL.links && FL.links.essentiel);
    $("#pw-pro").href = lienPay(FL.links && FL.links.pro);
    $("#pw-ess").closest(".pw-card").hidden = why === "envoi" || tier() === "essentiel";
    $("#pw-err").hidden = true; $("#pw-restore-box").hidden = true; $("#pw-code-box").hidden = true;
    $("#paywall").hidden = false;
  }
  $$("[data-close-pw]").forEach(function (b) { b.addEventListener("click", function () { $("#paywall").hidden = true; }); });
  $("#pw-restore").addEventListener("click", function () { $("#pw-restore-box").hidden = false; $("#pw-code-box").hidden = true; $("#pw-mail").value = (S.profil && S.profil.email) || ""; $("#pw-mail").focus(); });
  $("#pw-restore-go").addEventListener("click", async function () {
    var b = this; b.disabled = true; $("#pw-err").hidden = true;
    try { var d = await api("restaurer", { email: $("#pw-mail").value.trim() }); S.pass = { tier: d.tier, email: d.email, v: d.jeton }; save(); majPass(); $("#paywall").hidden = true; toast("Pass " + (d.tier === "pro" ? "Pro" : "Essentiel") + " récupéré ✓"); }
    catch (e) { $("#pw-err").textContent = e.message; $("#pw-err").hidden = false; } finally { b.disabled = false; }
  });
  $("#pw-code").addEventListener("click", function () { $("#pw-code-box").hidden = false; $("#pw-restore-box").hidden = true; $("#pw-code-in").focus(); });
  $("#pw-code-go").addEventListener("click", async function () {
    var b = this; b.disabled = true; $("#pw-err").hidden = true;
    try { var d = await api("code_pass", { code: $("#pw-code-in").value.trim() }); S.pass = { tier: d.tier, email: d.email, v: d.jeton, invite: true }; save(); majPass(); $("#paywall").hidden = true; toast("Code activé : tout est débloqué ✓"); }
    catch (e) { $("#pw-err").textContent = e.message; $("#pw-err").hidden = false; } finally { b.disabled = false; }
  });
  function majPass() {
    var b = $("#pass-btn"); if (!b) return;
    b.hidden = !FL.pay;
    if (FL.pay) { $("#free").hidden = true; var t = tier(); b.textContent = S.pass && S.pass.invite ? "Accès offert ✓" : t === "pro" ? "Pass Pro ✓" : t === "essentiel" ? "Pass Essentiel ✓" : "Débloquer le Pass"; b.classList.toggle("on", !!t); }
    if (galFait) galerie();
    if (cur) majAuto();
  }
  $("#pass-btn").addEventListener("click", function () { if (tier() === "pro") { toast("Tu as le Pass Pro : tout est débloqué"); return; } paywall("menu"); });
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
    $("#gm-go").hidden = on; $("#gm-off").hidden = !on;
    $("#gm-etat").innerHTML = on ? "Connecté : tes candidatures et relances partent de <b>" + esc(S.gmail.email) + "</b>. L'appli peut seulement envoyer, jamais lire tes mails."
      : "Connecte ton Gmail : l'appli envoie tes candidatures et tes relances depuis ta propre adresse. Elle peut seulement envoyer, jamais lire tes mails.";
    if (cur) majAuto();
  }
  $("#gm-go").addEventListener("click", gmailConnect);
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
    try { var r = await CV.cvPdf(S.profil, S.cv); dl(r.doc.output("blob"), cvNom()); toast(r.pages > 1 ? "CV téléchargé (" + r.pages + " pages : raccourcis un peu pour tenir sur 1 page)" : "CV téléchargé"); }
    catch (e) { toast(e.message); } finally { btn.disabled = false; }
  });

  /* fichiers joints aux candidatures */
  async function cvFichier() {
    if (S.cvMode === "import") { var rec = await CV.fichiers.get("cv"); return rec ? new File([rec.blob], rec.name, { type: "application/pdf" }) : null; }
    if (S.cvMode === "genere") { cvDefaults(); var r = await CV.cvPdf(S.profil, S.cv); return new File([r.doc.output("blob")], cvNom(), { type: "application/pdf" }); }
    return null;
  }
  function lettreTexte() {
    var id = keyOf(cur), s = S.suivi[id];
    if (curDoc === "lettre") return $("#sh-texte").value;
    return (s && s.textes && s.textes.lettre) || texteLettre(S.profil, cur);
  }
  async function lettreFichier() {
    var d = await CV.lettrePdf(lettreTexte(), S.profil, S.cvMode === "genere" ? S.cv : null);
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
    if (sel.value === "entretien") toast("Bien joué, prépare-toi bien !");
  });
  function badge() {
    var n = Object.keys(S.suivi).filter(function (id) { return aRelancer(S.suivi[id]); }).length;
    var b = $("#badge-suivi"); b.hidden = !n; b.textContent = n;
  }

  $("#reset").addEventListener("click", function () {
    if (!confirm("Effacer ton profil, ton CV, tes textes et ton suivi de cet appareil ?")) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
    CV.fichiers.del("cv").then(function () { location.reload(); });
  });

  /* ---------- démarrage ---------- */
  fillForm(); badge();
  var start = location.hash === "#suivi" ? "suivi" : !S.profil ? "profil" : location.hash === "#cv" || !S.cvMode ? "cv" : "recherche";
  if (location.hash === "#cv" && !S.profil) toast("Remplis d'abord ton profil, ensuite on fait ton CV");
  tab(start);
  getInfo();

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
