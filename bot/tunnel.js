const { execFileSync, spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const path = require("node:path");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const deployWorktree =
  process.env.DEPLOY_WORKTREE || "C:\\NoamWebsites-deploy";
const endpointFile = path.join(deployWorktree, "bot-endpoint.json");

let child;
let currentUrl;
let healthTimer;
let restartTimer;
let stopping = false;

function git(args, options = {}) {
  const output = execFileSync("git", ["-C", deployWorktree, ...args], {
    encoding: "utf8",
    stdio: options.stdio || "pipe",
  });
  return typeof output === "string" ? output.trim() : "";
}

function publishEndpoint(url) {
  const status = git(["status", "--porcelain"]);
  if (status) {
    throw new Error(`Deployment worktree is not clean: ${status}`);
  }

  git(["pull", "--ff-only", "origin", "dist"], { stdio: "ignore" });
  writeFileSync(
    endpointFile,
    `${JSON.stringify({ url, updatedAt: new Date().toISOString() })}\n`,
    "utf8",
  );
  git(["add", "bot-endpoint.json"]);

  try {
    git(["diff", "--cached", "--quiet"]);
    return;
  } catch (error) {
    if (error.status !== 1) throw error;
  }

  git(["commit", "-m", "Update contact bot tunnel endpoint"], {
    stdio: "ignore",
  });
  git(["push", "origin", "dist"], { stdio: "ignore" });
  console.log(`Published tunnel endpoint: ${url}`);
}

function stopChild() {
  if (!child || child.killed) return;
  child.kill();
}

function scheduleRestart(reason) {
  if (stopping || restartTimer) return;
  clearInterval(healthTimer);
  healthTimer = undefined;
  currentUrl = undefined;
  if (reason) console.error(`Tunnel reconnecting: ${reason}`);
  stopChild();
  restartTimer = setTimeout(() => {
    restartTimer = undefined;
    startTunnel();
  }, 3000);
}

async function checkHealth() {
  if (!currentUrl) return;
  try {
    const response = await fetch(`${currentUrl}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      scheduleRestart(`health check returned ${response.status}`);
    }
  } catch (error) {
    scheduleRestart(error.message);
  }
}

function handleOutput(text) {
  process.stdout.write(text);
  const match = text.match(/https:\/\/[a-z0-9-]+\.loca\.lt/i);
  if (!match || match[0] === currentUrl) return;

  currentUrl = match[0];
  try {
    publishEndpoint(currentUrl);
  } catch (error) {
    console.error(`Could not publish tunnel URL: ${error.message}`);
  }

  clearInterval(healthTimer);
  healthTimer = setInterval(checkHealth, 20_000);
}

function startTunnel() {
  const command =
    process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", `npx -y localtunnel --port ${port}`]
      : ["-y", "localtunnel", "--port", String(port)];

  child = spawn(command, args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => handleOutput(chunk.toString()));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  child.on("error", (error) => scheduleRestart(error.message));
  child.on("exit", (code) => {
    child = undefined;
    scheduleRestart(`process exited with code ${code}`);
  });
}

function shutdown() {
  stopping = true;
  clearTimeout(restartTimer);
  clearInterval(healthTimer);
  stopChild();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startTunnel();
