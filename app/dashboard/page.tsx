import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Suspense } from "react";

async function UserDetails() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return null;
}

async function HangoutsDashboard() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // Unreachable in practice — UserDetails (above) already redirects
  // unauthenticated requests before this component ever renders.
  if (!claims) return null;

  const canCreate = !claims.is_anonymous;

  const { data: hangouts, error } = await supabase
    .from("hangouts")
    .select(
      "id, name, status, start_time, created_at, hangout_members!inner(profile_id)",
    )
    .eq("hangout_members.profile_id", claims.sub)
    .order("start_time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">Dashboard</h1>
        {canCreate && (
          <Button asChild>
            <Link href="/hangouts/new">Create hangout</Link>
          </Button>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-500">
          Couldn&apos;t load your hangouts.
        </p>
      ) : !hangouts || hangouts.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-muted-foreground">
            You don&apos;t have any hangouts yet.
          </p>
          {canCreate && (
            <Button asChild>
              <Link href="/hangouts/new">Create hangout</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {hangouts.map((hangout) => (
            <Link key={hangout.id} href={`/hangouts/${hangout.id}`}>
              <Card className="h-full hover:bg-accent transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    {hangout.name}
                    <span className="text-xs font-normal rounded-full border px-2 py-0.5 capitalize">
                      {hangout.status}
                    </span>
                  </CardTitle>
                  {hangout.start_time && (
                    <CardDescription>
                      {new Date(hangout.start_time).toLocaleString(
                        undefined,
                        { dateStyle: "medium", timeStyle: "short" },
                      )}
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <Suspense>
        <UserDetails />
      </Suspense>
      <Suspense>
        <HangoutsDashboard />
      </Suspense>
    </div>
  );
}
