type RequestPayload = {
  fullName?: string;
  phone?: string;
  need?: string;
  plan?: string;
  description?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function clean(value: unknown, fallback = "-") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1000) : fallback;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders },
    );
  }

  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
  if (!webhookUrl) {
    return Response.json(
      { error: "Discord webhook is not configured" },
      { status: 500, headers: corsHeaders },
    );
  }

  let data: RequestPayload;
  try {
    data = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders },
    );
  }

  const embed = {
    title: "New NoamWebsites Request",
    color: 0x7c3aed,
    fields: [
      { name: "Name", value: clean(data.fullName), inline: true },
      { name: "Phone", value: clean(data.phone), inline: true },
      { name: "Need", value: clean(data.need), inline: true },
      { name: "Plan", value: clean(data.plan), inline: true },
      { name: "Description", value: clean(data.description, "No description") },
    ],
    timestamp: new Date().toISOString(),
  };

  const discordResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "NoamWebsites",
      allowed_mentions: { parse: [] },
      embeds: [embed],
    }),
  });

  if (!discordResponse.ok) {
    const details = await discordResponse.text();
    console.error("Discord webhook failed", discordResponse.status, details);
    return Response.json(
      { error: "Discord webhook failed" },
      { status: 502, headers: corsHeaders },
    );
  }

  return Response.json({ ok: true }, { headers: corsHeaders });
});
