import { isUuid } from "@/lib/db";
import { getSupabaseAdminClient, secretMatches } from "@/lib/supabase/admin";

/**
 * Tâche planifiée quotidienne (vercel.json → crons). Vercel envoie
 * `Authorization: Bearer $CRON_SECRET`.
 *
 * 1. Termine les parties dont la durée choisie par l'hôte est écoulée.
 * 2. Supprime les photos de preuve orphelines du bucket `proofs` :
 *    dossiers de parties supprimées, et fichiers de plus d'un jour qui ne
 *    sont rattachés à aucune proposition (envoi interrompu, proposition
 *    contestée dont l'auteur n'est jamais revenu…).
 */

const BUCKET = "proofs";
const PAGE = 1000;
const GRACE_MS = 24 * 60 * 60 * 1000;

export const maxDuration = 60;

export async function GET(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(bearer, process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return new Response("SUPABASE_SERVICE_ROLE_KEY missing", { status: 503 });

  const { data: finished, error: finishError } = await admin.rpc("finish_expired_games");
  if (finishError) return Response.json({ error: finishError.message }, { status: 500 });

  const storage = admin.storage.from(BUCKET);
  const list = async (prefix: string) => {
    const entries = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await storage.list(prefix, { limit: PAGE, offset });
      if (error) throw error;
      entries.push(...data);
      if (data.length < PAGE) return entries;
    }
  };

  // arborescence : <game_id>/<user_id>/<fichier>.jpg
  const toRemove: string[] = [];
  const gameFolders = (await list("")).filter((e) => e.id === null && isUuid(e.name)).map((e) => e.name);
  // une erreur de lecture ne doit jamais faire passer des photos pour orphelines
  const { data: games, error: gamesError } = gameFolders.length
    ? await admin.from("games").select("id").in("id", gameFolders)
    : { data: [], error: null };
  if (gamesError) return Response.json({ finished, error: gamesError.message }, { status: 500 });
  const liveGames = new Set((games ?? []).map((g) => g.id));
  const { data: claims, error: claimsError } = liveGames.size
    ? await admin.from("game_claims").select("photo_path").in("game_id", [...liveGames]).not("photo_path", "is", null)
    : { data: [], error: null };
  if (claimsError) return Response.json({ finished, error: claimsError.message }, { status: 500 });
  const referenced = new Set((claims ?? []).map((c) => c.photo_path));
  const now = Date.now();

  for (const gameId of gameFolders) {
    const live = liveGames.has(gameId);
    for (const userFolder of (await list(gameId)).filter((e) => e.id === null)) {
      for (const file of await list(`${gameId}/${userFolder.name}`)) {
        if (file.id === null) continue;
        const path = `${gameId}/${userFolder.name}/${file.name}`;
        const age = now - new Date(file.created_at ?? 0).getTime();
        if (!live || (!referenced.has(path) && age > GRACE_MS)) toRemove.push(path);
      }
    }
  }

  for (let i = 0; i < toRemove.length; i += 100) {
    const { error } = await storage.remove(toRemove.slice(i, i + 100));
    if (error) return Response.json({ finished, removed: i, error: error.message }, { status: 500 });
  }

  return Response.json({ finished, removed: toRemove.length });
}
