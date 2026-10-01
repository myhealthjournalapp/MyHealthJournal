const CACHE_NAME = 'my-health-journal-v1.0.0.0';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./enhancements.js','./google-api.js','./email-templates.js','./runtime-config.js','./reliability.js','./email-triggers.html','./email_icon.png','./whatsapp_icon.png','./manifest.json','./app-logo.png','./reporting-logo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('my-health-journal-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.some(a=>new URL(a,self.location.href).pathname===url.pathname)) return;
  e.respondWith(fetch(e.request).then(res=>{if(res.ok){const copy=res.clone();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.put(e.request,copy)));}return res;}).catch(async()=>await caches.match(e.request)||new Response('Offline',{status:503})));
});
