"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APIProvider } from "@vis.gl/react-google-maps";

import { createClient } from "@/lib/supabase/client";
import { CtaButton } from "@/components/ui/cta-button";
import { Field } from "@/components/ui/field";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { Stepper } from "@/components/ui/stepper";
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
      <p className="font-grotesk text-sm lowercase text-[#8a1c1c]">
        missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — location fields can&apos;t
        load.
      </p>
    );
  }

  const labelClass =
    "mb-1.5 block font-grotesk text-[11px] font-bold uppercase tracking-[0.12em] text-ink";

  return (
    <APIProvider apiKey={apiKey}>
      <div className="flex flex-1 flex-col gap-10 md:flex-row">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2.5 md:w-[632px] md:flex-none md:gap-3.5"
        >
          <Field
            id="name"
            label="plan name"
            required
            placeholder="e.g. saturday downtown crawl"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid gap-2.5 md:grid-cols-2 md:gap-5">
            <Field
              id="start-time"
              label="start time"
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Field
              id="end-time"
              label="end time (optional)"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <PlaceAutocompleteField
            id="start-location"
            label="start location"
            variant="field"
            placeholder="search a starting point"
            required
            value={startLocation}
            onChange={setStartLocation}
          />

          <PlaceAutocompleteField
            id="end-location"
            label="end location (optional)"
            variant="field"
            placeholder="search an ending point"
            value={endLocation}
            onChange={setEndLocation}
          />

          <div>
            <span className={labelClass}>transportation mode</span>
            <SegmentedButtons<TransportationMode>
              aria-label="transportation mode"
              value={transportationMode}
              onChange={setTransportationMode}
              options={[
                { value: "driving", label: "Driving" },
                { value: "walking", label: "Walking" },
                { value: "transit", label: "Transit" },
              ]}
            />
          </div>

          <div>
            <span className={labelClass}>buffer between stops</span>
            <Stepper
              value={bufferMinutes}
              onChange={setBufferMinutes}
              min={0}
              step={5}
              unit="min"
            />
          </div>

          {error && (
            <p role="alert" className="font-grotesk text-sm lowercase text-[#8a1c1c]">
              {error}
            </p>
          )}

          <CtaButton type="submit" disabled={isLoading} className="mt-1">
            {isLoading ? "creating hangout…" : "create hangout"}
          </CtaButton>
        </form>

        <MapPlaceholder label="route preview appears here" />
      </div>
    </APIProvider>
  );
}
