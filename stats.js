/* TissaWeb : mesure d'audience anonyme (sans cookie, sans adresse IP).
   Ne compte pas les visites de l'équipe (appareils connectés à l'appli). */
(function () {
  var URL = "https://fhfnwvhhpmvmbqmlhruk.supabase.co/rest/v1/visites";
  var KEY = "sb_publishable_THAhHaBkdN8wkeFG7BculA_EgfjV6QV";
  function get(s, k) { try { return s.getItem(k); } catch (e) { return null; } }
  if (get(window.localStorage, "tw-admin") === "1" || /^(localhost|127\.|file)/.test(location.hostname || "file") || navigator.webdriver) { window.twTrack = function () {}; return; }
  var ses = get(window.sessionStorage, "tw-s");
  if (!ses) { ses = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-6); try { sessionStorage.setItem("tw-s", ses); } catch (e) {} }
  var q = new URLSearchParams(location.search), ref = "", src = "direct";
  try { if (document.referrer) { var h = new URL(document.referrer).hostname.replace(/^www\./, ""); if (h && h !== location.hostname.replace(/^www\./, "")) ref = h.slice(0, 80); } } catch (e) {}
  if (q.get("utm_source")) src = q.get("utm_source");
  else if (/google\./.test(ref)) src = "google"; else if (/bing\.|duckduckgo|qwant|ecosia|yahoo/.test(ref)) src = "autre moteur";
  else if (/instagram/.test(ref)) src = "instagram"; else if (/facebook|fb\./.test(ref)) src = "facebook";
  else if (/tiktok/.test(ref)) src = "tiktok"; else if (/linkedin/.test(ref)) src = "linkedin";
  else if (/mail|outlook|gmail/.test(ref)) src = "mail"; else if (ref) src = "autre site";
  var dev = /iPad|Tablet/i.test(navigator.userAgent) ? "tablette" : /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "ordinateur";
  var lang = (get(window.localStorage, "tw-lang") || q.get("lang") || (navigator.language || "fr")).slice(0, 2);
  var sent = {};
  window.twTrack = function (event) {
    event = event || "view";
    if (event !== "view" && sent[event]) return; sent[event] = 1;   // une seule fois par page pour les actions
    try {
      fetch(URL, { method: "POST", keepalive: true, headers: { apikey: KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ event: event, page: (location.pathname || "/").slice(0, 120), source: String(src).slice(0, 40), ref: ref, lang: lang, device: dev, session: ses.slice(0, 24) }) }).catch(function () {});
    } catch (e) {}
  };
  twTrack("view");
  if (/merci/.test(location.pathname)) twTrack("form");
  // Actions utiles à compter
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("a,button"); if (!t) return;
    if (t.id === "twChatBtn") twTrack("chat");
    else if (t.classList.contains("tw-demo-cta") || /demo-/.test(t.getAttribute("href") || "")) twTrack("demo");
    else if (/^mailto:/.test(t.getAttribute("href") || "")) twTrack("mail");
  }, true);
  document.addEventListener("change", function (e) { if (e.target.closest && e.target.closest(".sim")) twTrack("sim"); }, true);
})();
