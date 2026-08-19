"use client";

import { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Shared shape for anything backed by a Google Places Autocomplete pick:
// hangouts.start_location/end_location jsonb, and new public.places rows.
export type PlaceAutocompleteValue = {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  formatted_address: string;
} | null;

export function PlaceAutocompleteField({
  id,
  label,
  required,
  value,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: PlaceAutocompleteValue;
  onChange: (value: PlaceAutocompleteValue) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary("places");
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const instance = new placesLib.Autocomplete(inputRef.current, {
      fields: ["place_id", "name", "formatted_address", "geometry"],
    });
    setAutocomplete(instance);

    return () => {
      google.maps.event.clearInstanceListeners(instance);
    };
  }, [placesLib]);

  useEffect(() => {
    if (!autocomplete) return;

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;

      if (!place.place_id || !location) {
        onChange(null);
        return;
      }

      const formattedAddress = place.formatted_address ?? "";

      onChange({
        place_id: place.place_id,
        name: place.name ?? formattedAddress,
        lat: location.lat(),
        lng: location.lng(),
        formatted_address: formattedAddress,
      });

      if (inputRef.current) {
        inputRef.current.value = formattedAddress;
      }
    });

    return () => listener.remove();
  }, [autocomplete, onChange]);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={inputRef}
        type="text"
        required={required}
        defaultValue={value?.formatted_address ?? ""}
        placeholder="Search for a place"
        onChange={() => {
          // Typing without picking a fresh suggestion invalidates whatever
          // place was previously selected.
          if (value) onChange(null);
        }}
      />
    </div>
  );
}
