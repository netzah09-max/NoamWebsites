const localtunnel = require("localtunnel");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const subdomain = process.env.TUNNEL_SUBDOMAIN || "noamwebsites-bot";
const healthUrl = `https://${subdomain}.loca.lt/health`;

let tunnel;
let reconnectTimer;
let healthTimer;
let reconnecting = false;

function scheduleReconnect(reason) {
  if (reconnecting) return;
  reconnecting = true;
  clearInterval(healthTimer);
  healthTimer = undefined;

  if (reason) console.error(`Tunnel reconnecting: ${reason}`);
  try {
    tunnel?.close();
  } catch {
    // The tunnel may already be closed.
  }
  tunnel = undefined;

  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnecting = false;
    connect();
  }, 3000);
}

async function checkHealth() {
  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      scheduleReconnect(`health check returned ${response.status}`);
    }
  } catch (error) {
    scheduleReconnect(error.message);
  }
}

async function connect() {
  try {
    tunnel = await localtunnel({ port, subdomain });
    console.log(`NoamWebsites tunnel: ${tunnel.url}`);

    tunnel.on("error", (error) => scheduleReconnect(error.message));
    tunnel.on("close", () => scheduleReconnect("connection closed"));

    clearInterval(healthTimer);
    healthTimer = setInterval(checkHealth, 20_000);
  } catch (error) {
    scheduleReconnect(error.message);
  }
}

process.on("SIGINT", () => {
  clearTimeout(reconnectTimer);
  clearInterval(healthTimer);
  tunnel?.close();
  process.exit(0);
});

connect();
