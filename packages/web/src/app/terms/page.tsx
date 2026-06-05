import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { EMAIL } from "@/lib/constants";

export const metadata: Metadata = { title: "Terms of Service · KickStake" };

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
      <Link href="/" aria-label="KickStake home" className="inline-block">
        <Logo />
      </Link>
      <h1 className="mt-8 font-display text-4xl">Terms of Service</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated 5 June 2026</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-foreground [&_a]:text-primary [&_a]:underline">
        <p>
          By using KickStake you agree to these terms. KickStake is a free tool
          for organising football tournament sweepstakes among a group.
        </p>

        <section className="space-y-2">
          <h2>Tracking-only — no payments</h2>
          <p>
            KickStake records buy-ins, prizes and who has paid, and produces a
            settlement summary. It never collects, holds, or transfers money.
            Any payments happen entirely off-app, between you and your group.
            You are responsible for how money is handled in your sweepstake and
            for complying with the laws that apply to you.
          </p>
        </section>

        <section className="space-y-2">
          <h2>Your responsibilities</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Use KickStake only where it&apos;s legal for you to do so.</li>
            <li>Keep your sign-in access secure.</li>
            <li>Be fair to the players in sweepstakes you organise.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2>Availability &amp; changes</h2>
          <p>
            KickStake is provided &ldquo;as is&rdquo;, without warranty. We may
            change or discontinue features, and may update these terms; material
            changes will be reflected by the date above.
          </p>
        </section>

        <section className="space-y-2">
          <h2>Contact</h2>
          <p>
            Questions? Email{" "}
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
