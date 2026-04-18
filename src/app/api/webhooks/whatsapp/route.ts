import { NextResponse } from "next/server";
import { getWhatsAppAdapter } from "@/adapters";
import * as RecommendationService from "@/services/RecommendationService";

// ──────────────────────────────────────────────
// GET — Meta webhook verification (one-time setup)
// ──────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    // Return challenge as plain text — Meta requires this exact format
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

// ──────────────────────────────────────────────
// POST — Incoming messages from Meta
// ──────────────────────────────────────────────
export async function POST(req: Request) {
  // 1. Read raw body as Buffer — needed for HMAC verification
  const rawBody = Buffer.from(await req.arrayBuffer());

  // 2. Verify Meta's HMAC-SHA256 signature
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const adapter = getWhatsAppAdapter();

  if (!adapter.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Build response immediately — Meta retries if no 200 within 5 seconds
  const response = NextResponse.json({ status: "ok" }, { status: 200 });

  // 4. Parse the payload
  const body = JSON.parse(rawBody.toString("utf8"));
  const message = adapter.parseInboundMessage(body);

  // 5. Process async — do NOT await before returning
  //    Status updates (delivery/read receipts) are silently ignored
  //    because parseInboundMessage returns null for them
  if (message) {
    setImmediate(() => {
      RecommendationService.handleWebhookReply(
        message.messageId,
        message.from,
        message.text
      ).catch((err) =>
        console.error("[Webhook] handleWebhookReply error:", err)
      );
    });
  }

  return response;
}
