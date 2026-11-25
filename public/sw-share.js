// Handles Android Web Share Target POST requests containing shared Zalo/browser images & text
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await req.formData();
          const title = String(formData.get('title') || '');
          const text = String(formData.get('text') || '');
          const sharedUrl = String(formData.get('url') || '');
          const file = formData.get('image');

          const cache = await caches.open('safeai-share-target-v1');
          if (file && typeof file === 'object' && 'arrayBuffer' in file) {
            const headers = new Headers({
              'Content-Type': file.type || 'image/png',
              'X-Share-Text': encodeURIComponent([title, text, sharedUrl].filter(Boolean).join(' ')),
            });
            await cache.put('/__shared-image', new Response(file, { headers }));
          } else {
            await cache.delete('/__shared-image');
          }

          const combinedText = [title, text, sharedUrl].filter(Boolean).join(' ').trim();
          const qs = new URLSearchParams({ shared: '1' });
          if (combinedText) qs.set('text', combinedText.slice(0, 1200));
          return Response.redirect(`/?${qs.toString()}`, 303);
        } catch {
          return Response.redirect('/?shared=error', 303);
        }
      })()
    );
  }
});
