import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { EMAIL } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy Policy · KickStake" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
      <Link href="/" aria-label="KickStake home" className="inline-block">
        <Logo />
      </Link>
      <h1 className="mt-8 font-display text-4xl">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated 5 June 2026</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-foreground [&_a]:text-primary [&_a]:underline">
        <p>
          KickStake helps groups run football tournament sweepstakes. We keep
          the data we collect to the minimum needed to run them. KickStake is
          tracking-only and never processes payments.
        </p>

        <section className="space-y-2">
          <h2>What we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Organisers:</strong> your email address (for passwordless
              sign-in), and your name/photo if you sign in with Google.
            </li>
            <li>
              <strong>Players:</strong> the display name you enter to join, and
              an optional email if you provide one for updates.
            </li>
            <li>
              <strong>Sweepstake data:</strong> the tournament, buy-in, prize
              structure, draw results and who has been marked as paid.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2>How we use it</h2>
          <p>
            To run your sweepstake — authenticate organisers, send one-time
            sign-in codes (via Resend), assign teams, and produce the
            settlement summary. We do not sell your data or use it for
            advertising.
          </p>
        </section>

        <section className="space-y-2">
          <h2>Cookies</h2>
          <p>
            We use a single session cookie to keep organisers signed in. No
            third-party advertising or tracking cookies.
          </p>
        </section>

        <section className="space-y-2">
          <h2>Your choices</h2>
          <p>
            You can request deletion of your account and associated sweepstakes
            at any time by emailing{" "}
            <a href={`mailto:${EMAIL.contact}`}>{EMAIL.contact}</a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2>Contact</h2>
          <p>
            Questions about privacy? Email{" "}
            <a href={`mailto:${EMAIL.contact}`}>{EMAIL.contact}</a>.
          </p>
        </section>
      </div>

      <Link
        href="/"
        className="mt-10 inline-block text-sm text-primary underline"
      >
        ← Back to KickStake
      </Link>
    </main>
  );
}
