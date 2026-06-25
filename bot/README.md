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

## Run the bot API

```bash
cd bot
npm install
npm start
```

GitHub stores this source code, but GitHub Pages cannot run a persistent Node
server or safely store the bot token. When a private Node host is available,
expose the configured `PORT` through HTTPS and put that public URL in the
website build variable:

```env
VITE_REQUEST_BOT_API_URL=https://your-bot-host.example.com
```

Health check:

```text
GET /health
```

The API allows only configured website origins, rate-limits submissions, and
deduplicates request IDs for 24 hours.
