# NoamWebsites Discord Bot

This is the dedicated request bot for `https://noamwebsites.xyz`.

It accepts `POST /requests` from the website and creates an ordinary Discord
bot message in the configured channel. It does not use Discord webhooks or
Supabase Edge Functions.

## Discord setup

1. Create a new Discord application named `NoamWebsites`.
2. Add a bot and invite it to the server with `View Channel` and
   `Send Messages`.
3. Copy `bot/.env.example` to `bot/.env`.
4. Set `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID`.

## Run

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
