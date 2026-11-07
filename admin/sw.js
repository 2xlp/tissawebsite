/* TissaWeb Admin — notifications push */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "TissaWeb", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "TissaWeb", { body: d.body || "", icon: "icon-180.png", badge: "icon-180.png", tag: d.tag || "tw", renotify: true, data: { url: d.url || "/admin/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/admin/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.includes("/admin")) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
