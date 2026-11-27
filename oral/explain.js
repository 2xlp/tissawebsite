/* Clic sur un chiffre : petite bulle qui explique d'où il vient */
(function(){
const X=[
 // Marché
 ['marche','.mk-nums .card:nth-child(1) .mk-n',"<b>42 295 entreprises</b>Toutes les entreprises de Côte-d'Or en 2023 (dernier chiffre publié). Source : fiche statistique Bpifrance Création 2025."],
 ['marche','.mk-nums .card:nth-child(2) .mk-n',"<b>7 438 créations en 2025</b>Chaque année, des milliers de nouvelles entreprises qui doivent trouver leurs premiers clients : notre réservoir de prospects. 66,4 % sont des micro-entreprises."],
 ['marche','.mk-nums .card:nth-child(3) .mk-n',"<b>40 % utilisent l'IA</b>Baromètre France Num 2026, plus de 9 000 TPE-PME interrogées. Les petites entreprises sont prêtes pour un outil automatique."],
 ['marche','.mk-nums .card:nth-child(4) .mk-n',"<b>0,06 %</b>25 abonnés visés en fin d'année 1 ÷ 42 295 entreprises de Côte-d'Or = 0,06 %. Même sans sortir du département, l'objectif est atteignable."],
 // Positionnement
 ['position','.pp.me span',"<b>TissaWeb</b>49 à 99 €/mois, et on fait tout : mise en place, mails, tri des réponses. Les logiciels sont moins chers mais à configurer soi-même ; les agences font tout mais coûtent 1 500 €/mois."],
 // Offre
 ['offre','.row.c3 .card:nth-child(1) .price',"<b>Mise en place, 99 € une fois</b>On importe ses prospects, on règle l'envoi et on écrit ses modèles de mails avec lui. Environ 2 h de travail pour nous."],
 ['offre','.row.c3 .card:nth-child(2) .price',"<b>Starter, 49 €/mois</b>100 prospects par mois et 1 relance. Un seul chantier gagné rembourse plusieurs mois d'abonnement."],
 ['offre','.row.c3 .card:nth-child(3) .price',"<b>Pro, 99 €/mois</b>300 prospects, tri automatique des réponses, alertes et bilan chaque semaine. On pense qu'1 client sur 3 le choisit."],
 // Chiffres
 ['chiffres','.num[data-n="13405"]',"<b>13 405 € sur 12 mois</b>10 435 € d'abonnements (somme des 12 barres) + 30 mises en place × 99 € = 2 970 €. Détail mois par mois : diapo « Progression des abonnés »."],
 ['chiffres','.num[data-n="4361"]',"<b>4 361 € par associé</b>13 405 € − 3 458 € d'URSSAF − 1 226 € de charges = 8 721 € de bénéfice, partagé en deux (50/50)."],
 ['chiffres','.num[data-n="65"]',"<b>65 % de marge</b>8 721 € de bénéfice ÷ 13 405 € de chiffre d'affaires = 65 %. Sur 100 € encaissés, il en reste 65."],
 ['chiffres','.art img',"<b>Revenu de chaque mois</b>Nombre d'abonnés du mois × 66 € de panier moyen. De 3 abonnés en avril (205 €) à 25 en mars (1 671 €)."],
 // Charges
 ['charges','.mid b',"<b>1 226 € par an</b>Somme des 8 lignes : 390 + 280 + 200 + 180 + 120 + 26 + 20 + 10 = 1 226 €, soit environ 102 € par mois."],
 ['charges','.be .num',"<b>3 abonnés suffisent</b>Un abonné rapporte 66 €, moins 25,8 % d'URSSAF ≈ 49 € net. 102 € de charges par mois ÷ 49 € ≈ 2,1 : dès le 3e abonné, tout est payé."],
 // Charges de chacun
 ['charges-perso','.fx-c:nth-child(1) .fx-t',"<b>Hugo : 79 €/mois</b>5 + 10 + 10 + 22 + 22 + 10 = 79 €, × 12 mois = 948 € par an."],
 ['charges-perso','.fx-c:nth-child(2) .fx-t',"<b>Clémence : 89 €/mois</b>5 + 10 + 10 + 22 + 12 + 30 = 89 €, × 12 mois = 1 068 € par an. Plus de déplacements : c'est elle qui va voir les clients."],
 ['charges-perso','.fx-r:nth-child(2) em',"<b>Électricité</b>Un PC + écran ≈ 150 W, 4 h par jour, 21 jours ≈ 13 kWh, à environ 0,25 € le kWh ≈ 3 à 5 € par mois."],
 ['charges-perso','.fx-r:nth-child(5) em',"<b>Ordinateur</b>Un PC à 800 € qui dure 3 ans : 800 € ÷ 36 mois ≈ 22 € par mois (amortissement)."],
 // Scénarios
 ['scenarios','tbody tr:nth-child(1) td:not(:first-child)',"<b>Abonnés en fin d'année</b>Toutes les signatures de l'année, moins les départs (5 % par mois). Pessimiste ≈ 1 signature/mois, réaliste 2 à 4, optimiste ≈ 4,5."],
 ['scenarios','tbody tr:nth-child(2) td:not(:first-child)',"<b>Revenu mensuel final</b>Abonnés en mars × 66 € de panier moyen. Réaliste : 25 × 66 € ≈ 1 671 €."],
 ['scenarios','tbody tr:nth-child(3) td:not(:first-child)',"<b>Chiffre d'affaires</b>Les 12 mois d'abonnements + les mises en place à 99 €. Réaliste : 10 435 € + 2 970 € = 13 405 €."],
 ['scenarios','tbody tr:nth-child(4) td:not(:first-child)',"<b>Cotisations URSSAF</b>25,8 % du chiffre d'affaires (micro-entreprise). Réaliste : 13 405 € × 25,8 % = 3 458 €."],
 ['scenarios','tbody tr:nth-child(5) td:not(:first-child)',"<b>Charges fixes</b>Les mêmes 1 226 € par an dans les 3 scénarios (outils, assurance, domaine…)."],
 ['scenarios','tbody tr:nth-child(6) td:not(:first-child)',"<b>Bénéfice net</b>Chiffre d'affaires − URSSAF − charges. Réaliste : 13 405 − 3 458 − 1 226 = 8 721 €."],
 ['scenarios','tbody tr:nth-child(7) td:not(:first-child)',"<b>Par associé</b>Le bénéfice divisé par 2 : on partage à 50/50."],
 // Progression
 ['progression','.pg-funnel div:nth-child(1) b',"<b>300 artisans par mois</b>Environ 15 mails par jour ouvré, écrits et envoyés tout seuls par l'appli, étalés le matin pour ne pas tomber en spam."],
 ['progression','.pg-funnel div:nth-child(2) b',"<b>15 réponses</b>5 % de 300. Hypothèse prudente pour des mails personnalisés et bien ciblés. L'appli relance à 7 jours et range les réponses."],
 ['progression','.pg-funnel div:nth-child(3) b',"<b>7 démos</b>1 réponse sur 2 accepte une démo gratuite en visio. C'est nous qui la faisons."],
 ['progression','.pg-funnel div:nth-child(4) b',"<b>≈ 3 signatures</b>40 % des démos signent : 7 × 40 % ≈ 2,8, donc environ 3 nouveaux abonnés par mois."],
 ['progression','.pg-hyp .pm b',"<b>Panier moyen 66 €</b>Sur 3 clients, 2 prennent Starter (49 €) et 1 prend Pro (99 €) : (49 + 49 + 99) ÷ 3 = 65,67 €. C'est ce qu'un client rapporte en moyenne chaque mois."],
 ['progression','.pg-hyp span:nth-child(2) b',"<b>5 % de résiliation</b>Sur 20 abonnés, 1 part chaque mois en moyenne. Plus on a d'abonnés, plus il y a de départs : c'est pour ça que la colonne grandit."],
 ['progression','.pg-t tbody td:nth-child(4)',"<b>Abonnés</b>Abonnés du mois d'avant + nouveaux − départs."],
 ['progression','.pg-t tbody td:nth-child(5)',"<b>Revenu du mois</b>Abonnés × 66 € de panier moyen (environ : les clients arrivés en cours de mois ne paient pas le mois entier)."],
 ['progression','.pg-t tfoot td:nth-child(6)',"<b>13 405 €</b>10 435 € d'abonnements + 30 mises en place × 99 €. La mise en place est offerte à 2 des 3 clients de la bêta (32 signatures, 30 payantes)."],
 // Sites
 ['sites','.st-calc div:nth-child(2) b',"<b>Prix moyen 583 €</b>Sur 3 sites, 2 Essentiel (450 €) et 1 Professionnel (850 €) : (450 + 450 + 850) ÷ 3 = 583 €."],
 ['sites','.st-calc div:nth-child(3) b',"<b>Entretien</b>1 site sur 3 prend l'entretien à 30 €/mois : 12 sites → 4 contrats, qui démarrent au fil de l'année."],
 ['sites','.st-l:nth-child(2) em',"<b>660 € d'entretien</b>1 contrat en plus tous les 3 mois : en additionnant les mois payés, ça fait 22 mois × 30 € = 660 €."],
 ['sites','.st-big b',"<b>21 065 € au total</b>7 660 € de sites + 13 405 € d'appli. L'appli fait 64 % du chiffre d'affaires, les sites 36 %."],
];
const tip=document.createElement('div');tip.id='extip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.appendChild(tip);
let curEl=null;
for(const [id,sel,txt] of X){document.querySelectorAll(`.step[data-id="${id}"] ${sel}`).forEach(el=>{el.classList.add('ex');el.dataset.ex=txt;el.tabIndex=0;el.setAttribute('role','button')})}
const hide=()=>{tip.hidden=true;if(curEl)curEl.classList.remove('exon');curEl=null};
const show=el=>{if(curEl===el){hide();return}hide();curEl=el;el.classList.add('exon');tip.innerHTML=el.dataset.ex+'<small>Clique ailleurs pour fermer</small>';tip.hidden=false;
  const r=el.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight,pad=10;
  let x=r.left+r.width/2-tw/2;x=Math.max(pad,Math.min(innerWidth-tw-pad,x));
  let y=r.bottom+12;if(y+th>innerHeight-90)y=Math.max(pad,r.top-th-12);
  tip.style.left=x+'px';tip.style.top=y+'px'};
document.addEventListener('click',e=>{const el=e.target.closest('.ex');const st=el&&el.closest('.step');
  if(el&&st&&st.classList.contains('on')){e.stopPropagation();e.preventDefault();show(el);return}
  if(!e.target.closest('#extip'))hide()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();if((e.key==='Enter'||e.key===' ')&&document.activeElement&&document.activeElement.classList.contains('ex')){e.preventDefault();e.stopPropagation();show(document.activeElement)}},true);
addEventListener('resize',hide);addEventListener('hashchange',hide);
new MutationObserver(()=>{if(curEl&&!curEl.closest('.step.on'))hide()}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
})();
