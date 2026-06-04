export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground">
          K
        </div>
        <h1 className="text-3xl font-black tracking-tight">KickStake</h1>
      </div>
      <p className="max-w-md text-muted-foreground">
        Create a football tournament sweepstake, share a link, and let the app
        run the draw and the prizes for you.
      </p>
      <p className="text-sm text-muted-foreground">
        Scaffold ready — API on{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">:3801</code>, web on{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">:3800</code>.
      </p>
    </main>
  );
}
