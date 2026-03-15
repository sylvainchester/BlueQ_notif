const statusEl = document.getElementById('status');
const btnPermission = document.getElementById('btn-permission');
const btnSubscribe = document.getElementById('btn-subscribe');
const subscriptionPanel = document.getElementById('subscription-panel');
const welcomeEl = document.getElementById('welcome');
const welcomeMessageEl = document.getElementById('welcome-message');
const assignmentViewEl = document.getElementById('assignment-view');
const assignmentTitleEl = document.getElementById('assignment-title');
const assignmentCopyEl = document.getElementById('assignment-copy');
const assignmentStatusEl = document.getElementById('assignment-status');
const pdfFrameEl = document.getElementById('pdf-frame');
const ackCheckboxEl = document.getElementById('ack-checkbox');
const ackSubmitEl = document.getElementById('ack-submit');

const emailInput = document.getElementById('email');
const savedEmailKey = 'blueq_push_email';
let currentAssignment = null;

let swRegistration;
let vapidPublicKey;

function setStatus(message) {
  statusEl.textContent = message;
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function showWelcome(email) {
  assignmentViewEl.classList.add('hidden');
  welcomeMessageEl.textContent = `Welcome ${email}`;
  subscriptionPanel.classList.add('hidden');
  welcomeEl.classList.remove('hidden');
}

function showAssignment(assignment) {
  currentAssignment = assignment;
  welcomeEl.classList.add('hidden');
  subscriptionPanel.classList.add('hidden');
  assignmentTitleEl.textContent = 'Task assignment';
  assignmentCopyEl.textContent = `You have been assigned to task ${assignment.taskName}. Please review the information below and confirm.`;
  pdfFrameEl.src = assignment.pdfUrl;
  ackCheckboxEl.checked = Boolean(assignment.acknowledged);
  ackSubmitEl.disabled = Boolean(assignment.acknowledged);
  assignmentStatusEl.textContent = assignment.acknowledged
    ? `Already acknowledged on ${new Date(assignment.acknowledgedAt).toLocaleString()}.`
    : '';
  assignmentViewEl.classList.remove('hidden');
}

function getSavedEmail() {
  return normalizeEmail(localStorage.getItem(savedEmailKey) || '');
}

function saveEmail(email) {
  localStorage.setItem(savedEmailKey, normalizeEmail(email));
}

function getAssignmentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const assignmentId = Number(params.get('assignment'));
  return Number.isInteger(assignmentId) && assignmentId > 0 ? assignmentId : null;
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

async function loadAssignment(assignmentId) {
  const response = await fetch(`/api/assignment?id=${assignmentId}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to load assignment.');
  }

  return payload;
}

async function acknowledgeAssignment() {
  if (!currentAssignment) {
    throw new Error('No assignment loaded.');
  }

  if (!ackCheckboxEl.checked) {
    throw new Error('Please confirm that you acknowledge the information.');
  }

  const email = getSavedEmail();
  if (!email) {
    throw new Error('No saved email found on this device.');
  }

  const response = await fetch('/api/acknowledge', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      assignmentId: currentAssignment.id,
      email
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Unable to submit acknowledgement.');
  }

  currentAssignment = {
    ...currentAssignment,
    acknowledged: true,
    acknowledgedAt: payload.acknowledgedAt
  };

  assignmentStatusEl.textContent = 'Acknowledgement submitted.';
  ackSubmitEl.disabled = true;
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
    await subscribePush();
    showWelcome(normalizeEmail(emailInput.value));
  } catch (error) {
    setStatus(error.message);
  }
});

ackSubmitEl.addEventListener('click', async () => {
  try {
    assignmentStatusEl.textContent = 'Submitting...';
    await acknowledgeAssignment();
  } catch (error) {
    assignmentStatusEl.textContent = error.message;
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

    const assignmentId = getAssignmentIdFromUrl();
    if (assignmentId) {
      const assignment = await loadAssignment(assignmentId);
      if (savedEmail && assignment.email !== savedEmail) {
        setStatus(`This assignment is for ${assignment.email}.`);
        return;
      }
      showAssignment(assignment);
      return;
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
