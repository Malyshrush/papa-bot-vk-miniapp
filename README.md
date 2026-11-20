# PAPA BOT VK Mini App

Frontend for the PAPA BOT VK Mini App.

Community plugin `54903386` is built at `/plugin/`. Existing PAPA BOT communities can confirm their transition through the cabinet's community link and the plugin's «Подключить плагин с сохранением данных» action. The backend resolves the original profile and community scope from a signed VK administrator launch and stores only a separate confirmation record. Profiles, balance, payment history, settings, scenarios and subscribers retain their original storage. Confirmation does not claim that the plugin remains installed in VK; installation and removal are managed by VK. New communities first follow the cabinet connection instructions.

Cabinet login also uses `https://vk.ru/app54903386` and the plugin signing key. A personal `handoff=login` launch is processed before the community landing page and works without `vk_group_id`; the one-use ticket survives VK's `hash` parameter. Publication sets `VITE_COMMUNITY_PLUGIN=1` for GitHub Pages and both Selectel paths. Saved releases for current publication declare `kind: community-plugin` and `appId: 54903386`; legacy app releases remain archived. Callback API setup uses the selected community's saved Community Token. User Token grants for server automation remain a separate VK ID authorization-code flow.

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
DEFAULT_COMMUNITY_ID=229445618
```
