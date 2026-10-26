import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { LEGAL } from "@/lib/legal";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { getServerUser } from "@/lib/supabase/user";
import { WelcomeClient } from "./WelcomeClient";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("welcome.1.title"), robots: { index: false } };
}

type Props = { searchParams: Promise<{ next?: string }> };

export default async function WelcomePage({ searchParams }: Props) {
  const [user, { next: rawNext }] = await Promise.all([getServerUser(), searchParams]);
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (!user || user.isAnonymous) redirect("/");
  if (hasCompletedOnboarding(user.metadata)) redirect(next);

  return (
    <WelcomeClient
      next={next}
      name={user.name}
      // inscription e-mail : la case a déjà été cochée à la création du compte
      termsAccepted={user.metadata.terms_version === LEGAL.version}
      termsVersion={LEGAL.version}
    />
  );
}
