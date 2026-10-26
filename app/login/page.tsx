import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/user";

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

/**
 * Ancienne adresse : sans compte, la connexion se fait sur l'accueil (/) ;
 * connecté, la gestion du compte est dans /settings.
 */
export default async function LoginPage({ searchParams }: Props) {
  const [params, user] = await Promise.all([searchParams, getServerUser()]);
  if (user && !user.isAnonymous) redirect("/settings");

  const query = new URLSearchParams();
  if (params.next) query.set("next", params.next);
  if (params.error) query.set("error", params.error);
  const qs = query.toString();
  redirect(qs ? `/?${qs}` : "/");
}
