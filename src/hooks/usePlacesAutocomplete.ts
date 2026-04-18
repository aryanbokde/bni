"use client";

import { useEffect, useRef, useCallback } from "react";

interface PlacesResult {
  formatted_address: string;
  lat: number;
  lng: number;
}

export function usePlacesAutocomplete(
  onSelect: (result: PlacesResult) => void
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    if (autocompleteRef.current) return;

    const country =
      process.env.NEXT_PUBLIC_AUTOCOMPLETE_COUNTRY ?? "in";
    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["establishment", "geocode"],
      componentRestrictions: { country },
      fields: ["formatted_address", "geometry"],
    });

    listenerRef.current = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place.formatted_address && place.geometry?.location) {
        onSelect({
          formatted_address: place.formatted_address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    });

    autocompleteRef.current = ac;
  }, [onSelect]);

  useEffect(() => {
    if (window.google?.maps?.places) {
      initAutocomplete();
    } else {
      const interval = setInterval(() => {
        if (window.google?.maps?.places) {
          initAutocomplete();
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }

    return () => {
      if (listenerRef.current) {
        google.maps.event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
      autocompleteRef.current = null;
    };
  }, [initAutocomplete]);

  return inputRef;
}
