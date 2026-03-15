# BlueQ Notif PWA

PWA minimale pour recevoir des notifications web push, stocker les abonnements et les affectations dans Google Sheets, et gérer un flux d'acknowledgement sur PDF.

## 1) Preparer Google Sheets

Creer un Google Sheet et partager ce fichier avec le compte de service Google utilise par Vercel.

Le projet gere automatiquement deux onglets :

- `subscriptions`
- `assignments`

## 2) Generer des cles VAPID

Tu peux générer les clés avec:

```bash
npx web-push generate-vapid-keys
```

## 3) Variables d'environnement Vercel

Configurer dans le projet Vercel:

- `GOOGLE_SHEETS_SPREADSHEET_ID=...`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL=...`
- `GOOGLE_PRIVATE_KEY=...`
- `VAPID_PUBLIC_KEY=...`
- `VAPID_PRIVATE_KEY=...`
- `VAPID_SUBJECT=mailto:ton-email@domaine.com` (optionnel)
- `PUSH_ADMIN_TOKEN=un-secret` (optionnel mais recommandé)
- `APP_URL=https://blueqnotif.vercel.app` (recommandé pour les liens de notification)
- `GOOGLE_SHEETS_ACK_WEBHOOK_URL=...` (optionnel, pour écrire dans Google Sheets au submit)
- `GOOGLE_SHEETS_SUBSCRIPTIONS_TAB=subscriptions` (optionnel)
- `GOOGLE_SHEETS_ASSIGNMENTS_TAB=assignments` (optionnel)

Pour `GOOGLE_PRIVATE_KEY`, colle la cle privee complete du compte de service, y compris les sauts de ligne.

## 4) Lancer en local

```bash
npm install
npm run dev
```

Ensuite:
1. Ouvre l'app dans le navigateur (Chrome/Edge conseillé).
2. Saisis un email.
3. Clique `Allow notifications`.
4. Clique `Subscribe to push`.

## 5) Déployer sur Vercel

```bash
vercel
vercel --prod
```

## Endpoints

- `GET /api/config` -> retourne la clé publique VAPID
- `POST /api/subscribe` -> enregistre l'abonnement dans Google Sheets pour un email
- `POST /api/unsubscribe` -> supprime un abonnement
- `POST /api/notify` -> envoie une notification aux abonnés d'un email donné
- `POST /api/assign` -> crée une affectation et envoie la notification ouvrant l'app sur cette affectation
- `GET /api/assignment?id=<id>` -> charge une affectation
- `POST /api/acknowledge` -> marque l'affectation comme consultée dans Google Sheets

Exemple `POST /api/notify`:

```json
{
  "email": "personne@example.com",
  "title": "BlueQ",
  "body": "New message",
  "url": "/"
}
```

Header recommandé:

- `x-admin-token: <PUSH_ADMIN_TOKEN>`

Exemple `POST /api/assign`:

```json
{
  "email": "personne@example.com",
  "taskName": "LOWER COVER",
  "pdfUrl": "https://example.com/instructions.pdf",
  "sourceRef": "gsheet-row-42"
}
```

Exemple de structure de l'onglet `assignments` apres utilisation :

- `id`
- `email`
- `task_name`
- `pdf_url`
- `source_ref`
- `assigned_at`
- `acknowledged`
- `acknowledged_at`
