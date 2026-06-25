const test = require("node:test");
const assert = require("node:assert/strict");

const { createDiscordPayload, validateRequest } = require("../index");

test("validates and cleans a website request", () => {
  const result = validateRequest({
    requestId: "12345678-abcd",
    fullName: "  Noam   Test  ",
    phone: " 050-0000000 ",
    need: "website",
    plan: "starter",
    description: " A new website ",
  });

  assert.equal(result.error, undefined);
  assert.deepEqual(result.value, {
    requestId: "12345678-abcd",
    fullName: "Noam Test",
    phone: "050-0000000",
    need: "website",
    plan: "starter",
    description: "A new website",
  });
});

test("rejects incomplete requests", () => {
  const result = validateRequest({ requestId: "12345678-abcd" });
  assert.equal(result.error, "Name, phone, service, and description are required.");
});

test("creates the same request embed as the old webhook", () => {
  const payload = createDiscordPayload({
    requestId: "12345678-abcd",
    fullName: "Noam Test",
    phone: "050-0000000",
    need: "website",
    plan: "starter",
    description: "A new website",
  });

  assert.equal(payload.embeds[0].title, "New NoamWebsites Request");
  assert.equal(payload.embeds[0].color, 0x7c3aed);
  assert.equal(payload.embeds[0].fields[0].value, "Noam Test");
  assert.equal(payload.embeds[0].fields[4].value, "A new website");
});
