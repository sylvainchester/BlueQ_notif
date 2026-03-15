const statusEl = document.getElementById('status');
const btnPermission = document.getElementById('btn-permission');
const btnSubscribe = document.getElementById('btn-subscribe');

const emailInput = document.getElementById('email');

let swRegistration;
let vapidPublicKey;

function setStatus(message) {
  statusEl.textContent = message;
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
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
  const email = normalizeEmail(emailInput.value);
  if (!email) {
    throw new Error('Saisis un email avant de t abonner.');
  }

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
      email,
      subscription
    })
  });

  if (!saveResponse.ok) {
    const body = await saveResponse.text();
    throw new Error(`Echec sauvegarde abonnement: ${body}`);
  }

  return subscription;
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
    setStatus(`Abonnement actif pour ${normalizeEmail(emailInput.value)}.\nEndpoint: ${subscription.endpoint}`);
  } catch (error) {
    setStatus(error.message);
  }
});

(async function init() {
  try {
    setStatus('Initialisation...');
    await registerServiceWorker();
    await loadConfig();
    setStatus('Pret. Saisis ton email, autorise les notifications, puis confirme l abonnement.');
  } catch (error) {
    setStatus(error.message);
  }
})();
