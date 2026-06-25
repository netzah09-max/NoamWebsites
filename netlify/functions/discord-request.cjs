const {
  createDiscordPayload,
  validateRequest,
} = require("../../bot/index.js");

function allowedOrigins() {
  return new Set(
    (
      process.env.ALLOWED_ORIGINS ||
      "https://noamwebsites.xyz,http://localhost:5173,http://127.0.0.1:5173"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function headers(origin) {
  const result = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };

  if (origin && allowedOrigins().has(origin)) {
    result["Access-Control-Allow-Origin"] = origin;
  }

  return result;
}

function response(statusCode, body, origin) {
  return {
    statusCode,
    headers: headers(origin),
    body: JSON.stringify(body),
  };
}

async function sendToDiscord(data) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    throw new Error("Discord bot credentials are not configured.");
  }

  const discordResponse = await fetch(
    `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createDiscordPayload(data)),
    },
  );

  if (!discordResponse.ok) {
    const details = await discordResponse.text();
    throw new Error(
      `Discord API returned ${discordResponse.status}: ${details.slice(0, 300)}`,
    );
  }
}

async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin;

  if (event.httpMethod === "OPTIONS") {
    if (origin && !allowedOrigins().has(origin)) {
      return response(403, { error: "Origin not allowed." }, origin);
    }
    return response(204, {}, origin);
  }

  if (event.httpMethod === "GET") {
    return response(
      200,
      {
        ok: true,
        service: "NoamWebsites Bot",
        discordConfigured: Boolean(
          process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID,
        ),
      },
      origin,
    );
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed." }, origin);
  }

  if (!origin || !allowedOrigins().has(origin)) {
    return response(403, { error: "Origin not allowed." }, origin);
  }

  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body || "{}";

    if (Buffer.byteLength(rawBody) > 32 * 1024) {
      return response(413, { error: "Request body is too large." }, origin);
    }

    const parsed = validateRequest(JSON.parse(rawBody));
    if (parsed.error) {
      return response(400, { error: parsed.error }, origin);
    }

    await sendToDiscord(parsed.value);
    return response(201, { ok: true }, origin);
  } catch (error) {
    console.error("Could not deliver website request:", error);
    return response(
      502,
      { error: "Could not send the Discord notification." },
      origin,
    );
  }
}

module.exports = {
  handler,
  sendToDiscord,
};
