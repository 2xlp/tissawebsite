// TissaWeb — appli TissAlternance (tissaweb.fr/alternance)
// POST ?action=info                → fonctions actives
// POST ?action=search              { source: "lba"|"sirene", secteur, ville, zone, q?, page? }
//   lba    : La bonne alternance (offres d'alternance + entreprises à fort potentiel d'embauche en alternance), clé LBA_API_KEY
//   sirene : annuaire Recherche d'entreprises (toutes les entreprises de 3 salariés et plus)
// POST ?action=postuler            candidature transmise au recruteur par La bonne alternance (LBA_API_KEY + LBA_APPLY=1)
// POST ?action=code / verif        vérification de l'adresse de l'étudiant (code à 6 chiffres)
// POST ?action=envoyer             envoi depuis candidatures@tissaweb.fr au nom de l'étudiant, réponse vers l'étudiant (ALT_SMTP_PASSWORD)
// POST ?action=annuler             annule une relance prévue
// POST ?action=relances            (cron, x-cron-secret) envoie les relances arrivées à échéance + purge > 30 j
// POST ?action=rediger             rédaction IA si ANTHROPIC_API_KEY
// POST ?action=gconnect            { code } : connexion Gmail de l'étudiant (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) → jeton
// POST ?action=gdeconnect          { jeton } : supprime la connexion Gmail
// POST ?action=pass               { session_id } : vérifie un paiement Stripe Checkout → jeton de Pass (essentiel | pro)
// POST ?action=restaurer          { email } : retrouve le Pass acheté avec cette adresse
// Pass actif seulement si STRIPE_SECRET_KEY + STRIPE_LINK_ESSENTIEL + STRIPE_LINK_PRO. Sans Pass : 3 envois auto par mois (Gmail / candidatures@).
// Si l'étudiant a connecté Gmail, « envoyer » et les relances partent de SA boîte (API Gmail, droit gmail.send uniquement).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

const ORIGINS = ["https://tissaweb.fr"];
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o && ORIGINS.includes(o) ? o : ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const env = (k: string) => Deno.env.get(k) || "";
const LBA = "https://api.apprentissage.beta.gouv.fr/api";
const SMTP_USER = () => env("ALT_SMTP_USER") || "candidatures@tissaweb.fr";
const GREDIRECT = "https://tissaweb.fr/alternance/google.html";
const gmailOn = () => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET") && env("CRON_SECRET"));
const smtpOn = () => !!env("ALT_SMTP_PASSWORD");
const payOn = () => !!(env("STRIPE_SECRET_KEY") && env("STRIPE_LINK_ESSENTIEL") && env("STRIPE_LINK_PRO") && env("CRON_SECRET"));
const FREE_ENVOIS = 3;

const EFFECTIFS: Record<string, string> = {
  "02": "3 à 5 salariés", "03": "6 à 9 salariés", "11": "10 à 19 salariés", "12": "20 à 49 salariés",
  "21": "50 à 99 salariés", "22": "100 à 199 salariés", "31": "200 à 249 salariés", "32": "250 à 499 salariés",
  "41": "500 à 999 salariés", "42": "1 000 à 1 999 salariés", "51": "2 000 à 4 999 salariés", "52": "5 000 à 9 999 salariés", "53": "10 000 salariés et plus",
};

type Secteur = { naf?: Record<string, string>; section?: string; label: string; romes?: string[] };
const SECTEURS: Record<string, Secteur> = {
  commerce: { label: "Commerce / vente", section: "G", romes: ["D1106", "D1211", "D1212", "D1214", "D1301", "D1401", "D1402", "D1403", "D1501", "D1505", "D1507"] },
  informatique: { label: "Informatique / développement", romes: ["M1805", "M1801", "M1802", "M1810", "I1401", "E1205"], naf: { "62.01Z": "Programmation informatique", "62.02A": "Conseil en systèmes informatiques", "62.02B": "Maintenance de systèmes informatiques", "62.03Z": "Gestion d'installations informatiques", "62.09Z": "Services informatiques", "63.11Z": "Hébergement et traitement de données", "63.12Z": "Portails internet", "58.29C": "Édition de logiciels" } },
  marketing: { label: "Marketing / communication", romes: ["E1103", "M1705", "E1401", "E1205", "M1707"], naf: { "73.11Z": "Agence de publicité", "73.12Z": "Régie publicitaire", "70.21Z": "Conseil en communication", "74.10Z": "Design", "59.11B": "Production audiovisuelle", "73.20Z": "Études de marché" } },
  compta: { label: "Comptabilité / gestion / juridique", romes: ["M1203", "M1202", "M1607", "M1602", "M1605", "K1903"], naf: { "69.20Z": "Expertise comptable", "69.10Z": "Activités juridiques", "70.22Z": "Conseil en gestion" } },
  rh: { label: "Ressources humaines / recrutement", romes: ["M1501", "M1502", "M1503", "K1801"], naf: { "78.10Z": "Agence de recrutement", "78.20Z": "Travail temporaire", "78.30Z": "Mise à disposition de personnel", "70.22Z": "Conseil en gestion" } },
  banque: { label: "Banque / assurance", section: "K", romes: ["C1206", "C1401", "C1102", "C1103"] },
  immobilier: { label: "Immobilier", romes: ["C1504", "C1501"], naf: { "68.31Z": "Agence immobilière", "68.32A": "Administration de biens", "68.20B": "Location de biens", "41.10A": "Promotion immobilière" } },
  industrie: { label: "Industrie / production", section: "C", romes: ["H2909", "H2903", "H1502", "H2913", "H2102", "H1404"] },
  maintenance: { label: "Maintenance / automatisme", romes: ["I1304", "I1309", "I1310", "I1302", "H1208", "I1306"], naf: { "33.12Z": "Réparation de machines", "33.14Z": "Réparation d'équipements électriques", "33.20A": "Installation de machines", "33.20C": "Installation d'équipements de contrôle", "33.20D": "Installation d'équipements électriques", "28.29B": "Fabrication de machines", "28.99B": "Fabrication de machines spécialisées", "43.22B": "Installation thermique et climatisation" } },
  btp: { label: "BTP / construction", section: "F", romes: ["F1703", "F1104", "F1202", "F1701", "F1603", "F1607", "F1606", "F1610"] },
  electricite: { label: "Électricité / énergie", romes: ["F1602", "I1309", "H2602", "I1307", "F1603"], naf: { "43.21A": "Installation électrique", "43.22A": "Plomberie", "43.22B": "Chauffage et climatisation", "27.12Z": "Matériel électrique", "35.11Z": "Production d'électricité" } },
  auto: { label: "Automobile / mécanique", romes: ["I1604", "I1606", "D1404", "I1607"], naf: { "45.11Z": "Concession automobile", "45.20A": "Garage, entretien auto", "45.20B": "Carrosserie", "45.32Z": "Pièces auto", "45.40Z": "Motos" } },
  hotellerie: { label: "Hôtellerie / restauration", romes: ["G1602", "G1603", "G1803", "G1703", "D1102", "D1104", "G1801", "D1101"], naf: { "56.10A": "Restaurant", "56.10C": "Restauration rapide", "56.21Z": "Traiteur", "56.30Z": "Bar", "55.10Z": "Hôtel" } },
  beaute: { label: "Coiffure / esthétique", romes: ["D1202", "D1208"], naf: { "96.02A": "Coiffure", "96.02B": "Soins de beauté", "96.04Z": "Bien-être" } },
  logistique: { label: "Transport / logistique", romes: ["N1103", "N4101", "N1303", "N1101", "N4105"], naf: { "49.41A": "Transport de marchandises", "49.41B": "Transport de proximité", "52.10B": "Entreposage", "52.29A": "Messagerie, fret express", "52.29B": "Affrètement", "53.20Z": "Livraison, coursiers", "49.39B": "Transport de voyageurs" } },
  sante: { label: "Santé / pharmacie / optique", romes: ["J1307", "J1405", "J1303", "J1501", "A1501"], naf: { "47.73Z": "Pharmacie", "47.78A": "Opticien", "86.23Z": "Cabinet dentaire", "86.90A": "Ambulances", "75.00Z": "Vétérinaire", "47.74Z": "Matériel médical" } },
  social: { label: "Petite enfance / social", romes: ["K1303", "K1302", "K1207", "G1202"], naf: { "88.91A": "Crèche", "88.10A": "Aide à domicile", "88.99B": "Action sociale", "87.10A": "Hébergement médicalisé (EHPAD)", "85.10Z": "Enseignement pré-primaire" } },
  paysage: { label: "Paysage / agriculture", romes: ["A1203", "A1405", "A1414", "A1416"], naf: { "81.30Z": "Paysagiste", "01.30Z": "Pépinière", "01.21Z": "Viticulture", "46.22Z": "Commerce de fleurs et plantes" } },
  tourisme: { label: "Tourisme / événementiel", romes: ["G1201", "G1303", "E1107", "G1101"], naf: { "79.11Z": "Agence de voyage", "79.12Z": "Voyagiste", "82.30Z": "Organisation d'événements", "93.29Z": "Loisirs" } },
  autre: { label: "Autre (mot-clé)" },
};
const SECTION_LABEL: Record<string, string> = { G: "Commerce", K: "Banque, assurance", C: "Industrie", F: "Construction" };

function serviceKey(): string {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (k) return k;
  try { const o = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); const v = Object.values(o)[0]; if (typeof v === "string") return v; } catch (_) { /* rien */ }
  throw new Error("Clé serveur introuvable");
}
let _sb: ReturnType<typeof createClient> | null = null;
const sb = () => (_sb ||= createClient(env("SUPABASE_URL"), serviceKey(), { auth: { persistSession: false } }));

async function sha(s: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function hmac(s: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode("tw-alt-jeton|" + env("CRON_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(s));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c] as string));
}
async function ipHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "?";
  return (await sha("tw-alt|" + new Date().toISOString().slice(0, 10) + "|" + ip)).slice(0, 32);
}
async function count(h: string, action: string, minutes: number) {
  const { count: n } = await sb().from("alt_recherches").select("id", { count: "exact", head: true }).eq("ip_hash", h).eq("action", action).gte("created_at", new Date(Date.now() - minutes * 60000).toISOString());
  return n || 0;
}
async function limit(h: string, action: string, max10: number, maxDay: number) { return (await count(h, action, 10)) < max10 && (await count(h, action, 1440)) < maxDay; }
const log = (h: string, action: string, extra: Record<string, unknown> = {}) => sb().from("alt_recherches").insert({ ip_hash: h, action, ...extra });

const clean = (v: unknown, n = 120) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const cleanText = (v: unknown, n = 8000) => String(v ?? "").replace(/\r/g, "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").slice(0, n);
const cap = (s: string) => s.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());
const okEmail = (e: string) => /^[^@\s<>"]+@[^@\s<>"]+\.[a-z]{2,}$/i.test(e);
function km(a: number, b: number, c: number, d: number) {
  const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(x)) * 10) / 10;
}

async function commune(ville: string) {
  const cp = /^\d{5}$/.test(ville);
  const u = cp ? `https://geo.api.gouv.fr/communes?codePostal=${ville}&fields=nom,code,codesPostaux,codeDepartement,centre,population&limit=5`
    : `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(ville)}&fields=nom,code,codesPostaux,codeDepartement,centre,population&boost=population&limit=1`;
  const r = await fetch(u, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("Service des communes indisponible, réessaie dans un instant");
  const l = await r.json() as { nom: string; code: string; codesPostaux: string[]; codeDepartement: string; centre?: { coordinates: [number, number] }; population?: number }[];
  if (!l.length) return null;
  return l.sort((a, b) => (b.population || 0) - (a.population || 0))[0];
}

/* ---------- recherche : annuaire Sirene (toutes les entreprises) ---------- */
async function searchSirene(b: Record<string, unknown>, s: Secteur, q: string, c: NonNullable<Awaited<ReturnType<typeof commune>>>, zone: string) {
  const page = Math.min(20, Math.max(1, Number(b.page) || 1));
  const p = new URLSearchParams({ etat_administratif: "A", per_page: "25", page: String(page), tranche_effectif_salarie: Object.keys(EFFECTIFS).join(","), include: "siege,dirigeants,matching_etablissements", minimal: "true" });
  if (s.naf) p.set("activite_principale", Object.keys(s.naf).join(","));
  if (s.section) p.set("section_activite_principale", s.section);
  if (q) p.set("q", q);
  if (zone === "dep") p.set("departement", c.codeDepartement); else p.set("code_postal", c.codesPostaux.slice(0, 10).join(","));
  const r = await fetch("https://recherche-entreprises.api.gouv.fr/search?" + p, { headers: { accept: "application/json" } });
  if (r.status === 429) throw new Error("Trop de recherches en même temps, réessaie dans quelques secondes");
  if (!r.ok) throw new Error("Annuaire des entreprises indisponible (" + r.status + "), réessaie plus tard");
  const d = await r.json() as { results: any[]; total_results: number; total_pages: number };
  const [lon0, lat0] = c.centre?.coordinates || [0, 0];
  const results = (d.results || []).map((e) => {
    const loc = (e.matching_etablissements || []).find((x: any) => x.etat_administratif !== "F") || e.siege || {};
    const naf = loc.activite_principale || e.activite_principale || "";
    const petit = ["02", "03", "11", "12"].includes(e.tranche_effectif_salarie);
    const dir = petit ? (e.dirigeants || []).find((x: any) => x.type_dirigeant === "personne physique" && x.nom) || null : null;
    const lat = Number(loc.latitude), lon = Number(loc.longitude);
    const adresse = clean(loc.adresse, 200);
    const enseigne = clean((loc.liste_enseignes || [])[0] || loc.nom_commercial || "", 80);
    const base = cap(clean(e.nom_complet || e.nom_raison_sociale, 120));
    return {
      type: "entreprise", siren: e.siren, siret: loc.siret || "",
      nom: enseigne && !base.toLowerCase().includes(enseigne.toLowerCase()) ? cap(enseigne) + " (" + base + ")" : base,
      activite: s.naf?.[naf] || SECTION_LABEL[e.section_activite_principale] || (q ? cap(q) : s.label),
      naf, effectif: EFFECTIFS[e.tranche_effectif_salarie] || "", groupe: !petit, adresse,
      cp: loc.code_postal || (adresse.match(/\b\d{5}\b/) || [""])[0], ville: cap(clean(loc.libelle_commune, 80)),
      lat: isFinite(lat) && lat ? lat : null, lon: isFinite(lon) && lon ? lon : null,
      km: isFinite(lat) && lat && lat0 ? km(lat0, lon0, lat, lon) : null,
      dirigeant: dir ? { nom: cap(clean(`${(dir.prenoms || "").split(/[ ,]/)[0]} ${dir.nom}`.replace(/\(.*?\)/g, ""), 80)), qualite: clean(dir.qualite, 60) } : null,
    };
  }).filter((e) => e.nom && !/^\[ND\]/.test(e.nom));
  results.sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
  return { source: "sirene", commune: { nom: c.nom, dep: c.codeDepartement }, secteur: s.label, total: d.total_results || 0, page, pages: d.total_pages || 1, results };
}

/* ---------- recherche : La bonne alternance ---------- */
function lbaItem(x: any, type: "offre" | "recrute", lat0: number, lon0: number, s: Secteur) {
  const w = x.workplace || {}, loc = w.location || {}, gp = loc.geopoint?.coordinates || [];
  const lon = Number(gp[0]), lat = Number(gp[1]);
  const adresse = clean(loc.address, 200);
  const siret = clean(w.siret, 20);
  const o = x.offer || {}, ct = x.contract || {};
  const taille = clean(w.size, 30);
  return {
    type, id: clean(x.identifier?.id, 80), siren: siret.slice(0, 9), siret,
    nom: cap(clean(w.brand || w.name || w.legal_name, 120)),
    activite: clean(w.domain?.naf?.label, 120) || s.label, naf: clean(w.domain?.naf?.code, 10),
    effectif: taille ? (/salari/i.test(taille) ? taille : taille + " salariés") : "",
    groupe: /^(50|100|200|250|500|1000|2000|5000|10000)/.test(taille.replace(/\s/g, "")),
    adresse, cp: (adresse.match(/\b\d{5}\b/) || [""])[0], ville: cap(clean((adresse.match(/\b\d{5}\s+(.+)$/) || ["", ""])[1], 80)),
    lat: isFinite(lat) ? lat : null, lon: isFinite(lon) ? lon : null, km: isFinite(lat) && lat0 ? km(lat0, lon0, lat, lon) : null,
    site: clean(w.website, 200),
    titre: type === "offre" ? clean(o.title, 160) : "",
    description: type === "offre" ? cleanText(o.description, 900) : "",
    debut: type === "offre" ? clean(ct.start, 40).slice(0, 10) : "", duree: ct.duration ? clean(ct.duration, 10) + " mois" : "",
    partenaire: clean(x.identifier?.partner_label, 60),
    apply: { url: clean(x.apply?.url, 500), phone: clean(x.apply?.phone, 30), recipient_id: clean(x.apply?.recipient_id, 200) },
    dirigeant: null,
  };
}
async function searchLba(s: Secteur, q: string, c: NonNullable<Awaited<ReturnType<typeof commune>>>, zone: string) {
  const [lon0, lat0] = c.centre?.coordinates || [0, 0];
  const p = new URLSearchParams({ latitude: String(lat0), longitude: String(lon0), radius: zone === "dep" ? "60" : "15" });
  if (s.romes?.length) p.set("romes", s.romes.join(","));
  const r = await fetch(LBA + "/job/v1/search?" + p, { headers: { Authorization: "Bearer " + env("LBA_API_KEY"), accept: "application/json" } });
  if (r.status === 401 || r.status === 403) throw new Error("Service La bonne alternance : accès refusé (clé à vérifier)");
  if (!r.ok) throw new Error("La bonne alternance ne répond pas (" + r.status + "), réessaie plus tard");
  const d = await r.json() as { jobs?: any[]; recruiters?: any[] };
  let results = [...(d.jobs || []).map((x) => lbaItem(x, "offre", lat0, lon0, s)), ...(d.recruiters || []).map((x) => lbaItem(x, "recrute", lat0, lon0, s))];
  if (q) { const k = q.toLowerCase(); results = results.filter((x) => (x.nom + " " + x.activite + " " + x.titre).toLowerCase().includes(k)); }
  results.sort((a, b) => (a.type === b.type ? (a.km ?? 999) - (b.km ?? 999) : a.type === "offre" ? -1 : 1));
  return { source: "lba", commune: { nom: c.nom, dep: c.codeDepartement }, secteur: s.label, total: results.length, page: 1, pages: 1, results: results.slice(0, 150) };
}

async function search(b: Record<string, unknown>) {
  const key = clean(b.secteur, 30), s = SECTEURS[key];
  if (!s) throw new Error("Secteur inconnu");
  const q = clean(b.q, 60);
  if (key === "autre" && q.length < 2) throw new Error("Tape un mot-clé (ex. « agence web », « boulangerie »)");
  const ville = clean(b.ville, 60);
  if (ville.length < 2) throw new Error("Indique ta ville");
  const c = await commune(ville);
  if (!c) throw new Error(`Ville « ${ville} » introuvable`);
  const zone = b.zone === "dep" ? "dep" : "ville";
  if (b.source === "lba" && env("LBA_API_KEY")) return await searchLba(s, q, c, zone);
  return await searchSirene(b, s, q, c, zone);
}

/* ---------- postuler via La bonne alternance ---------- */
async function postuler(b: Record<string, unknown>) {
  const p = (b.profil || {}) as Record<string, unknown>;
  const email = clean(p.email, 120), tel = clean(p.tel, 30).replace(/[^\d+]/g, "");
  if (!okEmail(email)) throw new Error("Ton adresse mail n'est pas valide (onglet Profil)");
  if (tel.length < 9) throw new Error("Ton numéro de téléphone n'est pas valide (onglet Profil)");
  const cv = (b.cv || {}) as Record<string, unknown>;
  const content = String(cv.content || "");
  if (!/^data:application\/pdf;base64,/.test(content)) throw new Error("CV manquant");
  if (content.length > 4_200_000) throw new Error("Ton CV est trop lourd (3 Mo maximum)");
  const body = {
    applicant_first_name: clean(p.prenom, 50), applicant_last_name: clean(p.nom, 50), applicant_email: email,
    applicant_phone: tel.startsWith("0") ? "+33" + tel.slice(1) : tel,
    applicant_attachment_name: clean(cv.name, 80).replace(/[^\w.\- ]/g, "") || "CV.pdf", applicant_attachment_content: content,
    applicant_message: cleanText(b.message, 6000) || null,
    recipient_id: clean(b.recipient_id, 200),
    applicant_inscription_formation: true,
    applicant_formation_description: clean([p.formation, p.ecole].filter(Boolean).join(" – "), 200) || null,
    applicant_rythm_description: clean(p.rythme, 200) || null,
    applicant_contract_duration: clean(p.duree, 40) || null,
  };
  const r = await fetch(LBA + "/job/v1/apply", { method: "POST", headers: { Authorization: "Bearer " + env("LBA_API_KEY"), "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
  const out = await r.json().catch(() => ({})) as { id?: string; message?: string };
  if (!r.ok) throw new Error(r.status === 403 ? "L'envoi via La bonne alternance n'est pas encore autorisé pour TissAlternance" : "Candidature refusée par La bonne alternance : " + (out.message || r.status));
  return { ok: true, id: out.id || null };
}



/* ---------- Pass payant (Stripe Checkout) ---------- */
async function passJeton(email: string, tier: string) { const base = "p." + tier + "." + btoa(email); return base + "." + await hmac(base); }
async function lirePass(j: unknown): Promise<{ tier: string; email: string } | null> {
  const [p, tier, e, sig] = String(j || "").split(".");
  if (p !== "p" || !tier || !e || !sig) return null;
  if (sig !== await hmac(`p.${tier}.${e}`)) return null;
  try { return { tier, email: atob(e) }; } catch (_) { return null; }
}
const TIERS: Record<number, string> = { 499: "essentiel", 999: "pro" };
async function pass(b: Record<string, unknown>) {
  const id = clean(b.session_id, 200);
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) throw new Error("Paiement introuvable");
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + id, { headers: { Authorization: "Bearer " + env("STRIPE_SECRET_KEY") } });
  const d = await r.json().catch(() => ({})) as any;
  if (!r.ok) { console.error("stripe", r.status, d?.error?.message); throw new Error("Paiement introuvable"); }
  if (d.payment_status !== "paid") throw new Error("Le paiement n'est pas encore validé, réessaie dans une minute");
  const tier = TIERS[Number(d.amount_total)] || (String(d.metadata?.tier || "") === "pro" ? "pro" : String(d.metadata?.tier || "") === "essentiel" ? "essentiel" : "");
  if (!tier) throw new Error("Montant inattendu, écris à contact@tissaweb.fr");
  const email = clean(d.customer_details?.email || d.customer_email, 160).toLowerCase();
  if (!okEmail(email)) throw new Error("Adresse du paiement introuvable");
  await sb().from("alt_pass").upsert({ session_id: id, email, tier, amount: Number(d.amount_total) || null });
  return { ok: true, tier, email, jeton: await passJeton(email, tier) };
}
async function restaurer(b: Record<string, unknown>) {
  const email = clean(b.email, 160).toLowerCase();
  if (!okEmail(email)) throw new Error("Adresse invalide");
  const { data } = await sb().from("alt_pass").select("tier").eq("email", email);
  let tiers = (data || []).map((x: any) => x.tier);
  if (!tiers.length) {
    // le paiement a pu réussir sans que l'étudiant revienne sur merci.html : on demande directement à Stripe
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions?limit=20&status=complete&customer_details[email]=" + encodeURIComponent(email), { headers: { Authorization: "Bearer " + env("STRIPE_SECRET_KEY") } });
    const d = await r.json().catch(() => ({})) as any;
    for (const cs of (r.ok ? d.data || [] : [])) {
      const t = TIERS[Number(cs.amount_total)];
      if (cs.payment_status !== "paid" || !t) continue;
      await sb().from("alt_pass").upsert({ session_id: cs.id, email, tier: t, amount: Number(cs.amount_total) || null });
      tiers.push(t);
    }
  }
  const tier = tiers.includes("pro") ? "pro" : tiers.includes("essentiel") ? "essentiel" : "";
  if (!tier) throw new Error("Aucun Pass trouvé pour cette adresse (utilise celle du paiement)");
  return { ok: true, tier, email, jeton: await passJeton(email, tier) };
}

/* ---------- Gmail de l'étudiant (OAuth, droit gmail.send) ---------- */
async function aesKey() {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("tw-alt-gmail|" + env("CRON_SECRET")));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function chiffre(t: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(t)));
  return b64(iv) + "." + b64(c);
}
async function dechiffre(s: string) {
  const [iv, c] = s.split(".");
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(), unb64(c)));
}
async function gToken(params: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), ...params }) });
  const d = await r.json().catch(() => ({})) as Record<string, string>;
  if (!r.ok) { console.error("google token", r.status, d.error, d.error_description); const e = new Error(d.error === "invalid_grant" ? "Connexion Gmail expirée, reconnecte ton Gmail" : "Google a refusé la connexion (" + (d.error || r.status) + ")"); (e as any).gmail = d.error === "invalid_grant"; throw e; }
  return d;
}
async function gconnect(b: Record<string, unknown>) {
  const code = clean(b.code, 600);
  if (!code) throw new Error("Code Google manquant");
  const d = await gToken({ code, grant_type: "authorization_code", redirect_uri: GREDIRECT });
  if (!String(d.scope || "").includes("gmail.send")) throw new Error("Coche bien la case « Envoyer des e-mails en votre nom » pour que l'appli puisse envoyer tes candidatures");
  const ui = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + d.access_token } }).then((r) => r.json()).catch(() => ({})) as { email?: string; email_verified?: boolean; name?: string };
  const email = clean(ui.email, 120).toLowerCase();
  if (!okEmail(email)) throw new Error("Impossible de lire ton adresse Gmail");
  const row: Record<string, unknown> = { email, nom: clean(ui.name, 100) || null, updated_at: new Date().toISOString() };
  if (d.refresh_token) row.refresh_token = await chiffre(d.refresh_token);
  else {
    const { data } = await sb().from("alt_gmail").select("email").eq("email", email).maybeSingle();
    if (!data) throw new Error("Google n'a pas donné l'accès complet, réessaie « Connecter mon Gmail »");
  }
  const { error } = await sb().from("alt_gmail").upsert(row);
  if (error) throw new Error("Enregistrement impossible, réessaie");
  return { ok: true, email, jeton: await jeton(email) };
}
async function gmailRow(email: string) {
  if (!gmailOn()) return null;
  const { data } = await sb().from("alt_gmail").select("email,refresh_token").eq("email", email).maybeSingle();
  return data as { email: string; refresh_token: string } | null;
}
async function gdeconnect(b: Record<string, unknown>) {
  const email = await lireJeton(b.jeton);
  const row = await gmailRow(email);
  if (row) {
    try { await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(await dechiffre(row.refresh_token)), { method: "POST" }); } catch (_) { /* rien */ }
    await sb().from("alt_gmail").delete().eq("email", email);
  }
  return { ok: true };
}
const qp = (s: string) => /^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + btoa(String.fromCharCode(...new TextEncoder().encode(s))) + "?=";
const addr = (name: string, email: string) => name ? `${qp(name.replace(/["\\]/g, ""))} <${email}>` : email;
const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
const utf8b64 = (s: string) => wrap76(btoa(String.fromCharCode(...new TextEncoder().encode(s))));
function mime(o: { from: string; to: string; subject: string; text: string; attachments?: { filename: string; content: string }[] }) {
  const id = crypto.randomUUID().replace(/-/g, ""), alt = "alt" + id, mix = "mix" + id;
  const h = [`From: ${o.from}`, `To: ${o.to}`, `Subject: ${qp(o.subject)}`, "MIME-Version: 1.0"];
  const altPart = [`--${alt}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", utf8b64(o.text),
    `--${alt}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", utf8b64(html(o.text)), `--${alt}--`, ""].join("\r\n");
  let body: string;
  if (o.attachments?.length) {
    body = [...h, `Content-Type: multipart/mixed; boundary="${mix}"`, "", `--${mix}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "", altPart,
      ...o.attachments.flatMap((a) => [`--${mix}`, `Content-Type: application/pdf; name="${a.filename}"`, `Content-Disposition: attachment; filename="${a.filename}"`, "Content-Transfer-Encoding: base64", "", wrap76(a.content)]),
      `--${mix}--`, ""].join("\r\n");
  } else body = [...h, `Content-Type: multipart/alternative; boundary="${alt}"`, "", altPart].join("\r\n");
  return btoa(body).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function gmailSend(row: { email: string; refresh_token: string }, m: { fromName: string; to: string; toName?: string; subject: string; text: string; attachments?: { filename: string; content: string }[] }) {
  let at: string;
  try { at = (await gToken({ refresh_token: await dechiffre(row.refresh_token), grant_type: "refresh_token" })).access_token; }
  catch (e) { if ((e as any).gmail) await sb().from("alt_gmail").delete().eq("email", row.email); throw e; }
  const raw = mime({ from: addr(m.fromName, row.email), to: addr(m.toName || "", m.to), subject: m.subject, text: m.text, attachments: m.attachments });
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: "Bearer " + at, "content-type": "application/json" }, body: JSON.stringify({ raw }) });
  if (!r.ok) { const t = await r.text(); console.error("gmail send", r.status, t.slice(0, 300)); throw new Error(r.status === 403 ? "Gmail a refusé l'envoi : reconnecte ton Gmail" : "Gmail n'a pas pu envoyer le mail (" + r.status + ")"); }
}

/* ---------- envoi depuis candidatures@ ---------- */
let _t: ReturnType<typeof nodemailer.createTransport> | null = null;
const transport = () => (_t ||= nodemailer.createTransport({ host: env("ALT_SMTP_HOST") || "ssl0.ovh.net", port: 465, secure: true, auth: { user: SMTP_USER(), pass: env("ALT_SMTP_PASSWORD") }, connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 30000 }));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const html = (t: string) => `<div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b2420">${esc(t).replace(/\n/g, "<br>")}</div>`;

async function jeton(email: string) { const exp = Date.now() + 180 * 86400000, base = btoa(email) + "." + exp; return base + "." + await hmac(base); }
async function lireJeton(j: unknown) {
  const [e, exp, sig] = String(j || "").split(".");
  if (!e || !exp || !sig || Number(exp) < Date.now() || sig !== await hmac(e + "." + exp)) throw new Error("Vérifie à nouveau ton adresse mail");
  return atob(e);
}
async function code(b: Record<string, unknown>, ih: string) {
  const email = clean(b.email, 120).toLowerCase();
  if (!okEmail(email)) throw new Error("Adresse mail invalide");
  if ((await count(ih, "code", 60)) >= 5) throw new Error("Trop de codes demandés, réessaie dans une heure");
  const c = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  await sb().from("alt_verif").insert({ email_hash: await sha(email), code_hash: await sha(email + "|" + c), expires_at: new Date(Date.now() + 15 * 60000).toISOString() });
  const t = `Bonjour,\n\nVoici ton code pour activer l'envoi automatique de tes candidatures sur TissAlternance :\n\n${c}\n\nIl est valable 15 minutes. Si tu n'as rien demandé, ignore ce message.\n\nTissAlternance · tissaweb.fr/alternance`;
  await transport().sendMail({ from: { name: "TissAlternance", address: SMTP_USER() }, to: email, subject: `Ton code TissAlternance : ${c}`, text: t, html: html(t) });
  await log(ih, "code");
  return { ok: true };
}
async function verif(b: Record<string, unknown>) {
  const email = clean(b.email, 120).toLowerCase(), c = clean(b.code, 10);
  const eh = await sha(email);
  const { data } = await sb().from("alt_verif").select("*").eq("email_hash", eh).gte("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
  const row = data?.[0];
  if (!row || row.essais >= 5) throw new Error("Code expiré, demande un nouveau code");
  if (row.code_hash !== await sha(email + "|" + c)) { await sb().from("alt_verif").update({ essais: row.essais + 1 }).eq("id", row.id); throw new Error("Code incorrect"); }
  await sb().from("alt_verif").delete().eq("email_hash", eh);
  return { ok: true, jeton: await jeton(email) };
}
async function envoyer(b: Record<string, unknown>) {
  const email = await lireJeton(b.jeton);
  const p = (b.profil || {}) as Record<string, unknown>;
  const nom = clean(`${clean(p.prenom, 50)} ${clean(p.nom, 50)}`, 100) || email;
  const to = clean(b.to, 160).toLowerCase(), subject = clean(b.subject, 200), text = cleanText(b.text, 8000);
  if (!okEmail(to)) throw new Error("Adresse de l'entreprise invalide");
  if (to === email) throw new Error("C'est ta propre adresse : mets celle de l'entreprise");
  if (!subject || text.length < 40) throw new Error("Objet ou texte vide");
  const { count: n } = await sb().from("alt_envois").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", new Date(Date.now() - 86400000).toISOString());
  if ((n || 0) >= 15) throw new Error("15 envois par jour maximum, la suite demain");
  if (payOn()) {
    const ps = await lirePass(b.pass);
    if (!ps || ps.tier !== "pro") {
      const { count: m } = await sb().from("alt_envois").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
      if ((m || 0) >= FREE_ENVOIS) { const e = new Error(`Tu as utilisé tes ${FREE_ENVOIS} envois automatiques gratuits du mois. Passe au Pass Pro pour envoyer sans limite.`); (e as any).status = 402; throw e; }
    }
  }
  const atts = (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 2).map((a: any) => {
    const c = String(a.content || ""), m = c.match(/^data:application\/pdf;base64,(.+)$/);
    if (!m || c.length > 4_200_000) throw new Error("Pièce jointe invalide ou trop lourde (3 Mo max)");
    return { filename: clean(a.name, 80).replace(/[^\w.\- ]/g, "") || "document.pdf", content: m[1], encoding: "base64" };
  });
  const g = await gmailRow(email);
  if (g) await gmailSend(g, { fromName: nom, to, toName: clean(b.to_name, 120), subject, text, attachments: atts.map((a) => ({ filename: a.filename, content: a.content })) });
  else {
    if (!smtpOn()) throw new Error("Connecte ton Gmail pour envoyer tes candidatures");
    const foot = `\n\n—\nCandidature envoyée via TissAlternance. Pour répondre, utilisez simplement « Répondre » : votre message arrivera directement à ${nom} (${email}).`;
    await transport().sendMail({ from: { name: `${nom} via TissAlternance`, address: SMTP_USER() }, replyTo: { name: nom, address: email }, to: { name: clean(b.to_name, 120) || to, address: to }, subject, text: text + foot, html: html(text + foot), attachments: atts });
  }
  const rel = b.relance && typeof b.relance === "object" ? b.relance as Record<string, unknown> : null;
  const { data } = await sb().from("alt_envois").insert({
    email, nom_affiche: nom, to_email: to, to_name: clean(b.to_name, 120) || null, subject,
    relance_subject: rel ? clean(rel.subject, 200) : null, relance_text: rel ? cleanText(rel.text, 4000) : null,
    relance_at: rel ? new Date(Date.now() + 7 * 86400000).toISOString() : null, statut: rel ? "relance_prevue" : "envoye",
  }).select("id,relance_at").single();
  // copie à l'étudiant (preuve d'envoi) — inutile avec Gmail : le mail est dans ses « Envoyés »
  if (!g) try { await transport().sendMail({ from: { name: "TissAlternance", address: SMTP_USER() }, to: email, subject: "Envoyé : " + subject, text: `Ta candidature a bien été envoyée à ${to}.${rel ? "\nUne relance partira automatiquement dans 7 jours si tu ne l'annules pas dans l'appli." : ""}\n\nCopie du message :\n\n${text}`, html: html(`Ta candidature a bien été envoyée à ${to}.${rel ? "\nUne relance partira automatiquement dans 7 jours si tu ne l'annules pas dans l'appli." : ""}\n\nCopie du message :\n\n${text}`) }); } catch (_) { /* pas bloquant */ }
  return { ok: true, id: data?.id, relance_at: data?.relance_at || null, via: g ? "gmail" : "tissaweb" };
}
async function annuler(b: Record<string, unknown>) {
  const email = await lireJeton(b.jeton);
  await sb().from("alt_envois").update({ statut: "relance_annulee" }).eq("id", clean(b.id, 40)).eq("email", email).eq("statut", "relance_prevue");
  return { ok: true };
}
async function relances() {
  const { data } = await sb().from("alt_envois").select("*").eq("statut", "relance_prevue").lte("relance_at", new Date().toISOString()).limit(40);
  let n = 0;
  for (const r of data || []) {
    try {
      const g = await gmailRow(r.email);
      if (g) { await gmailSend(g, { fromName: r.nom_affiche, to: r.to_email, toName: r.to_name || "", subject: r.relance_subject || "Relance – " + r.subject, text: r.relance_text });
        await sb().from("alt_envois").update({ statut: "relance_envoyee" }).eq("id", r.id); n++; continue; }
      if (!smtpOn()) throw new Error("Gmail déconnecté");
      const foot = `\n\n—\nMessage envoyé via TissAlternance. Pour répondre, utilisez « Répondre » : votre message arrivera directement à ${r.nom_affiche} (${r.email}).`;
      await transport().sendMail({ from: { name: `${r.nom_affiche} via TissAlternance`, address: SMTP_USER() }, replyTo: { name: r.nom_affiche, address: r.email }, to: { name: r.to_name || r.to_email, address: r.to_email }, subject: r.relance_subject || "Relance – " + r.subject, text: r.relance_text + foot, html: html(r.relance_text + foot) });
      await sb().from("alt_envois").update({ statut: "relance_envoyee" }).eq("id", r.id); n++;
    } catch (e) { await sb().from("alt_envois").update({ statut: "erreur", erreur: (e as Error).message.slice(0, 300) }).eq("id", r.id); }
  }
  const old = new Date(Date.now() - 30 * 86400000).toISOString();
  await sb().from("alt_envois").delete().lt("created_at", old);
  await sb().from("alt_verif").delete().lt("expires_at", new Date(Date.now() - 86400000).toISOString());
  return { relances: n };
}

/* ---------- rédaction IA (optionnelle) ---------- */
async function rediger(b: Record<string, unknown>) {
  const pr = (b.profil || {}) as Record<string, unknown>, en = (b.entreprise || {}) as Record<string, unknown>;
  const type = ["mail", "lettre", "relance"].includes(String(b.type)) ? String(b.type) : "mail";
  const profil = ["prenom", "nom", "formation", "ecole", "rythme", "debut", "metier", "qualites", "experience"].map((k) => `${k} : ${clean(pr[k], 400)}`).join("\n");
  const entreprise = ["nom", "activite", "ville", "effectif", "titre"].map((k) => `${k} : ${clean(en[k], 150)}`).join("\n") + (en.dirigeant ? `\ndirigeant : ${clean((en.dirigeant as any).nom, 80)}` : "");
  const consigne = {
    mail: "un mail de candidature en alternance, court (120 à 170 mots), sans objet",
    lettre: "une lettre de motivation complète pour une alternance (250 à 320 mots), sans en-tête d'adresse",
    relance: "un mail de relance poli et court (60 à 90 mots), une semaine après une candidature restée sans réponse",
  }[type];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 900,
      system: "Tu rédiges des candidatures d'étudiants français pour des contrats d'alternance. Français impeccable, vouvoiement, ton professionnel et sincère, phrases simples, pas de formules creuses ni d'exagération. N'invente aucun fait sur l'étudiant ou l'entreprise : utilise seulement les informations fournies. Termine par une formule de politesse complète puis le prénom et le nom. Réponds uniquement avec le texte.",
      messages: [{ role: "user", content: `Rédige ${consigne}.\n\nÉtudiant :\n${profil}\n\nEntreprise :\n${entreprise}` }] }),
  });
  if (!r.ok) throw new Error("Rédaction IA indisponible");
  const d = await r.json() as { content?: { text?: string }[] };
  return { texte: (d.content?.[0]?.text || "").trim() };
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const action = new URL(req.url).searchParams.get("action") || "search";
  try {
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (action === "info") return json({ ia: !!env("ANTHROPIC_API_KEY"), lba: !!env("LBA_API_KEY"), postuler: !!env("LBA_API_KEY") && env("LBA_APPLY") === "1", envoi: smtpOn(), gmail: gmailOn(), gclient: gmailOn() ? env("GOOGLE_CLIENT_ID") : null, pay: payOn(), links: payOn() ? { essentiel: env("STRIPE_LINK_ESSENTIEL"), pro: env("STRIPE_LINK_PRO") } : null, gratuit: { envois: FREE_ENVOIS, suivi: 10 } });
    if (action === "relances") {
      if (!env("CRON_SECRET") || req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return json({ error: "Non autorisé" }, 401);
      if (!smtpOn() && !gmailOn()) return json({ relances: 0, info: "envoi inactif" });
      return json(await relances());
    }
    const ih = await ipHash(req);
    if (action === "search") {
      if (!(await limit(ih, "search", 30, 300))) return json({ error: "Tu as fait beaucoup de recherches d'un coup. Patiente 10 minutes." }, 429);
      const out = await search(b);
      await log(ih, "search", { secteur: clean(b.secteur, 30), commune: out.commune.nom, nb: out.results.length });
      return json(out);
    }
    if (action === "postuler") {
      if (!env("LBA_API_KEY") || env("LBA_APPLY") !== "1") return json({ error: "Envoi via La bonne alternance pas encore actif" }, 404);
      if (!(await limit(ih, "postuler", 10, 30))) return json({ error: "30 candidatures par jour maximum, la suite demain" }, 429);
      const out = await postuler(b); await log(ih, "postuler", { nb: 1 }); return json(out);
    }
    if (action === "pass" || action === "restaurer") {
      if (!payOn()) return json({ error: "Pass pas encore disponible" }, 404);
      if (!(await limit(ih, action, 10, 40))) return json({ error: "Trop d'essais, patiente un peu" }, 429);
      await log(ih, action); return json(action === "pass" ? await pass(b) : await restaurer(b));
    }
    if (action === "gconnect" || action === "gdeconnect") {
      if (!gmailOn()) return json({ error: "Connexion Gmail pas encore active" }, 404);
      if (action === "gdeconnect") return json(await gdeconnect(b));
      if (!(await limit(ih, "gconnect", 10, 30))) return json({ error: "Trop d'essais, patiente un peu" }, 429);
      await log(ih, "gconnect"); return json(await gconnect(b));
    }
    if (["code", "verif", "envoyer", "annuler"].includes(action)) {
      if (!smtpOn() && !(gmailOn() && (action === "envoyer" || action === "annuler"))) return json({ error: "Envoi automatique pas encore actif" }, 404);
      if (action === "code") return json(await code(b, ih));
      if (action === "verif") { if (!(await limit(ih, "verif", 10, 40))) return json({ error: "Trop d'essais, patiente un peu" }, 429); await log(ih, "verif"); return json(await verif(b)); }
      if (action === "envoyer") { if (!(await limit(ih, "envoyer", 10, 30))) return json({ error: "Trop d'envois d'un coup, patiente un peu" }, 429); const out = await envoyer(b); await log(ih, "envoyer", { nb: 1 }); return json(out); }
      return json(await annuler(b));
    }
    if (action === "rediger") {
      if (!env("ANTHROPIC_API_KEY")) return json({ ia: false }, 404);
      if (!(await limit(ih, "rediger", 20, 80))) return json({ error: "Limite de rédactions IA atteinte, on utilise le modèle." }, 429);
      const out = await rediger(b); await log(ih, "rediger", { nb: 1 }); return json({ ia: true, ...out });
    }
    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "Erreur" }, (e as any).status || 400);
  }
});
