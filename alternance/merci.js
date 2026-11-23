/* TissAlternance : retour de Stripe après l'achat du Pass. Le serveur vérifie le paiement et renvoie un jeton signé. */
(function () {
  var API = "https://fhfnwvhhpmvmbqmlhruk.supabase.co/functions/v1/tw-alternance";
  var id = new URLSearchParams(location.search).get("session_id") || "";
  function fin(t, s) { document.getElementById("m-t").textContent = t; document.getElementById("m-s").textContent = s; document.getElementById("m-back").hidden = false; }
  if (!id) return fin("Rien à activer ici", "Ouvre TissAlternance et touche « Débloquer le Pass ».");
  var essais = 0;
  (function go() {
    fetch(API + "?action=pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: id }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Erreur " + r.status); return d; }); })
      .then(function (d) {
        var S = {}; try { S = JSON.parse(localStorage.getItem("tw-alt") || "{}") || {}; } catch (e) {}
        S.pass = { tier: d.tier, email: d.email, v: d.jeton };
        try { localStorage.setItem("tw-alt", JSON.stringify(S)); } catch (e) {}
        document.getElementById("m-t").textContent = "Merci ! Pass " + (d.tier === "pro" ? "Pro" : "Essentiel") + " activé ✓";
        document.getElementById("m-s").textContent = "Un reçu t'a été envoyé par mail. Sur un autre appareil, utilise « Récupérer mon Pass » avec " + d.email + ".";
        setTimeout(function () { location.replace("/alternance/?pass=ok"); }, 2200);
      })
      .catch(function (e) { if (++essais < 4 && /pas encore validé/.test(e.message)) return setTimeout(go, 3000); fin("Activation impossible pour l'instant", e.message + " Ton paiement est bien enregistré : utilise « Récupérer mon Pass » dans l'appli avec ton adresse mail."); });
  })();
})();
