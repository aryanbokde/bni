export interface GoogleMapsAdapter {
  geocode(address: string): Promise<{ lat: number; lng: number } | null>;
}

export class GoogleMapsAdapterImpl implements GoogleMapsAdapter {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_SERVER_KEY ?? "";
  }

  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "OK" && data.results?.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }

    if (data.status === "ZERO_RESULTS") {
      return null;
    }

    throw new Error(`Google Maps Geocoding API error: ${data.status} — ${data.error_message ?? "unknown"}`);
  }
}

export class StubGoogleMapsAdapter implements GoogleMapsAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async geocode(_address: string): Promise<{ lat: number; lng: number } | null> {
    return { lat: 23.0225, lng: 72.5714 };
  }
}
