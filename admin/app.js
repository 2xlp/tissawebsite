/* TissaWeb Admin — appli de gestion reliée à Supabase.
   Tout est chargé en mémoire (petit volume), puis mis à jour à chaque action
   et en temps réel pour les nouvelles demandes du site. */
(function () {
"use strict";

/* ================= utilitaires ================= */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function eur(n) { n = Math.round((+n || 0) * 100) / 100; const neg = n < 0; n = Math.abs(n); const p = n.toFixed(2).split("."); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, " "); return (neg ? "-" : "") + p[0] + "," + p[1] + " €"; }
const eur0 = (n) => eur(n).replace(",00 €", " €");
function iso(d) { d = d || new Date(); const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
const today = () => iso(new Date());
function addDays(s, n) { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + (+n || 0)); return iso(d); }
function daysBetween(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000); }
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function frDate(s) { if (!s) return ""; const d = new Date(String(s).slice(0, 10) + "T12:00:00"); return d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear(); }
function sDate(s) { if (!s) return ""; const p = String(s).slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
function ago(ts) { const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000); if (m < 1) return "à l'instant"; if (m < 60) return "il y a " + m + " min"; const h = Math.round(m / 60); if (h < 24) return "il y a " + h + " h"; return "le " + sDate(ts); }
function toast(t, ms) { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), ms || 2600); }
const monthKey = (d) => iso(d || new Date()).slice(0, 7);
function copy(txt, el) { try { navigator.clipboard.writeText(txt).then(() => toast("Copié"), () => fallbackCopy(el)); } catch (e) { fallbackCopy(el); } }
function fallbackCopy(el) { if (!el) return; const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Texte sélectionné : copie-le"); }
const mailto = (to, sub, body) => "mailto:" + encodeURIComponent(to || "") + "?subject=" + encodeURIComponent(sub) + "&body=" + encodeURIComponent(body);

/* ================= état ================= */
const TABLES = ["demandes", "clients", "prospects", "pieces", "projets", "abonnements", "journal", "messages"];
const VAPID_PUBLIC = "BBd2CAw93yLsDm4146CkDdM-THfBBAN6JlXxJYMbEnhYZbtUieKxtIJyuDgCsjLD-ckPuifNBormBdf03bSiQcg";
const D = { demandes: [], clients: [], prospects: [], pieces: [], projets: [], abonnements: [], journal: [], messages: [], notes: [], rdv: [], pub: null, equipe: [], config: null };
const S = { me: null, who: "tous", view: "accueil", param: null };
let sb = null;
const DEF_CFG = {
  emetteurs: {
    hugo: { nom: "Hugo Thirion", siret: "13178802800010", adresse: "8 rue Docteur Parizot\n21000 Dijon", email: "contact@tissaweb.fr", tel: "06 40 38 50 45", iban: "", bic: "", lien: "", acre: true, periodicite: "trimestrielle" },
    lucas: { nom: "Lucas Paris", siret: "131829095", adresse: "6 rue Catherine Sauvage\n21800 Chevigny-Saint-Sauveur", email: "contact@tissaweb.fr", tel: "", iban: "", bic: "", lien: "", acre: true, periodicite: "trimestrielle" }
  },
  validite: 30, delai: 15, acompte: 50, relance_prospect: 5
};
const cfg = () => Object.assign({}, DEF_CFG, (D.config && D.config.data) || {});
const em = (k) => Object.assign({}, DEF_CFG.emetteurs[k] || DEF_CFG.emetteurs.hugo, (cfg().emetteurs || {})[k] || {});
const first = (k) => em(k).nom.split(" ")[0];
const byId = (t, id) => D[t].find((x) => x.id === id) || null;
const client = (id) => byId("clients", id);
const cname = (id) => { const c = client(id); return c ? c.entreprise || c.nom || "Client" : "Client supprimé"; };
const mine = (x) => S.who === "tous" || !x.emetteur || x.emetteur === S.who;
const idLab = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 9 ? "SIREN" : "SIRET"; };
const idVal = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 9 ? d.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : d.length === 14 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4") : v; };
const total = (p) => (p.lignes || []).reduce((a, l) => a + (+l.qte || 0) * (+l.pu || 0), 0);
const rate = (k) => (em(k).acre ? 19.2 : 25.6);

const QUICK = [
  { l: "Essentiel 450 €", d: "Site vitrine Essentiel : site d'une page sur-mesure, adapté mobile, bouton d'appel, formulaire de contact, optimisation Google de base, mise en ligne", p: 450 },
  { l: "Professionnel 850 €", d: "Site vitrine Professionnel : jusqu'à 5 pages sur-mesure, galerie photos, avis, plan d'accès, formulaire de devis, référencement local, fiche Google Business", p: 850 },
  { l: "Remise lancement −30 %", d: "Remise offre de lancement (-30 %) : réservée à nos 5 premiers clients", p: "remise" },
  { l: "Maintenance 30 €/mois", d: "Maintenance mensuelle : hébergement, sécurité, sauvegardes et modifications", p: 30 },
  { l: "Nom de domaine 1 an", d: "Nom de domaine (1 an), enregistré au nom du client", p: 10 },
  { l: "Logo", d: "Création de logo et identité visuelle simple", p: 150 }
];
const ETAPES = ["Acompte reçu", "Infos et photos reçues", "Maquette envoyée", "Retours du client intégrés", "Nom de domaine acheté", "Site mis en ligne", "Fiche Google configurée", "Solde payé"];

/* ================= base de données ================= */
function dbErr(e) { console.error(e); toast(e && e.message ? "Erreur : " + e.message : "Erreur d'enregistrement"); throw e; }
async function loadAll() {
  const res = await Promise.all(TABLES.map((t) => sb.from(t).select("*").order("created_at", { ascending: false }).limit(5000)));
  res.forEach((r, i) => { if (r.error) throw r.error; D[TABLES[i]] = r.data || []; });
  const c = await sb.from("config").select("*").eq("id", "main").maybeSingle();
  D.config = c.data || { id: "main", data: DEF_CFG };
  const eq = await sb.from("equipe").select("*");
  D.equipe = eq.data || [];
  try { await loadExtras(); } catch (e) { console.warn(e); S.needSql4 = true; }
}
async function ins(t, row) { const { data, error } = await sb.from(t).insert(row).select().single(); if (error) dbErr(error); D[t].unshift(data); return data; }
async function upd(t, id, patch) {
  if (t === "pieces") patch.updated_at = new Date().toISOString();
  const { data, error } = await sb.from(t).update(patch).eq("id", id).select().single(); if (error) dbErr(error);
  const i = D[t].findIndex((x) => x.id === id); if (i >= 0) D[t][i] = data; return data;
}
async function del(t, id) { const { error } = await sb.from(t).delete().eq("id", id); if (error) dbErr(error); D[t] = D[t].filter((x) => x.id !== id); }
async function saveCfg(data) { const { data: r, error } = await sb.from("config").upsert({ id: "main", data }).select().single(); if (error) dbErr(error); D.config = r; }
async function log(type, texte, ids) { try { await ins("journal", Object.assign({ type, texte, auteur: S.me ? S.me.nom.split(" ")[0] : "" }, ids || {})); } catch (e) {} }

/* ================= statuts ================= */
function pState(p) {
  const t = today();
  if (p.type === "devis") {
    if (p.statut === "envoye" && p.date && addDays(p.date, cfg().validite) < t) return { k: "expire", l: "Expiré", c: "warn" };
    return ({ brouillon: { k: "brouillon", l: "Brouillon", c: "" }, envoye: { k: "envoye", l: "Envoyé", c: "info" }, accepte: { k: "accepte", l: "Accepté", c: "ok" }, refuse: { k: "refuse", l: "Refusé", c: "bad" } })[p.statut] || { k: p.statut, l: p.statut, c: "" };
  }
  if (p.statut === "payee") return { k: "payee", l: "Payée", c: "ok" };
  if (p.statut === "envoye" && p.echeance && p.echeance < t) return { k: "retard", l: "En retard", c: "bad" };
  if (p.statut === "envoye") return { k: "envoye", l: "Envoyée", c: "info" };
  if (p.statut === "annulee") return { k: "annulee", l: "Annulée", c: "" };
  return { k: "brouillon", l: "Brouillon", c: "" };
}
const chip = (p) => { const s = pState(p); return `<span class="chip ${s.c}">${s.l}</span>`; };
const kindLabel = (p) => p.type === "devis" ? "Devis" : ({ acompte: "Facture d'acompte", solde: "Facture de solde", abonnement: "Facture de maintenance" })[p.kind] || "Facture";
const PSTAT = { a_contacter: ["À contacter", ""], contacte: ["Contacté", "info"], interesse: ["Intéressé", "ok"], pas_interesse: ["Pas intéressé", "bad"], client: ["Devenu client", "ok"] };
function prState(p) {
  if (p.statut === "contacte" && p.prochaine_action && p.prochaine_action <= today()) return ["À relancer", "warn"];
  return PSTAT[p.statut] || [p.statut, ""];
}
const DSTAT = { nouvelle: ["Nouvelle", "info"], repondu: ["Répondu", ""], convertie: ["Devis créé", "ok"], archivee: ["Archivée", ""], spam: ["Spam", "bad"] };
function nextNumber(type, emetteur, date) {
  const y = (date || today()).slice(0, 4), pre = (type === "devis" ? "D" : "F") + (emetteur === "lucas" ? "L" : "H") + "-" + y + "-";
  let max = 0; D.pieces.forEach((p) => { if (p.numero && p.numero.indexOf(pre) === 0) { const n = parseInt(p.numero.slice(pre.length), 10); if (n > max) max = n; } });
  return pre + String(max + 1).padStart(3, "0");
}
async function insPiece(row) {
  for (let i = 0; i < 3; i++) {
    row.numero = nextNumber(row.type, row.emetteur, row.date);
    const { data, error } = await sb.from("pieces").insert(row).select().single();
    if (!error) { D.pieces.unshift(data); return data; }
    if (error.code === "23505") { const r = await sb.from("pieces").select("*"); if (r.data) D.pieces = r.data; continue; }
    dbErr(error);
  }
  dbErr({ message: "numérotation impossible, réessaie" });
}

/* ================= automatisations ================= */
async function devisAccepte(p) {
  await upd("pieces", p.id, { statut: "accepte" });
  await log("devis", `Devis ${p.numero} accepté (${eur(total(p))})`, { client_id: p.client_id });
  // 1. projet créé automatiquement
  let pj = D.projets.find((x) => x.devis_id === p.id);
  if (!pj) {
    const pro = (p.lignes || []).some((l) => /Professionnel/.test(l.desc));
    pj = await ins("projets", { client_id: p.client_id, devis_id: p.id, emetteur: p.emetteur, titre: "Site " + cname(p.client_id), date_debut: today(), date_prevue: addDays(today(), pro ? 10 : 7), etapes: ETAPES.map((t) => ({ t, done: false, date: null })) });
  }
  // 2. facture d'acompte préparée automatiquement
  let fa = D.pieces.find((f) => f.devis_id === p.id);
  if (!fa && cfg().acompte > 0) fa = await makeInvoice(p, "acompte", pj.id);
  toast("Projet créé et facture d'acompte prête à envoyer");
  return fa;
}
async function makeInvoice(d, kind, projetId) {
  const date = today(), t = total(d), pct = cfg().acompte; let lignes;
  if (kind === "acompte") lignes = [{ desc: `Acompte de ${pct} % sur le devis ${d.numero} : ${(d.lignes[0] ? d.lignes[0].desc.split(":")[0] : "prestation")}`, qte: 1, pu: Math.round(t * pct) / 100 }];
  else if (kind === "solde") { lignes = d.lignes.slice(); D.pieces.filter((f) => f.devis_id === d.id && f.kind === "acompte" && f.statut !== "annulee").forEach((f) => lignes.push({ desc: `Acompte déjà facturé (${f.numero})`, qte: 1, pu: -total(f) })); }
  else lignes = d.lignes.slice();
  const pj = projetId || (D.projets.find((x) => x.devis_id === d.id) || {}).id || null;
  const f = await insPiece({ type: "facture", kind, emetteur: d.emetteur, client_id: d.client_id, date, echeance: addDays(date, kind === "acompte" ? 0 : cfg().delai), lignes, note: d.note || "", devis_id: d.id, devis_ref: d.numero, projet_id: pj, statut: "brouillon" });
  await log("facture", `${kindLabel(f)} ${f.numero} préparée (${eur(total(f))})`, { client_id: d.client_id });
  return f;
}
async function facturePayee(f, date, moyen) {
  await upd("pieces", f.id, { statut: "payee", paye_le: date, moyen });
  await log("paiement", `Paiement reçu : ${f.numero}, ${eur(total(f))} (${moyen})`, { client_id: f.client_id });
  const pj = f.projet_id ? byId("projets", f.projet_id) : D.projets.find((x) => f.devis_id && x.devis_id === f.devis_id);
  if (pj) {
    const etapes = (pj.etapes || []).map((e) => Object.assign({}, e));
    const mark = (name) => { const e = etapes.find((x) => x.t === name); if (e && !e.done) { e.done = true; e.date = date; } };
    if (f.kind === "acompte") mark("Acompte reçu");
    if (f.kind === "solde" || f.kind === "totale") { mark("Solde payé"); }
    const patch = { etapes };
    if ((f.kind === "solde" || f.kind === "totale")) { patch.statut = "termine"; patch.date_livraison = patch.date_livraison || date; }
    await upd("projets", pj.id, patch);
  }
}
async function etapeCochee(pj, idx, done) {
  const etapes = (pj.etapes || []).map((e) => Object.assign({}, e));
  etapes[idx].done = done; etapes[idx].date = done ? today() : null;
  const patch = { etapes };
  if (etapes[idx].t === "Site mis en ligne" && done) patch.date_livraison = today();
  await upd("projets", pj.id, patch);
  if (done) await log("projet", `${pj.titre} : ${etapes[idx].t}`, { client_id: pj.client_id });
  // mise en ligne cochée : facture de solde préparée automatiquement
  if (done && etapes[idx].t === "Site mis en ligne" && pj.devis_id) {
    const d = byId("pieces", pj.devis_id);
    const has = D.pieces.some((f) => f.devis_id === pj.devis_id && (f.kind === "solde" || f.kind === "totale") && f.statut !== "annulee");
    if (d && !has) { await makeInvoice(d, D.pieces.some((f) => f.devis_id === d.id && f.kind === "acompte") ? "solde" : "totale", pj.id); toast("Site en ligne : facture de solde prête à envoyer"); }
  }
}
async function abonnementsDuMois() {
  const mk = monthKey(), created = [];
  for (const a of D.abonnements) {
    if (!a.actif || (a.debut && a.debut.slice(0, 7) > mk) || a.dernier_mois === mk) continue;
    if (D.pieces.some((p) => p.abonnement_id === a.id && p.periode === mk)) { await upd("abonnements", a.id, { dernier_mois: mk }); continue; }
    const date = today(), m = new Date();
    const f = await insPiece({ type: "facture", kind: "abonnement", emetteur: a.emetteur, client_id: a.client_id, date, echeance: addDays(date, cfg().delai), lignes: [{ desc: `${a.libelle} – ${MOIS[m.getMonth()]} ${m.getFullYear()}`, qte: 1, pu: +a.montant }], abonnement_id: a.id, periode: mk, statut: "brouillon" });
    await upd("abonnements", a.id, { dernier_mois: mk });
    created.push(f);
  }
  if (created.length) toast(created.length + " facture(s) de maintenance préparée(s) pour ce mois");
}
async function demandeVersDevis(dm) {
  let c = D.clients.find((x) => x.email && dm.email && x.email.toLowerCase() === dm.email.toLowerCase());
  if (!c) c = await ins("clients", { nom: dm.nom, email: dm.email, tel: dm.telephone || "", activite: dm.activite || "", source: "Site tissaweb.fr" });
  const lignes = [], o = (dm.offre || "").toLowerCase();
  if (/essentiel|lancement/.test(o)) lignes.push({ desc: QUICK[0].d, qte: 1, pu: 450 });
  if (/professionnel/.test(o)) lignes.push({ desc: QUICK[1].d, qte: 1, pu: 850 });
  if (/lancement/.test(o)) lignes.push({ desc: QUICK[2].d, qte: 1, pu: -135 });
  const emk = S.me ? S.me.emetteur : "hugo";
  const p = await insPiece({ type: "devis", emetteur: emk, client_id: c.id, date: today(), lignes, statut: "brouillon", demande: [dm.activite, dm.message].filter(Boolean).join(" · ") });
  await upd("demandes", dm.id, { statut: "convertie", client_id: c.id, traite_par: S.me ? S.me.nom : "" });
  await log("demande", `Demande reçue du site, devis ${p.numero} créé`, { client_id: c.id });
  return p;
}
async function prospectVersClient(pr) {
  let c = pr.client_id ? client(pr.client_id) : null;
  if (!c) c = await ins("clients", { entreprise: pr.entreprise, email: pr.email || "", tel: pr.tel || "", adresse: pr.adresse || "", activite: pr.activite || "", source: "Prospection", notes: pr.notes || "" });
  await upd("prospects", pr.id, { statut: "client", client_id: c.id });
  await log("prospect", `${pr.entreprise} devient client`, { client_id: c.id, prospect_id: pr.id });
  return c;
}

/* ================= mails ================= */
// La signature pro (logo, nom complet, coordonnées) est ajoutée automatiquement à l'envoi par la fonction serveur
function sig() { return "\n\nBien à vous,"; }
function mailPiece(p, kind) {
  const c = client(p.client_id) || {}, e = em(p.emetteur), hello = "Bonjour" + (c.nom ? " " + c.nom : "") + ",";
  if (kind === "relance") return { to: c.email, sub: "Rappel – facture " + p.numero, body: `${hello}\n\nSauf erreur de notre part, la facture ${p.numero} de ${eur(total(p))}, arrivée à échéance le ${frDate(p.echeance)}, n'a pas encore été réglée.\n\nVous la trouverez à nouveau en pièce jointe. Si le paiement est déjà parti, merci de ne pas tenir compte de ce message.${e.iban ? "\n\nIBAN : " + e.iban : ""}${e.lien ? "\nPaiement par carte : " + e.lien : ""}${sig(p.emetteur)}` };
  if (kind === "merci") return { to: c.email, sub: "Paiement bien reçu – " + p.numero, body: `${hello}\n\nNous avons bien reçu votre paiement de ${eur(total(p))} pour la facture ${p.numero}. Merci !${p.kind === "acompte" ? "\n\nOn lance la création de votre site. Pour avancer vite, envoyez-nous si possible votre logo, quelques photos et vos horaires." : ""}${sig(p.emetteur)}` };
  if (p.type === "devis") return { to: c.email, sub: "Votre devis TissaWeb – " + p.numero, body: `${hello}\n\nComme convenu, voici votre devis ${p.numero} d'un montant de ${eur(total(p))} (prix fixe, sans TVA).\n\nPour valider, il suffit de nous le renvoyer signé ou de répondre « Bon pour accord » à ce mail. Nous vous envoyons alors la facture d'acompte de ${cfg().acompte} % et nous démarrons.\n\nLe devis est valable jusqu'au ${frDate(addDays(p.date, cfg().validite))}. Nos conditions générales de vente et le formulaire de rétractation sont joints au devis (aussi sur tissaweb.fr/cgv.html).\n\nSi vous êtes un particulier ou une entreprise de 5 salariés au plus et que vous souhaitez que l'on démarre tout de suite, sans attendre la fin du délai de rétractation de 14 jours, cochez simplement les cases prévues sur le devis.${sig(p.emetteur)}` };
  return { to: c.email, sub: kindLabel(p) + " " + p.numero + " – TissaWeb", body: `${hello}\n\nVous trouverez ci-joint la ${kindLabel(p).toLowerCase()} ${p.numero} d'un montant de ${eur(total(p))}, à régler ${p.echeance && p.echeance > p.date ? "avant le " + frDate(p.echeance) : "à réception"}.${e.iban ? `\n\nPar virement : IBAN ${e.iban}${e.bic ? " · BIC " + e.bic : ""}\nRéférence à indiquer : ${p.numero}` : ""}${e.lien ? "\nOu par carte : " + e.lien : ""}${sig(p.emetteur)}` };
}
const PMODELES = [
  ["auto", "Automatique (selon l'avancement)"],
  ["premier", "1er contact"],
  ["relance1", "Relance (après 5 jours)"],
  ["relance2", "Dernière relance"],
  ["maquette", "Proposer une maquette gratuite"],
  ["apres_echange", "Après un appel ou une visite"],
];
function sigEquipe() { return "\n\nBien à vous,"; }
const STOPLINE = "\n\nSi vous ne souhaitez plus recevoir de message de notre part, répondez simplement « STOP ».";
function mailProspect(pr, kind) {
  const n = pr.nb_contacts || 0, me = S.me ? S.me.nom.split(" ")[0] : "Hugo";
  const metier = (pr.activite || "").toLowerCase(), avis = pr.notes && /avis/.test(pr.notes) ? "vos très bons avis sur Google" : "votre activité";
  const accroche = pr.angle ? pr.angle.replace(/\.$/, "") : "";
  const direct = /\b(vous|votre|vos)\b/i.test(pr.angle || "");
  const exemple = /boulang|pâtiss/.test(metier) ? "notre site de démonstration pour une boulangerie" : /barb|coiff/.test(metier) ? "notre démo pour un barbier, avec la prise de rendez-vous" : /plomb|électri|artisan|garage/.test(metier) ? "notre démo pour un artisan, avec le bouton d'appel et la demande de devis" : "nos sites de démonstration";
  if (kind === "auto") kind = n === 0 ? "premier" : n === 1 ? "relance1" : "relance2";
  const apercu = window.TWEssai ? `\n\nJ'ai préparé un aperçu de ce que pourrait être le site de ${pr.entreprise}, à votre nom : ${TWEssai.lien(pr.entreprise, (S.pvm && S.pvm[pr.id]) || TWEssai.metier(pr.activite))}` : "";
  const M = {
    premier: direct ? [`${pr.entreprise} – votre site internet`, `Bonjour,\n\nJe m'appelle ${me}, je crée des sites internet pour les commerces et artisans de Dijon avec mon associé, chez TissaWeb.\n\n${pr.angle.trim()}${apercu}\n\nNos sites sont livrés en 7 jours, à prix fixe : à partir de 315 € au lieu de 450 € (-30 % pour nos 5 premiers clients). Vous pouvez voir ${exemple} sur tissaweb.fr.\n\nSeriez-vous d'accord pour que je vous montre à quoi pourrait ressembler le vôtre ? C'est gratuit et sans engagement.${sigEquipe()}${STOPLINE}`] : [`Un site internet pour ${pr.entreprise} ?`, `Bonjour,\n\nJe m'appelle ${me}, je crée des sites internet pour les commerces et artisans de Dijon avec mon associé, chez TissaWeb.\n\nEn cherchant ${pr.entreprise} sur Google, j'ai vu ${avis}, mais pas de site pour présenter ce que vous faites.${accroche ? "\n\nPar exemple : " + accroche.charAt(0).toLowerCase() + accroche.slice(1) + "." : ""}${apercu}\n\nNos sites sont livrés en 7 jours, à prix fixe : à partir de 315 € au lieu de 450 € (-30 % pour nos 5 premiers clients). Vous pouvez voir ${exemple} sur tissaweb.fr.\n\nSeriez-vous d'accord pour que je vous montre à quoi ressemblerait le vôtre ? C'est gratuit et sans engagement.${sigEquipe()}${STOPLINE}`],
    relance1: [`${pr.entreprise} – petite relance`, `Bonjour,\n\nJe me permets de revenir vers vous suite à mon message de la semaine dernière au sujet d'un site internet pour ${pr.entreprise}.\n\nJe peux vous montrer en 5 minutes à quoi ressemblerait votre site, sans engagement. Des exemples sont visibles sur tissaweb.fr.\n\nUn simple « oui » en réponse suffit, et je vous envoie une proposition.${sigEquipe()}${STOPLINE}`],
    relance2: [`Dernier message – ${pr.entreprise}`, `Bonjour,\n\nC'est mon dernier message, promis : je ne voudrais pas vous déranger.\n\nSi un jour vous souhaitez un site pour ${pr.entreprise} (horaires, photos, contact, avis Google réunis au même endroit), vous pouvez me répondre à tout moment, même dans plusieurs mois. L'offre de lancement à -30 % reste valable pour nos 5 premiers clients.\n\nBonne continuation !${sigEquipe()}`],
    maquette: [`Une maquette gratuite pour ${pr.entreprise}`, `Bonjour,\n\nPour vous rendre les choses concrètes, je vous propose de préparer gratuitement une maquette de la page d'accueil de ${pr.entreprise}, avec vos vraies informations (horaires, adresse, avis).\n\nVous la regardez, et si elle ne vous plaît pas, vous ne nous devez rien. Ça vous tente ?\n\nIl me suffit de votre accord en réponse à ce mail.${sigEquipe()}${STOPLINE}`],
    apres_echange: [`Suite à notre échange – ${pr.entreprise}`, `Bonjour,\n\nMerci pour le temps que vous m'avez accordé.\n\nComme convenu, voici en résumé ce que nous vous proposons pour ${pr.entreprise} :\n- un site clair et rapide, parfait sur téléphone ;\n- vos horaires, vos services, vos photos et vos avis Google ;\n- un bouton pour vous appeler ou vous écrire en un geste ;\n- la mise en ligne et le référencement local inclus.\n\nLe tout livré en 7 jours, à prix fixe. Je vous envoie le devis détaillé dès votre accord.${sigEquipe()}`],
  };
  const r = M[kind] || M.premier;
  return { to: pr.email, sub: r[0], body: r[1], kind };
}
function mailDemande(dm) {
  return { to: dm.email, sub: "Votre demande de site – TissaWeb", body: `Bonjour ${dm.nom},\n\nMerci pour votre demande sur tissaweb.fr !${dm.activite ? `\n\nPour votre activité (${dm.activite.toLowerCase()}), ` : "\n\n"}nous vous proposons ${/professionnel/i.test(dm.offre || "") ? "notre offre Professionnel (jusqu'à 5 pages)" : /essentiel|lancement/i.test(dm.offre || "") ? "notre offre Essentiel (site d'une page)" : "un site adapté à vos besoins"}. Vous trouverez notre devis en pièce jointe.\n\nPour bien le personnaliser, pouvez-vous nous dire en deux mots ce que vous aimeriez mettre en avant (services, horaires, photos, prise de rendez-vous…) ?\n\nOn peut aussi s'appeler 10 minutes si c'est plus simple.${sig()}` };
}
function mailBlock(m, ctx) {
  S.mailCtx = Object.assign({}, ctx || {}, { m });
  return `<div class="card"><h2>Mail prêt à envoyer</h2>
  <p class="note" style="margin:-6px 0 10px">À : <b>${esc(m.to || "adresse à compléter")}</b><br>Objet : <b>${esc(m.sub)}</b></p>
  <div class="mailbox" id="mailBody">${esc(m.body)}</div>
  <div class="actions" style="margin-top:10px">${m.to ? `<button class="btn primary" type="button" data-compose>${ctx && ctx.kind === "piece" ? "Envoyer avec le PDF" : "Envoyer depuis l'appli"}</button><a class="btn ghost" href="${esc(mailto(m.to, m.sub, m.body))}">Ouvrir dans ma boîte mail</a>` : ""}<button class="btn ghost" type="button" data-copy="body">Copier le message</button></div></div>`;
}

/* ================= rendu commun ================= */
function setBadges() {
  const n = D.demandes.filter((d) => d.statut === "nouvelle").length; $("bDem").textContent = n; $("bDem").hidden = !n;
  const r = D.prospects.filter((p) => prState(p)[0] === "À relancer").length; $("bPro").textContent = r; $("bPro").hidden = !r;
  const f = D.pieces.filter((p) => mine(p) && (pState(p).k === "retard" || (p.type === "facture" && p.statut === "brouillon"))).length; $("bFac").textContent = f; $("bFac").hidden = !f;
  const u = unread(); $("bMsg").textContent = u; $("bMsg").hidden = !u;
  document.title = (n + u ? `(${n + u}) ` : "") + "TissaWeb Admin";
  extraBadges();
}
function route() {
  const h = (location.hash || "#accueil").slice(1).split("/");
  S.view = h[0] || "accueil"; S.param = h[1] || null;
  document.querySelectorAll("#nav a").forEach((a) => { if (a.dataset.v === S.view || (S.view === "client" && a.dataset.v === "clients")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  $("side").classList.remove("open"); $("menuBtn").setAttribute("aria-expanded", "false");
  render();
}
function render() {
  setBadges();
  const v = VIEWS[S.view] || VIEWS.accueil;
  const el = $("view"), changed = S._lastView !== S.view; S._lastView = S.view;
  el.innerHTML = v(); flipKpis(el);
  if (changed) { el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter"); countUp(el); }
  cockpitFx(); requestAnimationFrame(navPill);
  if (S.after) { const f = S.after; S.after = null; f(); }
}


/* ---------- Graphique en vraie 3D (barres qui sortent du sol) ---------- */
function bars3d(steps, opt) {
  opt = opt || {}; const top = Math.max(1, ...steps.map((x) => x[1])), H = opt.h || 130;
  return `<div class="b3 ${opt.dark ? "dark" : ""}"><div class="b3-scene"><div class="b3-plate">${steps.map((x, i) => `<div class="b3-bar" style="--i:${i};--hh:${Math.max(8, Math.round(Math.sqrt(x[1] / top) * H))}px;--c:${x[2]}"><i class="t"></i><i class="f"></i><i class="r"></i></div>`).join("")}</div></div>
    <div class="b3-leg">${steps.map((x) => `<span><i style="background:${x[2]}"></i>${x[0]} <b class="num" data-count="${x[1]}">${x[1]}</b></span>`).join("")}</div></div>`;
}
/* ---------- Cockpit du tableau de bord (bandeau vivant) ---------- */
function cockpitHTML(nTodo) {
  const h = new Date().getHours(), me = S.me ? S.me.nom.split(" ")[0] : "";
  const hello = h < 5 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
  const c = cfg(), on = c.auto_prospect === true, max = c.auto_par_jour || 5;
  const auto = D.messages.filter((m) => m.direction === "out" && m.auteur === "Auto");
  const today0 = auto.filter((m) => new Date(m.date) > new Date(Date.now() - 20 * 3600000)).length;
  const dem = D.demandes.filter((d) => d.statut === "nouvelle").length, un = unread(), rel = D.prospects.filter((p) => prState(p)[0] === "À relancer").length;
  const chips = [[dem, "nouvelle(s) demande(s)", "#demandes"], [un, "mail(s) non lu(s)", "#messages"], [rel, "prospect(s) à relancer", "#prospects"]].filter((x) => x[0]);
  const np = (k) => D.prospects.filter((p) => p.statut === k).length;
  const b3 = bars3d([["À contacter", np("a_contacter"), "#5E6B65"], ["Contactés", np("contacte"), "#4C8DDB"], ["Intéressés", np("interesse"), "#3DDC97"], ["Clients", np("client"), "#F2C14E"]], { dark: true, h: 120 });
  return `<section class="cockpit" id="cockpit"><div class="ck-fx" id="ckFx" aria-hidden="true"></div><div class="ck-3d" aria-hidden="true">${b3}</div>
    <div class="ck-in"><div class="ck-top"><span class="eyebrow">${frDate(today())}</span><span class="ck-clock num" id="ckClock"></span></div>
      <h1>${hello} ${esc(me)}</h1>
      <p>${nTodo ? `${nTodo} chose${nTodo > 1 ? "s" : ""} à faire aujourd'hui, listée${nTodo > 1 ? "s" : ""} plus bas dans l'ordre.` : "Rien d'urgent : tout est à jour."}</p>
      <div class="ck-chips">${chips.map((x) => `<a class="ck-chip" href="${x[2]}"><b class="num" data-count="${x[0]}">${x[0]}</b> ${x[1]}</a>`).join("")}
        ${window.TW3D && TW3D.need() ? `<button type="button" class="ck-chip gyro" data-gyro>📱 Activer la 3D (penche ton téléphone)</button>` : ""}
        <a class="ck-chip ${on ? "live" : ""}" href="#prospects"><span class="pulse" aria-hidden="true"></span>Pilote auto ${on ? `· ${today0}/${max} aujourd'hui` : "coupé"}</a></div></div>
    ${D.journal.length ? `<div class="ck-feed" aria-label="Activité en direct"><span class="ck-live">EN DIRECT</span><div class="ck-track"><div class="ck-run">${(() => { const it = D.journal.slice(0, 10).map((j) => `<span><i></i>${esc(j.texte)} <small>${ago(j.created_at)}</small></span>`).join(""); return it + it; })()}</div></div></div>` : ""}</section>`;
}
const CK = { cv: null, gl: null, raf: 0, t0: performance.now(), mx: .7, my: .6, tx: .7, ty: .6 };
function cockpitFx() {
  const host = $("ckFx"); if (!host) { if (CK.raf) cancelAnimationFrame(CK.raf); CK.raf = 0; return; }
  /* fond animé retiré (demande de Hugo) : on garde seulement l'horloge en direct */
  const tick = () => { const c = $("ckClock"); if (c) c.textContent = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
  tick(); if (!CK.iv) CK.iv = setInterval(tick, 1000); $("cockpit").classList.add("on"); return;
  if (!CK.cv) {
    CK.cv = document.createElement("canvas");
    const gl = CK.cv.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;
    const VS = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
    const FS = "precision mediump float;varying vec2 v;uniform float t,a;uniform vec2 m,r;" +
      "float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}" +
      "float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),u.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),u.x),u.y);}" +
      "float fb(vec2 p){float x=0.,k=.5;mat2 M=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){x+=k*n(p);p=M*p;k*=.5;}return x;}" +
      "float H(vec2 u){vec2 p=(u-.5)*vec2(a,1.)*1.3;vec2 q=vec2(fb(p+vec2(0.,t*.10)),fb(p+vec2(5.2,1.3)-t*.08));float h=fb(p+2.4*q+vec2(t*.04,0.));vec2 mm=(m-.5)*vec2(a,1.)*1.3;float d=length(p-mm);return h+exp(-d*d*4.)*.12;}" +
      "void main(){float e=1.5/r.y;float h=H(v),hx=H(v+vec2(e,0.)),hy=H(v+vec2(0.,e));vec3 N=normalize(vec3((h-hx)*4.2,(h-hy)*4.2,e*60.));" +
      "vec2 u=v+N.xy*.16;vec3 c=mix(vec3(.02,.20,.12),vec3(.04,.54,.31),smoothstep(-.2,1.2,u.y+.15*sin(u.x*3.+t*.2)));c=mix(c,vec3(.35,.86,.58),smoothstep(.55,1.,1.-length(u-vec2(.85,.85))*1.3)*.8);c*=.55+.45*h;" +
      "c+=vec3(.78,1.,.88)*pow(1.-abs(sin(h*9.-t*.35+N.x*2.)),18.)*.14;c+=vec3(.98,1.,.96)*pow(max(dot(reflect(-normalize(vec3(-.45,.6,.65)),N),vec3(0,0,1)),0.),70.)*.7;gl_FragColor=vec4(max(c*.8,vec3(.03,.12,.08)),1.);}";
    const sh = (ty, src) => { const o = gl.createShader(ty); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    CK.gl = gl; CK.U = { t: gl.getUniformLocation(pr, "t"), a: gl.getUniformLocation(pr, "a"), m: gl.getUniformLocation(pr, "m"), r: gl.getUniformLocation(pr, "r") };
    document.addEventListener("pointermove", (e) => { const h = $("cockpit"); if (!h) return; const r = h.getBoundingClientRect(); CK.tx = (e.clientX - r.left) / r.width; CK.ty = 1 - (e.clientY - r.top) / r.height; }, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) cockpitFx(); });
  }
  if (!CK.gl) return;
  host.appendChild(CK.cv);
  const gl = CK.gl, w = host.clientWidth, h = host.clientHeight, sc = innerWidth < 820 ? .4 : .5;
  CK.cv.width = Math.max(2, Math.round(w * sc)); CK.cv.height = Math.max(2, Math.round(h * sc)); gl.viewport(0, 0, CK.cv.width, CK.cv.height);
  gl.uniform1f(CK.U.a, w / Math.max(1, h)); gl.uniform2f(CK.U.r, CK.cv.width, CK.cv.height);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clock = () => { const c = $("ckClock"); if (c) c.textContent = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
  const frame = (now) => {
    if (!$("ckFx") || !CK.cv.isConnected) { CK.raf = 0; return; }
    CK.mx += (CK.tx - CK.mx) * .05; CK.my += (CK.ty - CK.my) * .05;
    gl.uniform1f(CK.U.t, (now - CK.t0) / 1000); gl.uniform2f(CK.U.m, CK.mx, CK.my); gl.drawArrays(gl.TRIANGLES, 0, 3);
    CK.raf = reduce || document.hidden ? 0 : requestAnimationFrame(frame);
  };
  clock(); if (!CK.iv) CK.iv = setInterval(clock, 1000); if (CK.raf) cancelAnimationFrame(CK.raf); CK.raf = 0;
  $("cockpit").classList.add("on");
  if (reduce) frame(performance.now() + 6000); else CK.raf = requestAnimationFrame(frame);
}

/* ---------- Aperçu du futur site du prospect (même générateur que tissaweb.fr) ---------- */
S.pvm = S.pvm || {};
function pvMetier(p) { return S.pvm[p.id] || (window.TWEssai ? TWEssai.metier(p.activite) : "boutique"); }
function pvBlock(p) {
  if (!window.TWEssai) return "";
  const m = pvMetier(p), lien = TWEssai.lien(p.entreprise, m), tel = (p.tel || "").replace(/[^\d+]/g, "");
  const me = S.me ? S.me.nom.split(" ")[0] : "Hugo";
  const sms = `Bonjour, c'est ${me} de TissaWeb (Dijon). J'ai préparé un aperçu du site que pourrait avoir ${p.entreprise} : ${lien} Je peux vous le faire en 7 jours. Bonne journée !`;
  return `<section class="pv">
    <div class="pv-stage"><div class="pv-browser"><div class="pv-bar"><i></i><i></i><i></i><span>${esc(TWEssai.slug(p.entreprise))}.fr</span></div><div class="pv-screen"><div data-pv="${p.id}" data-pvm="${m}" data-pvn="${esc(p.entreprise)}"></div></div></div>
      <div class="pv-phone"><div class="pv-screen"><div data-pv="${p.id}" data-pvm="${m}" data-pvn="${esc(p.entreprise)}"></div></div></div></div>
    <div class="pv-side"><span class="eyebrow">Son futur site</span><h3>Montre-lui, il signe.</h3>
      <p class="note">Le prospect ouvre ce lien et voit son site à son nom sur tissaweb.fr, avec le bouton pour te demander un devis.</p>
      <div class="pv-ms">${Object.keys(TWEssai.T).map((k) => `<button type="button" class="${k === m ? "on" : ""}" data-pvset="${k}" data-id="${p.id}">${TWEssai.T[k].label}</button>`).join("")}</div>
      <div class="pv-act"><button class="btn pv-3d" type="button" data-pv3d="${p.id}">▶ Construction 3D</button><button class="btn primary" type="button" data-pvcopy="${esc(lien)}">Copier son lien perso</button>${tel ? `<a class="btn" href="sms:${tel}?&body=${encodeURIComponent(sms)}">Envoyer par SMS</a>` : ""}<a class="btn ghost" href="${esc(lien)}" target="_blank" rel="noopener">Voir</a></div></div>
  </section>`;
}
function hydratePv(root) {
  if (!window.TWEssai || !root) return;
  root.querySelectorAll("[data-pv]").forEach((el) => TWEssai.render(el, el.dataset.pvm, el.dataset.pvn));
}
document.addEventListener("click", (ev) => {
  const b3 = ev.target.closest("[data-pv3d]");
  if (b3 && TWEssai.cinema) { const p = byId("prospects", b3.dataset.pv3d); const m = pvMetier(p), lien = TWEssai.lien(p.entreprise, m);
    return TWEssai.cinema({ nom: p.entreprise, metier: m, cta: { text: "Copier son lien perso", onClick: () => { (navigator.clipboard ? navigator.clipboard.writeText(lien) : Promise.reject()).then(() => toast("Lien copié : il verra la même construction sur tissaweb.fr"), () => prompt("Copie ce lien :", lien)); } } }); }
  const b = ev.target.closest("[data-pvset],[data-pvcopy]"); if (!b) return;
  if (b.dataset.pvset) { S.pvm[b.dataset.id] = b.dataset.pvset; return S.sheetRender && S.sheetRender(); }
  const url = b.dataset.pvcopy;
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast("Lien copié : colle-le dans un mail, un SMS ou un DM Insta"), () => prompt("Copie ce lien :", url));
});

/* ---------- Pipeline glisser-déposer ---------- */
const COLS = [["a_contacter", "À contacter"], ["contacte", "Contactés"], ["interesse", "Intéressés"], ["client", "Clients"], ["pas_interesse", "Pas intéressés"]];
function proBoard(cnt, q) {
  const list = D.prospects.filter((p) => !q || (p.entreprise + " " + (p.activite || "") + " " + (p.adresse || "")).toLowerCase().includes(q));
  const card = (p, i) => { const s = prState(p); return `<article class="pc" draggable="true" data-prospect="${p.id}" data-drag="${p.id}" style="--i:${Math.min(i, 12)}"><b>${esc(p.entreprise)}</b><small>${esc(p.activite || "")}</small><div class="pc-f">${p.email ? `<span class="pc-t on">mail</span>` : `<span class="pc-t">pas de mail</span>`}${p.tel ? `<span class="pc-t on">tél</span>` : ""}${s[0] === "À relancer" ? `<span class="pc-t warn">à relancer</span>` : ""}${p.nb_contacts ? `<span class="pc-t">${p.nb_contacts} mail${p.nb_contacts > 1 ? "s" : ""}</span>` : ""}</div></article>`; };
  return `<div class="head"><div><h1>Prospection</h1><p>Glisse une carte d'une colonne à l'autre pour changer son statut. Clique dessus pour ouvrir la fiche et son futur site.</p></div><div class="actions"><div class="seg mode"><button type="button" data-promode="liste" aria-pressed="false">Liste</button><button type="button" data-promode="tableau" aria-pressed="true">Tableau</button></div><button class="btn primary" type="button" data-bulk>Envoi groupé</button><button class="btn" type="button" data-newprospect>+ Prospect</button></div></div>
  <div class="filters"><input id="qPro" type="search" placeholder="Rechercher" value="${esc(S.qPro || "")}"></div>
  <div class="board">${COLS.map(([k, label]) => { const items = list.filter((p) => p.statut === k).sort((a, b) => (a.priorite || 50) - (b.priorite || 50)); return `<section class="col" data-col="${k}"><header><span>${label}</span><b class="num">${items.length}</b></header><div class="col-body">${items.map(card).join("") || `<p class="col-empty">Dépose une carte ici</p>`}</div></section>`; }).join("")}</div>`;
}
document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-promode]"); if (!b) return; S.proMode = b.dataset.promode; S._lastView = null; render(); });
document.addEventListener("dragstart", (e) => { const c = e.target.closest && e.target.closest("[data-drag]"); if (!c) return; e.dataTransfer.setData("text/plain", c.dataset.drag); e.dataTransfer.effectAllowed = "move"; c.classList.add("dragging"); document.body.classList.add("is-dragging"); });
document.addEventListener("dragend", (e) => { document.querySelectorAll(".dragging,.col.over").forEach((x) => x.classList.remove("dragging", "over")); document.body.classList.remove("is-dragging"); });
document.addEventListener("dragover", (e) => { const col = e.target.closest && e.target.closest("[data-col]"); if (!col) return; e.preventDefault(); document.querySelectorAll(".col.over").forEach((x) => x !== col && x.classList.remove("over")); col.classList.add("over"); });
document.addEventListener("drop", async (e) => {
  const col = e.target.closest && e.target.closest("[data-col]"); if (!col) return; e.preventDefault();
  const id = e.dataTransfer.getData("text/plain"), p = byId("prospects", id), st = col.dataset.col; col.classList.remove("over");
  if (!p || p.statut === st) return;
  const patch = { statut: st }; if (st !== "contacte") patch.prochaine_action = null;
  const r = await upd("prospects", id, patch); await log("prospect", `${r.entreprise} : ${PSTAT[st][0].toLowerCase()}`, { prospect_id: id });
  S._lastView = null; render();
  const el = document.querySelector(`[data-drag="${id}"]`); if (el) el.classList.add("landed");
  if (st === "client") celebrate("Nouveau client : " + r.entreprise + " !"); else if (st === "interesse") celebrate(r.entreprise + " est intéressé !", true); else toast(`${r.entreprise} → ${PSTAT[st][0]}`);
});

/* ---------- Célébration (victoires) ---------- */
function celebrate(msg, small) {
  toast(msg, 3200);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.createElement("canvas"); cv.className = "fx-canvas"; document.body.appendChild(cv);
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext("2d"); g.scale(dpr, dpr);
  const cols = ["#0B7A55", "#3DDC97", "#FFFFFF", "#C9F2DD", "#0C1310"], N = small ? 70 : 170, P = [];
  for (let i = 0; i < N; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * 1.9, v = (small ? 7 : 10) + Math.random() * 9; P.push({ x: W / 2 + (Math.random() - .5) * 120, y: H * .62, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6.28, vr: (Math.random() - .5) * .35, w: 6 + Math.random() * 7, h: 3 + Math.random() * 5, c: cols[i % cols.length] }); }
  const t0 = performance.now();
  (function f(now) { const t = (now - t0) / 1000; g.clearRect(0, 0, W, H);
    P.forEach((p) => { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.globalAlpha = Math.max(0, 1 - t / 2.4); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); });
    if (t < 2.5) requestAnimationFrame(f); else cv.remove(); })(t0);
}

/* ---------- 3D partout : logo en cube, et toute l'appli bouge en relief avec le téléphone (ou la souris) ---------- */
(function () {
  document.querySelectorAll(".brand .mark").forEach((m) => {
    if (m.classList.contains("cube3")) return; const svg = m.innerHTML;
    m.classList.add("cube3"); m.innerHTML = `<span class="cb">${["f", "b", "l", "r", "t", "d"].map((k) => `<i class="${k}">${svg}</i>`).join("")}</span>`;
  });
  const R = document.documentElement, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const loop = () => { x += (tx - x) * .12; y += (ty - y) * .12; R.style.setProperty("--gx", x.toFixed(3)); R.style.setProperty("--gy", y.toFixed(3)); raf = Math.abs(tx - x) + Math.abs(ty - y) > .002 ? requestAnimationFrame(loop) : 0; };
  const set = (a, b) => { tx = Math.max(-1, Math.min(1, a)); ty = Math.max(-1, Math.min(1, b)); if (!raf) raf = requestAnimationFrame(loop); };
  R.classList.add("g3d");
  if (reduce) { R.style.setProperty("--gx", ".35"); R.style.setProperty("--gy", "-.25"); return; }
  if (matchMedia("(pointer: fine)").matches) document.addEventListener("pointermove", (e) => set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
  const onOri = (e) => { if (e.gamma == null) return; set(e.gamma / 25, (e.beta - 40) / 25); };
  window.TW3D = {
    need: () => typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function" && localStorage.getItem("tw-gyro") !== "1",
    ask: async () => { try { const r = await DeviceOrientationEvent.requestPermission(); if (r === "granted") { localStorage.setItem("tw-gyro", "1"); addEventListener("deviceorientation", onOri); toast("3D activée : penche ton téléphone"); render(); } else toast("Autorisation refusée"); } catch (e) { toast("Impossible d'activer le capteur"); } }
  };
  if (typeof DeviceOrientationEvent !== "undefined" && (typeof DeviceOrientationEvent.requestPermission !== "function" || localStorage.getItem("tw-gyro") === "1")) addEventListener("deviceorientation", onOri);
})();
document.addEventListener("click", (e) => { if (e.target.closest("[data-gyro]") && window.TW3D) TW3D.ask(); });

/* ---------- Cartes de chiffres qui se retournent en 3D (touche ou clic) ---------- */
function flipKpis(root) {
  const box = root.querySelector("[data-flipkpis]"); if (!box) return;
  const mk = monthKey(), list = D.pieces.filter(mine), prev = new Date(); prev.setMonth(prev.getMonth() - 1); const pk = prev.toISOString().slice(0, 7);
  const encPrev = list.filter((p) => p.type === "facture" && p.statut === "payee" && (p.paye_le || "").slice(0, 7) === pk).reduce((s, p) => s + total(p), 0);
  const nbClients = D.clients.length, nbDevis = list.filter((p) => p.type === "devis").length, acc = list.filter((p) => p.type === "devis" && ["accepte", "facture"].includes(p.statut)).length;
  const backs = [`Mois dernier : <b>${eur0(encPrev)}</b>`, `${nbClients} client${nbClients > 1 ? "s" : ""} au total`, nbDevis ? `${Math.round(acc / nbDevis * 100)} % de devis acceptés` : "Aucun devis pour l'instant", `${D.abonnements.filter((a) => a.actif).length} abonnement(s) actif(s)`];
  box.querySelectorAll(".kpi").forEach((k, i) => {
    if (k.querySelector(".kf")) return;
    k.innerHTML = `<div class="kf"><div class="kfront">${k.innerHTML}</div><div class="kback"><span>${k.querySelector("span").textContent}</span><p>${backs[i] || ""}</p><small>Touche pour revenir</small></div></div>`;
    k.tabIndex = 0; k.setAttribute("role", "button");
  });
}
document.addEventListener("click", (e) => { const k = e.target.closest("[data-flipkpis] .kpi"); if (k) k.classList.toggle("flipped"); });
/* ---------- Pastille du menu qui glisse vers la page active ---------- */
function navPill() {
  const nav = $("nav"); if (!nav) return;
  let pill = nav.querySelector(".nav-pill"); if (!pill) { pill = document.createElement("i"); pill.className = "nav-pill"; pill.setAttribute("aria-hidden", "true"); nav.prepend(pill); }
  const a = nav.querySelector("a[aria-current=page]"); if (!a) { pill.style.opacity = 0; return; }
  pill.style.opacity = 1; pill.style.transform = `translateY(${a.offsetTop}px)`; pill.style.height = a.offsetHeight + "px";
}
/* ---------- Relief 3D : les cartes s'inclinent sous la souris ---------- */
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let cur = null;
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest && e.target.closest(".kpi,.pilot > *,.pc,.cockpit,.pv-stage,.grid2 > .card");
    if (cur && cur !== el) { cur.style.transform = ""; cur.classList.remove("t3d"); }
    cur = el; if (!el) return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    const k = el.classList.contains("cockpit") || el.classList.contains("card") ? 3 : el.classList.contains("pv-stage") ? 10 : 7;
    el.classList.add("t3d"); el.style.transform = `perspective(900px) rotateX(${(-y * k).toFixed(2)}deg) rotateY(${(x * k).toFixed(2)}deg) translateZ(6px)`;
  }, { passive: true });
  document.addEventListener("pointerleave", () => { if (cur) cur.style.transform = ""; }, true);
}
/* ---------- Lumière qui suit la souris sur les cartes ---------- */
document.addEventListener("pointermove", (e) => {
  const el = e.target.closest && e.target.closest(".card,.kpi,.pilot > *,.item,.ck-chip"); if (!el) return;
  const r = el.getBoundingClientRect(); el.style.setProperty("--mx", (e.clientX - r.left) + "px"); el.style.setProperty("--my", (e.clientY - r.top) + "px");
}, { passive: true });
/* Animation des chiffres (seulement en changeant de page, et pas si l'utilisateur a réduit les animations) */
function countUp(root) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.querySelectorAll("[data-eur]").forEach((n) => {
    const to = +n.dataset.eur; if (!to) return; const t0 = performance.now(), d = 1000;
    const step = (t) => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); n.textContent = eur0(Math.round(to * e)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  root.querySelectorAll("[data-count]").forEach((n) => {
    const to = +n.dataset.count; if (!to) return; const t0 = performance.now(), d = 900;
    const step = (t) => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); n.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); };
    n.textContent = "0"; requestAnimationFrame(step);
  });
}
function rerender() { render(); if (!$("sheet").hidden && S.sheetRender) S.sheetRender(); }

/* ================= vues ================= */
const VIEWS = {};
VIEWS.accueil = function () {
  const mk = monthKey(), list = D.pieces.filter(mine);
  const encMois = list.filter((p) => p.type === "facture" && p.statut === "payee" && (p.paye_le || "").slice(0, 7) === mk).reduce((s, p) => s + total(p), 0);
  const due = list.filter((p) => p.type === "facture" && p.statut === "envoye"), late = due.filter((p) => pState(p).k === "retard");
  const qs = list.filter((p) => p.type === "devis" && p.statut === "envoye" && pState(p).k !== "expire");
  const mrr = D.abonnements.filter((a) => a.actif && mine(a)).reduce((s, a) => s + (+a.montant || 0), 0);
  const todo = [];
  D.demandes.filter((d) => d.statut === "nouvelle").forEach((d) => todo.push({ c: "info", t: `Nouvelle demande : ${d.nom}`, s: `${d.activite || ""}${d.offre ? " · " + d.offre : ""} · ${ago(d.created_at)}`, a: `<button class="btn sm primary" data-dem="${d.id}">Traiter</button>` }));
  const un = unread(); if (un) todo.push({ c: "info", t: `${un} mail${un > 1 ? "s" : ""} non lu${un > 1 ? "s" : ""}`, s: convs().filter((c) => c.unread).slice(0, 3).map((c) => c.name).join(", "), a: `<a class="btn sm primary" href="#messages">Lire</a>` });
  ["hugo", "lucas"].forEach((k) => { if ((S.who === "tous" || S.who === k) && !em(k).siret) todo.push({ c: "warn", t: `SIRET de ${first(k)} à compléter`, s: "Obligatoire sur les factures.", a: `<a class="btn sm" href="#reglages">Réglages</a>` }); });
  list.forEach((p) => {
    const st = pState(p).k;
    if (st === "brouillon") todo.push({ c: "", t: `Envoyer ${p.type === "devis" ? "le devis" : "la " + kindLabel(p).toLowerCase()} à ${cname(p.client_id)}`, s: `${p.numero} · ${eur(total(p))}`, a: `<button class="btn sm" data-piece="${p.id}">Ouvrir</button>` });
    if (st === "retard") todo.push({ c: "bad", t: `Relancer ${cname(p.client_id)}`, s: `${p.numero} · ${eur(total(p))} · échue le ${sDate(p.echeance)}`, a: `<button class="btn sm" data-piece="${p.id}">Relancer</button>` });
    if (st === "envoye" && p.type === "devis" && p.envoye_le && daysBetween(p.envoye_le, today()) >= 5) todo.push({ c: "warn", t: `Devis sans réponse : ${cname(p.client_id)}`, s: `${p.numero} envoyé le ${sDate(p.envoye_le)}`, a: `<button class="btn sm" data-piece="${p.id}">Ouvrir</button>` });
    if (st === "expire") todo.push({ c: "warn", t: `Devis expiré : ${cname(p.client_id)}`, s: p.numero, a: `<button class="btn sm" data-piece="${p.id}">Ouvrir</button>` });
  });
  D.projets.filter((x) => x.statut === "en_cours" && mine(x)).forEach((pj) => {
    const next = (pj.etapes || []).find((e) => !e.done); const late = pj.date_prevue && pj.date_prevue < today();
    todo.push({ c: late ? "bad" : "ok", t: `${pj.titre} : ${next ? next.t.toLowerCase() : "à terminer"}`, s: late ? `En retard, prévu le ${sDate(pj.date_prevue)}` : `Livraison prévue le ${sDate(pj.date_prevue)}`, a: `<button class="btn sm" data-projet="${pj.id}">Ouvrir</button>` });
  });
  const relances = D.prospects.filter((p) => prState(p)[0] === "À relancer");
  if (relances.length) todo.push({ c: "warn", t: `${relances.length} prospect${relances.length > 1 ? "s" : ""} à relancer`, s: relances.slice(0, 3).map((p) => p.entreprise).join(", "), a: `<a class="btn sm" href="#prospects">Voir</a>` });
  const dl = nextDeadline(); if (dl && daysBetween(today(), dl.date) <= 15) todo.push({ c: "info", t: `Déclaration URSSAF avant le ${frDate(dl.date)}`, s: dl.label, a: `<a class="btn sm" href="#urssaf">Montants</a>` });
  const recent = D.journal.slice(0, 8);
  return `${cockpitHTML(todo.length)}
  <div class="kpis" data-flipkpis>
    <div class="kpi"><span>Encaissé ce mois</span><b class="num" data-eur="${encMois}">${eur0(encMois)}</b><span>${MOIS[new Date().getMonth()]}</span></div>
    <div class="kpi"><span>À encaisser</span><b class="num" data-eur="${due.reduce((s, p) => s + total(p), 0)}">${eur0(due.reduce((s, p) => s + total(p), 0))}</b><span>${due.length ? due.length + " facture(s)" + (late.length ? " · " + late.length + " en retard" : "") : "Rien en attente"}</span></div>
    <div class="kpi"><span>Devis en attente</span><b class="num" data-eur="${qs.reduce((s, p) => s + total(p), 0)}">${eur0(qs.reduce((s, p) => s + total(p), 0))}</b><span>${qs.length} devis envoyé(s)</span></div>
    <div class="kpi"><span>Maintenance</span><b class="num" data-eur="${mrr}">${eur0(mrr)}</b><span>par mois, récurrent</span></div>
  </div>
  ${objHTML()}
  ${dashCharts()}
  <div class="grid2"><div class="card"><h2>À faire (${todo.length})</h2><ul class="list">${todo.length ? todo.map((x) => `<li class="item ${x.c}"><div><b>${esc(x.t)}</b><small>${esc(x.s)}</small></div>${x.a || ""}</li>`).join("") : `<li class="item ok"><div><b>Tout est à jour</b><small>Les prochaines actions apparaîtront ici automatiquement.</small></div></li>`}</ul></div>
  <div class="card"><h2>Activité récente</h2>${recent.length ? `<ul class="timeline">${recent.map((j) => `<li><time>${ago(j.created_at)}</time><div>${esc(j.texte)}${j.auteur ? ` <small class="note">· ${esc(j.auteur)}</small>` : ""}</div></li>`).join("")}</ul>` : `<p class="note">L'historique des actions de Lucas et toi s'affichera ici.</p>`}</div></div>`;
};
VIEWS.demandes = function () {
  const f = S.fDem || "ouvertes";
  const rows = D.demandes.filter((d) => f === "toutes" || (f === "ouvertes" ? ["nouvelle", "repondu"].includes(d.statut) : d.statut === f));
  return `<div class="head"><div><h1>Demandes du site</h1><p>Chaque formulaire rempli sur tissaweb.fr arrive ici automatiquement, en temps réel.</p></div><div class="actions"><button class="btn" type="button" data-pushon>Notifications</button>${D.demandes.some((d) => ["archivee", "spam", "convertie"].includes(d.statut)) ? `<button class="btn ghost danger" type="button" data-danger data-purgedem>Vider les traitées</button>` : ""}</div></div>
  <div class="filters"><select id="fDem"><option value="ouvertes"${f === "ouvertes" ? " selected" : ""}>À traiter</option><option value="convertie"${f === "convertie" ? " selected" : ""}>Devis créé</option><option value="archivee"${f === "archivee" ? " selected" : ""}>Archivées</option><option value="toutes"${f === "toutes" ? " selected" : ""}>Toutes</option></select></div>
  <ul class="list">${rows.length ? rows.map((d) => `<li class="item click ${d.statut === "nouvelle" ? "info" : ""}" data-dem="${d.id}"><div><b>${esc(d.nom)}</b> <span class="chip ${DSTAT[d.statut] ? DSTAT[d.statut][1] : ""}">${DSTAT[d.statut] ? DSTAT[d.statut][0] : esc(d.statut)}</span><small>${esc(d.activite || "")}${d.offre ? " · " + esc(d.offre) : ""} · ${esc(d.email)} · ${ago(d.created_at)}${d.langue && d.langue !== "fr" ? " · site en " + esc(d.langue.toUpperCase()) : ""}</small>${d.message ? `<small style="margin-top:4px;color:var(--ink-2)">« ${esc(d.message.slice(0, 140))}${d.message.length > 140 ? "…" : ""} »</small>` : ""}</div></li>`).join("") : `<li class="item"><div class="empty"><h3>Aucune demande ici</h3>Dès qu'un visiteur remplit le formulaire de tissaweb.fr, elle apparaît ici et dans le tableau de bord.</div></li>`}</ul>`;
};

/* ---------- Pilote auto : progression + mails envoyés automatiquement ---------- */
function autoQueue() {
  const ok = (p) => p.email && (p.priorite ?? 50) < 50 && (/\b(vous|votre|vos)\b/i.test(p.angle || "") || !(p.site_actuel || /a déjà un site|site wix|site [a-z0-9.-]+\.(fr|com|net)/i.test(p.notes || "")));
  const t = today();
  const rel = D.prospects.filter((p) => ok(p) && p.statut === "contacte" && (p.nb_contacts || 0) === 1 && p.prochaine_action && p.prochaine_action <= t);
  const neu = D.prospects.filter((p) => ok(p) && p.statut === "a_contacter" && !(p.nb_contacts || 0)).sort((a, b) => (a.priorite || 50) - (b.priorite || 50));
  return rel.concat(neu);
}
function autoNext(on, sentToday, max) {
  if (!on) return "Envoi auto coupé";
  const now = new Date(), P = (d) => Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", hour: "numeric", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  const p = P(now), h = +p.hour, we = /samedi|dimanche/.test(p.weekday);
  if (!we && h >= 9 && h < 11 && sentToday < max) return "En cours : 1 mail toutes les 20 min";
  for (let i = (we || h >= 9) ? 1 : 0; i < 8; i++) { const d = new Date(now.getTime() + i * 86400000), q = P(d); if (!/samedi|dimanche/.test(q.weekday)) return "Prochain envoi : " + (i === 0 ? "aujourd'hui" : i === 1 ? "demain" : q.weekday) + " à 9 h"; }
  return "";
}
function autoPanel() {
  const c = cfg(), on = c.auto_prospect === true, max = c.auto_par_jour || 5;
  const auto = D.messages.filter((m) => m.direction === "out" && m.auteur === "Auto").sort((a, b) => new Date(b.date) - new Date(a.date));
  const d0 = new Date(Date.now() - 20 * 3600000), sentToday = auto.filter((m) => new Date(m.date) > d0).length;
  const withMail = D.prospects.filter((p) => p.email && p.statut !== "pas_interesse");
  const touched = withMail.filter((p) => (p.nb_contacts || 0) > 0 || ["interesse", "client"].includes(p.statut)).length;
  const pct = withMail.length ? Math.round(touched / withMail.length * 100) : 0;
  const n = (s) => D.prospects.filter((p) => p.statut === s).length;
  const steps = [["À contacter", n("a_contacter"), ""], ["Contactés", n("contacte"), "info"], ["Intéressés", n("interesse"), "ok"], ["Clients", n("client"), "ok"]];
  const top = Math.max(1, ...steps.map((x) => x[1]));
  const q = autoQueue();
  const pr = (m) => D.prospects.find((p) => p.id === m.prospect_id) || D.prospects.find((p) => (p.email || "").toLowerCase() === (m.to_email || "").toLowerCase()) || {};
  return `<section class="pilot" aria-label="Progression de la prospection">
    <div class="pilot-ring" style="--p:${pct}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="trk"/><circle cx="60" cy="60" r="52" class="val" pathLength="100"/></svg><div><b class="num" data-count="${pct}">${pct}</b><span>%</span><small>des prospects avec mail déjà contactés</small></div></div>
    <div class="pilot-funnel">${bars3d(steps.map((x) => [x[0], x[1], x[2] === "info" ? "#4C8DDB" : x[2] === "ok" ? "#0B7A55" : "#8A9690"]), { h: 110 })}</div>
    <div class="pilot-auto ${on ? "on" : "off"}"><div class="pa-head"><span class="pulse" aria-hidden="true"></span><b>Pilote auto ${on ? "activé" : "coupé"}</b></div>
      <p>${esc(autoNext(on, sentToday, max))}</p>
      <div class="pa-stats"><div><b class="num">${sentToday}/${max}</b><small>aujourd'hui</small></div><div><b class="num">${auto.length}</b><small>envoyés au total</small></div><div><b class="num">${q.length}</b><small>en file</small></div></div>
      ${q.length ? `<small class="pa-next">Prochains : ${q.slice(0, 3).map((p) => esc(p.entreprise)).join(", ")}${q.length > 3 ? "…" : ""}</small>` : ""}
      <a class="btn sm" href="#reglages">${on ? "Régler / couper" : "Activer"}</a></div>
  </section>
  <details class="card autolog" ${auto.length ? "open" : ""}><summary><h2>Envoyés automatiquement</h2><span class="chip">${auto.length}</span></summary>
    ${auto.length ? `<ul class="list">${auto.slice(0, 30).map((m, i) => { const p = pr(m); const rel = /relance/i.test(m.subject || ""); const rep = p.statut === "interesse" || p.statut === "client"; return `<li class="item click" style="--i:${i}" data-conv="${esc(m.to_email)}"><div><b>${esc(p.entreprise || m.to_email)}</b> <span class="chip ${rel ? "warn" : "info"}">${rel ? "Relance" : "1er mail"}</span>${rep ? ` <span class="chip ok">A répondu</span>` : p.statut === "pas_interesse" ? ` <span class="chip bad">STOP</span>` : ""}<small>${esc(m.subject || "")} · ${ago(m.date)}</small></div></li>`; }).join("")}</ul>` : `<p class="note">Rien encore. Les premiers mails partiront ${esc(autoNext(on, sentToday, max).replace(/^Prochain envoi : /, "").toLowerCase())}.</p>`}
  </details>
  ${Object.keys(triCounts()).length ? `<div class="card tri-card"><h2>Réponses triées automatiquement</h2><p class="note">Chaque réponse est lue et rangée toute seule : le prospect passe en « Intéressé » ou « Pas intéressé », et tu reçois une notif.</p>${triBar()}</div>` : `<div class="card tri-card"><h2>Réponses triées automatiquement</h2><p class="note">Dès qu'un prospect répond, sa réponse est rangée toute seule : ✅ partant, ❌ refus, 💬 à lire, 🏖️ absent ou 📭 adresse invalide. Le prospect change de colonne et tu reçois une notif.</p></div>`}`;
}
VIEWS.prospects = function () {
  const f = S.fPro || "actifs", q = (S.qPro || "").toLowerCase();
  const order = { a_relancer: 0, a_contacter: 1, interesse: 2, contacte: 3, client: 4, pas_interesse: 5 };
  const rows = D.prospects.filter((p) => {
    const k = prState(p)[0] === "À relancer" ? "a_relancer" : p.statut;
    if (f === "actifs" && ["client", "pas_interesse"].includes(p.statut)) return false;
    if (f !== "actifs" && f !== "tous" && k !== f) return false;
    return !q || (p.entreprise + " " + (p.activite || "") + " " + (p.adresse || "")).toLowerCase().includes(q);
  }).sort((a, b) => (order[prState(a)[0] === "À relancer" ? "a_relancer" : a.statut] - order[prState(b)[0] === "À relancer" ? "a_relancer" : b.statut]) || ((a.priorite || 50) - (b.priorite || 50)));
  const cnt = (s) => D.prospects.filter((p) => p.statut === s).length;
  if (S.proMode === "tableau") return proBoard(cnt, q);
  return `<div class="head"><div><h1>Prospection</h1><p>${cnt("a_contacter")} à contacter · ${cnt("contacte")} contactés · ${cnt("interesse")} intéressés · ${cnt("client")} devenus clients. Les relances se programment toutes seules ${cfg().relance_prospect} jours après chaque mail.</p></div><div class="actions"><div class="seg mode"><button type="button" data-promode="liste" aria-pressed="${S.proMode !== "tableau"}">Liste</button><button type="button" data-promode="tableau" aria-pressed="${S.proMode === "tableau"}">Tableau</button></div><button class="btn primary" type="button" data-bulk>Envoi groupé</button><button class="btn" type="button" data-newprospect>+ Prospect</button></div></div>
  ${autoPanel()}
  <div class="filters"><select id="fPro"><option value="actifs"${f === "actifs" ? " selected" : ""}>En cours</option><option value="a_relancer"${f === "a_relancer" ? " selected" : ""}>À relancer</option><option value="a_contacter"${f === "a_contacter" ? " selected" : ""}>À contacter</option><option value="interesse"${f === "interesse" ? " selected" : ""}>Intéressés</option><option value="client"${f === "client" ? " selected" : ""}>Devenus clients</option><option value="pas_interesse"${f === "pas_interesse" ? " selected" : ""}>Pas intéressés</option><option value="tous"${f === "tous" ? " selected" : ""}>Tous</option></select><input id="qPro" type="search" placeholder="Rechercher" value="${esc(S.qPro || "")}"></div>
  <div class="tablewrap"><table><thead><tr><th>Commerce</th><th>Activité</th><th>Contact</th><th>Statut</th><th>Prochaine action</th></tr></thead><tbody>
  ${rows.length ? rows.map((p) => { const s = prState(p); return `<tr class="click" data-prospect="${p.id}"><td><b>${esc(p.entreprise)}</b><br><small>${esc(p.adresse || "")}</small></td><td>${esc(p.activite || "")}</td><td><small>${esc(p.email || "pas de mail")}<br>${esc(p.tel || "")}</small></td><td><span class="chip ${s[1]}">${s[0]}</span>${p.nb_contacts ? `<br><small>${p.nb_contacts} mail(s)</small>` : ""}</td><td class="num">${p.prochaine_action ? sDate(p.prochaine_action) : p.statut === "a_contacter" ? "Maintenant" : ""}</td></tr>`; }).join("") : `<tr><td colspan="5"><div class="empty"><h3>Aucun prospect</h3>Ajoute un commerce avec « + Prospect ».</div></td></tr>`}
  </tbody></table></div>`;
};
VIEWS.clients = function () {
  const q = (S.qCli || "").toLowerCase();
  const rows = D.clients.filter((c) => !q || ((c.entreprise || "") + " " + (c.nom || "") + " " + (c.email || "")).toLowerCase().includes(q)).sort((a, b) => (a.entreprise || a.nom || "").localeCompare(b.entreprise || b.nom || ""));
  return `<div class="head"><div><h1>Clients</h1><p>Chaque fiche regroupe ses demandes, devis, factures, projet et maintenance.</p></div><button class="btn primary" type="button" data-newclient>+ Client</button></div>
  <div class="filters"><input id="qCli" type="search" placeholder="Rechercher un client" value="${esc(S.qCli || "")}"></div>
  <div class="tablewrap"><table><thead><tr><th>Client</th><th>Contact</th><th>Origine</th><th class="r">Payé</th><th class="r">À encaisser</th><th></th></tr></thead><tbody>
  ${rows.length ? rows.map((c) => { const ps = D.pieces.filter((p) => p.client_id === c.id && p.type === "facture"); return `<tr class="click" data-goclient="${c.id}"><td><b>${esc(c.entreprise || c.nom)}</b>${c.entreprise && c.nom ? `<br><small>${esc(c.nom)}</small>` : ""}</td><td><small>${esc(c.email || "")}<br>${esc(c.tel || "")}</small></td><td><small>${esc(c.source || "")}</small></td><td class="r num">${eur(ps.filter((p) => p.statut === "payee").reduce((s, p) => s + total(p), 0))}</td><td class="r num">${eur(ps.filter((p) => p.statut === "envoye").reduce((s, p) => s + total(p), 0))}</td><td class="r"><button class="btn sm ghost danger" type="button" data-danger data-delclient="${c.id}">Supprimer</button></td></tr>`; }).join("") : `<tr><td colspan="6"><div class="empty"><h3>Aucun client</h3>Les clients se créent tout seuls depuis une demande du site ou un prospect intéressé.</div></td></tr>`}
  </tbody></table></div>`;
};
VIEWS.client = function () {
  const c = client(S.param); if (!c) return `<div class="empty"><h3>Client introuvable</h3><a href="#clients">Retour aux clients</a></div>`;
  const ps = D.pieces.filter((p) => p.client_id === c.id), pj = D.projets.filter((x) => x.client_id === c.id), ab = D.abonnements.filter((a) => a.client_id === c.id), jr = D.journal.filter((j) => j.client_id === c.id);
  const paid = ps.filter((p) => p.type === "facture" && p.statut === "payee").reduce((s, p) => s + total(p), 0);
  return `<div class="head"><div><a href="#clients" class="note">← Clients</a><h1>${esc(c.entreprise || c.nom)}</h1><p>${esc([c.nom && c.entreprise ? c.nom : "", c.email, c.tel].filter(Boolean).join(" · "))}</p></div>
  <div class="actions"><button class="btn primary" type="button" data-new="devis" data-cid="${c.id}">+ Devis</button><button class="btn" type="button" data-editclient="${c.id}">Modifier</button><button class="btn ghost danger" type="button" data-danger data-delclient="${c.id}">Supprimer</button>${c.email ? `<a class="btn ghost" href="mailto:${esc(c.email)}">Écrire</a>` : ""}</div></div>
  <div class="kpis"><div class="kpi"><span>Payé au total</span><b class="num">${eur0(paid)}</b></div><div class="kpi"><span>Documents</span><b class="num">${ps.length}</b></div><div class="kpi"><span>Projet</span><b>${pj.length ? (pj[0].statut === "termine" ? "Livré" : "En cours") : "—"}</b></div><div class="kpi"><span>Maintenance</span><b class="num">${ab.filter((a) => a.actif).length ? eur0(ab.filter((a) => a.actif).reduce((s, a) => s + +a.montant, 0)) + "/mois" : "—"}</b></div></div>
  <div class="grid2"><div style="display:grid;gap:16px;min-width:0">
    <div class="card"><h2>Devis &amp; factures</h2><ul class="list">${ps.length ? ps.map((p) => `<li class="item click" data-piece="${p.id}"><div><b>${kindLabel(p)} ${esc(p.numero)}</b><small>${sDate(p.date)} · ${eur(total(p))}</small></div>${chip(p)}</li>`).join("") : `<li class="note">Aucun document.</li>`}</ul></div>
    <div class="card"><h2>Projet</h2>${pj.length ? pj.map((x) => projetMini(x)).join("") : `<p class="note">Le projet se crée automatiquement quand un devis est accepté.</p>`}</div>
    <div class="card"><h2>Maintenance</h2>${ab.length ? `<ul class="list">${ab.map((a) => `<li class="item click" data-abo="${a.id}"><div><b>${esc(a.libelle)}</b><small>${eur(a.montant)} / mois · depuis ${sDate(a.debut)}</small></div><span class="chip ${a.actif ? "ok" : ""}">${a.actif ? "Active" : "Arrêtée"}</span></li>`).join("")}</ul>` : `<button class="btn" type="button" data-newabo="${c.id}">+ Ajouter la maintenance 30 €/mois</button>`}</div>
  </div><div style="display:grid;gap:16px;min-width:0">
    <div class="card"><h2>Coordonnées</h2><p style="margin:0;white-space:pre-line">${esc([c.entreprise, c.nom, c.adresse, c.siren ? "SIREN " + c.siren : "", c.email, c.tel].filter(Boolean).join("\n"))}</p>${c.notes ? `<p class="note" style="margin-top:10px;white-space:pre-line">${esc(c.notes)}</p>` : ""}</div>
    <div class="card"><h2>Historique</h2>${jr.length ? `<ul class="timeline">${jr.map((j) => `<li><time>${sDate(j.created_at)}</time><div>${esc(j.texte)}${j.auteur ? ` <small class="note">· ${esc(j.auteur)}</small>` : ""}</div></li>`).join("")}</ul>` : `<p class="note">Rien pour l'instant.</p>`}</div>
  </div></div>`;
};
function projetMini(pj) {
  const et = pj.etapes || [], done = et.filter((e) => e.done).length, next = et.find((e) => !e.done), late = pj.statut === "en_cours" && pj.date_prevue && pj.date_prevue < today();
  return `<div class="mini" data-projet="${pj.id}"><b>${esc(pj.titre)}</b><small>${next ? "Prochaine étape : " + esc(next.t) : "Toutes les étapes sont faites"}</small><div class="progress"><i style="width:${et.length ? Math.round((done / et.length) * 100) : 0}%"></i></div><small>${done}/${et.length} · ${pj.statut === "termine" ? "Livré le " + sDate(pj.date_livraison) : late ? "En retard (prévu " + sDate(pj.date_prevue) + ")" : "Prévu le " + sDate(pj.date_prevue)}</small></div>`;
}
VIEWS.projets = function () {
  const ps = D.projets.filter(mine), cols = [["À démarrer", (p) => p.statut === "en_cours" && !(p.etapes || []).some((e) => e.done)], ["En création", (p) => p.statut === "en_cours" && (p.etapes || []).some((e) => e.done) && !(p.etapes || []).some((e) => e.t === "Site mis en ligne" && e.done)], ["En ligne, à finaliser", (p) => p.statut === "en_cours" && (p.etapes || []).some((e) => e.t === "Site mis en ligne" && e.done)], ["Terminés", (p) => p.statut === "termine"]];
  return `<div class="head"><div><h1>Projets</h1><p>Un projet se crée tout seul quand un devis est accepté. Coche les étapes au fur et à mesure : la facture de solde se prépare dès que le site est en ligne.</p></div></div>
  ${ps.length ? `<div class="board">${cols.map(([t, fn]) => { const it = ps.filter(fn); return `<div class="col"><h3>${t}<span class="chip">${it.length}</span></h3>${it.map(projetMini).join("") || `<p class="note">Aucun</p>`}</div>`; }).join("")}</div>` : `<div class="card empty"><h3>Aucun projet pour l'instant</h3>Quand un client accepte un devis, son projet apparaît ici avec les étapes à suivre.</div>`}`;
};
VIEWS.pieces = function () {
  const ft = S.fType || "", fs = S.fStat || "", q = (S.qPie || "").toLowerCase();
  const rows = D.pieces.filter(mine).filter((p) => { if (ft && p.type !== ft) return false; if (fs && pState(p).k !== fs) return false; return !q || (cname(p.client_id) + " " + p.numero).toLowerCase().includes(q); }).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.numero || "").localeCompare(a.numero || ""));
  const opt = (v, l, cur) => `<option value="${v}"${cur === v ? " selected" : ""}>${l}</option>`;
  return `<div class="head"><div><h1>Devis &amp; factures</h1><p>Les factures d'acompte, de solde et de maintenance se préparent automatiquement. Il ne reste qu'à les envoyer.</p></div><button class="btn primary" type="button" data-new="devis">+ Devis</button></div>
  <div class="filters"><select id="fType">${opt("", "Tous les types", ft)}${opt("devis", "Devis", ft)}${opt("facture", "Factures", ft)}</select><select id="fStat">${opt("", "Tous les statuts", fs)}${opt("brouillon", "À envoyer", fs)}${opt("envoye", "Envoyé", fs)}${opt("accepte", "Accepté", fs)}${opt("retard", "En retard", fs)}${opt("payee", "Payée", fs)}${opt("refuse", "Refusé", fs)}</select><input id="qPie" type="search" placeholder="Client ou numéro" value="${esc(S.qPie || "")}"></div>
  <div class="tablewrap"><table><thead><tr><th>Numéro</th><th>Client</th><th>Date</th><th>Par</th><th>Statut</th><th class="r">Montant</th></tr></thead><tbody>
  ${rows.length ? rows.map((p) => `<tr class="click" data-piece="${p.id}"><td class="num"><b>${esc(p.numero)}</b><br><small>${kindLabel(p)}</small></td><td>${esc(cname(p.client_id))}</td><td class="num">${sDate(p.date)}</td><td>${first(p.emetteur)}</td><td>${chip(p)}</td><td class="r num"><b>${eur(total(p))}</b></td></tr>`).join("") : `<tr><td colspan="6"><div class="empty"><h3>Aucun document</h3>Crée un devis, ou traite une demande du site : le devis se remplit tout seul.</div></td></tr>`}
  </tbody></table></div>`;
};
VIEWS.abonnements = function () {
  const ab = D.abonnements.filter(mine), act = ab.filter((a) => a.actif);
  return `<div class="head"><div><h1>Maintenance</h1><p>Chaque 1er du mois, la facture de chaque abonnement actif est préparée automatiquement. ${act.length} abonnement(s) actif(s) · ${eur0(act.reduce((s, a) => s + +a.montant, 0))} par mois.</p></div><button class="btn primary" type="button" data-newabo="">+ Abonnement</button></div>
  <ul class="list">${ab.length ? ab.map((a) => `<li class="item click ${a.actif ? "ok" : ""}" data-abo="${a.id}"><div><b>${esc(cname(a.client_id))}</b><small>${esc(a.libelle)} · ${eur(a.montant)} / mois · ${first(a.emetteur)} · depuis ${sDate(a.debut)}${a.dernier_mois ? " · dernière facture : " + a.dernier_mois : ""}</small></div><span class="chip ${a.actif ? "ok" : ""}">${a.actif ? "Active" : "Arrêtée"}</span></li>`).join("") : `<li class="item"><div class="empty"><h3>Aucun abonnement</h3>Propose la maintenance à 30 €/mois à chaque site livré : c'est ton revenu récurrent.</div></li>`}</ul>`;
};
function nextDeadline() {
  const t = new Date(); let best = null;
  ["hugo", "lucas"].forEach((k) => {
    if (S.who !== "tous" && S.who !== k) return; const e = em(k); let d, label;
    if (e.periodicite === "mensuelle") { d = new Date(t.getFullYear(), t.getMonth() + 1, 0); const pm = new Date(t.getFullYear(), t.getMonth() - 1, 1); label = `${first(k)} : chiffre d'affaires de ${MOIS[pm.getMonth()]}`; }
    else { const q = Math.floor(t.getMonth() / 3); d = new Date(t.getFullYear(), q * 3 + 1, 0); label = `${first(k)} : chiffre d'affaires du trimestre ${q === 0 ? 4 : q}`; }
    if (!best || iso(d) < best.date) best = { date: iso(d), label };
  });
  return best;
}
const enc = (a, b, k) => D.pieces.filter((p) => p.type === "facture" && p.statut === "payee" && p.paye_le >= a && p.paye_le <= b && p.emetteur === k).reduce((s, p) => s + total(p), 0);
VIEWS.urssaf = function () {
  const now = new Date();
  const cards = ["hugo", "lucas"].filter((k) => S.who === "tous" || S.who === k).map((k) => {
    const e = em(k), r = rate(k), rows = [];
    for (let i = 0; i < 4; i++) {
      let a, b, lab, lim;
      if (e.periodicite === "mensuelle") { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); a = iso(d); b = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); lab = MOIS[d.getMonth()] + " " + d.getFullYear(); lim = iso(new Date(d.getFullYear(), d.getMonth() + 2, 0)); }
      else { const d = new Date(now.getFullYear(), now.getMonth() - 3 * i, 1), q = Math.floor(d.getMonth() / 3); a = iso(new Date(d.getFullYear(), q * 3, 1)); b = iso(new Date(d.getFullYear(), q * 3 + 3, 0)); lab = "T" + (q + 1) + " " + d.getFullYear(); lim = iso(new Date(d.getFullYear(), q * 3 + 4, 0)); }
      const ca = enc(a, b, k); rows.push([lab, ca, (ca * r) / 100, lim, i === 0]);
    }
    const yr = enc(now.getFullYear() + "-01-01", now.getFullYear() + "-12-31", k);
    return `<div class="card"><h2>${esc(e.nom)}</h2><p class="note" style="margin:-6px 0 12px">Déclaration ${e.periodicite} · taux ${String(r).replace(".", ",")} %${e.acre ? " (ACRE)" : ""} · ${eur0(yr)} encaissés en ${now.getFullYear()} (plafond 83 600 €)</p>
    <div class="tablewrap"><table style="min-width:420px"><thead><tr><th>Période</th><th class="r">CA encaissé</th><th class="r">Cotisations</th><th>Avant le</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${x[0]}${x[4] ? ' <span class="chip info">en cours</span>' : ""}</td><td class="r num"><b>${eur(x[1])}</b></td><td class="r num">≈ ${eur(Math.round(x[2]))}</td><td class="num">${sDate(x[3])}</td></tr>`).join("")}</tbody></table></div></div>`;
  }).join("");
  return `<div class="head"><div><h1>URSSAF</h1><p>Montants encaissés à déclarer sur autoentrepreneur.urssaf.fr, chacun pour sa micro-entreprise. À déclarer même à 0 €.</p></div><a class="btn" href="https://autoentrepreneur.urssaf.fr" target="_blank" rel="noopener">Ouvrir le site URSSAF</a></div><div class="grid2 even">${cards}</div><p class="note" style="margin-top:14px">Estimation : 25,6 % (BNC 2026) ou environ 19,2 % avec l'ACRE. Le montant exact est calculé par l'URSSAF.</p>`;
};
VIEWS.reglages = function () {
  const field = (k, f, l, h, t) => `<label class="f${t === "area" ? " full" : ""}">${l}${h ? ` <span class="h">${h}</span>` : ""}${t === "area" ? `<textarea data-k="${k}" data-f="${f}">${esc(em(k)[f])}</textarea>` : `<input data-k="${k}" data-f="${f}" value="${esc(em(k)[f])}">`}</label>`;
  return `<div class="head"><div><h1>Réglages</h1><p>Informations reprises sur les devis, factures et mails.</p></div></div>
  <div class="grid2 even">${["hugo", "lucas"].map((k) => `<div class="card"><h2>${esc(em(k).nom)} EI</h2><div class="fgrid">${field(k, "nom", "Nom")}${field(k, "siret", "SIRET / SIREN", "9 chiffres en attendant les 14 du SIRET")}${field(k, "email", "Email")}${field(k, "tel", "Téléphone", "facultatif")}${field(k, "adresse", "Adresse de l'entreprise", "", "area")}${field(k, "iban", "IBAN")}${field(k, "bic", "BIC")}
    <label class="f full">Lien de paiement par carte <span class="h">SumUp, Stripe ou PayPal, facultatif</span><input data-k="${k}" data-f="lien" value="${esc(em(k).lien)}" placeholder="https://"></label>
    <label class="f">Déclaration URSSAF<select data-k="${k}" data-f="periodicite"><option value="trimestrielle"${em(k).periodicite !== "mensuelle" ? " selected" : ""}>Trimestrielle</option><option value="mensuelle"${em(k).periodicite === "mensuelle" ? " selected" : ""}>Mensuelle</option></select></label>
    <label class="f">ACRE la 1re année<select data-k="${k}" data-f="acre"><option value="1"${em(k).acre ? " selected" : ""}>Oui (≈ 19,2 %)</option><option value="0"${!em(k).acre ? " selected" : ""}>Non (25,6 %)</option></select></label></div></div>`).join("")}</div>
  <div class="card" style="margin-top:16px"><h2>Règles automatiques</h2><div class="fgrid">
    <label class="f">Validité des devis (jours)<input id="sValid" type="number" min="1" value="${cfg().validite}"></label>
    <label class="f">Délai de paiement des factures (jours)<input id="sDelay" type="number" min="0" value="${cfg().delai}"></label>
    <label class="f">Acompte à la commande (%)<input id="sDeposit" type="number" min="0" max="100" value="${cfg().acompte}"></label>
    <label class="f">Relance des prospects après (jours)<input id="sRel" type="number" min="1" value="${cfg().relance_prospect}"></label></div></div>
  <div class="card" style="margin-top:16px"><h2>Envoi automatique aux prospects</h2><p class="note" style="margin-bottom:12px">Du lundi au vendredi entre 9 h et 11 h, l'appli envoie toute seule le 1er mail aux prospects « à contacter » qui ont une adresse (priorité sous 50), puis une seule relance s'ils n'ont pas répondu. Un prospect qui répond n'est plus relancé, et « STOP » l'arrête. Les mails partent de equipe@tissaweb.fr, signés Hugo.</p><div class="fgrid">
    <label class="f">Envoi auto<select id="sAuto"><option value="1"${cfg().auto_prospect === true ? " selected" : ""}>Activé</option><option value="0"${cfg().auto_prospect !== true ? " selected" : ""}>Coupé</option></select></label>
    <label class="f">Mails auto par jour (max)<input id="sAutoN" type="number" min="1" max="20" value="${cfg().auto_par_jour || 5}"></label>
    <label class="f">Relance auto après (jours)<input id="sAutoR" type="number" min="2" max="30" value="${cfg().auto_relance_jours || 7}"></label></div></div>
  <div class="actions" style="margin-top:16px"><button class="btn primary" type="button" id="saveCfg">Enregistrer les réglages</button></div>
  <div class="card" style="margin-top:16px"><h2>Notifications</h2><p class="note" style="margin-bottom:12px">Reçois une notification pour chaque nouvelle demande, chaque nouveau mail, et un résumé chaque matin à 8 h. À activer sur chaque appareil (iPhone : depuis l'icône de l'écran d'accueil).</p><button class="btn primary" type="button" data-pushon>Activer sur cet appareil</button></div>
  ${reglagesExtra()}
  <div class="card" style="margin-top:16px"><h2>Équipe</h2><ul class="list">${D.equipe.map((u) => `<li class="item"><div><b>${esc(u.nom)}</b><small>${esc(u.email)}</small></div></li>`).join("")}</ul></div>`;
};

/* ================= panneaux ================= */
function openSheet(title, renderFn) { S.sheetRender = () => { $("sheetTitle").textContent = typeof title === "function" ? title() : title; $("sheetBody").innerHTML = renderFn(); hydratePv($("sheetBody")); }; S.sheetRender(); $("sheet").hidden = false; document.body.style.overflow = "hidden"; $("sheet").querySelector("section").scrollTop = 0; }
function closeSheet() { $("sheet").hidden = true; S.sheetRender = null; S.mail = null; document.body.style.overflow = ""; }

function sheetDemande(id) {
  openSheet("Demande du site", () => {
    const d = byId("demandes", id); if (!d) return "<p>Introuvable.</p>";
    const m = mailDemande(d); S.mail = m; const dv = d.client_id ? D.pieces.find((p) => p.client_id === d.client_id && p.type === "devis") : null;
    return `<div class="row"><span class="chip ${DSTAT[d.statut] ? DSTAT[d.statut][1] : ""}">${DSTAT[d.statut] ? DSTAT[d.statut][0] : esc(d.statut)}</span><span class="note">Reçue ${ago(d.created_at)}${d.traite_par ? " · traitée par " + esc(d.traite_par) : ""}</span></div>
    <div class="card"><h2>${esc(d.nom)}</h2><div class="fgrid"><div><span class="eyebrow">Email</span><br><a href="mailto:${esc(d.email)}">${esc(d.email)}</a></div><div><span class="eyebrow">Téléphone</span><br>${d.telephone ? `<a href="tel:${esc(d.telephone.replace(/\s/g, ""))}">${esc(d.telephone)}</a>` : "—"}</div><div><span class="eyebrow">Activité</span><br>${esc(d.activite || "—")}</div><div><span class="eyebrow">Offre</span><br>${esc(d.offre || "—")}</div>${d.message ? `<div class="full"><span class="eyebrow">Message</span><p style="margin:4px 0 0;white-space:pre-line">${esc(d.message)}</p></div>` : ""}</div></div>
    <div class="actions">${d.statut !== "convertie" ? `<button class="btn primary" type="button" data-dem2devis="${d.id}">Créer le client et le devis</button>` : dv ? `<button class="btn primary" type="button" data-piece="${dv.id}">Voir le devis ${esc(dv.numero)}</button>` : ""}${d.statut === "nouvelle" ? `<button class="btn" type="button" data-demstat="repondu" data-id="${d.id}">Marquer comme répondu</button>` : ""}${d.statut !== "archivee" ? `<button class="btn ghost" type="button" data-demstat="archivee" data-id="${d.id}">Archiver</button>` : ""}<button class="btn ghost danger" type="button" data-demstat="spam" data-id="${d.id}">Spam</button><button class="btn ghost danger" type="button" data-danger data-deldem="${d.id}">Supprimer</button></div>
    ${mailBlock(m, { kind: "demande", id: d.id })}`;
  });
}
const PDF = ["pEnt", "pAct", "pTel", "pMail", "pAdr", "pAng", "pNotes"], PDK = (id) => "tw-pdraft-" + (id || "new");
function pDraft(id) { try { return JSON.parse(localStorage.getItem(PDK(id)) || "null"); } catch (e) { return null; } }
function pDraftDel(id) { try { localStorage.removeItem(PDK(id)); } catch (e) {} }
document.addEventListener("input", (e) => {
  if (!PDF.includes(e.target.id)) return;
  const sv = document.querySelector("[data-prsave]"), id = sv ? sv.dataset.prsave : "";
  const d = { entreprise: $("pEnt").value, activite: $("pAct").value, tel: $("pTel").value, email: $("pMail").value, adresse: $("pAdr").value, angle: $("pAng").value, notes: $("pNotes").value };
  try { localStorage.setItem(PDK(id), JSON.stringify(d)); } catch (err) {}
});
function sheetProspect(id) {
  if (S.pModeleFor !== id) { S.pModele = "auto"; S.pModeleFor = id; }
  const blank = { id: null, entreprise: "", activite: "", adresse: "", email: "", tel: "", angle: "", notes: "", statut: "a_contacter" };
  openSheet(() => (id ? "Prospect" : "Nouveau prospect"), () => {
    const base = id ? byId("prospects", id) : blank; if (!base) return "<p>Introuvable.</p>";
    const dr = pDraft(id), p = dr ? Object.assign({}, base, dr) : base;
    const m = id && p.email ? mailProspect(p, S.pModele || "auto") : null; S.mail = m; const s = prState(p);
    return `${id ? `<div class="row"><span class="chip ${s[1]}">${s[0]}</span><span class="note">${p.nb_contacts || 0} mail(s) envoyé(s)${p.dernier_contact ? " · dernier le " + sDate(p.dernier_contact) : ""}${p.prochaine_action ? " · relance prévue le " + sDate(p.prochaine_action) : ""}</span></div>
    <div class="actions">${p.email && !["client", "pas_interesse"].includes(p.statut) ? `<button class="btn primary" type="button" data-prsent="${p.id}">J'ai envoyé le mail</button>` : ""}${p.statut !== "client" ? `<button class="btn" type="button" data-prstat="interesse" data-id="${p.id}">Intéressé</button><button class="btn" type="button" data-pr2devis="${p.id}">Devenu client → devis</button><button class="btn ghost" type="button" data-prstat="pas_interesse" data-id="${p.id}">Pas intéressé</button>` : p.client_id ? `<a class="btn" href="#client/${p.client_id}">Voir la fiche client</a>` : ""}${p.tel ? `<a class="btn ghost" href="tel:${esc(p.tel.replace(/\s/g, ""))}">Appeler</a>` : ""}</div>` : ""}
    ${p.statut !== "client" && id && !p.email ? `<p class="alert warn">Pas d'adresse mail : passe en boutique ou appelle, puis note le résultat ici.</p>` : ""}
    ${id ? pvBlock(p) + prospectQuick(p) + prospectShort(p) : ""}
    ${dr ? `<p class="alert warn">Ce que tu avais écrit a été récupéré (pas encore enregistré). <button class="btn sm ghost" type="button" data-pdraftclear="${id || ""}">Effacer</button></p>` : ""}
    <div class="card"><div class="fgrid">
      <label class="f full">Commerce<input id="pEnt" value="${esc(p.entreprise)}"></label>
      <label class="f">Activité<input id="pAct" value="${esc(p.activite)}"></label>
      <label class="f">Téléphone<input id="pTel" value="${esc(p.tel)}"></label>
      <label class="f">Email<input id="pMail" type="email" value="${esc(p.email)}"></label>
      <label class="f">Adresse<input id="pAdr" value="${esc(p.adresse)}"></label>
      <label class="f full">Argument pour le mail <span class="h">ce qui manque à ce commerce</span><textarea id="pAng">${esc(p.angle)}</textarea></label>
      <label class="f full">Notes<textarea id="pNotes">${esc(p.notes)}</textarea></label></div>
      <div class="actions" style="margin-top:12px"><button class="btn ${id ? "" : "primary"}" type="button" data-prsave="${id || ""}">Enregistrer</button>${id ? `<button class="btn ghost danger" type="button" data-prdel="${id}">Supprimer</button>` : ""}</div></div>
    ${id ? prospectHistory(p) : ""}
    ${m ? `<label class="f">Modèle de mail<select id="pModele">${PMODELES.map(([k, l]) => `<option value="${k}"${(S.pModele || "auto") === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>` + mailBlock(m, { kind: "prospect", id: p.id }) : ""}`;
  });
}
function sheetClient(id, after) {
  openSheet(id ? "Modifier le client" : "Nouveau client", () => {
    const c = id ? client(id) : {};
    return `<div class="fgrid"><label class="f full">Entreprise<input id="cEnt" value="${esc(c.entreprise)}"></label><label class="f">Nom du contact<input id="cNom" value="${esc(c.nom)}"></label><label class="f">Email<input id="cMail" type="email" value="${esc(c.email)}"></label><label class="f">Téléphone<input id="cTel" value="${esc(c.tel)}"></label><label class="f">SIREN <span class="h">pour les clients pros</span><input id="cSiren" value="${esc(c.siren)}"></label><label class="f full">Adresse<textarea id="cAdr">${esc(c.adresse)}</textarea></label><label class="f full">Notes<textarea id="cNotes">${esc(c.notes)}</textarea></label></div>
    <div class="actions"><button class="btn primary" type="button" id="cSave">Enregistrer</button>${id ? `<button class="btn ghost danger" type="button" id="cDel">Supprimer</button>` : ""}</div><p class="alert bad" id="cDelAsk" hidden>Supprimer ce client ? Ses documents restent. <button class="btn sm danger" type="button" id="cDelYes">Oui, supprimer</button></p>`;
  });
  $("cSave").onclick = async () => {
    const d = { entreprise: $("cEnt").value.trim(), nom: $("cNom").value.trim(), email: $("cMail").value.trim(), tel: $("cTel").value.trim(), siren: $("cSiren").value.trim(), adresse: $("cAdr").value.trim(), notes: $("cNotes").value.trim() };
    if (!d.entreprise && !d.nom) return toast("Indique l'entreprise ou le nom");
    const c = id ? await upd("clients", id, d) : await ins("clients", Object.assign(d, { source: "Ajout manuel" }));
    toast("Client enregistré"); if (after) after(c); else { closeSheet(); location.hash = "#client/" + c.id; rerender(); }
  };
  if (id) { $("cDel").onclick = () => ($("cDelAsk").hidden = false); $("cDelYes").onclick = async () => { await del("clients", id); closeSheet(); location.hash = "#clients"; }; }
}
function sheetAbo(id, cid) {
  openSheet(id ? "Abonnement de maintenance" : "Nouvel abonnement", () => {
    const a = id ? byId("abonnements", id) : { client_id: cid || "", emetteur: S.me ? S.me.emetteur : "hugo", libelle: "Maintenance mensuelle", montant: 30, debut: today(), actif: true };
    return `<div class="fgrid"><label class="f full">Client<select id="aCli">${clientOptions(a.client_id)}</select></label><label class="f">Facturé par<select id="aEm"><option value="hugo"${a.emetteur === "hugo" ? " selected" : ""}>Hugo</option><option value="lucas"${a.emetteur === "lucas" ? " selected" : ""}>Lucas</option></select></label><label class="f">Montant mensuel (€)<input id="aMt" type="number" step="0.01" value="${a.montant}"></label><label class="f full">Libellé sur la facture<input id="aLib" value="${esc(a.libelle)}"></label><label class="f">Début<input id="aDeb" type="date" value="${a.debut}"></label><label class="f">État<select id="aAct"><option value="1"${a.actif ? " selected" : ""}>Active</option><option value="0"${!a.actif ? " selected" : ""}>Arrêtée</option></select></label></div>
    <p class="note">La facture du mois est préparée automatiquement à l'ouverture de l'appli, à partir du mois de début.</p>
    <div class="actions"><button class="btn primary" type="button" id="aSave">Enregistrer</button>${id ? `<button class="btn ghost danger" type="button" id="aDel">Supprimer</button>` : ""}</div>`;
  });
  $("aSave").onclick = async () => {
    const d = { client_id: $("aCli").value || null, emetteur: $("aEm").value, montant: +$("aMt").value || 0, libelle: $("aLib").value.trim() || "Maintenance mensuelle", debut: $("aDeb").value || today(), actif: $("aAct").value === "1" };
    if (!d.client_id) return toast("Choisis un client");
    if (id) await upd("abonnements", id, d); else { await ins("abonnements", d); await log("abonnement", `Maintenance ${eur(d.montant)}/mois ajoutée`, { client_id: d.client_id }); }
    await abonnementsDuMois(); closeSheet(); toast("Abonnement enregistré"); rerender();
  };
  if (id) $("aDel").onclick = async () => { await del("abonnements", id); closeSheet(); rerender(); };
}
function sheetProjet(id) {
  S.curProjet = id;
  openSheet(() => (byId("projets", id) || {}).titre || "Projet", () => {
    const pj = byId("projets", id); if (!pj) return "<p>Introuvable.</p>";
    const d = pj.devis_id ? byId("pieces", pj.devis_id) : null, fs = D.pieces.filter((f) => f.type === "facture" && ((pj.devis_id && f.devis_id === pj.devis_id) || f.projet_id === pj.id));
    return `${projetMini(pj)}<div class="steps">${(pj.etapes || []).map((e, i) => `<label class="${e.done ? "done" : ""}"><input type="checkbox" data-step="${i}" ${e.done ? "checked" : ""}><span>${esc(e.t)}</span><small>${e.date ? sDate(e.date) : ""}</small></label>`).join("")}</div>
    <div class="card"><div class="fgrid"><label class="f">Livraison prévue<input id="jPrev" type="date" value="${pj.date_prevue || ""}"></label><label class="f">Adresse du site <span class="h">une fois en ligne</span><input id="jUrl" value="${esc(pj.url_site)}" placeholder="https://"></label><label class="f full">Notes <span class="h">accès, couleurs, demandes du client…</span><textarea id="jNotes">${esc(pj.notes)}</textarea></label></div><div class="actions" style="margin-top:12px"><button class="btn" type="button" id="jSave">Enregistrer</button><a class="btn ghost" href="#client/${pj.client_id}">Fiche client</a>${pj.statut === "termine" && !D.abonnements.some((a) => a.client_id === pj.client_id) ? `<button class="btn primary" type="button" data-newabo="${pj.client_id}">Proposer la maintenance</button>` : ""}<button class="btn ghost danger" type="button" data-danger data-delprojet="${pj.id}">Supprimer le projet</button></div></div>
    <div class="card"><h2>Documents</h2><ul class="list">${[d].concat(fs).filter(Boolean).map((p) => `<li class="item click" data-piece="${p.id}"><div><b>${kindLabel(p)} ${esc(p.numero)}</b><small>${eur(total(p))}</small></div>${chip(p)}</li>`).join("") || "<li class='note'>Aucun</li>"}</ul></div>`;
  });
}
function clientOptions(sel) {
  return `<option value="">Choisir un client…</option>` + D.clients.slice().sort((a, b) => (a.entreprise || a.nom || "").localeCompare(b.entreprise || b.nom || "")).map((c) => `<option value="${c.id}"${c.id === sel ? " selected" : ""}>${esc((c.entreprise || c.nom) + (c.entreprise && c.nom ? " · " + c.nom : ""))}</option>`).join("") + `<option value="__new">+ Nouveau client…</option>`;
}
function lineHTML(l) { return `<div class="line"><textarea class="ld" rows="2" aria-label="Désignation" placeholder="Désignation">${esc(l.desc || "")}</textarea><input class="lq num" type="number" step="1" inputmode="decimal" aria-label="Quantité" value="${l.qte == null ? 1 : l.qte}"><input class="lp num" type="number" step="0.01" inputmode="decimal" aria-label="Prix unitaire" value="${l.pu == null ? "" : l.pu}" placeholder="Prix €"><button type="button" class="btn sm ghost" data-rmline aria-label="Supprimer la ligne">✕</button></div>`; }
function edLines() { return Array.from(document.querySelectorAll("#eLines .line")).map((r) => ({ desc: r.querySelector(".ld").value.trim(), qte: parseFloat(r.querySelector(".lq").value) || 0, pu: parseFloat(r.querySelector(".lp").value) || 0 })).filter((l) => l.desc || l.pu); }
function edTotal() { $("eTotal").textContent = eur(edLines().reduce((a, l) => a + l.qte * l.pu, 0)); }
function sheetEditor(id, cid) {
  const p = id ? byId("pieces", id) : null;
  openSheet(p ? "Modifier " + p.numero : "Nouveau devis", () => `${p && p.demande ? `<p class="alert info">Demande du client : ${esc(p.demande)}</p>` : ""}
    <div class="fgrid"><label class="f">Émis par<select id="eEm" ${p ? "disabled" : ""}><option value="hugo">Hugo Thirion</option><option value="lucas">Lucas Paris</option></select></label><label class="f">Date<input id="eDate" type="date" value="${p ? p.date : today()}"></label><label class="f full">Client<select id="eCli">${clientOptions(p ? p.client_id : cid)}</select></label></div>
    <div><span class="eyebrow">Prestations</span><div class="quick" style="margin-top:8px">${QUICK.map((q, i) => `<button type="button" class="btn sm" data-q="${i}">+ ${esc(q.l)}</button>`).join("")}</div><div class="lines" id="eLines" style="margin-top:10px">${(p ? p.lignes : []).map(lineHTML).join("")}</div><button class="btn sm" type="button" id="addLine" style="margin-top:8px">+ Ligne libre</button></div>
    <div class="totalbar"><span>Total</span><span class="num" id="eTotal">0,00 €</span></div>
    <label class="f">Note sur le document <span class="h">facultatif</span><textarea id="eNote">${esc(p ? p.note : "")}</textarea></label>
    <div class="actions"><button class="btn primary" type="button" id="eSave">Enregistrer</button></div>`);
  $("eEm").value = p ? p.emetteur : (S.me ? S.me.emetteur : "hugo"); edTotal();
  $("eLines").addEventListener("input", edTotal);
  $("addLine").onclick = () => { $("eLines").insertAdjacentHTML("beforeend", lineHTML({ qte: 1 })); };
  $("eCli").onchange = function () { if (this.value === "__new") { this.value = ""; const keep = { lignes: edLines(), note: $("eNote").value }; sheetClient(null, (c) => { sheetEditor(id, c.id); $("eLines").innerHTML = keep.lignes.map(lineHTML).join(""); $("eNote").value = keep.note; edTotal(); }); } };
  $("eSave").onclick = async () => {
    const lignes = edLines(), cli = $("eCli").value; if (!cli) return toast("Choisis un client"); if (!lignes.length) return toast("Ajoute au moins une prestation");
    let r;
    if (p) { const patch = { date: $("eDate").value || today(), client_id: cli, lignes, note: $("eNote").value.trim() }; if (p.type === "facture") patch.echeance = addDays(patch.date, p.kind === "acompte" ? 0 : cfg().delai); r = await upd("pieces", p.id, patch); }
    else { r = await insPiece({ type: "devis", emetteur: $("eEm").value, client_id: cli, date: $("eDate").value || today(), lignes, note: $("eNote").value.trim(), statut: "brouillon" }); await log("devis", `Devis ${r.numero} créé (${eur(total(r))})`, { client_id: cli }); }
    toast("Enregistré"); sheetPiece(r.id); render();
  };
}
function paperHTML(p) {
  const e = em(p.emetteur), c = client(p.client_id) || {}, isF = p.type === "facture";
  return `<div class="paper"><div class="ph"><div><div class="pt">Tissa<em>Web</em></div><div style="margin-top:8px"><b>${esc(e.nom)} EI</b><br>${esc(e.adresse || "Adresse à compléter").replace(/\n/g, "<br>")}<br>${e.siret ? idLab(e.siret) + " : " + esc(idVal(e.siret)) : "SIRET : en cours d'attribution"}<br>${esc(e.email)}</div></div><div class="meta"><span class="lbl">${kindLabel(p)}</span><b class="num">${esc(p.numero)}</b>Date : ${frDate(p.date)}${isF ? "<br>Échéance : " + (p.echeance > p.date ? frDate(p.echeance) : "à réception") : ""}${p.devis_ref ? "<br>Réf. devis : " + esc(p.devis_ref) : ""}</div></div>
  <div style="margin-bottom:16px"><div class="lbl">Client</div><b>${esc(c.entreprise || c.nom || "")}</b>${c.entreprise && c.nom ? "<br>" + esc(c.nom) : ""}${c.adresse ? "<br>" + esc(c.adresse).replace(/\n/g, "<br>") : ""}${c.siren ? "<br>SIREN : " + esc(c.siren) : ""}</div>
  <div style="overflow-x:auto"><table><thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">Prix unit.</th><th class="r">Total</th></tr></thead><tbody>${(p.lignes || []).map((l) => `<tr><td>${esc(l.desc)}</td><td class="r num">${String(l.qte).replace(".", ",")}</td><td class="r num">${eur(l.pu)}</td><td class="r num">${eur(l.qte * l.pu)}</td></tr>`).join("")}</tbody></table></div>
  <div class="ptotal"><div class="num">Total à payer : ${eur(total(p))}</div></div><div class="legal">${legalLines(p).map((x) => `<div>${esc(x)}</div>`).join("")}</div></div>`;
}
function legalLines(p) {
  const e = em(p.emetteur), L = ["TVA non applicable, art. 293 B du CGI."];
  if (p.type === "facture") {
    L.push(`Catégorie de l'opération : prestation de services. Paiement ${p.echeance > p.date ? "avant le " + frDate(p.echeance) : "à réception"}. Pas d'escompte pour paiement anticipé.`);
    L.push("En cas de retard de paiement : pénalités au taux de 3 fois le taux d'intérêt légal et, pour les professionnels, indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).");
    if (e.iban) L.push(`Règlement par virement : IBAN ${e.iban}${e.bic ? " · BIC " + e.bic : ""} · Référence : ${p.numero}`);
    if (e.lien) L.push("Paiement par carte : " + e.lien);
  } else L.push(`Devis valable ${cfg().validite} jours, jusqu'au ${frDate(addDays(p.date, cfg().validite))}. Acompte de ${cfg().acompte} % à la commande, solde à la livraison.`);
  return L;
}
function sheetPiece(id) {
  openSheet(() => { const p = byId("pieces", id); return p ? kindLabel(p) + " " + p.numero : "Document"; }, () => {
    const p = byId("pieces", id); if (!p) return "<p>Introuvable.</p>";
    const st = pState(p).k, isF = p.type === "facture", e = em(p.emetteur), a = [];
    a.push(`<button class="btn primary" type="button" data-pdf="${p.id}">Télécharger le PDF</button>`);
    if (st === "brouillon") a.push(`<button class="btn" type="button" data-edit="${p.id}">Modifier</button>`, `<button class="btn" type="button" data-sent="${p.id}">Marquer comme envoyé${isF ? "e" : ""}</button>`);
    if (p.type === "devis" && (st === "envoye" || st === "expire")) a.push(`<button class="btn dark" type="button" data-accept="${p.id}">Accepté par le client</button>`, `<button class="btn ghost" type="button" data-refuse="${p.id}">Refusé</button>`);
    if (p.type === "devis" && st === "accepte" && !D.pieces.some((f) => f.devis_id === p.id)) a.push(`<button class="btn" type="button" data-inv="acompte" data-id="${p.id}">Facture d'acompte</button>`);
    if (isF && (st === "envoye" || st === "retard")) a.push(`<button class="btn dark" type="button" data-payask="${p.id}">Marquer comme payée</button>`);
    if (st === "brouillon" || (p.type === "devis" && !D.pieces.some((f) => f.devis_id === p.id))) a.push(`<button class="btn ghost danger" type="button" data-pdel="${p.id}">Supprimer</button>`);
    const kind = st === "retard" ? "relance" : st === "payee" ? "merci" : "envoi"; const m = mailPiece(p, kind); S.mail = m;
    const linked = D.pieces.filter((f) => f.id !== p.id && ((p.devis_id && (f.id === p.devis_id || f.devis_id === p.devis_id)) || f.devis_id === p.id));
    const pj = D.projets.find((x) => x.devis_id === (p.devis_id || p.id));
    let warn = "";
    if (isF && !e.siret) warn += `<p class="alert warn">Le SIRET de ${esc(e.nom)} est vide : obligatoire sur une facture. Complète-le dans Réglages avant d'envoyer.</p>`;
    if (isF && !e.iban && !e.lien) warn += `<p class="alert warn">Ajoute ton IBAN ou un lien de paiement dans Réglages pour que le client sache comment payer.</p>`;
    if (st !== "brouillon" && st !== "accepte") warn += `<p class="alert info">${isF ? "Facture émise : elle n'est plus modifiable. En cas d'erreur, fais un avoir puis une nouvelle facture." : "Devis envoyé : il n'est plus modifiable."}</p>`;
    return `<div class="row">${chip(p)}<span class="note">${first(p.emetteur)} · <a href="#client/${p.client_id}">${esc(cname(p.client_id))}</a>${p.paye_le ? " · payée le " + sDate(p.paye_le) + (p.moyen ? " (" + esc(p.moyen) + ")" : "") : ""}</span></div>${warn}
    <div class="actions">${a.join("")}</div><p class="alert bad" id="pDelAsk" hidden>Supprimer définitivement ce document ? <button class="btn sm danger" type="button" data-pdelyes="${p.id}">Oui, supprimer</button></p>
    <div class="card" id="payBox" hidden><h2>Paiement reçu</h2><div class="fgrid"><label class="f">Date<input type="date" id="payDate" value="${today()}"></label><label class="f">Moyen<select id="payHow"><option>Virement</option><option>Carte</option><option>Espèces</option><option>Chèque</option></select></label></div><div class="actions" style="margin-top:12px"><button class="btn primary" type="button" data-payok="${p.id}">Confirmer le paiement</button></div></div>
    ${linked.length || pj ? `<div><span class="eyebrow">Lié</span><div class="actions" style="margin-top:6px">${linked.map((f) => `<button type="button" class="btn sm" data-piece="${f.id}">${kindLabel(f)} ${esc(f.numero)} ${chip(f)}</button>`).join("")}${pj ? `<button type="button" class="btn sm" data-projet="${pj.id}">Projet</button>` : ""}</div></div>` : ""}
    ${paperHTML(p)}${mailBlock(m, { kind: "piece", id: p.id })}`;
  });
}

/* ================= PDF ================= */
function clientRef(id) {
  const list = D.clients.slice().sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  const i = list.findIndex((c) => c.id === id); return "C-" + String(i >= 0 ? i + 1 : 0).padStart(5, "0");
}
const CGV = [
  ["I. GÉNÉRALITÉS", "Les présentes conditions générales de vente (ci-après les « CGV ») régissent de manière exclusive les relations commerciales entre l'entrepreneur individuel émetteur du devis, exerçant sous le nom commercial TissaWeb (ci-après le « Prestataire »), et ses clients professionnels ou particuliers (ci-après le « Client »), pour toute prestation de conception, de réalisation, de mise en ligne, de référencement et de maintenance de sites internet (ci-après les « Prestations »). Toute commande implique l'adhésion entière et sans réserve du Client aux CGV, qui prévalent sur tout autre document, sauf conditions particulières expressément acceptées par écrit par le Prestataire. Les CGV applicables sont celles en vigueur à la date de la commande."],
  ["II. COMMANDES", "La commande est formée à la réception par le Prestataire du devis signé et revêtu de la mention « Bon pour accord », ou de son acceptation écrite par courrier électronique, et du paiement de l'acompte prévu. Le devis est valable pendant la durée indiquée ; au-delà, le Prestataire n'est plus tenu par les prix et délais proposés. Toute demande de modification ou d'extension de la commande après acceptation fait l'objet d'un devis complémentaire ou d'un avenant."],
  ["III. PRIX", "Les prix sont fixes, forfaitaires et exprimés en euros. TVA non applicable, article 293 B du Code général des impôts. Ils sont établis sur la base des informations fournies par le Client et du périmètre décrit au devis. Le nom de domaine, les licences, extensions, photographies ou services tiers ne sont pas compris, sauf mention expresse au devis."],
  ["IV. CONDITIONS DE RÈGLEMENT", "Sauf stipulation contraire du devis, un acompte de cinquante pour cent (50 %) du montant total est exigible à la commande et le solde est exigible à la livraison, avant la mise en ligne définitive du site. Les factures sont payables à réception ou à l'échéance indiquée, par virement bancaire ou par carte bancaire via le lien de paiement fourni. Aucun escompte n'est accordé en cas de paiement anticipé. Le paiement ne peut en aucun cas être suspendu ni faire l'objet d'une compensation."],
  ["V. RETARDS ET DÉFAUT DE PAIEMENT", "En cas de retard ou de défaut de paiement total ou partiel à l'échéance, toutes les sommes dues deviennent immédiatement exigibles. Le Prestataire peut suspendre l'exécution des Prestations en cours ainsi que la mise en ligne ou la maintenance du site jusqu'au complet paiement. Conformément à l'article L441-10 du Code de commerce, sont dues de plein droit, sans rappel préalable : des pénalités de retard calculées au taux égal à trois fois le taux d'intérêt légal, à compter du lendemain de la date d'échéance ; et, pour les clients professionnels, une indemnité forfaitaire pour frais de recouvrement de quarante euros (40 €) par facture impayée, susceptible d'être augmentée sur justificatif."],
  ["VI. CONTESTATION DE LA FACTURE", "Toute contestation relative à une facture doit être adressée par écrit au Prestataire dans un délai de quinze (15) jours à compter de sa réception. À défaut, la facture est réputée acceptée. La contestation d'une partie de la facture ne dispense pas le Client de régler la partie non contestée."],
  ["VII. DÉLAIS DE RÉALISATION", "Les délais indiqués au devis sont exprimés en jours ouvrés et donnés de bonne foi. Ils ne courent qu'à compter de la réception de l'acompte et de l'ensemble des éléments demandés au Client (textes, logo, photographies, horaires, accès techniques). Tout retard du Client dans la fourniture de ces éléments ou dans ses validations décale d'autant la date de livraison. Le dépassement d'un délai ne peut donner lieu à aucune pénalité ni à l'annulation de la commande."],
  ["VIII. OBLIGATIONS DU CLIENT – CONTENUS", "Le Client s'engage à collaborer activement à la réalisation du site et à fournir des contenus exacts, licites et dont il détient les droits d'utilisation (textes, images, marques, logos). Il garantit le Prestataire contre toute réclamation d'un tiers à ce titre. Le Client demeure seul responsable des informations publiées sur son site, notamment de ses mentions légales, de ses prix et de sa politique de confidentialité."],
  ["IX. VALIDATION – RECETTE – LIVRAISON", "Une maquette est soumise au Client pour validation. Deux (2) séries de modifications sont comprises dans le prix. À la livraison, le Client dispose d'un délai de sept (7) jours pour signaler par écrit toute anomalie ou non-conformité au devis. À défaut de réserve dans ce délai, ou dès la mise en ligne à la demande du Client, la Prestation est réputée acceptée sans réserve. Les corrections d'anomalies relevant du devis sont réalisées sans frais."],
  ["X. MODIFICATIONS ET PRESTATIONS SUPPLÉMENTAIRES", "Toute demande excédant le périmètre du devis (pages, fonctionnalités, séries de modifications supplémentaires, refonte de la maquette validée) fait l'objet d'un devis complémentaire. Le Prestataire peut refuser une modification incompatible avec les délais ou le budget convenus."],
  ["XI. CLAUSE DE RÉSERVE DE PROPRIÉTÉ", "Le transfert de propriété du site et des droits d'utilisation qui y sont attachés est subordonné au paiement intégral du prix. Jusqu'à ce paiement, le Prestataire conserve la propriété de ses créations et peut suspendre l'accès au site mis en ligne."],
  ["XII. PROPRIÉTÉ INTELLECTUELLE", "Après paiement intégral, le Client devient propriétaire du site réalisé spécifiquement pour lui et des éléments graphiques créés à cette fin, pour une utilisation dans le monde entier et pour la durée légale de protection. Les outils, méthodes, bibliothèques de code et éléments génériques utilisés par le Prestataire restent sa propriété ou celle de leurs auteurs, le Client bénéficiant d'un droit d'utilisation pour son site."],
  ["XIII. NOM DE DOMAINE ET HÉBERGEMENT", "Le nom de domaine est enregistré au nom du Client, qui en reste propriétaire et en supporte le coût de renouvellement annuel. Lorsque le Prestataire se charge des démarches, il agit en qualité de mandataire du Client. L'hébergement est assuré par un prestataire tiers ; le Prestataire ne saurait être tenu responsable de ses interruptions ou défaillances."],
  ["XIV. MAINTENANCE", "La maintenance est une option souscrite sans engagement de durée et facturée mensuellement à terme à échoir. Elle comprend l'hébergement, les mises à jour de sécurité, les sauvegardes et les petites modifications de contenu (horaires, textes, photos, offres), dans une limite raisonnable. Elle peut être résiliée par chacune des parties par écrit, avec effet à la fin du mois en cours. À la résiliation, le Prestataire remet au Client, à sa demande, les fichiers de son site."],
  ["XV. GARANTIES – RESPONSABILITÉ", "Le Prestataire est tenu d'une obligation de moyens. Il garantit la conformité du site au devis lors de sa livraison. Sa responsabilité ne peut être engagée en cas de mauvaise utilisation du site, de modification réalisée par le Client ou un tiers, de défaillance de l'hébergeur, du registre de noms de domaine ou des réseaux, ni au titre des résultats commerciaux ou de positionnement dans les moteurs de recherche, qui ne peuvent être garantis. En tout état de cause, la responsabilité du Prestataire est limitée au montant effectivement payé par le Client au titre de la commande concernée."],
  ["XVI. FORCE MAJEURE", "Aucune des parties ne pourra être tenue responsable d'un manquement à ses obligations résultant d'un cas de force majeure au sens de l'article 1218 du Code civil. Les obligations sont suspendues pendant la durée de l'événement. Si celui-ci se prolonge au-delà de trente (30) jours, chaque partie peut résilier la commande par écrit, les Prestations déjà réalisées restant dues."],
  ["XVII. RÉSOLUTION – RÉSILIATION", "En cas de manquement grave de l'une des parties à ses obligations, non réparé dans un délai de quinze (15) jours après mise en demeure écrite, l'autre partie peut résoudre la commande de plein droit. En cas d'annulation de la commande par le Client après son acceptation, l'acompte reste acquis au Prestataire et les travaux réalisés au-delà de l'acompte sont facturés au prorata."],
  ["XVIII. DONNÉES PERSONNELLES", "Les données personnelles du Client sont traitées par le Prestataire pour la gestion de la relation commerciale, la facturation et le respect de ses obligations légales, et conservées pour la durée nécessaire à ces finalités (dix ans pour les pièces comptables). Conformément au RGPD, le Client dispose d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition, qu'il peut exercer à l'adresse contact@tissaweb.fr, ainsi que du droit d'introduire une réclamation auprès de la CNIL. Lorsque le site du Client collecte des données de ses visiteurs, le Client en est le responsable de traitement."],
  ["XIX. CONFIDENTIALITÉ", "Chaque partie s'engage à garder confidentielles les informations non publiques communiquées par l'autre partie, notamment les accès techniques, et à ne les utiliser que pour l'exécution des Prestations."],
  ["XX. RÉFÉRENCES COMMERCIALES", "Sauf refus écrit du Client, le Prestataire peut mentionner le nom du Client et présenter le site réalisé à titre de référence sur ses supports de communication, et apposer une mention discrète « Site réalisé par TissaWeb » en pied de page du site."],
  ["XXI. DROIT DE RÉTRACTATION ET MÉDIATION", "Le Client consommateur dispose d'un délai de quatorze (14) jours à compter de la signature du devis pour se rétracter d'un contrat conclu à distance ou hors établissement, sans motif ni frais (art. L.221-18 C. conso). Ce droit bénéficie également au Client professionnel employant cinq salariés au plus, lorsque le contrat est conclu hors établissement et que son objet n'entre pas dans le champ de son activité principale (art. L.221-3). La rétractation s'exerce par toute déclaration claire adressée à contact@tissaweb.fr ou par courrier, notamment au moyen du formulaire joint au devis. Les sommes versées sont remboursées dans les quatorze (14) jours, par le même moyen de paiement (art. L.221-24). Si le Client a expressément demandé, en cochant la case prévue au devis, que la Prestation commence avant la fin du délai, il reste redevable d'un montant proportionnel au service fourni jusqu'à sa rétractation (art. L.221-25). S'il a en outre reconnu expressément perdre son droit de rétractation, ce droit ne peut plus être exercé une fois la Prestation pleinement exécutée, c'est-à-dire le site livré et mis en ligne (art. L.221-28, 1°). En cas de litige, le Client consommateur peut recourir gratuitement au médiateur de la consommation indiqué sur tissaweb.fr/mentions-legales.html (art. L.612-1). Détails : tissaweb.fr/retractation.html."],
  ["XXII. DROIT APPLICABLE ET ATTRIBUTION DE JURIDICTION", "Les présentes CGV et les relations entre les parties sont soumises au droit français. En cas de différend, les parties rechercheront une solution amiable avant toute action judiciaire. À défaut, et lorsque le Client est un professionnel, compétence exclusive est attribuée aux tribunaux du ressort de Dijon, nonobstant pluralité de défendeurs ou appel en garantie. Le Client consommateur peut saisir, à son choix, la juridiction du lieu où il demeurait au moment de la conclusion du contrat."],
];
function pdfFor(p) {
  const J = window.jspdf && window.jspdf.jsPDF; if (!J) return null;
  const doc = new J({ unit: "mm", format: "a4" }), e = em(p.emetteur), c = client(p.client_id) || {}, isF = p.type === "facture";
  const W = 210, H = 297, M = 16, R = W - M;
  const T = (s) => String(s == null ? "" : s).replace(/[\u2212\u2013\u2014]/g, "-").replace(/[\u202f\u00a0]/g, " ").replace(/≈/g, "~").replace(/[\u{1F300}-\u{1FAFF}]/gu, "");
  const INK = [12, 19, 16], MUT = [101, 112, 106], LINE = [214, 220, 227], SOFT = [241, 244, 242], ACC = [11, 122, 85];
  const col = (c) => doc.setTextColor(c[0], c[1], c[2]), fill = (c) => doc.setFillColor(c[0], c[1], c[2]), draw = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (st, sz) => { doc.setFont("helvetica", st); doc.setFontSize(sz); };
  const title = p.type === "devis" ? "DEVIS" : ({ acompte: "FACTURE D'ACOMPTE", solde: "FACTURE DE SOLDE", abonnement: "FACTURE" })[p.kind] || "FACTURE";
  const ded = (p.lignes || []).filter((l) => l.pu < 0 && /^Acompte déjà facturé/.test(l.desc));
  const lines = (p.lignes || []).filter((l) => !ded.includes(l));
  const gross = lines.reduce((a, l) => a + l.qte * l.pu, 0), net = total(p);

  function footer(page, pages) {
    draw(LINE); doc.setLineWidth(0.3); doc.line(M, H - 22, R, H - 22);
    font("normal", 7); col(MUT);
    doc.text(T(`${e.nom} EI – TissaWeb · ${(e.adresse || "Adresse à compléter").replace(/\n/g, ", ")} · ${e.siret ? idLab(e.siret) + " " + idVal(e.siret) : "SIRET en cours d'attribution"}`), W / 2, H - 17.5, { align: "center" });
    doc.text(T(`${e.email} · tissaweb.fr · TVA non applicable, art. 293 B du CGI`), W / 2, H - 14, { align: "center" });
    doc.text(T(`${p.numero} · ${page} sur ${pages}`), R, H - 8, { align: "right" });
  }
  // ---- logo (même dessin que sur tissaweb.fr) ----
  fill(INK); doc.roundedRect(M, 14, 16, 16, 3, 3, "F");
  const L = (x1, y1, x2, y2, rgb) => { doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.6); doc.setLineCap("round"); doc.line(M + x1 * 0.8, 14 + y1 * 0.8, M + x2 * 0.8, 14 + y2 * 0.8); };
  L(3, 5, 17, 5, [255, 255, 255]); L(10, 5, 10, 17, [255, 255, 255]); L(5.5, 10.5, 8.5, 10.5, [146, 151, 149]); L(11.5, 10.5, 14.5, 10.5, [146, 151, 149]); L(5.5, 14.5, 8.5, 14.5, [85, 91, 88]); L(11.5, 14.5, 14.5, 14.5, [85, 91, 88]);
  font("bold", 19); col(INK); doc.text("Tissa", M + 20, 25.5); col(ACC); doc.text("Web", M + 20 + doc.getTextWidth("Tissa"), 25.5);
  font("normal", 8); col(MUT); doc.text("Sites web pour artisans, commerces et indépendants", M + 20, 30);
  // ---- cadre titre + références ----
  draw(INK); doc.setLineWidth(0.5); doc.rect(R - 72, 14, 72, 13);
  font("bold", 15); col(INK); doc.text(T(title), R - 36, 22.6, { align: "center" });
  const refs = [["Référence", p.numero], ["Date", sDate(p.date)]];
  if (isF) refs.push(["Échéance", p.echeance > p.date ? sDate(p.echeance) : "À réception"]); else refs.push(["Valable jusqu'au", sDate(addDays(p.date, cfg().validite))]);
  if (p.devis_ref) refs.push(["Devis", p.devis_ref]);
  refs.push(["Référence client", clientRef(p.client_id)]);
  font("normal", 8.5); refs.forEach((r, i) => { col(MUT); doc.text(T(r[0] + " :"), R - 30, 33 + i * 4.6, { align: "right" }); col(INK); doc.setFont("helvetica", "bold"); doc.text(T(r[1]), R, 33 + i * 4.6, { align: "right" }); doc.setFont("helvetica", "normal"); });
  // ---- émetteur / client ----
  let y = 33 + refs.length * 4.6 + 8;
  font("bold", 11); col(INK); doc.text(T(e.nom + " EI"), M, y); font("normal", 9); col([51, 64, 58]);
  const emL = ["TissaWeb"].concat((e.adresse || "Adresse à compléter").split("\n")).concat([e.siret ? idLab(e.siret) + " : " + idVal(e.siret) : "SIRET : en cours d'attribution"]).concat(e.tel ? ["Tél. : " + e.tel] : []).concat([e.email]);
  emL.forEach((l, i) => doc.text(T(l), M, y + 5.5 + i * 4.3));
  col(ACC); doc.text("tissaweb.fr", M, y + 5.5 + emL.length * 4.3);
  const cx = W / 2 + 6, cw = R - cx;
  const clL = [].concat(c.entreprise && c.nom ? [c.nom] : []).concat((c.adresse || "").split("\n").filter(Boolean)).concat(c.siren ? ["SIREN : " + c.siren] : []).concat(c.tel ? ["Tél. : " + c.tel] : []).concat(c.email ? [c.email] : []);
  const ch = 12 + Math.max(2, clL.length) * 4.3;
  fill(SOFT); doc.rect(cx, y - 5, cw, ch, "F");
  font("bold", 7.5); col(MUT); doc.text("CLIENT", cx + 4, y - 0.5);
  font("bold", 11); col(INK); doc.text(T(c.entreprise || c.nom || ""), cx + 4, y + 4.8);
  font("normal", 9); col([51, 64, 58]); clL.forEach((l, i) => doc.text(T(l), cx + 4, y + 9.6 + i * 4.3));
  y = Math.max(y + 5.5 + (emL.length + 1) * 4.3, y - 5 + ch) + 5;
  if (p.type === "devis") {
    font("normal", 9); col(INK);
    if (c.nom) { doc.text(T("À l'attention de " + c.nom), M, y); y += 6; }
    font("bold", 9.5); doc.text(T(p.demande ? "En réponse à votre demande, nous avons le plaisir de vous adresser notre meilleure offre pour :" : "Nous avons le plaisir de vous adresser notre meilleure offre de prix et de délai pour :"), M, y); y += 5;
    const pro = lines.some((l) => /Professionnel/.test(l.desc));
    fill(SOFT); doc.rect(M, y, R - M, 7, "F"); font("bold", 8.2); col(INK);
    doc.text(T(`Validité de l'offre : ${cfg().validite} jours (jusqu'au ${sDate(addDays(p.date, cfg().validite))})   ·   Délai de réalisation : ${pro ? 10 : 7} jours ouvrés   ·   Prix fixe et forfaitaire`), M + 3, y + 4.7); y += 11;
  }
  if (p.note) { font("italic", 9); col(MUT); const n = doc.splitTextToSize(T("Objet : " + p.note), R - M); doc.text(n, M, y); y += n.length * 4.3 + 3; }
  // ---- tableau ----
  const X = { d: M + 2, pu: R - 66, q: R - 40, t: R - 2 };
  draw(INK); doc.setLineWidth(0.5); doc.line(M, y, R, y);
  font("bold", 9); col(INK); doc.text("Description", X.d, y + 5.5); doc.text("Prix unit. HT", X.pu, y + 5.5, { align: "right" }); doc.text("Quantité", X.q, y + 5.5, { align: "right" }); doc.text("Total HT", X.t, y + 5.5, { align: "right" });
  y += 8.5; draw(LINE); doc.setLineWidth(0.3); doc.line(M, y, R, y);
  const pages = []; let page = 1;
  lines.forEach((l) => {
    const parts = String(l.desc || "").split(/\s:\s|:\s/), head = parts.length > 1 ? parts.shift() : l.desc, rest = parts.length ? parts.join(" : ") : "";
    font("normal", 8.6); const dl = rest ? doc.splitTextToSize(T(rest.charAt(0).toUpperCase() + rest.slice(1)), X.pu - X.d - 26) : [];
    const h = 6.5 + dl.length * 3.9 + 3;
    if (y + h > H - 70) { pages.push(page); doc.addPage(); page++; y = 20; }
    font("bold", 9.5); col(INK); doc.text(T(head), X.d, y + 5.2);
    font("normal", 8.6); col([76, 87, 82]); if (dl.length) doc.text(dl, X.d, y + 9.6);
    font("normal", 9.5); col(INK); doc.text(T(eur(l.pu)), X.pu, y + 5.2, { align: "right" }); doc.text(String(l.qte).replace(".", ","), X.q, y + 5.2, { align: "right" }); doc.text(T(eur(l.qte * l.pu)), X.t, y + 5.2, { align: "right" });
    y += h; draw(LINE); doc.line(M, y, R, y);
  });
  // ---- bloc paiement (gauche) + totaux (droite) ----
  y += 8; if (y > H - 95) { doc.addPage(); page++; y = 20; }
  const tx = W / 2 + 6, tR = R; let ty = y;
  const row = (label, val, opt) => { opt = opt || {}; font(opt.bold ? "bold" : "normal", opt.size || 9.5); col(opt.color || INK); doc.text(T(label), tx, ty); doc.text(T(val), tR, ty, { align: "right" }); if (opt.sub) { font("normal", 7.5); col(MUT); doc.text(T(opt.sub), tx, ty + 3.8); ty += 3.8; } ty += opt.gap || 6; };
  if (ded.length) { row("Total du projet HT", eur(gross)); ded.forEach((l) => { const ref = (l.desc.match(/\((.*?)\)/) || [])[1] || ""; const fa = D.pieces.find((f) => f.numero === ref); row("Acompte déjà facturé", eur(l.qte * l.pu), { sub: ref + (fa && fa.paye_le ? " · réglé le " + sDate(fa.paye_le) : "") }); }); }
  row("Total HT", eur(net)); row("TVA", "Non applicable", { sub: "Art. 293 B du CGI" });
  draw(INK); doc.setLineWidth(0.5); doc.line(tx, ty - 3, tR, ty - 3); ty += 2;
  fill(ACC); doc.roundedRect(tx - 2, ty - 5.5, tR - tx + 2, 10, 1.5, 1.5, "F"); font("bold", 11.5); col([255, 255, 255]); doc.text(isF ? "Net à payer" : "Total TTC", tx + 1, ty + 1); doc.text(T(eur(net)), tR - 3, ty + 1, { align: "right" }); ty += 11;
  if (p.type === "devis" && cfg().acompte > 0) { font("normal", 8.5); col(MUT); doc.text(T(`Acompte à la commande (${cfg().acompte} %) : ${eur(Math.round(net * cfg().acompte) / 100)}`), tR, ty, { align: "right" }); ty += 4.4; doc.text(T(`Solde à la livraison : ${eur(net - Math.round(net * cfg().acompte) / 100)}`), tR, ty, { align: "right" }); ty += 4; }
  // paiement
  let ly = y; font("bold", 10.5); col(INK); doc.text(isF ? "Règlement" : "Modalités de paiement", M, ly); ly += 6;
  font("normal", 8.6);
  const pay = [];
  if (isF) pay.push(["Échéance", p.echeance > p.date ? frDate(p.echeance) : "À réception de la facture"]);
  else pay.push(["Acompte", `${cfg().acompte} % à la signature`], ["Solde", "À la livraison, avant mise en ligne"]);
  pay.push(["Mode", "Virement" + (e.lien ? " ou carte bancaire" : "")]);
  pay.push(["Titulaire", e.nom + " EI"]); pay.push(["IBAN", e.iban || "à compléter"]); if (e.bic) pay.push(["BIC", e.bic]);
  if (isF) pay.push(["Référence", p.numero]);
  pay.forEach((r) => { col(MUT); doc.setFont("helvetica", "bold"); doc.text(T(r[0]), M, ly); col(INK); doc.setFont("helvetica", "normal"); const v = doc.splitTextToSize(T(r[1]), 62); doc.text(v, M + 22, ly); ly += 4.6 * v.length; });
  if (e.lien) { col(ACC); const v = doc.splitTextToSize(T("Payer par carte : " + e.lien), 84); doc.text(v, M, ly + 1); ly += 4.6 * v.length + 1; }
  y = Math.max(ly, ty) + 5;
  // ---- conditions + signature ----
  const cond = [];
  if (p.type === "devis") {
    const pro = lines.some((l) => /Professionnel/.test(l.desc));
    cond.push(`Le délai de ${pro ? 10 : 7} jours ouvrés court à compter de la réception de l'acompte et des contenus (textes, logo, photos).`);
    cond.push("Inclus : maquette, deux séries de modifications, adaptation mobile, mise en ligne et bases du référencement Google.");
    cond.push("Non inclus : nom de domaine (environ 10 € par an, au nom du client), maintenance mensuelle (option), photos professionnelles.");
    cond.push("Paiement : acompte de " + cfg().acompte + " % à la commande, solde à la livraison avant mise en ligne, par virement ou carte bancaire. Aucun escompte pour paiement anticipé.");
    cond.push("Cette offre est établie sur la base des informations transmises par le client et du périmètre décrit ci-dessus. Toute demande supplémentaire fera l'objet d'un devis complémentaire.");
    cond.push("Le site et son contenu deviennent la propriété du client après paiement intégral (clause de réserve de propriété, art. XI des CGV).");
  } else {
    cond.push("Pas d'escompte pour paiement anticipé. Catégorie de l'opération : prestation de services.");
    cond.push("En cas de retard de paiement : pénalités au taux de trois fois le taux d'intérêt légal et, pour les professionnels, indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).");
  }
  const cw2 = p.type === "devis" ? R - M - 80 : R - M - 6;
  font("normal", 7.2); const cl = cond.map((x) => doc.splitTextToSize(T(x), cw2 - 6)); const chH = cl.reduce((a, x) => a + x.length * 3.2 + 0.8, 0) + 9;
  if (y + Math.max(chH, 36) > H - 23) { doc.addPage(); page++; y = 20; }
  draw(LINE); doc.setLineWidth(0.3); doc.rect(M, y - 4, cw2, chH, "S");
  font("bold", 8); col(INK); doc.text(p.type === "devis" ? "CONDITIONS PARTICULIÈRES" : "CONDITIONS DE RÈGLEMENT", M + 3, y + 0.5); let cy = y + 4.8; font("normal", 7.2); col([76, 87, 82]);
  cl.forEach((x) => { doc.text(x, M + 3, cy); cy += x.length * 3.2 + 0.8; });
  if (p.type === "devis") { font("italic", 7.6); col(MUT); const pol = doc.splitTextToSize(T(`Conditions générales de vente au verso. Merci de rappeler la référence ${p.numero} lors de votre commande et dans toute correspondance. Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`), cw2); doc.text(pol, M, y - 4 + chH + 5); }
  if (p.type === "devis") {
    const bx = R - 72; draw(LINE); doc.setLineWidth(0.4); doc.roundedRect(bx, y - 4, 72, 36, 2, 2, "S");
    font("bold", 9); col(INK); doc.text("Bon pour accord", bx + 4, y + 1.5); font("normal", 7.3); col(MUT);
    doc.text(doc.splitTextToSize("Date, nom et signature du client, précédés de la mention « Bon pour accord »", 64), bx + 4, y + 6);
    doc.text("Date :", bx + 4, y + 17); doc.text("Signature :", bx + 4, y + 23);
    font("italic", 6.6); doc.text(T("Démarrage immédiat : cases en page 2"), bx + 4, y + 29.5);
  }
  // ---- CGV (devis) : page « verso » ----
  if (p.type === "devis") {
    doc.addPage(); page++; let gy = 16;
    { // Démarrage anticipé : cases NON cochées (art. L.221-25 et L.221-28 1° C. conso)
      const rw = R - M, items = [
        "Je demande expressément que TissaWeb commence la réalisation avant la fin du délai de rétractation de 14 jours. Si je me rétracte, je paierai la part déjà réalisée (art. L.221-25 du Code de la consommation).",
        "Je reconnais qu'une fois mon site entièrement livré et mis en ligne à ma demande, je perds mon droit de rétractation (art. L.221-28, 1° du Code de la consommation).",
      ];
      font("normal", 7.2); const il = items.map((x) => doc.splitTextToSize(T(x), rw - 14));
      const bh = 12 + il.reduce((a, x) => a + x.length * 3.2 + 2.2, 0), ry = gy;
      draw(INK); doc.setLineWidth(0.4); doc.rect(M, ry - 4, rw, bh, "S");
      font("bold", 8); col(INK); doc.text(T("DÉMARRAGE AVANT 14 JOURS (facultatif) : particuliers et entreprises de 5 salariés au plus"), M + 3, ry + 0.5);
      font("normal", 6.8); col(MUT); doc.text(T("Ne cochez que si vous voulez que le travail commence tout de suite. Sans case cochée, nous démarrons après le délai de 14 jours."), M + 3, ry + 4.2);
      let iy = ry + 9.5; font("normal", 7.2); col([40, 50, 46]);
      il.forEach((x) => { draw(INK); doc.setLineWidth(0.35); doc.rect(M + 3.5, iy - 2.7, 3.4, 3.4, "S"); doc.text(x, M + 10, iy); iy += x.length * 3.2 + 2.2; });
      gy = ry - 4 + bh + 9;
    }
    font("bold", 12); col(INK); doc.text("CONDITIONS GÉNÉRALES DE VENTE", W / 2, gy, { align: "center" });
    font("normal", 7); col(MUT); doc.text(T(`TissaWeb · ${e.nom} EI · ${e.siret ? idLab(e.siret) + " " + idVal(e.siret) : "SIRET en cours d'attribution"} · version applicable au ${frDate(p.date)}`), W / 2, gy + 4.5, { align: "center" });
    draw(INK); doc.setLineWidth(0.4); doc.line(M, gy + 7, R, gy + 7); gy += 12;
    const gap = 6, colW = (R - M - gap) / 2, LH = 2.85, top = gy, bottom = H - 30; let colX = M;
    const next = () => { if (colX === M) { colX = M + colW + gap; gy = top; } else { doc.addPage(); page++; colX = M; gy = 16; } };
    CGV.forEach(([h, txt]) => {
      font("bold", 6.9); col(INK); if (gy + LH * 3 > bottom) next(); doc.text(T(h), colX, gy); gy += LH + 0.4;
      font("normal", 6.6); col([40, 50, 46]);
      doc.splitTextToSize(T(txt), colW).forEach((ln) => { if (gy > bottom) next(); doc.text(ln, colX, gy); gy += LH; });
      gy += 1.8;
    });
    font("normal", 7); col(MUT); doc.text("Lu et approuvé, paraphe du Client :", R - 52, H - 26);
  }
  // ---- Formulaire type de rétractation (annexe à l'art. R.221-1 C. conso) ----
  if (p.type === "devis") {
    doc.addPage(); page++; let fy = 22;
    font("bold", 12); col(INK); doc.text(T("FORMULAIRE DE RÉTRACTATION"), W / 2, fy, { align: "center" });
    font("normal", 7.5); col(MUT); doc.text(T("Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat."), W / 2, fy + 5, { align: "center" });
    fy += 16; font("normal", 9.5); col(INK);
    const fl = (t) => { doc.splitTextToSize(T(t), R - M).forEach((ln) => { doc.text(ln, M, fy); fy += 5; }); fy += 2; };
    fl(`À l'attention de ${e.nom} EI (TissaWeb), ${String(e.adresse || "").replace(/\n/g, ", ")}, contact@tissaweb.fr :`);
    fl(`Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous (devis ${p.numero}) :`);
    const ligne = (lab) => { doc.text(T(lab), M, fy); draw(LINE); doc.setLineWidth(0.3); doc.line(M + doc.getTextWidth(T(lab)) + 2, fy + 0.8, R, fy + 0.8); fy += 10; };
    ligne("Prestation :"); ligne("Commandée le :"); ligne("Nom du client :"); ligne("Adresse du client :"); fy += 0; ligne("");
    ligne("Signature du client (en cas d'envoi papier) :"); ligne("Date :");
    font("italic", 7.5); col(MUT); doc.text(T("Vous pouvez aussi remplir ce formulaire en ligne : tissaweb.fr/retractation.html"), M, fy + 4);
  }
  const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); footer(i, n); }
  return doc;
}

/* ================= messagerie ================= */
const unread = () => D.messages.filter((m) => m.direction === "in" && !m.lu && !m.archive).length;
function peerOf(m) { return (m.direction === "in" ? m.from_email : m.to_email || "").toLowerCase(); }
function nameFor(email, m) {
  const c = D.clients.find((x) => (x.email || "").toLowerCase() === email);
  if (c) return c.entreprise || c.nom;
  const pr = D.prospects.find((x) => (x.email || "").toLowerCase() === email); if (pr) return pr.entreprise;
  const d = D.demandes.find((x) => (x.email || "").toLowerCase() === email); if (d) return d.nom;
  return (m && m.from_name && m.direction === "in" && m.from_name) || email;
}
function convs(withArchived) {
  const map = {};
  D.messages.forEach((m) => {
    const e = peerOf(m); if (!e) return;
    const c = map[e] || (map[e] = { email: e, msgs: [], unread: 0, archived: true, last: null });
    c.msgs.push(m); if (m.direction === "in" && !m.lu && !m.archive) c.unread++; if (!m.archive) c.archived = false;
    if (!c.last || m.date > c.last.date) c.last = m;
  });
  return Object.values(map).filter((c) => withArchived ? c.archived : !c.archived).map((c) => Object.assign(c, { name: nameFor(c.email, c.last) })).sort((a, b) => (b.last.date || "").localeCompare(a.last.date || ""));
}
async function callFn(action, body) {
  const C = window.TW_CONFIG, { data } = await sb.auth.getSession();
  let saved = null; try { saved = localStorage.getItem("tw-fn"); } catch (e) {}
  const noms = [...new Set([saved, C.fn, "tw", "smart-function"].filter(Boolean))];
  if (action === "send" && body) { try { const e = em((S.me && S.me.emetteur) || "hugo"); body.signer_tel = body.signer_tel || e.tel || ""; body.signer_titre = body.signer_titre || e.titre || ""; } catch (e) {} }
  let r = null, out = {}, lastErr = null;
  for (const nom of noms) {
    try {
      r = await fetch(`${C.url}/functions/v1/${nom}?action=${action}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: C.key, Authorization: "Bearer " + (data.session ? data.session.access_token : "") }, body: JSON.stringify(body || {}) });
    } catch (e) { lastErr = e; r = null; console.warn("[TW] fonction injoignable :", nom, e); continue; }
    out = await r.json().catch(() => ({}));
    if (r.status !== 404) { try { localStorage.setItem("tw-fn", nom); } catch (e) {} break; }
    console.warn("[TW] fonction introuvable :", nom);
  }
  if (!r) { try { localStorage.removeItem("tw-fn"); } catch (e) {} throw new Error("Fonction serveur injoignable (" + noms.join(", ") + ") : vérifie qu'elle est déployée et que « Verify JWT » est désactivé."); }
  if (!r.ok) throw new Error(out.error || out.message || "Erreur " + r.status);
  return out;
}
async function syncMail(manual) {
  try {
    const r = await callFn("sync");
    const { data } = await sb.from("messages").select("*").order("date", { ascending: false }).limit(5000);
    if (data) D.messages = data;
    S.mailError = null; rerender();
    if (manual) toast(r.added ? r.added + " nouveau(x) mail(s)" : "Aucun nouveau mail");
  } catch (e) { S.mailError = e.message; if (manual) toast("Mails : " + e.message); if (S.view === "messages") render(); }
}
const fmtWhen = (d) => { const t = new Date(d), n = new Date(); return t.toDateString() === n.toDateString() ? t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : sDate(d); };

/* ---------- Tri automatique des réponses (fait par la base à chaque mail reçu) ---------- */
const CAT = { accepte: ["✅ Partant", "ok"], question: ["💬 À lire", "info"], refus: ["❌ Refus", "bad"], absence: ["🏖️ Absent", "warn"], non_distribue: ["📭 Adresse invalide", "bad"], pub: ["📰 Pubs & notifs", ""], spam: ["🚫 Spam", "bad"] };
const catOf = (c) => { const m = c.msgs.filter((x) => x.direction === "in" && x.categorie).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]; return m ? m.categorie : null; };
const catChip = (k) => k && CAT[k] ? ` <span class="chip ${CAT[k][1]}">${CAT[k][0]}</span>` : "";
function triCounts() { const n = {}; D.messages.forEach((m) => { if (m.direction === "in" && m.categorie) n[m.categorie] = (n[m.categorie] || 0) + 1; }); return n; }
function triBar() {
  const n = triCounts(), tot = Object.entries(n).filter(([k]) => !["pub", "spam"].includes(k)).reduce((a, [, b]) => a + b, 0), f = S.msgCat || "";
  return `<div class="tri"><span class="tri-l">Tri auto des réponses</span>${[["", "Toutes"], ["accepte", CAT.accepte[0]], ["question", CAT.question[0]], ["refus", CAT.refus[0]], ["absence", CAT.absence[0]], ["non_distribue", CAT.non_distribue[0]], ["pub", CAT.pub[0]], ["spam", CAT.spam[0]]].filter((x) => !x[0] || n[x[0]]).map((x) => `<button type="button" class="tri-b ${f === x[0] ? "on" : ""}" data-msgcat="${x[0]}">${x[1]}${x[0] ? ` <b>${n[x[0]]}</b>` : tot ? ` <b>${tot}</b>` : ""}</button>`).join("")}</div>`;
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-msgcat]"); if (!b) return; S.msgCat = b.dataset.msgcat; if (S.view !== "messages") { location.hash = "#messages"; } else render(); });
VIEWS.messages = function () {
  const arch = !!S.msgArch, list = convs(arch || ["pub", "spam"].includes(S.msgCat)).filter((c) => !S.msgCat || catOf(c) === S.msgCat);
  return `<div class="head"><div><h1>Messages</h1><p>Les mails reçus, rangés par personne. Les pubs, notifications et spams sont triés et archivés tout seuls.</p></div>
  <div class="actions"><button class="btn primary" type="button" data-compose-new>+ Nouveau mail</button><button class="btn" type="button" data-syncmail>Actualiser</button><button class="btn ghost" type="button" data-msgarch>${arch ? "Voir la boîte de réception" : "Voir les archives"}</button></div></div>
  ${S.mailError ? `<p class="alert warn" style="margin-bottom:12px">Lecture des mails impossible : ${esc(S.mailError)}. Vérifie les secrets dans Supabase (étape 5 du guide).</p>` : ""}
  ${triBar()}
  <ul class="list">${list.length ? list.map((c) => `<li class="item click ${c.unread ? "info" : ""}" data-conv="${esc(c.email)}"><div><b>${esc(c.name)}</b>${catChip(catOf(c))}${c.last.boite === "equipe" ? ' <span class="chip">equipe@</span>' : ""}${c.unread ? ` <span class="chip info">${c.unread} non lu${c.unread > 1 ? "s" : ""}</span>` : ""}<small>${esc(c.last.subject || "")} · ${esc((c.last.body || "").replace(/\s+/g, " ").slice(0, 90))}</small></div><small class="num">${fmtWhen(c.last.date)}</small></li>`).join("") : `<li class="item"><div class="empty"><h3>${arch ? "Aucune archive" : "Aucun message"}</h3>${arch ? "" : "Les mails reçus sur contact@ apparaissent ici toutes les 2 minutes."}</div></li>`}</ul>`;
};
function sheetConversation(email) {
  S.convEmail = email;
  openSheet(() => nameFor(email, null), () => {
    const msgs = D.messages.filter((m) => peerOf(m) === email).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const last = msgs[msgs.length - 1] || {}, lastIn = msgs.filter((m) => m.direction === "in").pop();
    const c = D.clients.find((x) => (x.email || "").toLowerCase() === email);
    return `<div class="row"><span class="note">${esc(email)}</span>${c ? `<a class="btn sm" href="#client/${c.id}">Fiche client</a>` : `<button class="btn sm" type="button" data-conv2client="${esc(email)}">Créer le client</button>`}</div>
    <div class="thread">${msgs.map((m) => `<div class="bubble ${m.direction}"><div class="bh"><b>${esc(m.direction === "in" ? (m.from_name || m.from_email) : "TissaWeb" + (m.auteur ? " · " + m.auteur : ""))}</b>${m.direction === "in" ? catChip(m.categorie) : ""}<small>${new Date(m.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</small></div><div class="bs">${esc(m.subject || "")}</div><div class="bb">${esc(m.body || "")}</div>${(m.pieces_jointes || []).length ? `<small class="note">📎 ${esc(m.pieces_jointes.join(", "))}</small>` : m.has_attachments ? `<small class="note">📎 Pièce jointe : à voir dans ta boîte mail</small>` : ""}<div class="bact"><button class="linkbtn danger" type="button" data-danger data-delmsg="${m.id}">Supprimer</button></div></div>`).join("")}</div>
    <div class="card"><h2>Répondre</h2>${composerHTML({ to: email, from: (lastIn || last).boite || "contact", subject: /^re\s*:/i.test(last.subject || "") ? last.subject : "Re: " + (last.subject || ""), body: "", client_id: c ? c.id : null, prospect_id: (D.prospects.find((x) => (x.email || "").toLowerCase() === email) || {}).id || null, in_reply_to: lastIn ? lastIn.message_id : null })}</div>
    <div class="actions"><button class="btn ghost" type="button" data-convarch="${esc(email)}">${msgs.every((m) => m.archive) ? "Désarchiver" : "Archiver la conversation"}</button><button class="btn ghost danger" type="button" data-danger data-convdel="${esc(email)}">Supprimer la conversation</button></div>`;
  });
  const ids = D.messages.filter((m) => peerOf(m) === email && m.direction === "in" && !m.lu).map((m) => m.id);
  if (ids.length) sb.from("messages").update({ lu: true }).in("id", ids).then(() => { D.messages.forEach((m) => { if (ids.includes(m.id)) m.lu = true; }); setBadges(); if (S.view === "messages" || S.view === "accueil") render(); });
  setTimeout(() => { const th = document.querySelector(".thread"); if (th) th.scrollTop = th.scrollHeight; }, 30);
}
function composerHTML(o) {
  S.compose = o;
  const ps = o.client_id ? D.pieces.filter((p) => p.client_id === o.client_id) : [];
  const from = o.from || (o.ctx && o.ctx.kind === "prospect" ? "equipe" : "contact");
  return `<div class="fgrid"><label class="f full">De<select id="mFrom"><option value="contact"${from === "contact" ? " selected" : ""}>TissaWeb &lt;contact@tissaweb.fr&gt;</option><option value="equipe"${from === "equipe" ? " selected" : ""}>TissaWeb – Hugo &amp; Lucas &lt;equipe@tissaweb.fr&gt;</option></select></label><label class="f full">À<input id="mTo" type="email" value="${esc(o.to || "")}" placeholder="adresse@client.fr"></label><label class="f full">Objet<input id="mSub" value="${esc(o.subject || "")}"></label><label class="f full">Message<textarea id="mBody" style="min-height:${o.body ? 260 : 140}px">${esc(o.body || "")}</textarea></label>
  ${ps.length ? `<label class="f full">Joindre un document<select id="mAtt"><option value="">Aucun</option>${ps.map((p) => `<option value="${p.id}"${p.id === o.pieceId ? " selected" : ""}>${kindLabel(p)} ${esc(p.numero)} · ${eur(total(p))}</option>`).join("")}</select></label>` : ""}</div>
  <p class="muted" style="font-size:12px;margin:8px 0 0">✍️ Ta signature pro (logo, nom complet, coordonnées) est ajoutée automatiquement à l'envoi.</p>
  <div class="actions" style="margin-top:12px"><button class="btn primary" type="button" data-sendmail>Envoyer</button></div>`;
}
function sheetCompose(o) { openSheet("Nouveau mail", () => composerHTML(o)); }
function pdfBase64(p) { const d = pdfFor(p); if (!d) return null; return { name: `${p.numero}_${cname(p.client_id).replace(/[^\w\-]+/g, "-").slice(0, 40)}.pdf`, content: d.output("datauristring").split(",")[1] }; }
async function sendFromComposer(btn) {
  const o = S.compose || {}, to = $("mTo").value.trim(), subject = $("mSub").value.trim(), text = $("mBody").value.trim();
  if (!to || !subject || !text) return toast("Remplis l'adresse, l'objet et le message");
  const pid = $("mAtt") ? $("mAtt").value : o.pieceId || "", piece = pid ? byId("pieces", pid) : null;
  const attachments = []; if (piece) { const a = pdfBase64(piece); if (a) attachments.push(a); }
  btn.disabled = true; btn.textContent = "Envoi…";
  try {
    const r = await callFn("send", { to, subject, text, attachments, from: $("mFrom") ? $("mFrom").value : "contact", client_id: o.client_id || (piece && piece.client_id) || null, in_reply_to: o.in_reply_to || null, prospect_id: o.prospect_id || null });
    if (r.message && !D.messages.some((m) => m.id === r.message.id)) D.messages.unshift(r.message);
    // suites automatiques selon ce qu'on vient d'envoyer
    const ctx = o.ctx || {};
    if (piece && piece.statut === "brouillon") { await upd("pieces", piece.id, { statut: "envoye", envoye_le: today() }); await log(piece.type, `${kindLabel(piece)} ${piece.numero} envoyé${piece.type === "facture" ? "e" : ""} par mail`, { client_id: piece.client_id }); }
    if (ctx.kind === "prospect") { const pr = byId("prospects", ctx.id); if (pr) { await upd("prospects", pr.id, { statut: pr.statut === "a_contacter" || pr.statut === "contacte" ? "contacte" : pr.statut, dernier_contact: today(), prochaine_action: (pr.nb_contacts || 0) >= 2 ? null : addDays(today(), cfg().relance_prospect), nb_contacts: (pr.nb_contacts || 0) + 1 }); await log("prospect", `Mail envoyé à ${pr.entreprise}`, { prospect_id: pr.id }); } }
    if (ctx.kind === "demande") { const d = byId("demandes", ctx.id); if (d && d.statut === "nouvelle") await upd("demandes", d.id, { statut: "repondu", traite_par: S.me ? S.me.nom : "" }); }
    if (!piece && !ctx.kind) await log("mail", `Mail envoyé à ${to} : ${subject}`, { client_id: o.client_id || null });
    toast("Mail envoyé ✅"); closeSheet(); render();
  } catch (e) { toast("Envoi impossible : " + e.message); btn.disabled = false; btn.textContent = "Envoyer"; }
}

/* ================= envoi groupé ================= */
function bulkTargets() {
  const t = today();
  return D.prospects.filter((p) => p.email && ((p.statut === "a_contacter") || (p.statut === "contacte" && p.prochaine_action && p.prochaine_action <= t && (p.nb_contacts || 0) < 3))).sort((a, b) => (a.priorite || 50) - (b.priorite || 50));
}
function sheetBulk() {
  S.bulkSel = S.bulkSel || {};
  openSheet("Envoi groupé", () => {
    const list = bulkTargets();
    if (!list.length) return `<div class="empty"><h3>Personne à contacter pour l'instant</h3>Ajoute des prospects avec une adresse mail, ou attends les prochaines relances.</div>`;
    return `<p class="note">Chaque commerce reçoit un mail personnalisé à son nom, envoyé depuis <b>equipe@tissaweb.fr</b> et signé ${esc(S.me ? S.me.nom.split(" ")[0] : "")}. 1er contact pour les nouveaux, relance pour les autres. Les relances suivantes se programment toutes seules.</p>
    <ul class="list">${list.map((p) => { const m = mailProspect(p, "auto"); const on = S.bulkSel[p.id] !== false; return `<li class="item"><label class="row" style="flex:1;cursor:pointer"><input type="checkbox" data-bulkpick="${p.id}" ${on ? "checked" : ""}><span><b>${esc(p.entreprise)}</b><small class="note" style="display:block">${esc(p.email)} · ${esc(m.sub)}</small></span></label><button class="btn sm ghost" type="button" data-prospect="${p.id}">Voir le mail</button></li>`; }).join("")}</ul>
    <p class="alert info">Conseil : 10 à 20 mails par jour maximum, pour ne pas être classé en spam.</p>
    <div class="actions"><button class="btn primary" type="button" data-bulkgo>Envoyer ${list.filter((p) => S.bulkSel[p.id] !== false).length} mail(s)</button></div><p class="note" id="bulkProg"></p>`;
  });
}
async function bulkSend(btn) {
  const list = bulkTargets().filter((p) => S.bulkSel[p.id] !== false); if (!list.length) return;
  btn.disabled = true; let ok = 0, ko = 0;
  for (const p of list) {
    const m = mailProspect(p, "auto"); $("bulkProg").textContent = `Envoi ${ok + ko + 1}/${list.length} : ${p.entreprise}…`;
    try {
      const r = await callFn("send", { to: p.email, subject: m.sub, text: m.body, from: "equipe", prospect_id: p.id });
      if (r.message) D.messages.unshift(r.message);
      await upd("prospects", p.id, { statut: "contacte", dernier_contact: today(), prochaine_action: m.kind === "relance2" ? null : addDays(today(), cfg().relance_prospect), nb_contacts: (p.nb_contacts || 0) + 1 });
      await log("prospect", `${m.kind === "premier" ? "1er mail" : "Relance"} envoyé à ${p.entreprise}`, { prospect_id: p.id }); ok++;
    } catch (e) { ko++; console.error(e); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  toast(`${ok} mail(s) envoyé(s)${ko ? ", " + ko + " échec(s)" : ""}`); closeSheet(); render();
}

/* ================= notifications ================= */
function urlB64(s) { const p = "=".repeat((4 - (s.length % 4)) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...b].map((c) => c.charCodeAt(0))); }
function localNotify(title, body, tag, url) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opt = { body: body || "", icon: "icon-180.png", badge: "icon-180.png", tag: tag || "tw", renotify: true, data: { url: url || location.href } };
    if (navigator.serviceWorker && navigator.serviceWorker.controller && !/electron/i.test(navigator.userAgent)) navigator.serviceWorker.ready.then((r) => r.showNotification(title, opt)).catch(() => new Notification(title, opt));
    else { const n = new Notification(title, opt); n.onclick = () => { window.focus(); if (url) location.href = url; n.close(); }; }
  } catch (e) { console.warn(e); }
}
const appAway = () => document.hidden || !document.hasFocus();
async function registerSW() { try { if ("serviceWorker" in navigator) await navigator.serviceWorker.register("sw.js"); } catch (e) {} }
async function pushOn() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  if (ios && !standalone) return openSheet("Activer les notifications", () => `<p>Sur iPhone, les notifications marchent seulement depuis l'appli installée sur l'écran d'accueil.</p><ol><li>Dans Safari, appuie sur <b>Partager</b> puis <b>Sur l'écran d'accueil</b>.</li><li>Ouvre TissaWeb depuis la nouvelle icône.</li><li>Reviens ici et appuie à nouveau sur <b>Notifications</b>.</li></ol>`);
  const electron = /electron/i.test(navigator.userAgent);
  if (!("Notification" in window)) return toast("Cet appareil ne gère pas les notifications");
  const perm = await Notification.requestPermission(); if (perm !== "granted") return toast("Notifications bloquées : autorise-les dans les réglages du navigateur (icône 🔒 à gauche de l'adresse)");
  if (electron || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    try { localStorage.setItem("tw-localnotif", "1"); } catch (e) {}
    localNotify("Notifications activées ✅", electron ? "L'appli Windows te prévient tant qu'elle est ouverte (même réduite)." : "Tu seras prévenu tant que l'appli est ouverte.", "test");
    return toast(electron ? "Activé : l'appli Windows te prévient tant qu'elle est ouverte. Pour tout recevoir, active aussi sur ton téléphone." : "Activé tant que l'appli est ouverte");
  }
  try {
    const reg = await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(VAPID_PUBLIC) });
    const j = sub.toJSON(), dev = /iphone/i.test(navigator.userAgent) ? "iPhone" : /android/i.test(navigator.userAgent) ? "Android" : /windows/i.test(navigator.userAgent) ? "PC Windows" : /mac/i.test(navigator.userAgent) ? "Mac" : "Appareil";
    const { error } = await sb.from("push_subs").upsert({ endpoint: j.endpoint, sub: j, email: S.me ? S.me.email : "", appareil: dev }, { onConflict: "endpoint" });
    if (error) throw error;
    const r = await callFn("testpush");
    if (r && r.sent > 0) toast("Notifications activées ✅ Une notification de test arrive.");
    else toast("Appareil enregistré, mais le test n'est pas parti : " + ((r && r.errors && r.errors[0]) || "aucun appareil trouvé") + ". Envoie-moi ce message.", 9000);
  } catch (e) { toast("Activation impossible : " + (e.message || e)); }
}

/* ---------- boutons à confirmer (suppression) ---------- */
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-danger]"); if (!t) return;
  if (t.dataset.armed) return; // 2e clic : on laisse passer
  ev.preventDefault(); ev.stopImmediatePropagation();
  t.dataset.armed = "1"; t.dataset.label = t.textContent; t.textContent = "Confirmer ?"; t.classList.add("armed");
  setTimeout(() => { if (t.isConnected) { delete t.dataset.armed; t.textContent = t.dataset.label; t.classList.remove("armed"); } }, 3500);
}, true);
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("[data-bulk],[data-bulkgo],[data-conv],[data-compose],[data-compose-new],[data-syncmail],[data-msgarch],[data-sendmail],[data-delmsg],[data-convdel],[data-convarch],[data-conv2client],[data-deldem],[data-purgedem],[data-delprojet],[data-delclient],[data-pushon]"); if (!t) return;
  const ds = t.dataset;
  try {
    if (t.hasAttribute("data-bulk")) return sheetBulk();
    if (t.hasAttribute("data-bulkgo")) return bulkSend(t);
    if (ds.conv) return sheetConversation(ds.conv);
    if (t.hasAttribute("data-compose-new")) return sheetCompose({ to: "", subject: "", body: "" });
    if (t.hasAttribute("data-compose")) { const c = S.mailCtx || {}, m = c.m || {}; const piece = c.kind === "piece" ? byId("pieces", c.id) : null; const pr = c.kind === "prospect" ? byId("prospects", c.id) : null; return sheetCompose({ to: m.to, subject: m.sub, body: m.body, pieceId: piece ? piece.id : "", client_id: piece ? piece.client_id : (c.kind === "demande" ? (byId("demandes", c.id) || {}).client_id : null), prospect_id: pr ? pr.id : null, ctx: c }); }
    if (t.hasAttribute("data-syncmail")) { t.disabled = true; await syncMail(true); return; }
    if (t.hasAttribute("data-msgarch")) { S.msgArch = !S.msgArch; return render(); }
    if (t.hasAttribute("data-sendmail")) return sendFromComposer(t);
    if (ds.delmsg) { await del("messages", ds.delmsg); toast("Message supprimé de l'appli"); return rerender(); }
    if (ds.convdel) { const ids = D.messages.filter((m) => peerOf(m) === ds.convdel).map((m) => m.id); const { error } = await sb.from("messages").delete().in("id", ids); if (error) return toast(error.message); D.messages = D.messages.filter((m) => !ids.includes(m.id)); closeSheet(); toast("Conversation supprimée de l'appli"); return render(); }
    if (ds.convarch) { const ids = D.messages.filter((m) => peerOf(m) === ds.convarch).map((m) => m.id), v = !D.messages.filter((m) => ids.includes(m.id)).every((m) => m.archive); const { error } = await sb.from("messages").update({ archive: v, lu: true }).in("id", ids); if (error) return toast(error.message); D.messages.forEach((m) => { if (ids.includes(m.id)) { m.archive = v; m.lu = true; } }); closeSheet(); toast(v ? "Conversation archivée" : "Conversation désarchivée"); return render(); }
    if (ds.conv2client) { const m = D.messages.find((x) => peerOf(x) === ds.conv2client && x.direction === "in") || {}; const c = await ins("clients", { nom: m.from_name || "", email: ds.conv2client, source: "Mail reçu" }); await sb.from("messages").update({ client_id: c.id }).ilike(m.direction === "in" ? "from_email" : "to_email", ds.conv2client); toast("Client créé"); return sheetConversation(ds.conv2client); }
    if (ds.deldem) { await del("demandes", ds.deldem); closeSheet(); toast("Demande supprimée"); return render(); }
    if (t.hasAttribute("data-purgedem")) { const ids = D.demandes.filter((d) => ["archivee", "spam", "convertie"].includes(d.statut)).map((d) => d.id); const { error } = await sb.from("demandes").delete().in("id", ids); if (error) return toast(error.message); D.demandes = D.demandes.filter((d) => !ids.includes(d.id)); toast(ids.length + " demande(s) supprimée(s)"); return render(); }
    if (ds.delclient) {
      const id = ds.delclient, c = client(id);
      for (const t of ["projets", "abonnements", "messages", "journal", "demandes"]) { const ids = D[t].filter((x) => x.client_id === id).map((x) => x.id); if (ids.length) { const { error } = await sb.from(t).delete().in("id", ids); if (!error) D[t] = D[t].filter((x) => !ids.includes(x.id)); } }
      const pr = D.prospects.filter((x) => x.client_id === id); for (const x of pr) await upd("prospects", x.id, { client_id: null, statut: "interesse" });
      const brouillons = D.pieces.filter((x) => x.client_id === id && x.statut === "brouillon").map((x) => x.id); if (brouillons.length) { await sb.from("pieces").delete().in("id", brouillons); D.pieces = D.pieces.filter((x) => !brouillons.includes(x.id)); }
      await del("clients", id); closeSheet(); toast((c ? (c.entreprise || c.nom) : "Client") + " supprimé"); if (S.view === "client") location.hash = "#clients"; return render();
    }
    if (ds.delprojet) { await del("projets", ds.delprojet); closeSheet(); toast("Projet supprimé"); return render(); }
    if (t.hasAttribute("data-pushon")) return pushOn();
  } catch (e) { console.error(e); }
});

/* ================= événements ================= */
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button,a,[data-dem],[data-prospect],[data-goclient],[data-piece],[data-projet],[data-abo]"); if (!t) return;
  const ds = t.dataset;
  try {
    if (t.hasAttribute("data-close")) return closeSheet();
    if (ds.who) { S.who = ds.who; document.querySelectorAll("[data-who]").forEach((b) => b.setAttribute("aria-pressed", b === t ? "true" : "false")); try { localStorage.setItem("tw-who", S.who); } catch (e) {} return render(); }
    if (ds.dem) return sheetDemande(ds.dem);
    if (ds.prospect) return sheetProspect(ds.prospect);
    if (t.hasAttribute("data-newprospect")) return sheetProspect(null);
    if (ds.goclient) { location.hash = "#client/" + ds.goclient; return; }
    if (t.hasAttribute("data-newclient")) return sheetClient(null);
    if (ds.editclient) return sheetClient(ds.editclient);
    if (ds.piece) return sheetPiece(ds.piece);
    if (ds.projet) return sheetProjet(ds.projet);
    if (ds.abo) return sheetAbo(ds.abo);
    if (t.hasAttribute("data-newabo")) return sheetAbo(null, ds.newabo);
    if (ds.new === "devis") return sheetEditor(null, ds.cid);
    if (ds.edit) return sheetEditor(ds.edit);
    if (ds.q) { const q = QUICK[+ds.q]; let pu = q.p; if (pu === "remise") { const base = edLines().filter((l) => l.pu > 0 && /^Site vitrine/.test(l.desc)).reduce((a, l) => a + l.qte * l.pu, 0); if (!base) return toast("Ajoute d'abord un site Essentiel ou Professionnel"); pu = -Math.round(base * 0.3); } $("eLines").insertAdjacentHTML("beforeend", lineHTML({ desc: q.d, qte: 1, pu })); return edTotal(); }
    if (t.hasAttribute("data-rmline")) { t.closest(".line").remove(); return edTotal(); }
    if (ds.copy) { if (!S.mail) return; return copy(ds.copy === "sub" ? S.mail.sub : S.mail.body, $("mailBody")); }
    if (ds.pdf) { const p = byId("pieces", ds.pdf), d = pdfFor(p); if (!d) return toast("Le générateur de PDF n'a pas chargé"); d.save(`${p.numero}_${cname(p.client_id).replace(/[^\w\-]+/g, "-").slice(0, 40)}.pdf`); return; }
    if (ds.sent) { const p = await upd("pieces", ds.sent, { statut: "envoye", envoye_le: today() }); await log(p.type, `${kindLabel(p)} ${p.numero} envoyé${p.type === "facture" ? "e" : ""} au client`, { client_id: p.client_id }); toast("Marqué comme envoyé"); return rerender(); }
    if (ds.accept) { const fa = await devisAccepte(byId("pieces", ds.accept)); celebrate("Devis accepté !"); render(); return fa ? sheetPiece(fa.id) : rerender(); }
    if (ds.refuse) { const p = await upd("pieces", ds.refuse, { statut: "refuse" }); await log("devis", `Devis ${p.numero} refusé`, { client_id: p.client_id }); return rerender(); }
    if (ds.inv) { const f = await makeInvoice(byId("pieces", ds.id), ds.inv); render(); return sheetPiece(f.id); }
    if (ds.payask) { $("payBox").hidden = false; $("payBox").scrollIntoView({ block: "nearest" }); return; }
    if (ds.payok) { await facturePayee(byId("pieces", ds.payok), $("payDate").value || today(), $("payHow").value); celebrate("Paiement encaissé !"); return rerender(); }
    if (ds.pdel) { $("pDelAsk").hidden = false; return; }
    if (ds.pdelyes) { await del("pieces", ds.pdelyes); closeSheet(); toast("Supprimé"); return render(); }
    if (ds.dem2devis) { const p = await demandeVersDevis(byId("demandes", ds.dem2devis)); render(); return sheetEditor(p.id); }
    if (ds.demstat) { await upd("demandes", ds.id, { statut: ds.demstat, traite_par: S.me ? S.me.nom : "" }); toast("Demande mise à jour"); if (ds.demstat !== "repondu") closeSheet(); return rerender(); }
    if (ds.prsent) { const p = byId("prospects", ds.prsent); await upd("prospects", p.id, { statut: "contacte", dernier_contact: today(), prochaine_action: addDays(today(), cfg().relance_prospect), nb_contacts: (p.nb_contacts || 0) + 1 }); await log("prospect", `Mail ${(p.nb_contacts || 0) ? "de relance " : ""}envoyé à ${p.entreprise}`, { prospect_id: p.id }); toast(`Relance programmée dans ${cfg().relance_prospect} jours`); return rerender(); }
    if (ds.prstat) { const p = await upd("prospects", ds.id, { statut: ds.prstat, prochaine_action: null }); await log("prospect", `${p.entreprise} : ${PSTAT[ds.prstat][0].toLowerCase()}`, { prospect_id: p.id }); if (ds.prstat === "client") celebrate("Nouveau client : " + p.entreprise + " !"); else if (ds.prstat === "interesse") celebrate(p.entreprise + " est intéressé !", true); return rerender(); }
    if (ds.pr2devis) { const c = await prospectVersClient(byId("prospects", ds.pr2devis)); render(); return sheetEditor(null, c.id); }
    if (t.hasAttribute("data-pdraftclear")) { pDraftDel(ds.pdraftclear); return sheetProspect(ds.pdraftclear || null); }
    if (t.hasAttribute("data-prsave")) {
      const d = { entreprise: $("pEnt").value.trim(), activite: $("pAct").value.trim(), tel: $("pTel").value.trim(), email: $("pMail").value.trim(), adresse: $("pAdr").value.trim(), angle: $("pAng").value.trim(), notes: $("pNotes").value.trim() };
      if (!d.entreprise) return toast("Indique le nom du commerce");
      const r = ds.prsave ? await upd("prospects", ds.prsave, d) : await ins("prospects", d); pDraftDel(ds.prsave); toast("Prospect enregistré"); render(); return sheetProspect(r.id);
    }
    if (ds.prdel) { await del("prospects", ds.prdel); closeSheet(); return render(); }
    if (t.id === "saveCfg") {
      const c = JSON.parse(JSON.stringify(cfg())); c.emetteurs = { hugo: em("hugo"), lucas: em("lucas") };
      document.querySelectorAll("[data-k]").forEach((i) => { let v = i.value.trim(); if (i.dataset.f === "acre") v = v === "1"; c.emetteurs[i.dataset.k][i.dataset.f] = v; });
      c.validite = +$("sValid").value || 30; c.delai = Math.max(0, +$("sDelay").value || 0); c.acompte = Math.min(100, Math.max(0, +$("sDeposit").value || 0)); c.relance_prospect = +$("sRel").value || 5; if ($("sAuto")) { c.auto_prospect = $("sAuto").value === "1"; c.auto_par_jour = Math.min(20, Math.max(1, +$("sAutoN").value || 5)); c.auto_relance_jours = Math.min(30, Math.max(2, +$("sAutoR").value || 7)); }
      await saveCfg(c); toast("Réglages enregistrés"); return render();
    }
    if (t.id === "notifBtn") { if (!("Notification" in window)) return toast("Notifications non disponibles sur cet appareil"); const r = await Notification.requestPermission(); return toast(r === "granted" ? "Notifications activées" : "Notifications refusées"); }
    if (t.id === "menuBtn") { const o = $("side").classList.toggle("open"); t.setAttribute("aria-expanded", o ? "true" : "false"); return; }
    if (t.id === "logout") { await sb.auth.signOut(); location.reload(); }
  } catch (e) { console.error(e); }
});
document.addEventListener("change", async (ev) => {
  const t = ev.target;
  if (t.id === "pModele") { S.pModele = t.value; if (S.sheetRender) S.sheetRender(); return; }
  if (t.dataset.bulkpick) { S.bulkSel[t.dataset.bulkpick] = t.checked; const b = document.querySelector("[data-bulkgo]"); if (b) b.textContent = `Envoyer ${bulkTargets().filter((p) => S.bulkSel[p.id] !== false).length} mail(s)`; return; }
  if (t.id === "fDem") { S.fDem = t.value; render(); }
  if (t.id === "fPro") { S.fPro = t.value; render(); }
  if (t.id === "fType") { S.fType = t.value; render(); }
  if (t.id === "fStat") { S.fStat = t.value; render(); }
  if (t.dataset.step != null && S.curProjet) { const pj = byId("projets", S.curProjet); if (pj) { try { await etapeCochee(pj, +t.dataset.step, t.checked); rerender(); } catch (e) {} } }
});
document.addEventListener("input", (ev) => {
  const t = ev.target, keep = (k) => { S[k] = t.value; const pos = t.selectionStart; render(); const n = $(t.id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } };
  if (t.id === "qPro") keep("qPro"); if (t.id === "qCli") keep("qCli"); if (t.id === "qPie") keep("qPie");
});
document.addEventListener("click", async (ev) => { if (ev.target.id === "jSave") { const pj = byId("projets", S.curProjet); if (!pj) return; await upd("projets", pj.id, { date_prevue: $("jPrev").value || null, url_site: $("jUrl").value.trim(), notes: $("jNotes").value.trim() }); toast("Projet enregistré"); rerender(); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("sheet").hidden) closeSheet(); });
$("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) closeSheet(); });
window.addEventListener("hashchange", route);

/* ================= Agenda, notes, objectifs, sauvegarde ================= */
const RDV_TYPES = { rdv: "Rendez-vous", appel: "Appel", visite: "Visite en boutique", autre: "Autre" };
const pad2 = (n) => String(n).padStart(2, "0");
function rdvDay(d) { const t = today(), k = iso(new Date(d)); return k === t ? "Aujourd'hui" : k === addDays(t, 1) ? "Demain" : frDate(k); }
function hhmm(d) { d = new Date(d); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
function rdvLink(r) {
  if (r.prospect_id) { const p = byId("prospects", r.prospect_id); return p ? p.entreprise : ""; }
  if (r.client_id) return cname(r.client_id);
  return "";
}
async function loadExtras() {
  S.needSql4 = false;
  for (const t of ["notes", "rdv"]) {
    const r = await sb.from(t).select("*").order("created_at", { ascending: false }).limit(2000);
    if (r.error) { D[t] = []; S.needSql4 = true; } else D[t] = r.data || [];
  }
  const pc = await sb.from("config").select("*").eq("id", "public").maybeSingle();
  D.pub = (pc.data && pc.data.data) || { places_restantes: 5 };
}
function sql4Alert() { return S.needSql4 ? `<p class="alert warn">Pour activer cette page, lance une fois <b>code-supabase-etape4.txt</b> dans Supabase (SQL Editor → Run).</p>` : ""; }
function extraBadges() {
  const b = $("bAgd"); if (!b) return;
  const n = D.rdv.filter((r) => iso(new Date(r.debut)) === today() && new Date(r.debut) > new Date(Date.now() - 3600000)).length;
  b.textContent = n; b.hidden = !n;
}

/* ----- agenda ----- */
VIEWS.agenda = function () {
  const now = Date.now(), list = D.rdv.slice().sort((a, b) => new Date(a.debut) - new Date(b.debut));
  const next = list.filter((r) => new Date(r.debut).getTime() + (r.duree || 30) * 60000 >= now), past = list.filter((r) => !next.includes(r)).reverse().slice(0, 15);
  const groups = []; next.forEach((r) => { const k = iso(new Date(r.debut)); let g = groups.find((x) => x.k === k); if (!g) groups.push(g = { k, d: r.debut, items: [] }); g.items.push(r); });
  const item = (r) => `<li class="item rdv-it ${r.type || "rdv"}"><div class="rdv-time num">${hhmm(r.debut)}<small>${r.duree || 30} min</small></div><div><b>${esc(r.titre)}</b><small>${esc(RDV_TYPES[r.type] || "Rendez-vous")}${rdvLink(r) ? " · " + esc(rdvLink(r)) : ""}${r.lieu ? " · " + esc(r.lieu) : ""}${r.auteur ? " · " + esc(r.auteur) : ""}</small></div><button class="btn sm" type="button" data-rdv="${r.id}">Ouvrir</button></li>`;
  return `<div class="head"><div><h1>Agenda</h1><p>Rendez-vous, appels et visites. Une notification te prévient 1 h avant.</p></div><button class="btn primary" type="button" data-rdvnew>+ Rendez-vous</button></div>
  ${sql4Alert()}
  ${groups.length ? groups.map((g) => `<div class="card agenda-day"><h2>${rdvDay(g.d)}</h2><ul class="list">${g.items.map(item).join("")}</ul></div>`).join("") : `<div class="card empty-state"><b>Aucun rendez-vous prévu</b><p class="note">Ajoute tes appels et visites de prospects : tu recevras un rappel sur ton téléphone.</p><button class="btn primary" type="button" data-rdvnew>Planifier un rendez-vous</button></div>`}
  ${past.length ? `<details class="card past"><summary>Rendez-vous passés (${past.length})</summary><ul class="list">${past.map(item).join("")}</ul></details>` : ""}`;
};
function sheetRdv(id, preset) {
  openSheet(() => (id ? "Rendez-vous" : "Nouveau rendez-vous"), () => {
    const r = id ? byId("rdv", id) : Object.assign({ titre: "", type: "rdv", duree: 30, lieu: "", notes: "", debut: null }, preset || {});
    if (!r) return "<p>Introuvable.</p>";
    let d = r.debut ? new Date(r.debut) : new Date(Date.now() + 86400000); if (!r.debut) d.setHours(10, 0, 0, 0);
    const link = r.prospect_id ? "p:" + r.prospect_id : r.client_id ? "c:" + r.client_id : "";
    const pros = D.prospects.slice().sort((a, b) => a.entreprise.localeCompare(b.entreprise)), cls = D.clients.slice().sort((a, b) => cname(a.id).localeCompare(cname(b.id)));
    return `${sql4Alert()}<div class="fgrid">
      <label class="f full">Titre<input id="rTit" value="${esc(r.titre)}" placeholder="Ex. : Présenter la maquette"></label>
      <label class="f">Type<select id="rType">${Object.entries(RDV_TYPES).map(([k, l]) => `<option value="${k}"${r.type === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="f">Durée<select id="rDur">${[15, 30, 45, 60, 90, 120].map((m) => `<option value="${m}"${+r.duree === m ? " selected" : ""}>${m < 60 ? m + " min" : m / 60 + " h" + (m % 60 ? "30" : "")}</option>`).join("")}</select></label>
      <label class="f">Date<input id="rDate" type="date" value="${iso(d)}"></label>
      <label class="f">Heure<input id="rHeure" type="time" value="${hhmm(d)}"></label>
      <label class="f full">Lieu<input id="rLieu" value="${esc(r.lieu || "")}" placeholder="Adresse, téléphone ou visio"></label>
      <label class="f full">Avec<select id="rLink"><option value="">Personne en particulier</option><optgroup label="Prospects">${pros.map((p) => `<option value="p:${p.id}"${link === "p:" + p.id ? " selected" : ""}>${esc(p.entreprise)}</option>`).join("")}</optgroup><optgroup label="Clients">${cls.map((c) => `<option value="c:${c.id}"${link === "c:" + c.id ? " selected" : ""}>${esc(cname(c.id))}</option>`).join("")}</optgroup></select></label>
      <label class="f full">Notes<textarea id="rNotes">${esc(r.notes || "")}</textarea></label></div>
      <div class="actions" style="margin-top:14px"><button class="btn primary" type="button" data-rdvsave="${id || ""}">Enregistrer</button>${id ? `<button class="btn" type="button" data-rdvics="${id}">Ajouter à mon calendrier</button><button class="btn ghost danger" type="button" data-danger data-rdvdel="${id}">Supprimer</button>` : ""}</div>`;
  });
}
function icsFor(r) {
  const f = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const e = new Date(new Date(r.debut).getTime() + (r.duree || 30) * 60000), x = (t) => String(t || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TissaWeb//Agenda//FR", "BEGIN:VEVENT", "UID:" + r.id + "@tissaweb.fr", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(r.debut), "DTEND:" + f(e), "SUMMARY:" + x(r.titre), r.lieu ? "LOCATION:" + x(r.lieu) : "", "DESCRIPTION:" + x([rdvLink(r), r.notes].filter(Boolean).join("\n")), "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:" + x(r.titre), "END:VALARM", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "rendez-vous.ics"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ----- notes partagées ----- */
VIEWS.notes = function () {
  const n = D.notes.slice().sort((a, b) => (b.epingle - a.epingle) || (a.fait - b.fait) || (new Date(b.created_at) - new Date(a.created_at)));
  const card = (x) => `<div class="note-card${x.epingle ? " pin" : ""}${x.fait ? " done" : ""}"><p>${esc(x.texte)}</p><div class="note-foot"><small>${esc(x.auteur || "")} · ${ago(x.created_at)}</small><div class="note-act"><button type="button" class="icon-btn" data-notepin="${x.id}" title="${x.epingle ? "Désépingler" : "Épingler"}" aria-label="Épingler">${x.epingle ? "📌" : "📍"}</button><button type="button" class="icon-btn" data-notedone="${x.id}" title="${x.fait ? "Rouvrir" : "Marquer comme fait"}" aria-label="Fait">${x.fait ? "↺" : "✓"}</button><button type="button" class="icon-btn" data-danger data-notedel="${x.id}" title="Supprimer" aria-label="Supprimer">✕</button></div></div></div>`;
  return `<div class="head"><div><h1>Notes</h1><p>Un bloc-notes partagé entre ${esc(D.equipe.map((u) => u.nom.split(" ")[0]).join(" et ") || "vous deux")} : idées, choses à faire, numéros utiles.</p></div></div>
  ${sql4Alert()}
  <div class="card note-new"><textarea id="nText" rows="3" placeholder="Écris une note… (Ctrl + Entrée pour l'ajouter)"></textarea><div class="actions"><button class="btn primary" type="button" data-noteadd>Ajouter la note</button></div></div>
  ${n.length ? `<div class="notes-grid">${n.map(card).join("")}</div>` : `<p class="note" style="text-align:center;margin-top:24px">Aucune note pour l'instant.</p>`}`;
};

/* ----- objectifs du mois ----- */
function objectifs() { return Object.assign({ mails: 50, devis: 3, ca: 1500 }, cfg().objectifs || {}); }
function objHTML() {
  const o = objectifs(), mk = monthKey();
  const mails = D.messages.filter((m) => m.direction === "out" && (m.date || "").slice(0, 7) === mk && (m.prospect_id || m.boite === "equipe")).length;
  const devis = D.pieces.filter((p) => mine(p) && p.type === "devis" && (p.date || p.created_at || "").slice(0, 7) === mk).length;
  const ca = D.pieces.filter((p) => mine(p) && p.type === "facture" && p.statut === "payee" && (p.paye_le || "").slice(0, 7) === mk).reduce((s, p) => s + total(p), 0);
  const ring = (v, max, label, fmt) => { const pc = Math.min(100, Math.round((v / Math.max(1, max)) * 100)); return `<div class="goal"><div class="ring" style="--p:${pc}"><span class="num">${pc}%</span></div><div><b class="num">${fmt(v)} <small>/ ${fmt(max)}</small></b><span>${label}</span></div></div>`; };
  const t = today(), rdvs = D.rdv.filter((r) => iso(new Date(r.debut)) === t).sort((a, b) => new Date(a.debut) - new Date(b.debut));
  return `<div class="grid2 even dash">
    <div class="card"><div class="card-h"><h2>Objectifs de ${MOIS[new Date().getMonth()]}</h2><button class="btn ghost sm" type="button" data-objedit>Modifier</button></div><div class="goals">${ring(mails, o.mails, "mails de prospection", (x) => x)}${ring(devis, o.devis, "devis envoyés", (x) => x)}${ring(ca, o.ca, "encaissés", eur0)}</div></div>
    <div class="card"><div class="card-h"><h2>Aujourd'hui</h2><a class="btn ghost sm" href="#agenda">Agenda</a></div>${rdvs.length ? `<ul class="list">${rdvs.map((r) => `<li class="item"><div><b>${hhmm(r.debut)} · ${esc(r.titre)}</b><small>${esc(RDV_TYPES[r.type] || "")}${rdvLink(r) ? " · " + esc(rdvLink(r)) : ""}${r.lieu ? " · " + esc(r.lieu) : ""}</small></div><button class="btn sm" type="button" data-rdv="${r.id}">Ouvrir</button></li>`).join("")}</ul>` : `<p class="note">Aucun rendez-vous aujourd'hui.</p><div class="actions" style="margin-top:10px"><button class="btn sm" type="button" data-rdvnew>+ Planifier</button></div>`}</div>
  </div>`;
}
function sheetObjectifs() {
  openSheet("Objectifs du mois", () => { const o = objectifs(); return `<div class="fgrid">
    <label class="f">Mails de prospection<input id="oMails" type="number" min="1" value="${o.mails}"></label>
    <label class="f">Devis envoyés<input id="oDevis" type="number" min="1" value="${o.devis}"></label>
    <label class="f full">Chiffre encaissé (€)<input id="oCa" type="number" min="0" step="50" value="${o.ca}"></label></div>
    <div class="actions" style="margin-top:14px"><button class="btn primary" type="button" data-objsave>Enregistrer</button></div>`; });
}

/* ----- fiche prospect : actions rapides + historique ----- */
function prospectQuick(p) {
  const tel = (p.tel || "").replace(/[^\d+]/g, ""), q = encodeURIComponent([p.entreprise, p.adresse].filter(Boolean).join(" "));
  return `<div class="quick-row">${tel ? `<a class="btn" href="tel:${tel}">📞 Appeler</a>` : ""}${p.email ? `<a class="btn" href="mailto:${esc(p.email)}">✉️ Mail</a>` : ""}<a class="btn" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">📍 Itinéraire</a><button class="btn" type="button" data-rdvnew data-pid="${p.id}">📅 Planifier un RDV</button></div>`;
}
function msgCourt(p) {
  const me = S.me ? S.me.nom.split(" ")[0] : "Hugo", m = (p.activite || "").toLowerCase();
  const ex = /coiff|barb/.test(m) ? "avec vos prestations, vos prix et la réservation en ligne" : /beaut|institut|esth/.test(m) ? "avec votre carte des soins, vos prix et vos horaires" : /boulang|pâtiss|patiss/.test(m) ? "avec vos produits, vos horaires et les commandes" : "avec vos services, vos horaires et vos avis Google";
  const sms = `Bonjour, je suis ${me} de TissaWeb, à Dijon. On crée des sites internet pour les commerces du coin. J'ai vu ${p.entreprise} sur Google (super avis !) et je peux vous préparer gratuitement une maquette de votre site, ${ex}. Ça vous intéresse ? Bonne journée !`;
  const insta = `Bonjour ${p.entreprise} 👋 Je suis ${me}, on crée des sites internet pour les commerces de Dijon (TissaWeb). J'adore ce que vous faites ! Je peux vous préparer une maquette gratuite de votre site, ${ex}, sans engagement. Je vous l'envoie ? 🙂`;
  return { sms, insta };
}
function prospectShort(p) {
  const m = msgCourt(p), tel = (p.tel || "").replace(/[^\d+]/g, ""), mob = /^(\+33|0)[67]/.test(tel);
  return `<details class="card short-msg"><summary>💬 Message court (SMS / Instagram / Facebook)</summary>
    <label class="f full">SMS<textarea id="msgSms" rows="4">${esc(m.sms)}</textarea></label>
    <div class="actions"><button class="btn sm" type="button" data-copymsg="msgSms">Copier</button>${mob ? `<a class="btn sm primary" href="sms:${tel}?&body=${encodeURIComponent(m.sms)}">Envoyer le SMS</a>` : `<span class="note">Numéro fixe : copie le message pour Instagram ou Facebook.</span>`}</div>
    <label class="f full" style="margin-top:12px">Instagram / Facebook<textarea id="msgInsta" rows="4">${esc(m.insta)}</textarea></label>
    <div class="actions"><button class="btn sm" type="button" data-copymsg="msgInsta">Copier</button><a class="btn sm" href="https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(p.entreprise + " Dijon")}" target="_blank" rel="noopener">Chercher sur Instagram</a><a class="btn sm" href="https://www.facebook.com/search/pages/?q=${encodeURIComponent(p.entreprise + " Dijon")}" target="_blank" rel="noopener">Chercher sur Facebook</a></div>
    <p class="note" style="margin-top:8px">Une fois le mail récupéré, colle-le dans la fiche pour passer aux mails automatiques.</p></details>`;
}
function prospectHistory(p) {
  const ev = [];
  D.journal.filter((j) => j.prospect_id === p.id).forEach((j) => ev.push({ d: j.created_at, t: j.texte, a: j.auteur, k: j.type === "note" ? "note" : "log" }));
  if (p.email) { const e = p.email.toLowerCase(); D.messages.filter((m) => (m.from_email || "").toLowerCase() === e || (m.to_email || "").toLowerCase() === e).forEach((m) => ev.push({ d: m.date, t: (m.direction === "in" ? "Mail reçu : " : "Mail envoyé : ") + (m.subject || ""), a: m.direction === "out" ? m.auteur : "", k: m.direction === "in" ? "in" : "out", email: e })); }
  D.rdv.filter((r) => r.prospect_id === p.id).forEach((r) => ev.push({ d: r.debut, t: `${RDV_TYPES[r.type] || "RDV"} : ${r.titre} (${frDate(iso(new Date(r.debut)))} à ${hhmm(r.debut)})`, k: "rdv", rid: r.id }));
  ev.sort((a, b) => new Date(b.d) - new Date(a.d));
  const ico = { note: "📝", log: "•", in: "📩", out: "📤", rdv: "📅" };
  return `<div class="card"><h2>Historique</h2>
    <div class="hist-new"><textarea id="prNote" rows="2" placeholder="Ex. : passé en boutique, rappeler jeudi, intéressé par la prise de RDV…"></textarea><button class="btn" type="button" data-prnote="${p.id}">Ajouter</button></div>
    ${ev.length ? `<ul class="timeline hist">${ev.map((x) => `<li><time>${ago(x.d)}</time><div>${ico[x.k] || "•"} ${esc(x.t)}${x.a ? ` <small class="note">· ${esc(x.a)}</small>` : ""}${x.email ? ` <button class="linkbtn" type="button" data-conv="${esc(x.email)}">voir</button>` : ""}${x.rid ? ` <button class="linkbtn" type="button" data-rdv="${x.rid}">ouvrir</button>` : ""}</div></li>`).join("")}</ul>` : `<p class="note">Rien pour l'instant : les mails, rendez-vous et notes s'afficheront ici.</p>`}</div>`;
}

/* ----- réglages : site + sauvegarde ----- */
function reglagesExtra() {
  const n = D.pub ? +D.pub.places_restantes : 5;
  return `<div class="grid2 even" style="margin-top:16px">
    <div class="card"><h2>Site internet</h2><p class="note" style="margin-bottom:12px">Nombre de places encore disponibles à −30 %. Le compteur s'affiche sur tissaweb.fr (à 0, il disparaît).</p>
      <div class="fgrid"><label class="f">Places restantes<input id="sPlaces" type="number" min="0" max="20" value="${isNaN(n) ? 5 : n}"></label></div>
      <div class="actions" style="margin-top:12px"><button class="btn" type="button" data-placessave>Mettre à jour le site</button></div></div>
    <div class="card"><h2>Sauvegarde</h2><p class="note" style="margin-bottom:12px">Télécharge toutes vos données (clients, prospects, devis, factures, agenda, notes, mails) dans un fichier Excel. Pratique pour garder une copie ou pour ton comptable.</p>
      <div class="actions"><button class="btn" type="button" data-export>⬇️ Télécharger en Excel</button></div></div>
  </div>`;
}
function loadScript(src) { return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko(new Error("Chargement impossible")); document.head.appendChild(s); }); }
async function exportExcel(btn) {
  btn.disabled = true; const l = btn.textContent; btn.textContent = "Préparation…";
  try {
    if (!window.writeXlsxFile) await loadScript("vendor/write-excel-file.min.js");
    const sheets = [];
    const cell = (v) => (v == null || v === "" ? null : typeof v === "number" ? v : String(v));
    const add = (name, rows) => { rows = rows.length ? rows : [{ "(vide)": "" }]; const cols = Object.keys(rows[0]); sheets.push({ sheet: name.slice(0, 31), data: [cols.map((c) => ({ value: c, fontWeight: "bold" })), ...rows.map((r) => cols.map((c) => { const v = cell(r[c]); return v == null ? null : { value: v }; }))], stickyRowsCount: 1 }); };
    add("Clients", D.clients.map((c) => ({ Nom: c.nom, Entreprise: c.entreprise, Email: c.email, Téléphone: c.tel, Adresse: c.adresse, SIREN: c.siren, Activité: c.activite, Notes: c.notes, Créé: sDate(c.created_at) })));
    add("Prospects", D.prospects.map((p) => ({ Commerce: p.entreprise, Activité: p.activite, Statut: (PSTAT[p.statut] || [p.statut])[0], Email: p.email, Téléphone: p.tel, Adresse: p.adresse, "Mails envoyés": p.nb_contacts || 0, "Dernier contact": sDate(p.dernier_contact), "Prochaine relance": sDate(p.prochaine_action), Notes: p.notes })));
    add("Demandes", D.demandes.map((d) => ({ Date: sDate(d.created_at), Nom: d.nom, Email: d.email, Téléphone: d.telephone, Activité: d.activite, Offre: d.offre, Message: d.message, Statut: (DSTAT[d.statut] || [d.statut])[0] })));
    add("Devis et factures", D.pieces.map((p) => ({ Numéro: p.numero, Type: kindLabel(p), Client: cname(p.client_id), Date: sDate(p.date), "Montant (€)": Math.round(total(p) * 100) / 100, Statut: pState(p).l, Échéance: sDate(p.echeance), "Payée le": sDate(p.paye_le), Émetteur: p.emetteur })));
    add("Projets", D.projets.map((p) => ({ Projet: p.titre, Client: cname(p.client_id), Statut: p.statut, "Livraison prévue": sDate(p.date_prevue), Site: p.url_site })));
    add("Maintenance", D.abonnements.map((a) => ({ Client: cname(a.client_id), "Montant (€/mois)": a.montant, Actif: a.actif ? "oui" : "non" })));
    add("Agenda", D.rdv.map((r) => ({ Date: sDate(r.debut), Heure: hhmm(r.debut), Titre: r.titre, Type: RDV_TYPES[r.type] || r.type, Avec: rdvLink(r), Lieu: r.lieu, Notes: r.notes })));
    add("Notes", D.notes.map((n) => ({ Date: sDate(n.created_at), Auteur: n.auteur, Note: n.texte, Fait: n.fait ? "oui" : "non" })));
    add("Mails", D.messages.map((m) => ({ Date: sDate(m.date), Sens: m.direction === "in" ? "reçu" : "envoyé", De: m.from_email, À: m.to_email, Objet: m.subject })));
    await window.writeXlsxFile(sheets).toFile(`TissaWeb-sauvegarde-${today()}.xlsx`); toast("Sauvegarde téléchargée");
  } catch (e) { toast("Export impossible : " + (e.message || e)); }
  btn.disabled = false; btn.textContent = l;
}

/* ----- actions ----- */
document.addEventListener("keydown", (e) => { if (e.target.id === "nText" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const b = document.querySelector("[data-noteadd]"); if (b) b.click(); } });
document.addEventListener("click", async (ev) => {
  const cm = ev.target.closest("[data-copymsg]"); if (cm) { const ta = $(cm.dataset.copymsg); if (ta) copy(ta.value, ta); return; }
  const t = ev.target.closest("[data-rdvnew],[data-rdv],[data-rdvsave],[data-rdvdel],[data-rdvics],[data-noteadd],[data-notepin],[data-notedone],[data-notedel],[data-objedit],[data-objsave],[data-placessave],[data-export],[data-prnote]");
  if (!t || (t.hasAttribute("data-danger") && !t.dataset.armed)) return;
  const me = S.me ? S.me.nom.split(" ")[0] : "";
  if (t.hasAttribute("data-rdvnew")) { const pid = t.dataset.pid; sheetRdv(null, pid ? { prospect_id: pid, titre: "RDV " + ((byId("prospects", pid) || {}).entreprise || ""), lieu: (byId("prospects", pid) || {}).adresse || "" } : null); return; }
  if (t.hasAttribute("data-rdvsave")) {
    const id = t.dataset.rdvsave, titre = $("rTit").value.trim(); if (!titre) return toast("Donne un titre au rendez-vous");
    if (!$("rDate").value || !$("rHeure").value) return toast("Choisis la date et l'heure");
    const debut = new Date($("rDate").value + "T" + $("rHeure").value).toISOString(), lk = $("rLink").value;
    const row = { titre, type: $("rType").value, duree: +$("rDur").value, debut, lieu: $("rLieu").value.trim() || null, notes: $("rNotes").value.trim() || null, prospect_id: lk.startsWith("p:") ? lk.slice(2) : null, client_id: lk.startsWith("c:") ? lk.slice(2) : null };
    if (id) { const old = byId("rdv", id); if (old && old.debut !== debut) row.rappel_envoye = false; await upd("rdv", id, row); }
    else { row.auteur = me; const r = await ins("rdv", row); if (r && row.prospect_id) log("rdv", `RDV planifié : ${titre}`, { prospect_id: row.prospect_id }); }
    toast("Rendez-vous enregistré"); closeSheet(); rerender(); return;
  }
  if (t.dataset.rdv) { sheetRdv(t.dataset.rdv); return; }
  if (t.dataset.rdvics) { const r = byId("rdv", t.dataset.rdvics); if (r) icsFor(r); return; }
  if (t.dataset.rdvdel) { await del("rdv", t.dataset.rdvdel); toast("Rendez-vous supprimé"); closeSheet(); rerender(); return; }
  if (t.hasAttribute("data-noteadd")) { const v = $("nText").value.trim(); if (!v) return; await ins("notes", { texte: v, auteur: me }); rerender(); const n = $("nText"); if (n) n.focus(); return; }
  if (t.dataset.notepin) { const n = byId("notes", t.dataset.notepin); if (n) { await upd("notes", n.id, { epingle: !n.epingle }); rerender(); } return; }
  if (t.dataset.notedone) { const n = byId("notes", t.dataset.notedone); if (n) { await upd("notes", n.id, { fait: !n.fait }); rerender(); } return; }
  if (t.dataset.notedel) { await del("notes", t.dataset.notedel); rerender(); return; }
  if (t.hasAttribute("data-objedit")) { sheetObjectifs(); return; }
  if (t.hasAttribute("data-objsave")) { const o = { mails: Math.max(1, +$("oMails").value || 1), devis: Math.max(1, +$("oDevis").value || 1), ca: Math.max(0, +$("oCa").value || 0) }; await saveCfg(Object.assign({}, D.config.data || {}, { objectifs: o })); toast("Objectifs enregistrés"); closeSheet(); rerender(); return; }
  if (t.hasAttribute("data-placessave")) { const n = Math.max(0, Math.min(20, parseInt($("sPlaces").value, 10) || 0)); const { data, error } = await sb.from("config").upsert({ id: "public", data: Object.assign({}, D.pub || {}, { places_restantes: n }) }).select().single(); if (error) return dbErr(error); D.pub = data.data; toast(n ? `Le site affiche : plus que ${n} place${n > 1 ? "s" : ""}` : "Compteur retiré du site"); return; }
  if (t.hasAttribute("data-export")) { exportExcel(t); return; }
  if (t.dataset.prnote) { const v = $("prNote").value.trim(); if (!v) return; await log("note", v, { prospect_id: t.dataset.prnote }); const j = D.journal; if (!j.some((x) => x.texte === v && x.prospect_id === t.dataset.prnote)) j.unshift({ created_at: new Date().toISOString(), texte: v, auteur: me, type: "note", prospect_id: t.dataset.prnote }); rerender(); return; }
});
function extraRealtime() {
  try {
    ["notes", "rdv"].forEach((tb) => sb.channel("tw-" + tb).on("postgres_changes", { event: "*", schema: "public", table: tb }, (p) => {
      const arr = D[tb]; if (p.eventType === "DELETE") D[tb] = arr.filter((x) => x.id !== p.old.id);
      else { const i = arr.findIndex((x) => x.id === p.new.id); if (i >= 0) arr[i] = p.new; else arr.unshift(p.new); }
      if ($("sheet").hidden) render(); else setBadges();
    }).subscribe());
  } catch (e) { console.warn(e); }
}

/* ================= statistiques du site ================= */
async function loadStats(days) {
  S.statsLoading = true;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await sb.from("visites").select("created_at,event,page,source,ref,lang,device,session").gte("created_at", since).order("created_at", { ascending: true }).limit(50000);
  S.statsLoading = false;
  S.stats = { days, rows: error ? [] : data || [], err: error ? (error.message || "erreur") : null, at: Date.now() };
  if (S.view === "stats") render();
}
VIEWS.stats = function () {
  const days = (S.stats && S.stats.days) || 30;
  if (!S.stats || S.stats.days !== days || Date.now() - S.stats.at > 120000) { if (!S.statsLoading) loadStats(days); }
  const head = `<div class="head"><div><h1>Statistiques du site</h1><p>Visites de tissaweb.fr, sans cookie ni donnée personnelle. Tes propres visites ne sont pas comptées.</p></div>
    <div class="seg-light" role="group" aria-label="Période">${[7, 30, 90].map((d) => `<button type="button" data-statdays="${d}" aria-pressed="${d === days}">${d} jours</button>`).join("")}</div></div>`;
  if (!S.stats) return head + `<div class="card"><p class="note">Chargement…</p></div>`;
  if (S.stats.err) return head + `<p class="alert warn">Pour activer les statistiques, lance une fois <b>code-supabase-etape5.txt</b> dans Supabase (SQL Editor → Run).</p>`;
  const R = S.stats.rows, views = R.filter((r) => r.event === "view"), ses = new Set(views.map((r) => r.session)), cnt = (e) => new Set(R.filter((r) => r.event === e).map((r) => r.session)).size;
  const forms = cnt("form"), conv = ses.size ? ((forms / ses.size) * 100).toFixed(1).replace(".", ",") : "0";
  // visiteurs par jour
  const byDay = []; for (let i = days - 1; i >= 0; i--) { const d = iso(new Date(Date.now() - i * 86400000)); byDay.push({ d, s: new Set() }); }
  views.forEach((r) => { const k = iso(new Date(r.created_at)), b = byDay.find((x) => x.d === k); if (b) b.s.add(r.session); });
  const max = Math.max(1, ...byDay.map((b) => b.s.size));
  const bars = byDay.map((b) => `<div class="sbar" title="${sDate(b.d)} : ${b.s.size} visiteur(s)"><i style="height:${b.s.size ? Math.max(4, Math.round((b.s.size / max) * 100)) : 0}%"></i></div>`).join("");
  const top = (key, list, label) => { const m = {}; list.forEach((r) => { const k = label ? label(r[key]) : r[key] || "?"; m[k] = (m[k] || new Set()).add(r.session); }); const arr = Object.entries(m).map(([k, s]) => [k, s.size]).sort((a, b) => b[1] - a[1]).slice(0, 8); const t = Math.max(1, ...arr.map((a) => a[1])); return arr.length ? arr.map(([k, n]) => `<div class="fn"><span>${esc(k)}</span><div class="fbar"><i style="width:${Math.round((n / t) * 100)}%"></i></div><b class="num">${n}</b></div>`).join("") : `<p class="note">Pas encore de données.</p>`; };
  const pageName = (p) => ({ "/": "Accueil", "/index.html": "Accueil", "/merci.html": "Merci (demande envoyée)", "/404.html": "Page introuvable" })[p] || (p || "").replace(/^\/demo-(.*)\.html$/, "Démo $1").replace(/^\//, "");
  const langName = (l) => ({ fr: "Français", en: "Anglais", es: "Espagnol", pt: "Portugais", de: "Allemand", it: "Italien", ar: "Arabe", zh: "Chinois" })[l] || l || "?";
  const srcName = (s) => ({ direct: "Direct (lien ou adresse tapée)" })[s] || s;
  const pv = views.length, pps = ses.size ? (pv / ses.size).toFixed(1).replace(".", ",") : "0";
  return head + `
  <div class="kpis">
    <div class="kpi"><span>Visiteurs</span><b class="num">${ses.size}</b><span>sur ${days} jours</span></div>
    <div class="kpi"><span>Pages vues</span><b class="num">${pv}</b><span>${pps} page(s) par visite</span></div>
    <div class="kpi"><span>Demandes envoyées</span><b class="num">${forms}</b><span>${conv} % des visiteurs</span></div>
    <div class="kpi"><span>Intérêt</span><b class="num">${cnt("sim") + cnt("chat")}</b><span>${cnt("sim")} simulateur · ${cnt("chat")} assistant · ${cnt("demo")} démos</span></div>
  </div>
  <div class="card dash"><div class="card-h"><h2>Visiteurs par jour</h2><span class="note">max ${max}</span></div><div class="sbars" style="--n:${days}">${bars}</div><div class="sbar-l"><span>${sDate(byDay[0].d)}</span><span>aujourd'hui</span></div></div>
  <div class="grid2 even dash">
    <div class="card"><div class="card-h"><h2>D'où viennent-ils ?</h2></div><div class="funnel">${top("source", views, srcName)}</div></div>
    <div class="card"><div class="card-h"><h2>Pages les plus vues</h2></div><div class="funnel">${top("page", views, pageName)}</div></div>
  </div>
  <div class="grid2 even dash">
    <div class="card"><div class="card-h"><h2>Appareils</h2></div><div class="funnel">${top("device", views)}</div></div>
    <div class="card"><div class="card-h"><h2>Langues</h2></div><div class="funnel">${top("lang", views, langName)}</div></div>
  </div>
  <p class="note">💡 Astuce : ajoute <code>?utm_source=instagram</code> (ou flyer, carte, sms…) à la fin de tes liens tissaweb.fr pour savoir exactement ce qui t'amène des visiteurs.</p>`;
};
document.addEventListener("click", (e) => { const b = e.target.closest("[data-statdays]"); if (!b) return; const d = +b.dataset.statdays; S.stats = Object.assign({}, S.stats || {}, { days: d, at: 0 }); loadStats(d); render(); });

/* ================= tableau de bord : graphiques ================= */
function dashCharts() {
  const now = new Date(), months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), l: MOIS[d.getMonth()].slice(0, 4) + (MOIS[d.getMonth()].length > 4 ? "." : "") }); }
  const list = D.pieces.filter(mine);
  months.forEach((m) => {
    m.enc = list.filter((p) => p.type === "facture" && p.statut === "payee" && (p.paye_le || "").slice(0, 7) === m.k).reduce((a, p) => a + total(p), 0);
    m.dev = list.filter((p) => p.type === "devis" && (p.date || p.created_at || "").slice(0, 7) === m.k).length;
  });
  const max = Math.max(1, ...months.map((m) => m.enc)), sum = months.reduce((a, m) => a + m.enc, 0);
  const bars = months.map((m, i) => `<div class="bar${i === 5 ? " now" : ""}" title="${m.l} : ${eur0(m.enc)}"><span class="v num">${m.enc ? eur0(m.enc) : ""}</span><i style="height:${Math.max(3, Math.round((m.enc / max) * 100))}%"></i><span class="l">${m.l}</span></div>`).join("");
  const P = D.prospects, c = (k) => P.filter((p) => p.statut === k).length;
  const touched = P.length - c("a_contacter"), rep = c("interesse") + c("client") + c("pas_interesse");
  const steps = [["Prospects", P.length], ["Contactés", touched], ["Ont répondu", rep], ["Intéressés", c("interesse") + c("client")], ["Clients", c("client")]];
  const top = Math.max(1, steps[0][1]);
  const funnel = steps.map(([l, n]) => `<div class="fn"><span>${l}</span><div class="fbar"><i style="width:${Math.max(n ? 4 : 0, Math.round((n / top) * 100))}%"></i></div><b class="num">${n}</b></div>`).join("");
  const taux = touched ? Math.round((rep / touched) * 100) : 0;
  return `<div class="grid2 even dash">
    <div class="card"><div class="card-h"><h2>Encaissé sur 6 mois</h2><span class="note num">${eur0(sum)}</span></div><div class="bars">${bars}</div></div>
    <div class="card"><div class="card-h"><h2>Prospection</h2><span class="note">${touched ? `${taux} % de réponses` : "Pas encore de mails envoyés"}</span></div><div class="funnel">${funnel}</div></div>
  </div>`;
}

/* ================= recherche globale (Ctrl+K) ================= */
function norm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function searchAll(q) {
  q = norm(q).trim(); if (q.length < 2) return [];
  const hit = (...f) => f.some((x) => norm(x).includes(q)), out = [];
  D.clients.forEach((c) => { if (hit(c.nom, c.entreprise, c.email, c.tel, c.activite)) out.push({ k: "Client", t: c.entreprise || c.nom, s: [c.nom, c.email].filter(Boolean).join(" · "), go: () => { location.hash = "#client/" + c.id; } }); });
  D.prospects.forEach((p) => { if (hit(p.entreprise, p.contact, p.email, p.activite, p.adresse)) out.push({ k: "Prospect", t: p.entreprise, s: [(PSTAT[p.statut] || [""])[0], p.activite].filter(Boolean).join(" · "), go: () => sheetProspect(p.id) }); });
  D.demandes.forEach((d) => { if (hit(d.nom, d.email, d.activite, d.message)) out.push({ k: "Demande", t: d.nom, s: [d.activite, ago(d.created_at)].filter(Boolean).join(" · "), go: () => sheetDemande(d.id) }); });
  D.pieces.forEach((p) => { if (hit(p.numero, cname(p.client_id), ...(p.lignes || []).map((l) => l.desc))) out.push({ k: p.type === "devis" ? "Devis" : "Facture", t: `${p.numero} · ${cname(p.client_id)}`, s: `${eur(total(p))} · ${pState(p).l || ""}`, go: () => sheetPiece(p.id) }); });
  D.projets.forEach((pj) => { if (hit(pj.titre, cname(pj.client_id))) out.push({ k: "Projet", t: pj.titre, s: cname(pj.client_id), go: () => sheetProjet(pj.id) }); });
  const seen = new Set();
  D.messages.forEach((m) => { const e = peerOf(m); if (seen.has(e)) return; if (hit(m.subject, m.from_name, e, (m.body || "").slice(0, 400))) { seen.add(e); out.push({ k: "Mail", t: m.subject || "(sans objet)", s: nameFor(e, m) + " · " + ago(m.date), go: () => sheetConversation(e) }); } });
  D.rdv.forEach((r) => { if (hit(r.titre, r.lieu, r.notes, rdvLink(r))) out.push({ k: "Agenda", t: r.titre, s: `${rdvDay(r.debut)} à ${hhmm(r.debut)}`, go: () => sheetRdv(r.id) }); });
  D.notes.forEach((n) => { if (hit(n.texte)) out.push({ k: "Note", t: n.texte.slice(0, 70), s: (n.auteur || "") + " · " + ago(n.created_at), go: () => { location.hash = "#notes"; } }); });
  return out.slice(0, 30);
}
function openSearch() {
  const el = $("palette"); el.hidden = false; const i = $("palQ"); i.value = ""; S.palSel = 0; drawSearch(); setTimeout(() => i.focus(), 10);
}
function closeSearch() { $("palette").hidden = true; }
function drawSearch() {
  const q = $("palQ").value, r = searchAll(q); S.palRes = r; S.palSel = Math.min(S.palSel || 0, Math.max(0, r.length - 1));
  $("palList").innerHTML = q.trim().length < 2
    ? `<p class="pal-empty">Tape un nom, une entreprise, un mail, un numéro de facture…</p>`
    : r.length ? r.map((x, i) => `<button type="button" class="pal-it${i === S.palSel ? " sel" : ""}" data-pal="${i}"><span class="pal-k">${x.k}</span><span class="pal-t"><b>${esc(x.t)}</b><small>${esc(x.s || "")}</small></span></button>`).join("")
    : `<p class="pal-empty">Aucun résultat pour « ${esc(q)} »</p>`;
}
function pickSearch(i) { const x = (S.palRes || [])[i]; if (!x) return; closeSearch(); x.go(); }
document.addEventListener("keydown", (e) => {
  const pal = $("palette");
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (!$("app").hidden) pal.hidden ? openSearch() : closeSearch(); return; }
  if (pal && !pal.hidden) {
    if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = (S.palRes || []).length; if (n) { S.palSel = (S.palSel + (e.key === "ArrowDown" ? 1 : n - 1)) % n; drawSearch(); const s = document.querySelector(".pal-it.sel"); if (s) s.scrollIntoView({ block: "nearest" }); } }
    else if (e.key === "Enter") { e.preventDefault(); pickSearch(S.palSel || 0); }
  }
});
document.addEventListener("input", (e) => { if (e.target.id === "palQ") { S.palSel = 0; drawSearch(); } });
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-search],[data-pal],#palette");
  if (!t) return;
  if (t.matches("[data-search]")) { openSearch(); return; }
  if (t.matches("[data-pal]")) { pickSearch(+t.dataset.pal); return; }
  if (t.id === "palette" && e.target === t) closeSearch();
});

/* ================= thème clair / sombre ================= */
function applyTheme(t) {
  const sys = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = t === "dark" || (t !== "light" && sys);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const b = $("themeBtn"); if (b) b.textContent = dark ? "☀️ Mode clair" : "🌙 Mode sombre";
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = "#0C1310";
}
function themePref() { try { return localStorage.getItem("tw-theme") || "auto"; } catch (e) { return "auto"; } }
applyTheme(themePref());
if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(themePref()));
document.addEventListener("click", (e) => { if (e.target.id !== "themeBtn") return; const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; try { localStorage.setItem("tw-theme", next); } catch (er) {} applyTheme(next); });

/* ================= connexion ================= */
let recovery = false;
function showLogin(msg) { $("boot").hidden = true; $("app").hidden = true; $("login").hidden = false; if (msg) { $("lErr").textContent = msg; $("lErr").hidden = false; } }
function loginMode(mode) {
  recovery = mode === "new";
  $("lfPass").hidden = mode !== "login"; $("lfNew").hidden = mode !== "new"; $("lfMail").hidden = mode === "new";
  $("loginTitle").textContent = mode === "new" ? "Nouveau mot de passe" : mode === "forgot" ? "Mot de passe oublié" : "Espace équipe";
  $("lGo").textContent = mode === "new" ? "Enregistrer le mot de passe" : mode === "forgot" ? "Recevoir le lien" : "Se connecter";
  $("lForgot").textContent = mode === "login" ? "Mot de passe oublié ?" : "Retour à la connexion";
  $("loginForm").dataset.mode = mode; $("lErr").hidden = true; $("lOk").hidden = true;
}
$("lForgot").onclick = () => loginMode($("loginForm").dataset.mode === "login" ? "forgot" : "login");
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const mode = $("loginForm").dataset.mode || "login"; $("lErr").hidden = true; $("lGo").disabled = true;
  try {
    if (mode === "login") { const { error } = await sb.auth.signInWithPassword({ email: $("lMail").value.trim(), password: $("lPass").value }); if (error) throw new Error("Adresse ou mot de passe incorrect."); await start(); }
    else if (mode === "forgot") { const { error } = await sb.auth.resetPasswordForEmail($("lMail").value.trim(), { redirectTo: location.origin + location.pathname }); if (error) throw error; $("lOk").textContent = "Si cette adresse est dans l'équipe, un lien vient de partir par mail."; $("lOk").hidden = false; }
    else { if ($("lNew").value.length < 8) throw new Error("8 caractères minimum."); const { error } = await sb.auth.updateUser({ password: $("lNew").value }); if (error) throw error; toast("Mot de passe enregistré"); await start(); }
  } catch (err) { $("lErr").textContent = err.message || "Erreur"; $("lErr").hidden = false; }
  $("lGo").disabled = false;
});

async function start() {
  const { data } = await sb.auth.getSession(); const ses = data.session;
  if (!ses || recovery) { loginMode(recovery ? "new" : "login"); return showLogin(); }
  try { await loadAll(); } catch (e) { console.error(e); return showLogin("Connexion à la base impossible : " + (e.message || "")); }
  const mail = (ses.user.email || "").toLowerCase();
  S.me = D.equipe.find((u) => u.email.toLowerCase() === mail);
  if (!S.me) { await sb.auth.signOut(); loginMode("login"); return showLogin("Ce compte n'a pas accès à l'appli TissaWeb."); }
  $("meLine").textContent = "Connecté : " + S.me.nom;
  try { localStorage.setItem("tw-admin", "1"); } catch (e) {} // tes visites sur tissaweb.fr ne sont pas comptées
  // SIREN de Hugo reçu le 20/10/2026 : on le reporte une fois dans les réglages enregistrés s'ils sont vides
  try { const cd = Object.assign({}, D.config.data || {}), es = Object.assign({}, cd.emetteurs || {}), h = Object.assign({}, DEF_CFG.emetteurs.hugo, es.hugo || {});
    const digits = String(h.siret || "").replace(/\D/g, "");
    if (digits.length !== 14 || !h.adresse || !h.tel) { if (digits.length !== 14) h.siret = "13178802800010"; h.adresse = h.adresse || "8 rue Docteur Parizot\n21000 Dijon"; h.tel = h.tel || "06 40 38 50 45"; es.hugo = h; cd.emetteurs = es; await saveCfg(cd); }
    const l = Object.assign({}, DEF_CFG.emetteurs.lucas, es.lucas || {});
    if (!l.siret || !l.adresse) { l.siret = l.siret || "131829095"; l.adresse = l.adresse || "6 rue Catherine Sauvage\n21800 Chevigny-Saint-Sauveur"; es.lucas = l; cd.emetteurs = es; await saveCfg(cd); } } catch (e) { console.warn(e); }
  try { const w = localStorage.getItem("tw-who"); if (w) { S.who = w; document.querySelectorAll("[data-who]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.who === w ? "true" : "false")); } } catch (e) {}
  $("boot").hidden = true; $("login").hidden = true; $("app").hidden = false;
  route();
  try { await abonnementsDuMois(); render(); } catch (e) {}
  // temps réel
  sb.channel("tw").on("postgres_changes", { event: "*", schema: "public", table: "demandes" }, (p) => {
    if (p.eventType === "INSERT") { if (!D.demandes.some((d) => d.id === p.new.id)) D.demandes.unshift(p.new); toast("Nouvelle demande : " + p.new.nom); if (appAway()) localNotify("Nouvelle demande : " + p.new.nom, [p.new.activite, p.new.offre].filter(Boolean).join(" · ") || "Depuis tissaweb.fr", "demande", "#demandes"); }
    else if (p.eventType === "UPDATE") { const i = D.demandes.findIndex((d) => d.id === p.new.id); if (i >= 0) D.demandes[i] = p.new; }
    else if (p.eventType === "DELETE") D.demandes = D.demandes.filter((d) => d.id !== p.old.id);
    rerender();
  }).on("postgres_changes", { event: "*", schema: "public", table: "pieces" }, (p) => {
    if (p.eventType === "DELETE") D.pieces = D.pieces.filter((d) => d.id !== p.old.id);
    else { const i = D.pieces.findIndex((d) => d.id === p.new.id); if (i >= 0) D.pieces[i] = p.new; else D.pieces.unshift(p.new); }
    rerender();
  }).subscribe();
  extraRealtime();
  sb.channel("tw-msg").on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
    if (p.eventType === "DELETE") D.messages = D.messages.filter((d) => d.id !== p.old.id);
    else { const i = D.messages.findIndex((d) => d.id === p.new.id); if (i >= 0) D.messages[i] = p.new; else { D.messages.unshift(p.new); if (p.new.direction === "in") { toast("Nouveau mail : " + (p.new.from_name || p.new.from_email)); if (appAway()) localNotify("Nouveau mail : " + (p.new.from_name || p.new.from_email), p.new.subject || "", "mail", "#messages"); } } }
    rerender();
  }).subscribe();
  syncMail(); setInterval(() => { if (!document.hidden) syncMail(); }, 120000);
  registerSW();
  // rafraîchit tout au retour sur l'appli
  document.addEventListener("visibilitychange", async () => { if (!document.hidden) { try { await loadAll(); rerender(); } catch (e) {} } });
}

/* ================= démarrage ================= */
(function boot() {
  const C = window.TW_CONFIG || {};
  if (!C.url || !C.key || /XXXX/.test(C.url)) { $("boot").hidden = true; $("setup").hidden = false; return; }
  if (!window.supabase) { $("boot").innerHTML = "<p>Impossible de charger l'appli. Vérifie ta connexion internet et recharge la page.</p>"; return; }
  sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  sb.auth.onAuthStateChange((evt) => { if (evt === "PASSWORD_RECOVERY") { recovery = true; loginMode("new"); showLogin(); } });
  loginMode("login");
  setTimeout(start, 50);
})();
})();
