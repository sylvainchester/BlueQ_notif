# BlueQ Notif PWA

PWA minimale pour recevoir des notifications web push, avec stockage des abonnements dans Supabase et déploiement sur Vercel.

## 1) Préparer Supabase

Exécuter `supabase.sql` dans l'éditeur SQL de ton projet Supabase:
- URL projet: `https://zsnndwhnueenqccoyrmn.supabase.co`

## 2) Générer des clés VAPID

Tu peux générer les clés avec:

```bash
npx web-push generate-vapid-keys
```

## 3) Variables d'environnement Vercel

Configurer dans le projet Vercel:

- `SUPABASE_URL=https://zsnndwhnueenqccoyrmn.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `VAPID_PUBLIC_KEY=...`
- `VAPID_PRIVATE_KEY=...`
- `VAPID_SUBJECT=mailto:ton-email@domaine.com` (optionnel)
- `PUSH_ADMIN_TOKEN=un-secret` (optionnel mais recommandé)

## 4) Lancer en local

```bash
npm install
npm run dev
```

Ensuite:
1. Ouvre l'app dans le navigateur (Chrome/Edge conseillé).
2. Clique `Autoriser notifications`.
3. Clique `S'abonner au push`.
4. Clique `Envoyer un test`.

## 5) Déployer sur Vercel

```bash
vercel
vercel --prod
```

## Endpoints

- `GET /api/config` -> retourne la clé publique VAPID
- `POST /api/subscribe` -> enregistre l'abonnement dans Supabase
- `POST /api/unsubscribe` -> supprime un abonnement
- `POST /api/notify` -> envoie une notification à tous les abonnés

Exemple `POST /api/notify`:

```json
{
  "title": "BlueQ",
  "body": "Nouveau message",
  "url": "/"
}
```

Header recommandé:

- `x-admin-token: <PUSH_ADMIN_TOKEN>`
