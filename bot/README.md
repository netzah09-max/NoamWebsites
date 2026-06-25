# NoamWebsites Discord Bot

This is the dedicated request bot for `https://noamwebsites.xyz`.

It accepts `POST /requests` from the website and creates an ordinary Discord
bot message in the configured channel. It does not use Discord webhooks or
Supabase Edge Functions.

## Discord setup

1. Use the existing TheBoys Bot application.
2. Confirm it has `View Channel` and `Send Messages` in the request channel.
3. Set `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID` as private host
   environment variables. Never commit the token.

## Netlify Function deployment

The production API can run as the Netlify Function in
`netlify/functions/discord-request.cjs`. It uses TheBoys Bot only for Discord
authentication and posts into the configured channel.

```bash
npx netlify login
npx netlify env:set DISCORD_BOT_TOKEN
npx netlify env:set DISCORD_CHANNEL_ID 1508012388601958481
npx netlify deploy --prod
```

Set the website build variable to the resulting Netlify site URL:

```env
VITE_REQUEST_BOT_API_URL=https://your-site.netlify.app
```

The website sends requests to `/requests`, which Netlify routes to the
function.

## Optional local Node server

```bash
cd bot
npm install
npm start
```

The host must expose the configured `PORT` through HTTPS. Put that public URL
in the website build variable:

```env
VITE_REQUEST_BOT_API_URL=https://your-bot-host.example.com
```

Health check:

```text
GET /health
```

The API allows only configured website origins, rate-limits submissions, and
deduplicates request IDs for 24 hours.
