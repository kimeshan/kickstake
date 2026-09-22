import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CHALLENGE_APP_URL } from "@/lib/constants";

// Challenge pages carry their own title, preview text and icon (icon.svg in
// this segment) so shares from the challenge host never look like the
// football product — and vice versa.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("challenge.meta");
  const title = t("title");
  const description = t("description");
  return {
    title: { default: title, template: `%s · ${title}` },
    description,
    metadataBase: new URL(CHALLENGE_APP_URL),
    openGraph: { title, description, siteName: title, type: "website" },
    twitter: { card: "summary", title, description },
    // Invitation + personal pages are private to the group.
    robots: { index: false, follow: false },
  };
}

export default function ChallengesLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col">{children}</div>;
}
