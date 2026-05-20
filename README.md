# PAPA BOT VK Mini App

Frontend for the PAPA BOT VK Mini App.

## Local development

```bash
npm ci
VITE_PAPA_BOT_API_URL=https://your-papa-bot-api.example npm run dev
```

Open a community route:

```text
http://127.0.0.1:5173/#c=229445618
http://127.0.0.1:5173/#c=229445618&g=vip
```

## Deployment

GitHub Pages deployment is handled by `.github/workflows/deploy.yml`.

Required repository variable:

```text
PAPA_BOT_PUBLIC_URL=https://your-papa-bot-api.example
```
