import {
  MetaCloudApiAdapter,
  StubWhatsAppAdapter,
  type WhatsAppAdapter,
} from "./WhatsAppAdapter";
import {
  GoogleMapsAdapterImpl,
  StubGoogleMapsAdapter,
  type GoogleMapsAdapter,
} from "./GoogleMapsAdapter";

let waInstance: WhatsAppAdapter | null = null;

export function getWhatsAppAdapter(): WhatsAppAdapter {
  if (waInstance) return waInstance;

  if (
    process.env.WHATSAPP_PROVIDER === "stub" ||
    process.env.NODE_ENV === "test"
  ) {
    waInstance = new StubWhatsAppAdapter();
  } else {
    waInstance = new MetaCloudApiAdapter();
  }

  return waInstance;
}

let gmInstance: GoogleMapsAdapter | null = null;

export function getGoogleMapsAdapter(): GoogleMapsAdapter {
  if (gmInstance) return gmInstance;

  if (process.env.NODE_ENV === "test") {
    gmInstance = new StubGoogleMapsAdapter();
  } else {
    gmInstance = new GoogleMapsAdapterImpl();
  }

  return gmInstance;
}

export type { WhatsAppAdapter, GoogleMapsAdapter };
