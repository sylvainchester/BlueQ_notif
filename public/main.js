const statusEl = document.getElementById('status');
const btnPermission = document.getElementById('btn-permission');
const btnSubscribe = document.getElementById('btn-subscribe');
const btnTest = document.getElementById('btn-test');

const titleInput = document.getElementById('title');
const bodyInput = document.getElementById('body');
const urlInput = document.getElementById('url');
const tokenInput = document.getElementById('token');

let swRegistration;
let vapidPublicKey;

function setStatus(message) {
  statusEl.textContent = message;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function loadConfig() {
  const response = await fetch('/api/config');
  if (!response.ok) {
    throw new Error('Impossible de charger la configuration serveur.');
  }
  const data = await response.json();
  vapidPublicKey = data.vapidPublicKey;
  if (!vapidPublicKey) {
    throw new Error('VAPID public key manquante sur le serveur.');
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker non supporte par ce navigateur.');
  }
  swRegistration = await navigator.serviceWorker.register('/sw.js');
}

async function requestPermission() {
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    throw new Error(`Permission refusee (${result}).`);
  }
}

async function subscribePush() {
  let subscription = await swRegistration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
  }

  const saveResponse = await fetch('/api/subscribe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      subscription
    })
  });

  if (!saveResponse.ok) {
    const body = await saveResponse.text();
    throw new Error(`Echec sauvegarde abonnement: ${body}`);
  }

  return subscription;
}

async function sendTestNotification() {
  const response = await fetch('/api/notify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': tokenInput.value.trim()
    },
    body: JSON.stringify({
      title: titleInput.value.trim() || 'Notification',
      body: bodyInput.value.trim() || 'Message',
      url: urlInput.value.trim() || '/'
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Erreur HTTP ${response.status}`);
  }

  return payload;
}

btnPermission.addEventListener('click', async () => {
  try {
    await requestPermission();
    setStatus('Permission notifications: OK');
  } catch (error) {
    setStatus(error.message);
  }
});

btnSubscribe.addEventListener('click', async () => {
  try {
    setStatus('Abonnement en cours...');
    await requestPermission();
    const subscription = await subscribePush();
    setStatus(`Abonnement actif.\nEndpoint: ${subscription.endpoint}`);
  } catch (error) {
    setStatus(error.message);
  }
});

btnTest.addEventListener('click', async () => {
  try {
    setStatus('Envoi en cours...');
    const result = await sendTestNotification();
    setStatus(`Notification envoyee. Succes: ${result.success}, erreurs: ${result.failed}`);
  } catch (error) {
    setStatus(error.message);
  }
});

(async function init() {
  try {
    setStatus('Initialisation...');
    await registerServiceWorker();
    await loadConfig();
    setStatus('Pret. Autorise puis abonne le navigateur.');
  } catch (error) {
    setStatus(error.message);
  }
})();
