import crypto from "crypto";
import axios from "axios";
import { AppError } from "@/lib/AppError";

// ──────────────────────────────────────────────
// Interface
// ──────────────────────────────────────────────
export interface TemplateComponent {
  type: string;
  parameters: Array<{ type: string; text: string }>;
}

export interface WhatsAppAdapter {
  sendTemplate(params: {
    to: string;
    templateName: string;
    language: string;
    components: TemplateComponent[];
  }): Promise<{ messageId: string }>;

  verifyWebhookSignature(payload: Buffer, signature: string): boolean;

  parseInboundMessage(
    body: unknown
  ): { from: string; messageId: string; text: string } | null;
}

// ──────────────────────────────────────────────
// MetaCloudApiAdapter
// ──────────────────────────────────────────────
export class MetaCloudApiAdapter implements WhatsAppAdapter {
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor() {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.apiToken = process.env.WHATSAPP_API_TOKEN!;
    this.baseUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}`;
  }

  async sendTemplate(params: {
    to: string;
    templateName: string;
    language: string;
    components: TemplateComponent[];
  }): Promise<{ messageId: string }> {
    // Strip leading + for E.164 without prefix
    const to = params.to.replace(/^\+/, "");

    try {
      const res = await axios.post(
        `${this.baseUrl}/messages`,
        {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: params.language },
            components: params.components,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return { messageId: res.data.messages[0].id };
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { error?: { error_data?: { details?: string }; message?: string } } };
      };
      const metaMsg =
        axiosErr.response?.data?.error?.error_data?.details ??
        axiosErr.response?.data?.error?.message ??
        "WhatsApp API call failed";
      throw new AppError("WHATSAPP_SEND_FAILED", axiosErr.response?.status ?? 500, {
        message: metaMsg,
      });
    }
  }

  verifyWebhookSignature(payload: Buffer, signature: string): boolean {
    const appSecret = process.env.WHATSAPP_API_TOKEN!;
    const computed = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest("hex");

    const expected = `sha256=${computed}`;

    // Use timing-safe comparison to prevent timing attacks
    if (expected.length !== signature.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  }

  parseInboundMessage(
    body: unknown
  ): { from: string; messageId: string; text: string } | null {
    const b = body as Record<string, unknown>;

    // 1. Check object type
    if (b?.object !== "whatsapp_business_account") return null;

    // 2-3. Safely navigate to messages
    const entry = b.entry as Array<{
      changes?: Array<{
        value?: { messages?: Array<{ from?: string; id?: string; type?: string; text?: { body?: string } }> };
      }>;
    }>;

    const msg = entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return null;

    // 4. Only handle text messages
    if (msg.type !== "text") return null;

    // 5. Return parsed message
    if (!msg.from || !msg.id || !msg.text?.body) return null;

    return {
      from: msg.from,
      messageId: msg.id,
      text: msg.text.body,
    };
  }
}

// ──────────────────────────────────────────────
// StubWhatsAppAdapter
// ──────────────────────────────────────────────
export class StubWhatsAppAdapter implements WhatsAppAdapter {
  async sendTemplate(params: {
    to: string;
    templateName: string;
    language: string;
    components: TemplateComponent[];
  }): Promise<{ messageId: string }> {
    console.log(
      `[WHATSAPP-STUB] sendTemplate: ${params.templateName} → ${params.to}`
    );
    return { messageId: `stub-${Date.now()}` };
  }

  verifyWebhookSignature(): boolean {
    return true;
  }

  parseInboundMessage(): { from: string; messageId: string; text: string } | null {
    return null;
  }
}
