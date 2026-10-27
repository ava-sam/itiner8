import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { HangoutForm } from "@/components/hangout-form";
import { SectionPage } from "@/components/ui/section-page";

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

  return <HangoutForm />;
}

export default function NewHangoutPage() {
  return (
    <SectionPage
      label="create a plan"
      color="#aebbd2"
      texture="/textures/texture-brown.png"
      textureOpacity={0.2}
    >
      <Suspense>
        <NewHangoutContent />
      </Suspense>
    </SectionPage>
  );
}
