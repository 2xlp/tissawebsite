/* TissAlternance : fonctionne hors connexion pour l'interface (profil, CV, lettres, suivi).
   La recherche d'entreprises passe toujours par le réseau. Changer V à chaque mise à jour des fichiers. */
var V = "ta-v14";
var SHELL = ["/alternance/", "/alternance/app.css", "/alternance/app.js", "/alternance/cv.js", "/alternance/vendor/jspdf.umd.min.js",
  "/alternance/icon-192.png", "/alternance/fonts/onest-400.ttf", "/alternance/fonts/onest-600.ttf", "/alternance/fonts/onest-700.ttf", "/alternance/fonts/bricolage-700.ttf", "/alternance/fonts/bricolage-800.ttf", "/alternance/fonts/dmserif-400.ttf", "/alternance/fonts/archivoblack-400.ttf", "/fonts/fonts.css", "/fonts/onest-latin-wght-normal.woff2", "/fonts/bricolage-grotesque-latin-opsz-normal.woff2"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (n) { return n.indexOf("ta-") === 0 && n !== V; }).map(function (n) { return caches.delete(n); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    var home = u.pathname === "/alternance/" || u.pathname === "/alternance/index.html";
    e.respondWith(fetch(e.request).then(function (r) { if (home && r.ok) { var c = r.clone(); caches.open(V).then(function (x) { x.put("/alternance/", c); }); } return r; })
      .catch(function () { return caches.match("/alternance/"); }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    var net = fetch(e.request).then(function (r) { if (r.ok) { var c = r.clone(); caches.open(V).then(function (x) { x.put(e.request, c); }); } return r; });
    return hit || net;
  }));
});
