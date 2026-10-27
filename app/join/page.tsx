import { Suspense } from "react";
import { JoinForm } from "@/components/join-form";
import { SectionPage } from "@/components/ui/section-page";

export default function JoinPage() {
  return (
    <SectionPage
      label="join a plan"
      color="#b1b2ae"
      texture="/textures/texture-cream.png"
      textureOpacity={0.3}
    >
      <Suspense>
        <JoinForm />
      </Suspense>
    </SectionPage>
  );
}
