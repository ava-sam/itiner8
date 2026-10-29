import { CtaButton } from "@/components/ui/cta-button";
import { LandingFolders } from "@/components/landing-folders";
import { LandingInviteForm } from "@/components/landing-invite-form";

export function SignedOutLanding() {
  return (
    <div className="flex flex-col gap-8 overflow-x-clip px-5 pb-8 pt-6 md:min-h-[calc(100dvh-112px)] md:flex-row md:items-center md:gap-14 md:px-16 md:py-8">
      <section className="flex flex-col md:w-[46%] md:flex-none">
        <p className="font-grotesk text-[11px] font-bold uppercase tracking-[0.16em] md:text-xs">
          hangout planner
        </p>

        <h1 className="mt-3 font-display text-[50px] uppercase leading-[0.95] tracking-[0.01em] md:mt-4 md:text-[104px] md:leading-[0.92]">
          <span className="md:hidden">
            plan your day
            <br />
            together.
          </span>
          <span className="hidden md:inline">
            plan your
            <br />
            day
            <br />
            together
          </span>
        </h1>

        <p className="mt-4 max-w-[26rem] font-grotesk text-sm lowercase leading-relaxed md:mt-6 md:text-lg">
          <span className="md:hidden">add places, vote, and get a timed route.</span>
          <span className="hidden md:inline">
            add places, vote on them, and get a timed route that accounts for
            drive time, opening hours and reservations.
          </span>
        </p>

        <div className="mt-6 flex gap-2.5 md:mt-8 md:gap-3.5">
          <CtaButton
            href="/auth/sign-up"
            className="w-auto flex-1 whitespace-nowrap px-3 text-xs md:flex-none md:px-7 md:text-sm"
          >
            create an account
          </CtaButton>
          <CtaButton
            href="/auth/login"
            variant="light"
            className="w-auto flex-none whitespace-nowrap px-5 text-xs md:px-9 md:text-sm"
          >
            log in
          </CtaButton>
        </div>

        <div className="mt-6 md:mt-9">
          <p className="mb-2 hidden font-grotesk text-[11px] font-bold uppercase tracking-[0.12em] md:block">
            got an invite code?
          </p>
          <LandingInviteForm
            placeholder="got an invite code?"
            buttonLabel="join"
            className="md:hidden"
          />
          <LandingInviteForm
            placeholder="enter your invite code"
            buttonLabel="join a plan"
            className="hidden md:flex md:max-w-[26rem]"
          />
        </div>
      </section>

      <LandingFolders className="md:flex-1" />
    </div>
  );
}
