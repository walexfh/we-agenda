// Service Worker para Lembretes Reais e Web Push — W&E.Agenda (Etapa 3)

self.addEventListener('install', (event) => {
  // Ativação imediata do novo worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Manipulador de eventos de notificação Push recebidos do servidor
self.addEventListener('push', (event) => {
  let data = {
    title: 'Lembrete da Agenda',
    body: 'Você tem um compromisso ou vencimento agendado.',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'Abrir Agenda' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clique na notificação leva o usuário diretamente ao app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já houver janela aberta, focar nela
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não houver, abrir nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
