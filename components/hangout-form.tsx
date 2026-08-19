"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APIProvider } from "@vis.gl/react-google-maps";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PlaceAutocompleteField,
  type PlaceAutocompleteValue,
} from "@/components/place-autocomplete-field";

// Matches the jsonb shape expected by hangouts.start_location / end_location.
type PlaceValue = PlaceAutocompleteValue;

// Matches hangouts.transportation_mode's check constraint.
type TransportationMode = "driving" | "walking" | "transit";

export function HangoutForm() {
  const [name, setName] = useState("");
  const [startLocation, setStartLocation] = useState<PlaceValue>(null);
  const [endLocation, setEndLocation] = useState<PlaceValue>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [transportationMode, setTransportationMode] =
    useState<TransportationMode>("driving");
  const [bufferMinutes, setBufferMinutes] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startLocation) {
      setError("Please select a start location from the suggestions.");
      return;
    }
    if (!startTime) {
      setError("Start time is required.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError ?? new Error("You must be signed in to create a hangout.");
      }

      const { error: insertError } = await supabase.from("hangouts").insert({
        organizer_id: user.id,
        name,
        start_location: startLocation,
        end_location: endLocation,
        start_time: new Date(startTime).toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : null,
        transportation_mode: transportationMode,
        buffer_minutes: bufferMinutes,
        // The itinerary optimizer needs a single IANA timezone to resolve
        // opening hours/reservations against local wall-clock time — the
        // organizer's browser timezone is the best available proxy for
        // "where this hangout is happening" until place-level geocoding
        // exists.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (insertError) throw insertError;

      router.push("/dashboard");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (!apiKey) {
    return (
      <p className="text-sm text-red-500">
        Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — location fields can&apos;t
        load.
      </p>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <PlaceAutocompleteField
          id="start-location"
          label="Start location"
          required
          value={startLocation}
          onChange={setStartLocation}
        />

        <PlaceAutocompleteField
          id="end-location"
          label="End location"
          value={endLocation}
          onChange={setEndLocation}
        />

        <div className="grid gap-2">
          <Label htmlFor="start-time">Start time</Label>
          <Input
            id="start-time"
            type="datetime-local"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="end-time">End time</Label>
          <Input
            id="end-time"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="transportation-mode">Transportation mode</Label>
          <select
            id="transportation-mode"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            value={transportationMode}
            onChange={(e) =>
              setTransportationMode(e.target.value as TransportationMode)
            }
          >
            <option value="driving">Driving</option>
            <option value="walking">Walking</option>
            <option value="transit">Transit</option>
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="buffer-minutes">Buffer minutes</Label>
          <Input
            id="buffer-minutes"
            type="number"
            min={0}
            value={bufferMinutes}
            onChange={(e) => setBufferMinutes(Number(e.target.value))}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating hangout..." : "Create hangout"}
        </Button>
      </form>
    </APIProvider>
  );
}
