import { cn } from "@/lib/utils";

/** The KickStake "K" mark — same geometry as the favicon (app/icon.svg). */
export function KMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("size-9", className)}
      role="img"
      aria-label="KickStake"
    >
      <rect width="512" height="512" rx="116" fill="var(--color-primary)" />
      <path
        d="M132 120 H204 V224 L300 120 H380 L244 260 L380 400 H300 L204 296 V400 H132 Z"
        fill="var(--color-primary-foreground)"
      />
    </svg>
  );
}

/** The "K" mark + wordmark. Size controls the mark; text scales with it. */
export function Logo({
  className,
  showWord = true,
}: {
  className?: string;
  showWord?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <KMark className="size-9 rounded-xl drop-shadow-[0_0_16px_rgba(198,241,53,0.35)]" />
      {showWord && (
        <span className="font-display text-2xl tracking-tight text-foreground">
          KickStake
        </span>
      )}
    </div>
  );
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
