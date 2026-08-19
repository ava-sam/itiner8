import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { HangoutForm } from "@/components/hangout-form";

async function NewHangoutContent() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  // Guests (anonymous users) can't create hangouts — only account holders,
  // matching the "Account holders can create hangouts" insert policy on
  // the hangouts table.
  if (data.claims.is_anonymous) {
    redirect("/dashboard");
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8 max-w-2xl">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl">Plan a new hangout</h1>
      </div>
      <HangoutForm />
    </div>
  );
}

export default function NewHangoutPage() {
  return (
    <Suspense>
      <NewHangoutContent />
    </Suspense>
  );
}
