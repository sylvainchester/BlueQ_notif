const statusEl = document.getElementById('status');
const btnPermission = document.getElementById('btn-permission');
const btnSubscribe = document.getElementById('btn-subscribe');
const subscriptionPanel = document.getElementById('subscription-panel');
const welcomeEl = document.getElementById('welcome');
const welcomeMessageEl = document.getElementById('welcome-message');

const emailInput = document.getElementById('email');
const savedEmailKey = 'blueq_push_email';

let swRegistration;
let vapidPublicKey;

function setStatus(message) {
  statusEl.textContent = message;
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function showWelcome(email) {
  welcomeMessageEl.textContent = `Welcome ${email}`;
  subscriptionPanel.classList.add('hidden');
  welcomeEl.classList.remove('hidden');
}

function getSavedEmail() {
  return normalizeEmail(localStorage.getItem(savedEmailKey) || '');
}

function saveEmail(email) {
  localStorage.setItem(savedEmailKey, normalizeEmail(email));
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
    throw new Error('Unable to load server configuration.');
  }
  const data = await response.json();
  vapidPublicKey = data.vapidPublicKey;
  if (!vapidPublicKey) {
    throw new Error('Missing VAPID public key on the server.');
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker is not supported by this browser.');
  }
  swRegistration = await navigator.serviceWorker.register('/sw.js');
}

async function requestPermission() {
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    throw new Error(`Notification permission denied (${result}).`);
  }
}

async function subscribePush() {
  const email = normalizeEmail(emailInput.value);
  if (!email) {
    throw new Error('Enter an email address before subscribing.');
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
    throw new Error(`Failed to save subscription: ${body}`);
  }

  saveEmail(email);
  return subscription;
}

btnPermission.addEventListener('click', async () => {
  try {
    await requestPermission();
    setStatus('Notification permission: granted');
  } catch (error) {
    setStatus(error.message);
  }
});

btnSubscribe.addEventListener('click', async () => {
  try {
    setStatus('Subscribing...');
    await requestPermission();
    const subscription = await subscribePush();
    showWelcome(normalizeEmail(emailInput.value));
  } catch (error) {
    setStatus(error.message);
  }
});

(async function init() {
  try {
    setStatus('Initializing...');
    await registerServiceWorker();
    await loadConfig();

    const savedEmail = getSavedEmail();
    if (savedEmail) {
      emailInput.value = savedEmail;
    }

    if (Notification.permission === 'granted') {
      const existingSubscription = await swRegistration.pushManager.getSubscription();
      if (existingSubscription && savedEmail) {
        showWelcome(savedEmail);
        return;
      }
    }

    setStatus('Ready. Enter your email, allow notifications, then confirm the subscription.');
  } catch (error) {
    setStatus(error.message);
  }
})();
