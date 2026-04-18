"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useSession } from "@/lib/SessionContext";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";

interface MapPin {
  member_id: string;
  full_name: string;
  biz_category: string;
  latitude: number;
  longitude: number;
  geocode_status: string;
}

interface ListOnlyMember {
  member_id: string;
  full_name: string;
  biz_category: string;
  geocode_status: string;
}

interface MapData {
  pins: MapPin[];
  listOnly: ListOnlyMember[];
}

interface MemberCard {
  member_id: string;
  full_name: string;
  biz_category?: string;
  one_line_summary?: string;
  whatsapp?: string;
  office_address?: string;
  maps_link?: string;
}

const INDIA_CENTER = { lat: 23.0225, lng: 72.5714 }; // Ahmedabad fallback
const DEFAULT_RADIUS_KM = 20;
const RADIUS_OPTIONS = [3, 5, 10, 20, 50, 100];

/** Haversine distance in meters between two lat/lng points */
function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

export default function ChapterMap({ chapterId }: { chapterId: string }) {
  const api = useApi();
  const { session } = useSession();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isOnline, setIsOnline] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [requesting121, setRequesting121] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showNearby, setShowNearby] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const radiusMeters = radiusKm * 1000;

  // Online/offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Fetch map data
  const { data, isLoading } = useQuery<MapData>({
    queryKey: ["mapMembers", chapterId],
    queryFn: async () => {
      const res = await api.get(`/chapters/${chapterId}/map/members`);
      return res.data.data;
    },
    staleTime: 60_000,
  });

  // Get unique categories for filter
  const categories = data
    ? Array.from(new Set(data.pins.map((p) => p.biz_category).filter(Boolean))).sort()
    : [];

  const filteredPins = data
    ? categoryFilter === "all"
      ? data.pins
      : data.pins.filter((p) => p.biz_category === categoryFilter)
    : [];

  // Fetch member card for InfoWindow
  const fetchMemberCard = useCallback(
    async (memberId: string): Promise<MemberCard | null> => {
      try {
        const res = await api.get(`/chapters/${chapterId}/map/member/${memberId}`);
        return res.data.data;
      } catch {
        return null;
      }
    },
    [api, chapterId]
  );

  // Request 1-2-1
  async function handleRequest121(memberId: string) {
    if (!session) return;
    setRequesting121(memberId);
    try {
      await api.post(`/chapters/${chapterId}/recommendations/manual`, {
        member_a_id: session.memberId,
        member_b_id: memberId,
      });
      if (infoWindowRef.current) {
        infoWindowRef.current.setContent(
          '<div class="p-2 text-sm text-green-600 font-medium">1-2-1 Requested!</div>'
        );
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { code?: string } } } };
      const code = axiosErr.response?.data?.error?.code ?? "UNKNOWN";
      const msg = code === "RECOMMENDATION_ALREADY_EXISTS"
        ? "A recommendation already exists for this pair."
        : "Failed to create recommendation.";
      if (infoWindowRef.current) {
        infoWindowRef.current.setContent(
          `<div class="p-2 text-sm text-red-500 font-medium">${msg}</div>`
        );
      }
    } finally {
      setRequesting121(null);
    }
  }

  // Start/stop live location tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported by your browser");
      return;
    }
    setLocationError(null);
    setShowNearby(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError("Location access denied. Please allow location in browser settings.");
        } else {
          setLocationError("Unable to get your location.");
        }
        setShowNearby(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setUserLocation(null);
    setShowNearby(false);
    // Blue dot and circle cleanup handled by the useEffect above
  }, []);

  // Cleanup tracking on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Draw/update blue dot and 3km circle
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    // If no location or not in nearby mode, remove overlays
    if (!userLocation || !showNearby) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      return;
    }

    // Create or update blue dot
    if (!userMarkerRef.current) {
      userMarkerRef.current = new google.maps.Marker({
        map: mapInstanceRef.current,
        position: userLocation,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        title: "Your Location",
        zIndex: 999,
      });
    } else {
      userMarkerRef.current.setPosition(userLocation);
      userMarkerRef.current.setMap(mapInstanceRef.current);
    }

    // Create or update circle
    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map: mapInstanceRef.current,
        center: userLocation,
        radius: radiusMeters,
        fillColor: "#D1D5DB",
        fillOpacity: 0.25,
        strokeColor: "#6B7280",
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });
    } else {
      circleRef.current.setCenter(userLocation);
      circleRef.current.setRadius(radiusMeters);
      circleRef.current.setMap(mapInstanceRef.current);
    }

    // Fit map to circle bounds
    const circleBounds = circleRef.current.getBounds();
    if (circleBounds) {
      mapInstanceRef.current.fitBounds(circleBounds);
    }
  }, [userLocation, showNearby, mapReady, radiusMeters]);

  // Nearby members sorted by distance
  const nearbyMembers = userLocation && showNearby
    ? filteredPins
        .map((p) => ({
          ...p,
          distance: haversineDistance(userLocation, { lat: p.latitude, lng: p.longitude }),
        }))
        .filter((p) => p.distance <= radiusMeters)
        .sort((a, b) => a.distance - b.distance)
    : [];

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps || mapInstanceRef.current) return;

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: INDIA_CENTER,
      zoom: 12,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    infoWindowRef.current = new google.maps.InfoWindow();
    setMapReady(true);
  }, [data]); // re-check when data loads (google may be ready then)

  // Update markers when pins change
  useEffect(() => {
    if (!mapInstanceRef.current || !filteredPins.length) return;

    // Clear old markers
    for (const m of markersRef.current) {
      m.setMap(null);
    }
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    // When nearby mode is active, show pins within radius; if none found, show all
    let visiblePins = filteredPins;
    if (showNearby && userLocation) {
      const nearby = filteredPins.filter(
        (p) => haversineDistance(userLocation, { lat: p.latitude, lng: p.longitude }) <= radiusMeters
      );
      visiblePins = nearby.length > 0 ? nearby : filteredPins;
    }

    for (const pin of visiblePins) {
      const position = { lat: pin.latitude, lng: pin.longitude };

      const marker = new google.maps.Marker({
        map: mapInstanceRef.current!,
        position,
        title: `${pin.full_name} — ${pin.biz_category}`,
      });

      marker.addListener("click", async () => {
        if (!infoWindowRef.current || !mapInstanceRef.current) return;

        infoWindowRef.current.setContent(
          '<div class="p-2 text-sm text-slate-400">Loading...</div>'
        );
        infoWindowRef.current.open({ anchor: marker, map: mapInstanceRef.current });

        const card = await fetchMemberCard(pin.member_id);
        if (!card) return;

        const whatsappBtn = card.whatsapp
          ? `<a href="https://wa.me/${card.whatsapp.replace(/\D/g, "")}" target="_blank" rel="noopener" class="inline-block mt-2 px-3 py-1 bg-green-500 text-white text-xs rounded-full hover:bg-green-600">WhatsApp</a>`
          : "";

        const LT_ROLES = ["ADMIN", "PRESIDENT", "VP", "SECRETARY", "TREASURER"];
        const isLT = LT_ROLES.includes(session?.role ?? "");
        const request121Btn = isLT && card.member_id !== session?.memberId
          ? `<button id="req121-${card.member_id}" class="inline-block mt-2 ml-1 px-3 py-1 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600">Request 1-2-1</button>`
          : "";

        // Navigate button — opens Google Maps with directions from user's live location or just destination
        const destLatLng = `${pin.latitude},${pin.longitude}`;
        const originParam = userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : "";
        const navigateUrl = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destLatLng}&travelmode=driving`;
        const navigateBtn = `<a href="${navigateUrl}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:4px 12px;background:#1a73e8;color:#fff;font-size:12px;border-radius:9999px;text-decoration:none;">Navigate</a>`;

        // Distance label if user location is available
        const distLabel = userLocation
          ? `<div style="font-size:11px;color:#1a73e8;margin-top:4px;font-weight:500;">${(haversineDistance(userLocation, { lat: pin.latitude, lng: pin.longitude }) / 1000).toFixed(1)} km away</div>`
          : "";

        infoWindowRef.current.setContent(`
          <div style="max-width: 250px; font-family: sans-serif;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 2px;">${card.full_name}</div>
            ${card.biz_category ? `<div style="color: #6b7280; font-size: 12px;">${card.biz_category}</div>` : ""}
            ${card.one_line_summary ? `<div style="font-size: 12px; margin-top: 4px;">${card.one_line_summary}</div>` : ""}
            ${card.office_address ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">${card.office_address}</div>` : ""}
            ${distLabel}
            <div style="margin-top: 8px;">${navigateBtn}${whatsappBtn ? ` ${whatsappBtn}` : ""}${request121Btn ? ` ${request121Btn}` : ""}</div>
          </div>
        `);

        // Attach click handler for request 1-2-1 button
        setTimeout(() => {
          const btn = document.getElementById(`req121-${card.member_id}`);
          if (btn) {
            btn.addEventListener("click", () => handleRequest121(card.member_id));
          }
        }, 100);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    }

    // Fit map: if nearby mode, fit to circle bounds; otherwise fit all pins
    if (showNearby && userLocation && circleRef.current) {
      mapInstanceRef.current.fitBounds(circleRef.current.getBounds()!);
    } else if (visiblePins.length > 0) {
      mapInstanceRef.current.fitBounds(bounds);
      if (visiblePins.length === 1) {
        mapInstanceRef.current.setZoom(15);
      }
    }
    // Cleanup markers on unmount or re-render
    return () => {
      for (const m of markersRef.current) {
        google.maps.event.clearInstanceListeners(m);
        m.setMap(null);
      }
      markersRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPins, fetchMemberCard, session, userLocation, showNearby, radiusMeters]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ═══════ Header ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-headline text-navy">Chapter Map</h1>
          <p className="text-sm text-slate-500 mt-1">
            {filteredPins.length}{" "}
            {filteredPins.length === 1 ? "member" : "members"} on map
            {data?.listOnly.length
              ? ` · ${data.listOnly.length} not yet geocoded`
              : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={showNearby ? stopTracking : startTracking}
          className={`
            inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold
            transition-all duration-normal shadow-soft
            ${
              showNearby
                ? "bg-bni-blue-100 text-bni-blue-700 hover:bg-bni-blue-200"
                : "bg-navy text-white hover:bg-navy-600"
            }
          `}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
          >
            <circle cx="12" cy="10" r="3" />
            <path d="M12 2a8 8 0 0 0-8 8c0 4.5 8 12 8 12s8-7.5 8-12a8 8 0 0 0-8-8z" />
          </svg>
          {showNearby ? "Hide Nearby" : "Show Nearby Offices"}
        </button>
      </div>

      {/* ═══════ Offline banner ═══════ */}
      {!isOnline && (
        <Card
          variant="default"
          className="bg-bni-amber-50 border-bni-amber-100 ring-1 ring-bni-amber-100"
        >
          <div className="px-4 py-2.5 text-sm text-bni-amber-600 font-medium">
            Map requires connectivity — showing cached tiles only
          </div>
        </Card>
      )}

      {/* ═══════ Filter chips + radius ═══════ */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin max-w-full pb-1">
          <FilterChip
            label="All"
            active={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
          />
          {categories.map((c) => (
            <FilterChip
              key={c}
              label={c}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
            />
          ))}
        </div>

        {showNearby && (
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Radius
            </span>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="input-field w-auto text-sm min-h-[36px] py-1.5 pr-8"
            >
              {RADIUS_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ═══════ Location error ═══════ */}
      {locationError && (
        <Card
          variant="default"
          className="bg-bni-red-50 border-bni-red-100 ring-1 ring-bni-red-100"
        >
          <div className="px-4 py-2.5 text-sm text-bni-red-600 font-medium">
            {locationError}
          </div>
        </Card>
      )}

      {/* ═══════ Map ═══════ */}
      <Card variant="default" className="overflow-hidden">
        <div
          ref={mapRef}
          className="w-full h-[500px] lg:h-[600px] bg-slate-100"
        />
      </Card>

      {/* ═══════ Nearby offices list ═══════ */}
      {showNearby && userLocation && (
        <Card variant="default">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-bni-blue-50 flex items-center justify-center text-bni-blue-600">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 2a8 8 0 0 0-8 8c0 4.5 8 12 8 12s8-7.5 8-12a8 8 0 0 0-8-8z" />
                  </svg>
                </div>
                <h2 className="text-subtitle text-navy">
                  Offices within {radiusKm} km
                </h2>
              </div>
              <Badge variant="blue">{nearbyMembers.length}</Badge>
            </div>
            {nearbyMembers.length === 0 ? (
              <EmptyState
                icon={
                  <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                }
                title="No offices in this range"
                description={`Showing all members on the map instead. Try a larger radius.`}
                className="py-6"
              />
            ) : (
              <div className="space-y-2">
                {nearbyMembers.map((m) => {
                  const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${m.latitude},${m.longitude}&travelmode=driving`;
                  return (
                    <div
                      key={m.member_id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Avatar name={m.full_name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-navy truncate">
                          {m.full_name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500 truncate">
                            {m.biz_category}
                          </span>
                          <span className="text-xs text-bni-blue-600 font-semibold flex-shrink-0">
                            {(m.distance / 1000).toFixed(1)} km
                          </span>
                        </div>
                      </div>
                      <a
                        href={navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-bni-blue-500 text-white text-xs font-semibold rounded-md hover:bg-bni-blue-600 transition-colors"
                      >
                        Navigate
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ═══════ List-only members ═══════ */}
      {data?.listOnly && data.listOnly.length > 0 && (
        <Card variant="default">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-bni-amber-50 flex items-center justify-center text-bni-amber-600">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                </div>
                <h2 className="text-subtitle text-navy">
                  Not on map yet
                </h2>
              </div>
              <Badge variant="amber">{data.listOnly.length}</Badge>
            </div>
            <div className="space-y-2">
              {data.listOnly.map((m) => (
                <div
                  key={m.member_id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Avatar name={m.full_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-navy truncate">
                      {m.full_name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {m.biz_category}
                    </div>
                  </div>
                  <Badge
                    variant={m.geocode_status === "PENDING" ? "amber" : "red"}
                    size="sm"
                  >
                    {m.geocode_status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─────────── Filter Chip ─────────── */
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold
        transition-all duration-fast whitespace-nowrap border
        ${
          active
            ? "bg-bni-blue-500 text-white border-bni-blue-500 shadow-soft"
            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        }
      `}
    >
      {label}
    </button>
  );
}
