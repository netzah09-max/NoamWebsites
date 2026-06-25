const test = require("node:test");
const assert = require("node:assert/strict");

const { handler } = require("../../netlify/functions/discord-request.cjs");

const validBody = {
  requestId: "12345678-abcd",
  fullName: "Noam Test",
  phone: "050-0000000",
  need: "website",
  plan: "starter",
  description: "A new website",
};

test("Netlify function rejects unknown origins", async () => {
  const result = await handler({
    httpMethod: "POST",
    headers: { origin: "https://example.com" },
    body: JSON.stringify(validBody),
  });

  assert.equal(result.statusCode, 403);
});

test("Netlify function sends a request using the Discord bot API", async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.DISCORD_BOT_TOKEN;
  const originalChannel = process.env.DISCORD_CHANNEL_ID;
  let request;

  process.env.DISCORD_BOT_TOKEN = "test-token";
  process.env.DISCORD_CHANNEL_ID = "123456789";
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => "",
    };
  };

  try {
    const result = await handler({
      httpMethod: "POST",
      headers: { origin: "https://noamwebsites.xyz" },
      body: JSON.stringify(validBody),
    });

    assert.equal(result.statusCode, 201);
    assert.equal(
      request.url,
      "https://discord.com/api/v10/channels/123456789/messages",
    );
    assert.equal(request.options.headers.Authorization, "Bot test-token");
    assert.equal(
      JSON.parse(request.options.body).embeds[0].title,
      "New NoamWebsites Request",
    );
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.DISCORD_BOT_TOKEN;
    else process.env.DISCORD_BOT_TOKEN = originalToken;
    if (originalChannel === undefined) delete process.env.DISCORD_CHANNEL_ID;
    else process.env.DISCORD_CHANNEL_ID = originalChannel;
  }
});
