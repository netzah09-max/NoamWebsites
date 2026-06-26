require("dotenv").config();

const http = require("node:http");

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CHANNEL_ID,
  PORT = "3000",
  ALLOWED_ORIGINS = "https://noamwebsites.xyz",
  RATE_LIMIT_MAX = "5",
  RATE_LIMIT_WINDOW_MS = "600000",
  DRY_RUN = "false",
} = process.env;

const allowedOrigins = new Set(
  ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const requestsByIp = new Map();
const deliveredRequestIds = new Map();
let gatewaySocket = null;
let gatewayHeartbeat = null;
let gatewayReconnectTimer = null;
let discordReady = false;
let started = false;
const rateLimitMax = Math.max(1, Number.parseInt(RATE_LIMIT_MAX, 10) || 5);
const rateLimitWindowMs = Math.max(
  60_000,
  Number.parseInt(RATE_LIMIT_WINDOW_MS, 10) || 600_000,
);
const dryRun = DRY_RUN.toLowerCase() === "true";

function clean(value, maxLength, fallback = "-") {
  if (typeof value !== "string") return fallback;
  const text = value.trim().replace(/\s+/g, " ");
  return text ? text.slice(0, maxLength) : fallback;
}

function validateRequest(body) {
  const requestId = clean(body?.requestId, 80, "");
  const fullName = clean(body?.fullName, 120, "");
  const phone = clean(body?.phone, 30, "");
  const need = clean(body?.need, 200, "");
  const plan = clean(body?.plan, 80);
  const description = clean(body?.description, 1000, "");

  if (!/^[a-zA-Z0-9-]{8,80}$/.test(requestId)) {
    return { error: "Invalid request ID." };
  }
  if (!fullName || !phone || !need || !description) {
    return { error: "Name, phone, service, and description are required." };
  }

  return {
    value: { requestId, fullName, phone, need, plan, description },
  };
}

function createDiscordPayload(data) {
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "New NoamWebsites Request",
        color: 0x7c3aed,
        fields: [
          { name: "Name", value: data.fullName, inline: true },
          { name: "Phone", value: data.phone, inline: true },
          { name: "Need", value: data.need, inline: true },
          { name: "Plan", value: data.plan, inline: true },
          { name: "Description", value: data.description },
        ],
        footer: { text: `Request ID: ${data.requestId}` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function postDiscordMessage(data) {
  const payload = createDiscordPayload(data);
  if (dryRun) {
    console.log("DRY_RUN Discord message:", JSON.stringify(payload));
    return;
  }
  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
    throw new Error("DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID must be configured.");
  }

  const response = await fetch(
    `https://discord.com/api/v10/channels/${encodeURIComponent(DISCORD_CHANNEL_ID)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Discord API returned ${response.status}: ${details.slice(0, 300)}`);
  }
}

function clearGatewayHeartbeat() {
  if (gatewayHeartbeat) {
    clearInterval(gatewayHeartbeat);
    gatewayHeartbeat = null;
  }
}

function scheduleGatewayReconnect() {
  if (gatewayReconnectTimer || dryRun || !DISCORD_BOT_TOKEN) return;
  gatewayReconnectTimer = setTimeout(() => {
    gatewayReconnectTimer = null;
    startDiscordPresence();
  }, 5000);
}

async function startDiscordPresence() {
  if (dryRun || !DISCORD_BOT_TOKEN || gatewaySocket) return;

  try {
    const gatewayResponse = await fetch("https://discord.com/api/v10/gateway/bot", {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });
    if (!gatewayResponse.ok) {
      throw new Error(`Discord gateway returned ${gatewayResponse.status}`);
    }

    const gateway = await gatewayResponse.json();
    gatewaySocket = new WebSocket(`${gateway.url}/?v=10&encoding=json`);

    gatewaySocket.addEventListener("message", (event) => {
      const packet = JSON.parse(event.data);

      if (packet.op === 10) {
        clearGatewayHeartbeat();
        gatewayHeartbeat = setInterval(() => {
          if (gatewaySocket?.readyState === WebSocket.OPEN) {
            gatewaySocket.send(JSON.stringify({ op: 1, d: null }));
          }
        }, packet.d.heartbeat_interval);

        gatewaySocket.send(JSON.stringify({
          op: 2,
          d: {
            token: DISCORD_BOT_TOKEN,
            intents: 1,
            properties: {
              os: "windows",
              browser: "noamwebsites-bot",
              device: "noamwebsites-bot",
            },
            presence: {
              status: "online",
              activities: [{ name: "NoamWebsites requests", type: 3 }],
              afk: false,
            },
          },
        }));
        return;
      }

      if (packet.op === 0 && packet.t === "READY") {
        discordReady = true;
        console.log(`NoamWebsites Discord bot online as ${packet.d.user.username}`);
        return;
      }

      if (packet.op === 1 && gatewaySocket?.readyState === WebSocket.OPEN) {
        gatewaySocket.send(JSON.stringify({ op: 1, d: null }));
      }
    });

    gatewaySocket.addEventListener("close", () => {
      discordReady = false;
      gatewaySocket = null;
      clearGatewayHeartbeat();
      scheduleGatewayReconnect();
    });

    gatewaySocket.addEventListener("error", () => {
      discordReady = false;
      clearGatewayHeartbeat();
    });
  } catch (error) {
    discordReady = false;
    gatewaySocket = null;
    clearGatewayHeartbeat();
    console.error("Discord gateway login failed:", error instanceof Error ? error.message : error);
    scheduleGatewayReconnect();
  }
}

function clientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (requestsByIp.get(ip) || []).filter(
    (timestamp) => now - timestamp < rateLimitWindowMs,
  );
  if (recent.length >= rateLimitMax) {
    requestsByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  requestsByIp.set(ip, recent);
  return false;
}

function pruneDeliveredRequests() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [requestId, timestamp] of deliveredRequestIds) {
    if (timestamp < cutoff) deliveredRequestIds.delete(requestId);
  }
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type, bypass-tunnel-reminder",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function sendJson(response, status, body, origin) {
  response.writeHead(status, corsHeaders(origin));
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 32 * 1024) {
      throw new Error("Request body is too large.");
    }
  }
  return JSON.parse(body || "{}");
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;

  if (request.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) {
      return sendJson(response, 403, { error: "Origin not allowed." }, origin);
    }
    response.writeHead(204, corsHeaders(origin));
    return response.end();
  }

  if (request.method === "GET" && request.url === "/health") {
    return sendJson(
      response,
      200,
      {
        ok: true,
        service: "NoamWebsites Bot",
        discordConfigured: dryRun || Boolean(DISCORD_BOT_TOKEN && DISCORD_CHANNEL_ID),
        discordOnline: discordReady,
      },
      origin,
    );
  }

  if (request.method !== "POST" || request.url !== "/requests") {
    return sendJson(response, 404, { error: "Not found." }, origin);
  }
  if (!origin || !allowedOrigins.has(origin)) {
    return sendJson(response, 403, { error: "Origin not allowed." }, origin);
  }

  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    return sendJson(response, 429, { error: "Too many requests. Please try again later." }, origin);
  }

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "Request body is too large." ? 413 : 400;
    return sendJson(response, status, { error: status === 413 ? message : "Invalid request body." }, origin);
  }

  try {
    const parsed = validateRequest(body);
    if (parsed.error) {
      return sendJson(response, 400, { error: parsed.error }, origin);
    }

    pruneDeliveredRequests();
    if (deliveredRequestIds.has(parsed.value.requestId)) {
      return sendJson(response, 200, { ok: true, duplicate: true }, origin);
    }

    await postDiscordMessage(parsed.value);
    deliveredRequestIds.set(parsed.value.requestId, Date.now());
    return sendJson(response, 201, { ok: true }, origin);
  } catch (error) {
    console.error("Could not deliver website request:", error);
    return sendJson(response, 502, { error: "Could not send the Discord notification." }, origin);
  }
});

function startBot() {
  if (started) return;
  started = true;
  startDiscordPresence();
  server.listen(Number.parseInt(PORT, 10), "0.0.0.0", () => {
    console.log(`NoamWebsites Bot API listening on port ${PORT}`);
  });
}

if (require.main === module) {
  startBot();
}

module.exports = {
  createDiscordPayload,
  startBot,
  server,
  validateRequest,
};
