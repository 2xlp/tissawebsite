/* TissAlternance : retour de Google après « Connecter mon Gmail ».
   Le code reçu est échangé côté serveur (fonction tw-alternance, action gconnect) ; on garde ici seulement l'adresse et un jeton signé. */
(function () {
  var API = "https://fhfnwvhhpmvmbqmlhruk.supabase.co/functions/v1/tw-alternance";
  var q = new URLSearchParams(location.search);
  function fin(titre, texte) {
    document.getElementById("g-t").textContent = titre;
    document.getElementById("g-s").textContent = texte;
    document.getElementById("g-back").hidden = false;
  }
  var st = null;
  try { st = sessionStorage.getItem("tw-alt-gstate"); sessionStorage.removeItem("tw-alt-gstate"); } catch (e) {}
  history.replaceState(null, "", location.pathname);
  if (q.get("error")) return fin("Connexion annulée", "Tu n'as pas terminé la connexion avec Google. Tu peux réessayer quand tu veux depuis l'appli.");
  if (!q.get("code")) return fin("Rien à faire ici", "Ouvre TissAlternance et touche « Connecter mon Gmail ».");
  if (!st || st !== q.get("state")) return fin("Connexion interrompue", "Pour ta sécurité, relance « Connecter mon Gmail » depuis l'appli, dans le même navigateur.");
  if (st.charAt(0) === "L") {
    document.getElementById("g-t").textContent = "Connexion à ton compte…";
    fetch(API + "?action=glogin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: q.get("code") }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Erreur " + r.status); return d; }); })
      .then(function (d) {
        try { sessionStorage.setItem("tw-alt-login", JSON.stringify(d)); } catch (e) {}
        document.getElementById("g-t").textContent = "Connecté ✓";
        document.getElementById("g-s").textContent = d.email + " · retour à l'appli…";
        location.replace("/alternance/");
      })
      .catch(function (e) { fin("Connexion impossible", e.message); });
    return;
  }
  fetch(API + "?action=gconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: q.get("code") }) })
    .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Erreur " + r.status); return d; }); })
    .then(function (d) {
      var S = {};
      try { S = JSON.parse(localStorage.getItem("tw-alt") || "{}") || {}; } catch (e) {}
      S.gmail = { email: d.email, v: d.jeton };
      try { localStorage.setItem("tw-alt", JSON.stringify(S)); } catch (e) {}
      document.getElementById("g-t").textContent = "Gmail connecté ✓";
      document.getElementById("g-s").textContent = "Tes candidatures partiront de " + d.email + ". Retour à l'appli…";
      setTimeout(function () { location.replace("/alternance/?gmail=ok"); }, 900);
    })
    .catch(function (e) { fin("Connexion impossible", e.message); });
})();
