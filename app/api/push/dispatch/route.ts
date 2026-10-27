import webpush from "web-push";
import { createTranslator, getDictionary, isLocale, type MessageKey } from "@/lib/i18n";
import { getSupabaseAdminClient, secretMatches } from "@/lib/supabase/admin";

/**
 * Appelée par la base (pg_net, voir migration 13) à chaque bingo,
 * proposition, résolution de proposition, lancement et fin de partie. Calcule les
 * destinataires et envoie les notifications Web Push, dans la langue de
 * chaque appareil. Protégée par le secret partagé PUSH_WEBHOOK_SECRET.
 */

type Payload = {
  kind: "bingo" | "double_bingo" | "claim" | "claim_resolved" | "game_finished" | "game_started";
  game_id: string;
  player_id?: string;
  claim_id?: string;
  actor_id?: string | null;
};

type Message = { title: MessageKey; body: MessageKey; vars: Record<string, string> };

function vapidReady() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:contact@example.com", publicKey, privateKey);
  return true;
}

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-push-secret"), process.env.PUSH_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = getSupabaseAdminClient();
  if (!admin || !vapidReady()) return new Response("Push not configured", { status: 503 });

  const payload = (await request.json().catch(() => null)) as Payload | null;
  if (!payload?.kind || !payload.game_id) return new Response("Bad request", { status: 400 });

  const { data: game } = await admin.from("games").select("id, code, host_id, board_id").eq("id", payload.game_id).maybeSingle();
  if (!game) return Response.json({ sent: 0 });

  const [{ data: board }, { data: players }] = await Promise.all([
    admin.from("boards").select("title").eq("id", game.board_id).maybeSingle(),
    admin.from("game_players").select("id, user_id, nickname").eq("game_id", game.id),
  ]);
  const title = board?.title ?? "bingoBuzz";
  const members = [...new Set([game.host_id, ...(players ?? []).map((p) => p.user_id)])];
  const nameOf = (uid: string | null | undefined) => (players ?? []).find((p) => p.user_id === uid)?.nickname ?? "bingoBuzz";

  const phraseOfClaim = async (claimId: string | undefined) => {
    if (!claimId) return null;
    const { data: claim } = await admin.from("game_claims").select("*").eq("id", claimId).maybeSingle();
    if (!claim) return null;
    const { data: phrase } = await admin.from("board_phrases").select("text").eq("id", claim.phrase_id).maybeSingle();
    return { claim, text: phrase?.text ?? "…" };
  };

  // destinataires + message
  let recipients: string[] = [];
  let message: Message | null = null;
  switch (payload.kind) {
    case "bingo":
    case "double_bingo": {
      const player = (players ?? []).find((p) => p.id === payload.player_id);
      recipients = members.filter((uid) => uid !== payload.actor_id);
      const double = payload.kind === "double_bingo";
      message = {
        title: double ? "push.msg.double.title" : "push.msg.bingo.title",
        body: double ? "push.msg.double.body" : "push.msg.bingo.body",
        vars: { name: player?.nickname ?? "?", title },
      };
      break;
    }
    case "claim": {
      const found = await phraseOfClaim(payload.claim_id);
      if (!found) break;
      recipients = members.filter((uid) => uid !== found.claim.claimed_by);
      message = {
        title: "push.msg.claim.title",
        body: "push.msg.claim.body",
        vars: { name: nameOf(found.claim.claimed_by), text: found.text },
      };
      break;
    }
    case "claim_resolved": {
      const found = await phraseOfClaim(payload.claim_id);
      if (!found || found.claim.status === "pending") break;
      recipients = [found.claim.claimed_by];
      const confirmed = found.claim.status === "confirmed";
      message = {
        title: confirmed ? "push.msg.confirmed.title" : "push.msg.rejected.title",
        body: confirmed ? "push.msg.confirmed.body" : "push.msg.rejected.body",
        vars: { name: nameOf(found.claim.resolved_by), text: found.text },
      };
      break;
    }
    case "game_finished":
      recipients = members;
      message = { title: "push.msg.finished.title", body: "push.msg.finished.body", vars: { title } };
      break;
    case "game_started":
      // partie préparée ensemble : l'hôte vient de la lancer
      recipients = members.filter((uid) => uid !== payload.actor_id);
      message = { title: "push.msg.started.title", body: "push.msg.started.body", vars: { title } };
      break;
  }
  if (!message || recipients.length === 0) return Response.json({ sent: 0 });

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("*")
    .in("user_id", recipients);

  const url = `/play/${game.code}`;
  const expired: string[] = [];
  let sent = 0;
  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      const t = createTranslator(getDictionary(isLocale(sub.locale) ? sub.locale : "fr"));
      const body = JSON.stringify({
        title: t(message.title, message.vars),
        body: t(message.body, message.vars),
        url,
        // une notification par partie et par type : les suivantes la remplacent
        tag: `${game.id}:${payload.kind}`,
      });
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
          TTL: 60 * 60 * 12,
        });
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // abonnement révoqué ou expiré : on l'oublie
        if (status === 404 || status === 410) expired.push(sub.id);
      }
    }),
  );
  if (expired.length > 0) await admin.from("push_subscriptions").delete().in("id", expired);

  return Response.json({ sent, expired: expired.length });
}
