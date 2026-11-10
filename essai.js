/* TissaWeb — générateur d'aperçu de site (partagé entre tissaweb.fr et l'appli)
   TWEssai.render(el, metier, nom)  → construit l'aperçu animé dans el (.gsite)
   TWEssai.metier(activite)         → devine le modèle à partir d'une activité libre
   TWEssai.lien(nom, metier)        → lien personnalisé à envoyer au prospect */
(function () {
  var T = {
    boulangerie: { label: "Boulangerie", def: "Boulangerie Martin", kick: "Boulangerie · Pâtisserie", h: "Du pain au levain, <em>cuit chaque matin.</em>", p: "Farines de meuniers de la région, levain naturel et fournée dès 6 h. Commandez la veille, on vous le met de côté.", b1: "Commander pour demain", b2: "Horaires & accès", nav: "Commander", links: ["Nos produits", "Commander", "Horaires"], stamp: "Fait<br>maison<br>ici", call: "Appeler la boutique", rev: "4,9 sur Google · 212 avis", act: "Restaurant / Commerce de bouche" },
    restaurant: { label: "Restaurant", def: "Le Petit Bistrot", kick: "Restaurant · Cuisine maison", h: "Une cuisine maison, <em>à deux pas de chez vous.</em>", p: "Produits frais du marché, menu du jour le midi et carte de saison le soir. Réservez votre table en un clic.", b1: "Réserver une table", b2: "Voir la carte", nav: "Réserver", links: ["La carte", "Le lieu", "Infos"], stamp: "Menu du jour 16,90 €", call: "Réserver une table", rev: "4,7 sur Google · 386 avis", list: ["Entrée + plat · 16,90 €", "Plat du jour · 12,50 €", "Dessert maison · 6 €"], act: "Restaurant / Commerce de bouche" },
    barbier: { label: "Coiffeur / barbier", def: "Barber Club", kick: "Barbier · Coiffeur homme", h: "Coupe nette.<br><span class=\"g-a\">Barbe soignée.</span>", p: "Coupes aux ciseaux et à la tondeuse, taille de barbe et rasage à la serviette chaude. Réservez en 30 secondes.", b1: "Prendre rendez-vous", b2: "Voir les tarifs", nav: "Réserver", links: ["Prestations", "Galerie", "Infos"], stamp: "Créneau dispo · 17 h 30", call: "Réserver maintenant", rev: "5,0 sur Google · 148 avis", list: ["Coupe homme · 25 €", "Coupe + barbe · 35 €", "Rasage serviette chaude · 20 €"], act: "Coiffure / Beauté" },
    beaute: { label: "Institut / beauté", def: "Institut Belle Peau", kick: "Institut de beauté", h: "Prenez soin de vous, <em>on s'occupe du reste.</em>", p: "Soins du visage, mains et corps dans un cadre calme. Prenez rendez-vous en ligne, à l'heure qui vous arrange.", b1: "Réserver un soin", b2: "La carte des soins", nav: "Réserver", links: ["Soins", "Tarifs", "L'institut"], stamp: "Bon cadeau dispo", call: "Réserver un soin", rev: "4,9 sur Google · 167 avis", list: ["Soin visage · 55 €", "Manucure · 30 €", "Épilation · dès 12 €"], act: "Coiffure / Beauté" },
    artisan: { label: "Artisan", def: "Durand Plomberie", kick: "Artisan à Dijon", h: "Un souci ?<br><span class=\"g-a\">On arrive.</span>", p: "Dépannage, rénovation et entretien dans toute la métropole. Devis clair avant chaque intervention.", b1: "Appeler", b2: "Devis gratuit", nav: "Urgence", links: ["Services", "Tarifs", "Zone", "Contact"], stamp: "Sur place en 1 h", call: "Appeler maintenant", rev: "4,8 sur Google · 96 avis", list: ["Intervention 7j/7", "Devis gratuit avant travaux", "Garantie sur les réparations"], top: "Disponible maintenant · 7j/7", act: "Artisan / BTP" },
    coach: { label: "Coach / sport", def: "Studio Forme", kick: "Coach sportif diplômé d'État", h: "Reprenez votre forme <span class=\"g-a\">en main.</span>", p: "Des séances sur-mesure à domicile, en salle ou en extérieur, avec un programme adapté à votre niveau.", b1: "Ma séance offerte", b2: "Les formules", nav: "Réserver", links: ["Objectifs", "Formules", "Avis"], stamp: "1re séance offerte", call: "Réserver ma séance", rev: "5,0 sur Google · 74 avis", list: ["Perte de poids", "Remise en forme", "Préparation physique"], act: "Profession libérale" },
    boutique: { label: "Boutique", def: "Maison Clémence", kick: "Boutique · Créateurs", h: "Le coup de cœur <em>près de chez vous.</em>", p: "Une sélection de créateurs et de pièces uniques, renouvelée chaque semaine. Découvrez les nouveautés avant de passer.", b1: "Voir les nouveautés", b2: "Nous trouver", nav: "Nouveautés", links: ["Nouveautés", "Marques", "La boutique"], stamp: "Nouvelle collection", call: "Appeler la boutique", rev: "4,8 sur Google · 58 avis", act: "Commerce / Boutique" }
  };
  var CSS = '.gsite{position:absolute;inset:0;container-type:inline-size;overflow:hidden;font-family:"Onest",system-ui,sans-serif;--b:#F6EFE4;--k:#3B2516;--a:#B8862B;--m:#7A6555;--s1:#D9A35B;--s2:#8C5527;background:var(--b);color:var(--k);text-align:left}' +
    '.gsite *{box-sizing:border-box}.g-in{position:absolute;inset:0;display:flex;flex-direction:column}' +
    '.g-a{color:var(--a)}' +
    '.g-top{display:none;font-size:1.3cqw;font-weight:600;text-align:center;padding:.6cqw;background:var(--a);color:#fff}' +
    '.g-nav{display:flex;align-items:center;justify-content:space-between;padding:2.6cqw 5cqw}' +
    '.g-logo{display:flex;align-items:center;gap:1.2cqw;font:800 2.2cqw/1 "Schibsted Grotesk","Helvetica Neue",Arial,sans-serif;letter-spacing:-.02em;white-space:nowrap;max-width:46%;overflow:hidden;text-overflow:ellipsis}' +
    '.g-logo i{flex:none;width:3.2cqw;height:3.2cqw;border-radius:50%;background:var(--a)}' +
    '.g-links{display:flex;gap:3cqw;font-size:1.45cqw;color:var(--m)}' +
    '.g-btn{display:inline-flex;align-items:center;justify-content:center;font:700 1.45cqw/1 "Onest",system-ui,sans-serif;padding:1.4cqw 2.4cqw;border-radius:99px;background:var(--k);color:var(--b);white-space:nowrap}' +
    '.g-btn.alt{background:transparent;color:var(--k);box-shadow:inset 0 0 0 .2cqw currentColor}' +
    '.g-hero{flex:1;display:grid;grid-template-columns:1.1fr .9fr;gap:4cqw;align-items:center;padding:1cqw 5cqw 4cqw}' +
    '.g-kick{font-size:1.25cqw;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--a);margin-bottom:1.4cqw}' +
    '.gsite .g-h{font:800 5.2cqw/1 "Schibsted Grotesk","Helvetica Neue",Arial,sans-serif;letter-spacing:-.04em;margin:0 0 2cqw;color:var(--k)}' +
    '.g-h em{font-style:italic;font-weight:500;color:var(--a);font-family:Georgia,"Times New Roman",serif}' +
    '.g-p{font-size:1.5cqw;line-height:1.5;color:var(--m);margin:0 0 2.6cqw;max-width:36ch}' +
    '.g-act{display:flex;gap:1.4cqw;flex-wrap:wrap}' +
    '.g-vis{position:relative;height:100%;min-height:22cqw;display:grid;place-items:center}' +
    '.g-shape{width:80%;height:88%;border-radius:999px 999px 2cqw 2cqw;background:linear-gradient(160deg,var(--s1),var(--s2) 75%)}' +
    '.g-stamp{position:absolute;right:4%;bottom:6%;width:11cqw;height:11cqw;border-radius:50%;background:#F2C14E;color:#3B2516;display:grid;place-items:center;text-align:center;font:800 1.5cqw/1.15 "Schibsted Grotesk",Arial,sans-serif;transform:rotate(-12deg)}' +
    '.g-rev{display:flex;align-items:center;gap:1.2cqw;font-size:1.35cqw;color:var(--m);margin-top:2.4cqw}.g-rev b{color:#E8A317;letter-spacing:.1em;font-size:1.6cqw}' +
    '.g-call{display:none}' +
    '.g-list{position:absolute;inset:12% 10%;display:grid;align-content:center;gap:1.6cqw;font-size:1.35cqw;color:var(--k)}' +
    '.g-list div{display:flex;align-items:center;gap:1.2cqw;background:rgba(255,255,255,.07);border-radius:1cqw;padding:1.4cqw 1.6cqw;backdrop-filter:blur(2px)}' +
    '.g-list i{flex:none;width:2.4cqw;height:2.4cqw;border-radius:50%;background:var(--a);opacity:.9}' +
    /* thèmes */
    '.gsite[data-t=barbier]{--b:#111;--k:#F3EEE6;--a:#C9A45C;--m:#9E978C}' +
    '.gsite[data-t=barbier] .g-h,.gsite[data-t=artisan] .g-h,.gsite[data-t=coach] .g-h{text-transform:uppercase;font-size:5.6cqw;letter-spacing:-.03em}' +
    '.gsite[data-t=barbier] .g-logo{text-transform:uppercase;letter-spacing:.06em}' +
    '.gsite[data-t=barbier] .g-btn,.gsite[data-t=artisan] .g-btn,.gsite[data-t=coach] .g-btn{border-radius:.6cqw;background:var(--a);color:#fff}' +
    '.gsite[data-t=barbier] .g-btn{color:#111}' +
    '.gsite[data-t=barbier] .g-btn.alt,.gsite[data-t=artisan] .g-btn.alt,.gsite[data-t=coach] .g-btn.alt,.gsite[data-t=restaurant] .g-btn.alt{background:transparent;color:var(--k)}' +
    '.gsite[data-t=barbier] .g-shape{border-radius:.6cqw;background:repeating-linear-gradient(135deg,#1C1A17 0 1.2cqw,#211E1A 1.2cqw 2.4cqw);box-shadow:inset 0 0 0 .3cqw #3A3225}' +
    '.gsite[data-t=barbier] .g-stamp,.gsite[data-t=artisan] .g-stamp,.gsite[data-t=restaurant] .g-stamp,.gsite[data-t=beaute] .g-stamp,.gsite[data-t=boutique] .g-stamp{transform:none;width:auto;height:auto;padding:1.4cqw 1.8cqw;border-radius:.8cqw}' +
    '.gsite[data-t=barbier] .g-stamp{background:#C9A45C;color:#111}' +
    '.gsite[data-t=artisan]{--b:#0F2233;--k:#fff;--a:#E07B24;--m:#A9B8C6}.gsite[data-t=artisan] .g-top{display:block}' +
    '.gsite[data-t=artisan] .g-shape{border-radius:1.4cqw;background:#16304A;box-shadow:inset 0 0 0 .2cqw #24496B}.gsite[data-t=artisan] .g-stamp{background:#E07B24;color:#fff}' +
    '.gsite[data-t=coach]{--b:#0B0B0B;--k:#fff;--a:#FF4F1F;--m:#A3A3A3;background:linear-gradient(120deg,#0B0B0B 40%,#2A2A2A)}' +
    '.gsite[data-t=coach] .g-h{font-weight:600}.gsite[data-t=coach] .g-shape{border-radius:1cqw;background:linear-gradient(200deg,#3A3A3A,#141414)}.gsite[data-t=coach] .g-stamp{background:#FF4F1F;color:#fff;transform:rotate(-8deg)}' +
    '.gsite[data-t=restaurant]{--b:#1E1410;--k:#F7EFE6;--a:#E2A23B;--m:#B9A898;--s1:#5A3A28;--s2:#2A1A12}' +
    '.gsite[data-t=restaurant] .g-btn{background:var(--a);color:#1E1410}.gsite[data-t=restaurant] .g-shape{border-radius:2cqw}.gsite[data-t=restaurant] .g-stamp{background:var(--a);color:#1E1410}' +
    '.gsite[data-t=beaute]{--b:#F7EEEA;--k:#3A2A2E;--a:#C2788A;--m:#8A7479;--s1:#EBC3C9;--s2:#C98D99}' +
    '.gsite[data-t=beaute] .g-btn{background:var(--a);color:#fff}.gsite[data-t=beaute] .g-btn.alt{background:transparent;color:var(--k)}.gsite[data-t=beaute] .g-shape{border-radius:999px}.gsite[data-t=beaute] .g-stamp{background:#fff;color:var(--a)}.gsite[data-t=beaute] .g-list div{background:rgba(255,255,255,.55)}' +
    '.gsite[data-t=boutique]{--b:#F4F4F1;--k:#161616;--a:#2F5D50;--m:#6E6E68;--s1:#C9D6CF;--s2:#7E9A8E}' +
    '.gsite[data-t=boutique] .g-shape{border-radius:1cqw}.gsite[data-t=boutique] .g-stamp{background:#161616;color:#fff}' +
    '.gsite[data-t=boulangerie] .g-list,.gsite[data-t=boutique] .g-list{display:none}' +
    /* version téléphone */
    '@container (max-width:330px){' +
    '.g-top{font-size:3.4cqw;padding:11cqw 3cqw 2.4cqw}.g-nav{padding:13cqw 6cqw 4cqw}.g-top + .g-nav{padding-top:4cqw}' +
    '.g-logo{font-size:5.2cqw;max-width:58%;gap:2.4cqw}.g-logo i{width:7cqw;height:7cqw}.g-links{display:none}' +
    '.g-nav .g-btn{font-size:3.4cqw;padding:2.6cqw 3.6cqw}' +
    '.g-hero{grid-template-columns:1fr;align-content:start;gap:5cqw;padding:2cqw 6cqw 22cqw}' +
    '.g-kick{font-size:3cqw;margin-bottom:3cqw}.gsite .g-h,.gsite[data-t] .g-h{font-size:11cqw;margin-bottom:4cqw}' +
    '.g-p{font-size:3.7cqw;margin-bottom:5cqw}.g-act .g-btn{font-size:3.6cqw;padding:3.4cqw 4.6cqw}.g-act .g-btn.alt{display:none}' +
    '.g-rev{font-size:3.4cqw;gap:2cqw;margin-top:5cqw}.g-rev b{font-size:3.8cqw}' +
    '.g-vis{min-height:44cqw;height:44cqw;order:-1}.g-shape{width:100%;height:100%;border-radius:4cqw}' +
    '.g-stamp,.gsite[data-t] .g-stamp{width:auto;height:auto;padding:2.4cqw 3cqw;font-size:3cqw;border-radius:2cqw;right:3cqw;bottom:3cqw}' +
    '.g-list{font-size:3.2cqw;gap:2.4cqw;inset:8% 8%}.g-list div{padding:2.6cqw;border-radius:2cqw}.g-list i{width:4.6cqw;height:4.6cqw}' +
    '.g-call{display:flex;position:absolute;left:5cqw;right:5cqw;bottom:5cqw;justify-content:center;font:700 4cqw/1 "Onest",system-ui,sans-serif;padding:4.4cqw;border-radius:99px;background:var(--a);color:#fff;box-shadow:0 3cqw 8cqw -3cqw rgba(0,0,0,.5)}}' +
    /* construction animée */
    '.gsite [data-b]{opacity:0;transform:translateY(1.6cqw);filter:blur(.4cqw)}' +
    '.gsite.built [data-b]{opacity:1;transform:none;filter:none;transition:opacity .55s ease,transform .7s cubic-bezier(.2,.8,.2,1),filter .55s ease;transition-delay:calc(var(--d,0) * 90ms)}' +
    '.gsite .g-shape[data-b]{transform:scale(.92)}.gsite.built .g-shape[data-b]{transform:none}' +
    '@media (prefers-reduced-motion:reduce){.gsite [data-b]{opacity:1;transform:none;filter:none}}';


  /* Modèles 3D par métier : un dessin SVG extrudé en couches (léger, sans WebGL) */
  var M = {
    boulangerie: { e: "#9A5A1C", svg: '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2C46E"/><stop offset="1" stop-color="#C47A2C"/></linearGradient></defs><g fill="url(#a)" stroke="#9A5A1C" stroke-width="2.2"><ellipse cx="20" cy="80" rx="10" ry="13" transform="rotate(-55 20 80)"/><ellipse cx="100" cy="80" rx="10" ry="13" transform="rotate(55 100 80)"/><ellipse cx="35" cy="64" rx="15" ry="19" transform="rotate(-38 35 64)"/><ellipse cx="85" cy="64" rx="15" ry="19" transform="rotate(38 85 64)"/><ellipse cx="60" cy="56" rx="20" ry="25"/></g><g fill="#FFF3D6" opacity=".55"><ellipse cx="54" cy="44" rx="7" ry="4" transform="rotate(-20 54 44)"/><ellipse cx="31" cy="55" rx="5" ry="3" transform="rotate(-40 31 55)"/><ellipse cx="80" cy="54" rx="5" ry="3" transform="rotate(20 80 54)"/></g>' },
    restaurant: { e: "#6F777E", svg: '<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#C9CED3"/><stop offset="1" stop-color="#8C949B"/></linearGradient></defs><ellipse cx="60" cy="94" rx="54" ry="10" fill="#E9ECEF" stroke="#8C949B" stroke-width="2"/><path d="M16 90a44 44 0 0 1 88 0z" fill="url(#a)" stroke="#8C949B" stroke-width="2"/><rect x="52" y="38" width="16" height="9" rx="4" fill="#B8BEC4"/><circle cx="60" cy="37" r="6" fill="#E2A23B"/><path d="M30 78a32 32 0 0 1 22-28" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/>' },
    barbier: { e: "#6E5A33", svg: '<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F4F6F8"/><stop offset="1" stop-color="#9CA4AC"/></linearGradient></defs><path d="M57 66 86 8 96 14 63 70z" fill="url(#a)" stroke="#6B737B" stroke-width="1.6"/><path d="M63 66 34 8 24 14 57 70z" fill="url(#a)" stroke="#6B737B" stroke-width="1.6"/><g fill="#C9A45C" stroke="#8A6D33" stroke-width="2" fill-rule="evenodd"><path d="M36 76a16 16 0 1 0 .1 0zm0 7a9 9 0 1 1-.1 0z" transform="translate(4 4)"/><path d="M84 76a16 16 0 1 0 .1 0zm0 7a9 9 0 1 1-.1 0z" transform="translate(-4 4)"/><path d="M44 82 55 68 61 72 50 86z"/><path d="M76 82 65 68 59 72 70 86z"/></g><circle cx="60" cy="68" r="5" fill="#3A3225" stroke="#C9A45C" stroke-width="2"/>' },
    beaute: { e: "#A86272", svg: '<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBE3E7"/><stop offset="1" stop-color="#D99AA7"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F3D9A0"/><stop offset="1" stop-color="#B98A3E"/></linearGradient></defs><rect x="46" y="8" width="28" height="22" rx="4" fill="url(#b)"/><rect x="51" y="30" width="18" height="10" fill="#E9CF95"/><rect x="22" y="40" width="76" height="72" rx="20" fill="url(#a)" stroke="#C98D99" stroke-width="2"/><path d="M24 76h72v16a20 20 0 0 1-20 20H44a20 20 0 0 1-20-20z" fill="#E7A2B2" opacity=".75"/><rect x="40" y="62" width="40" height="18" rx="4" fill="#fff" opacity=".9"/><rect x="47" y="69" width="26" height="3" rx="1.5" fill="#C2788A"/><rect x="31" y="48" width="6" height="40" rx="3" fill="#fff" opacity=".7"/>' },
    artisan: { e: "#5D6B78", svg: '<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F1F4F7"/><stop offset="1" stop-color="#93A1AE"/></linearGradient><mask id="m"><rect width="120" height="120" fill="#fff"/><rect x="51" y="-2" width="18" height="30" rx="2" fill="#000"/><circle cx="60" cy="104" r="5" fill="#000"/></mask></defs><g transform="rotate(-40 60 60)" mask="url(#m)"><circle cx="60" cy="24" r="22" fill="url(#a)" stroke="#5D6B78" stroke-width="2"/><rect x="50" y="34" width="20" height="80" rx="10" fill="url(#a)" stroke="#5D6B78" stroke-width="2"/><rect x="50" y="62" width="20" height="52" rx="10" fill="#E07B24" stroke="#A9541A" stroke-width="2"/></g>' },
    coach: { e: "#7A2410", svg: '<g transform="rotate(-18 60 60)"><rect x="24" y="55" width="72" height="10" rx="3" fill="#B9B9B9" stroke="#6B6B6B" stroke-width="1.5"/><rect x="10" y="50" width="8" height="20" rx="2" fill="#3A3A3A"/><rect x="102" y="50" width="8" height="20" rx="2" fill="#3A3A3A"/><g fill="#FF4F1F" stroke="#9E2E0E" stroke-width="2"><rect x="16" y="32" width="12" height="56" rx="4"/><rect x="92" y="32" width="12" height="56" rx="4"/><rect x="28" y="40" width="10" height="40" rx="3"/><rect x="82" y="40" width="10" height="40" rx="3"/></g><g fill="#fff" opacity=".45"><rect x="19" y="36" width="3" height="40" rx="1.5"/><rect x="95" y="36" width="3" height="40" rx="1.5"/></g></g>' },
    boutique: { e: "#1C3A32", svg: '<path d="M42 46c0-30 36-30 36 0" fill="none" stroke="#1C3A32" stroke-width="7" stroke-linecap="round"/><path d="M22 44h76l6 66H16z" fill="#2F5D50" stroke="#1C3A32" stroke-width="2"/><path d="M22 44h76l1 10H21z" fill="#3E7566"/><rect x="66" y="66" width="20" height="26" rx="3" fill="#F4F4F1" transform="rotate(8 76 79)"/><circle cx="76" cy="72" r="2.5" fill="#2F5D50"/><path d="M28 58 25 100" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".35"/>' }
  };
  function mUrl(t) { return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' + M[t].svg + '</svg>') + '")'; }
  var NL = 10;
  function model(t) { var h = ""; for (var k = 0; k < NL; k++) h += '<i style="--k:' + k + '"></i>'; return '<div class="g-3d" data-m3="' + t + '"><div class="g-m">' + h + '</div></div>'; }
  function modelCss() {
    var c = '.g-3d{position:absolute;inset:0;margin:auto;width:64%;height:72%;perspective:70cqw;pointer-events:none}' +
      '.g-3d::after{content:"";position:absolute;left:22%;right:22%;bottom:-2%;height:9%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.38),transparent);animation:g3dSh 7s ease-in-out infinite}' +
      '.g-m{position:absolute;inset:0;transform-style:preserve-3d;animation:g3dSpin 7s ease-in-out infinite}' +
      '.g-m i{position:absolute;inset:0;transform:translateZ(calc((4.5 - var(--k)) * .5cqw));-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;background:color-mix(in srgb,var(--e) calc(100% - var(--k) * 5%),#000)}' +
      '.g-m i:not(:first-child){-webkit-mask-image:var(--img);mask-image:var(--img)}.g-m i:first-child{-webkit-mask:none;mask:none;background:var(--img) center/contain no-repeat}' +
      '@keyframes g3dSpin{0%,100%{transform:translateY(0) rotateX(-6deg) rotateY(-36deg)}25%,75%{transform:translateY(-5%) rotateX(2deg) rotateY(0deg)}50%{transform:translateY(0) rotateX(8deg) rotateY(36deg)}}' +
      '@keyframes g3dSh{0%,50%,100%{transform:scale(1);opacity:1}25%,75%{transform:scale(.8);opacity:.6}}' +
      /* métiers avec une liste : le modèle en haut, la liste compacte en bas */
      '.gsite[data-t] .g-vis:has(.g-list) .g-3d{inset:4% 0 auto;height:50%;width:56%}' +
      '.g-vis:has(.g-list) .g-list{inset:auto 9% 6%;gap:.9cqw;font-size:1.15cqw}.g-vis:has(.g-list) .g-list div{padding:.9cqw 1.2cqw}.g-vis:has(.g-list) .g-list i{width:1.8cqw;height:1.8cqw}' +
      '.g-vis:has(.g-list) .g-stamp{bottom:auto;top:2%;right:0}' +
      '@container (max-width:330px){.g-vis .g-list{display:none}.gsite[data-t] .g-vis .g-3d{inset:0;width:74%;height:92%}.g-vis:has(.g-list) .g-stamp{top:auto;bottom:3cqw;right:3cqw}}' +
      '@media (prefers-reduced-motion:reduce){.g-m{animation:none;transform:rotateY(-24deg)}.g-3d::after{animation:none}}';
    Object.keys(M).forEach(function (t) { c += '.g-3d[data-m3=' + t + ']{--e:' + M[t].e + ';--img:' + mUrl(t) + '}'; });
    return c;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "votre-commerce"; }
  function metier(a) {
    a = (a || "").toLowerCase();
    if (/boulang|pâtiss|patiss|pain/.test(a)) return "boulangerie";
    if (/restau|bistro|brasserie|pizz|cr[eê]p|traiteur|caf[eé]|bar\b|kebab|burger|snack|cuisine/.test(a)) return "restaurant";
    if (/barb|coiff/.test(a)) return "barbier";
    if (/beaut|institut|ongl|esth[eé]t|spa|soin|maquill|massage/.test(a)) return "beaute";
    if (/coach|sport|fitness|yoga|pilates|gym|salle/.test(a)) return "coach";
    if (/plomb|électri|electri|chauff|clim|artisan|rénov|renov|bâtiment|batiment|maçon|macon|peint|menuis|serrur|carrel|plâtr|platr|garage|auto|dépann|depann|jardin|paysag|bain|multiserv|toit|couvreur/.test(a)) return "artisan";
    return "boutique";
  }
  function html(t, nom) {
    var d = T[t] || T.boutique, n = esc(nom || d.def), i = 0, D = function () { return ' data-b style="--d:' + (i++) + '"'; };
    return '<div class="g-in">' + (d.top ? '<div class="g-top"' + D() + '>' + d.top + '</div>' : '') +
      '<div class="g-nav"><div class="g-logo"' + D() + '><i></i><span class="g-name">' + n + '</span></div><div class="g-links"' + D() + '>' + d.links.map(function (l) { return "<span>" + l + "</span>"; }).join("") + '</div><span class="g-btn"' + D() + '>' + d.nav + '</span></div>' +
      '<div class="g-hero"><div><div class="g-kick"' + D() + '>' + d.kick + '</div><div class="g-h" role="presentation"' + D() + '>' + d.h + '</div><p class="g-p"' + D() + '>' + d.p + '</p>' +
      '<div class="g-act"' + D() + '><span class="g-btn">' + d.b1 + '</span><span class="g-btn alt">' + d.b2 + '</span></div><div class="g-rev"' + D() + '><b>★★★★★</b>' + d.rev + '</div></div>' +
      '<div class="g-vis"><div class="g-shape"' + D() + '></div>' + (M[t] ? model(t) : '') + (d.list ? '<div class="g-list"' + D() + '>' + d.list.map(function (l) { return "<div><i></i>" + l + "</div>"; }).join("") + '</div>' : '') + '<div class="g-stamp"' + D() + '>' + d.stamp + '</div></div></div>' +
      '<span class="g-call"' + D() + '>' + d.call + '</span></div>';
  }
  function css() { if (document.getElementById("tw-essai-css")) return; var s = document.createElement("style"); s.id = "tw-essai-css"; s.textContent = CSS + modelCss(); document.head.appendChild(s); }
  function render(el, t, nom) {
    css(); if (!T[t]) t = "boutique";
    el.classList.add("gsite"); el.dataset.t = t; el.classList.remove("built"); el.innerHTML = html(t, nom); void el.offsetWidth;
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("built"); }); });
  }
  function rename(root, nom) { root.querySelectorAll(".g-name").forEach(function (e) { e.textContent = nom; }); }
  function lien(nom, t) { return "https://tissaweb.fr/?pour=" + encodeURIComponent(nom || "") + "&m=" + encodeURIComponent(t || "") + "#essai"; }
  window.TWEssai = { M: M, model: model, T: T, render: render, rename: rename, metier: metier, lien: lien, slug: slug, css: css };
})();
