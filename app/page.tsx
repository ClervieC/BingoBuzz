import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { HomeView } from "@/components/HomeView";
import { fetchActiveGames, fetchOwnBoards, fetchTemplates } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/user";

type Props = { searchParams: Promise<{ error?: string; next?: string; deleted?: string }> };

function safeNext(next: string | undefined): string | null {
  return next?.startsWith("/") && !next.startsWith("//") && next !== "/" ? next : null;
}

export default async function HomePage({ searchParams }: Props) {
  const [params, user, { t, locale }] = await Promise.all([searchParams, getServerUser(), getT()]);
  const next = safeNext(params.next);

  // Sans compte, l'accueil EST l'écran de connexion (connexion obligatoire).
  if (!user || user.isAnonymous) {
    return (
      <AuthScreen
        t={t}
        next={next ?? "/"}
        callbackError={params.error === "1"}
        notice={params.deleted === "1" ? t("settings.delete.done") : null}
      />
    );
  }

  // déjà connecté mais renvoyé ici par une redirection : on repart tout de suite
  if (next) redirect(next);

  const supabase = await getSupabaseServerClient();
  const [mine, templates, active] = await Promise.all([
    fetchOwnBoards(supabase, user.id).catch(() => []),
    fetchTemplates(supabase, locale).catch(() => []),
    fetchActiveGames(supabase, user.id).catch(() => []),
  ]);

  return <HomeView t={t} name={user.name} mine={mine} templates={templates} active={active} />;
}
