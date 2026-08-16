import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

async function UserDetails() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return null;
}

export default function ProtectedPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <Suspense>
        <UserDetails />
      </Suspense>
      <div className="flex flex-col gap-2 items-start">
        <h1 className="font-bold text-2xl">Dashboard</h1>
        <p>Your hangouts will show up here.</p>
      </div>
    </div>
  );
}
