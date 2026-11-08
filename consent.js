/* TissaWeb : gestion du consentement (art. 82 loi Informatique et Libertés, lignes directrices CNIL 2020-091).
   - Rien de non essentiel n'est lu ni écrit sur l'appareil avant un choix explicite.
   - « Accepter », « Refuser » et « Personnaliser » ont exactement le même poids visuel.
   - Le choix est conservé 6 mois, puis redemandé. Il se modifie à tout moment (lien « Gérer les cookies »).
   - Seul traceur soumis à consentement : la mesure d'audience interne (stats.js). */
(function () {
  var KEY = "tw-consent", VERSION = 1, DUREE = 182 * 864e5;
  window.twTrack = window.twTrack || function () {};

  function lire() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || "null");
      if (c && c.v === VERSION && Date.now() - c.t < DUREE) return c;
    } catch (e) {}
    return null;
  }
  function ecrire(stats) {
    var c = { v: VERSION, t: Date.now(), stats: !!stats };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    appliquer(c);
    fermer();
  }
  function appliquer(c) {
    if (c && c.stats) {
      if (!document.querySelector('script[data-tw-stats]')) {
        var s = document.createElement("script"); s.src = "/stats.js"; s.defer = true; s.setAttribute("data-tw-stats", "");
        document.head.appendChild(s);
      }
    } else {
      try { sessionStorage.removeItem("tw-s"); } catch (e) {}
      window.twTrack = function () {};
    }
  }

  var css =
    ".twc{position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;max-width:560px;margin-inline:auto;background:#F8F9FA;color:#0C1310;border:1px solid #8D9195;border-radius:16px;box-shadow:0 24px 60px -20px rgba(12,19,16,.45);padding:20px;font:15px/1.55 Onest,system-ui,sans-serif}" +
    ".twc h2{font:700 1.05rem/1.3 'Bricolage Grotesque',system-ui,sans-serif;margin:0 0 6px;color:#0C1310}" +
    ".twc p{margin:0 0 14px;color:#33403A}.twc a{color:#0B7A55;text-decoration:underline}" +
    ".twc-btns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}" +
    ".twc button{appearance:none;font:600 15px/1 Onest,system-ui,sans-serif;min-height:44px;padding:10px 12px;border-radius:10px;border:2px solid #0C1310;background:#0C1310;color:#fff;cursor:pointer}" +
    ".twc button:hover{background:#33403A;border-color:#33403A}" +
    ".twc button:focus-visible,.twc input:focus-visible{outline:3px solid #0B7A55;outline-offset:2px}" +
    ".twc-pref{display:none;margin:0 0 14px;border-top:1px solid #8D9195;padding-top:12px}.twc.perso .twc-pref{display:block}" +
    ".twc-row{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:8px 0}" +
    ".twc-row b{display:block;color:#0C1310}.twc-row span{font-size:14px;color:#33403A}" +
    ".twc-row input{width:22px;height:22px;flex:none;margin-top:2px;accent-color:#0B7A55}" +
    ".twc .twc-save{display:none}.twc.perso .twc-save{display:block;width:100%;margin-top:8px}" +
    "@media (max-width:480px){.twc{padding:16px;font-size:14px}.twc button{font-size:14px;padding:10px 6px}}@media (max-width:330px){.twc-btns{grid-template-columns:1fr}}" +
    "[data-theme=dark] .twc{background:#141C18;color:#EBEEF1;border-color:#7D8C85}[data-theme=dark] .twc h2,[data-theme=dark] .twc-row b{color:#EBEEF1}" +
    "[data-theme=dark] .twc p,[data-theme=dark] .twc-row span{color:#AEBBB4}[data-theme=dark] .twc a{color:#3DDC97}" +
    "[data-theme=dark] .twc button{background:#EBEEF1;color:#0C1310;border-color:#EBEEF1}";

  var box = null, retour = null;
  function ouvrir(perso) {
    if (!box) {
      var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
      box = document.createElement("section");
      box.className = "twc"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "false");
      box.setAttribute("aria-labelledby", "twc-t"); box.setAttribute("aria-describedby", "twc-d");
      box.innerHTML =
        '<h2 id="twc-t">Vos choix sur ce site</h2>' +
        '<p id="twc-d">Avec votre accord, nous mesurons la fréquentation du site (pages vues, provenance) pour l\'améliorer. Aucune publicité, aucun réseau social, rien n\'est revendu. Refuser ne change rien à votre visite. <a href="/cookies.html">En savoir plus</a></p>' +
        '<div class="twc-pref" id="twc-pref">' +
          '<div class="twc-row"><label for="twc-n"><b>Fonctionnement du site</b><span>Thème clair/sombre, langue, mémorisation de votre choix. Toujours actifs, indispensables.</span></label><input type="checkbox" id="twc-n" checked disabled></div>' +
          '<div class="twc-row"><label for="twc-s"><b>Mesure d\'audience</b><span>Statistiques internes et anonymes de visite. Conservées 13 mois maximum.</span></label><input type="checkbox" id="twc-s"></div>' +
        '</div>' +
        '<div class="twc-btns"><button type="button" data-c="oui">Accepter</button><button type="button" data-c="non">Refuser</button><button type="button" data-c="perso" aria-controls="twc-pref" aria-expanded="false">Personnaliser</button></div>' +
        '<button type="button" class="twc-save" data-c="save">Enregistrer mes choix</button>';
      document.body.insertBefore(box, document.body.firstChild); /* premier arrêt de tabulation */
      box.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-c]"); if (!b) return;
        var c = b.getAttribute("data-c");
        if (c === "oui") ecrire(true);
        else if (c === "non") ecrire(false);
        else if (c === "save") ecrire(box.querySelector("#twc-s").checked);
        else { box.classList.toggle("perso"); b.setAttribute("aria-expanded", box.classList.contains("perso")); box.querySelector("#twc-s").focus(); }
      });
      box.addEventListener("keydown", function (e) { if (e.key === "Escape" && lire()) fermer(); });
    }
    var c = lire();
    box.querySelector("#twc-s").checked = !!(c && c.stats);
    box.classList.toggle("perso", !!perso);
    box.querySelector('[data-c="perso"]').setAttribute("aria-expanded", !!perso);
    box.hidden = false;
    if (perso) { retour = document.activeElement; setTimeout(function () { box.querySelector("#twc-s").focus({ preventScroll: true }); }, 30); }
  }
  function fermer() { if (box) box.hidden = true; if (retour && retour.focus) try { retour.focus({ preventScroll: true }); } catch (e) {} retour = null; }

  window.twConsent = { ouvrir: ouvrir, etat: lire };
  function init() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-cookies]"); if (!a) return; e.preventDefault(); ouvrir(true);
    });
    var c = lire();
    if (c) appliquer(c); else ouvrir(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
