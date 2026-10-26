"use client";

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { requireUser } from "@/lib/auth";
import { fetchBoard } from "@/lib/db";
import { errorKey } from "@/lib/errors";
import { haptics } from "@/lib/haptics";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  BoardWithPhrases,
  Game,
  GameClaim,
  GameEvent,
  GamePlayer,
  GameReaction,
  PublicGame,
  ReactionEmoji,
} from "@/types/bingo";

/** Partie dont la durée choisie par l'hôte est écoulée. */
function isExpired(game: Game) {
  return game.status === "playing" && game.ends_at !== null && new Date(game.ends_at) <= new Date();
}

export type Phase = "loading" | "join" | "ready" | "error";
export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

/** Événement de proposition à signaler (mode « peer ») */
export interface ClaimNotice {
  seq: number;
  kind: "new" | "confirmed" | "rejected";
  claim: GameClaim;
}

export interface BingoNotice {
  seq: number;
  player: GamePlayer;
}

/** Au-delà de cette absence (onglet masqué, téléphone en veille), on recrée le canal. */
const STALE_AFTER_MS = 20_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * État temps réel d'une partie de groupe.
 *
 * - Données : `games`, `game_players`, `game_events` via postgres_changes
 *   (filtrées par la RLS : on ne reçoit que sa partie).
 * - Présence : qui a l'onglet ouvert (canal presence, clé = user id).
 * - Coches : mise à jour optimiste + file d'écriture sérialisée ; on ignore
 *   l'écho Realtime de sa propre ligne tant qu'une écriture est en cours.
 * - Reconnexion : au retour sur l'onglet (visibilitychange), au retour du
 *   réseau (online) et après une erreur de canal (backoff exponentiel), on
 *   se réabonne puis on recharge tout l'état depuis la base.
 */
export function useGame(publicGame: PublicGame) {
  const t = useT();
  const toast = useToast();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const gameId = publicGame.id;

  const [phase, setPhase] = useState<Phase>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  // propositions en attente + confirmées avec photo (mode « peer »)
  const [claims, setClaims] = useState<GameClaim[]>([]);
  const [reactions, setReactions] = useState<GameReaction[]>([]);
  const [board, setBoard] = useState<BoardWithPhrases | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [online, setOnline] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<BingoNotice | null>(null);
  const [claimNotice, setClaimNotice] = useState<ClaimNotice | null>(null);
  const claimSeq = useRef(0);

  const userIdRef = useRef<string | null>(null);
  const playersRef = useRef<GamePlayer[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryRef = useRef<{ attempt: number; timer: number | null }>({ attempt: 0, timer: null });
  const hiddenAtRef = useRef<number | null>(null);
  const noticeSeq = useRef(0);
  const boardLoaded = useRef(false);
  const boardRef = useRef<BoardWithPhrases | null>(null);
  const statusRef = useRef<Game["status"] | null>(null);
  // file d'écriture des coches du joueur courant
  const writeRef = useRef<{ inflight: boolean; dirty: boolean; local: boolean[] | null }>({
    inflight: false,
    dirty: false,
    local: null,
  });

  // ------------------------------------------------------------------------
  // Fusion des joueurs (protège sa propre ligne, détecte les nouveaux bingos)
  // ------------------------------------------------------------------------

  const applyPlayers = useCallback((incoming: GamePlayer[], mode: "replace" | "merge") => {
    const prev = playersRef.current;
    const prevById = new Map(prev.map((p) => [p.id, p]));

    let next: GamePlayer[];
    if (mode === "replace") {
      next = incoming;
    } else {
      const byId = new Map(prev.map((p) => [p.id, p]));
      for (const p of incoming) byId.set(p.id, p);
      next = [...byId.values()];
    }

    const me = userIdRef.current;
    const write = writeRef.current;
    if (write.local && (write.inflight || write.dirty)) {
      next = next.map((p) => (p.user_id === me ? { ...p, checked: write.local! } : p));
    }

    for (const p of next) {
      const before = prevById.get(p.id);
      if (p.user_id !== me && p.has_bingo && before && !before.has_bingo) {
        setNotice({ seq: ++noticeSeq.current, player: p });
      }
    }

    next.sort((a, b) => a.joined_at.localeCompare(b.joined_at));
    playersRef.current = next;
    setPlayers(next);
  }, []);

  /** Proposition reçue en direct : en attente → liste ; résolue → retirée (+ notification à l’auteur). */
  const applyClaim = useCallback((claim: GameClaim, isNew: boolean) => {
    const me = userIdRef.current;
    if (claim.status === "pending") {
      setClaims((list) => (list.some((c) => c.id === claim.id) ? list : [...list, claim]));
      if (isNew && claim.claimed_by !== me) setClaimNotice({ seq: ++claimSeq.current, kind: "new", claim });
      return;
    }
    // confirmée avec photo : reste dans la galerie ; sinon elle disparaît
    setClaims((list) =>
      claim.status === "confirmed" && claim.photo_path
        ? list.map((c) => (c.id === claim.id ? claim : c))
        : list.filter((c) => c.id !== claim.id),
    );
    // ma proposition contestée : sa photo n'a plus de raison d'être conservée
    if (claim.claimed_by === me && claim.status === "rejected" && claim.photo_path) {
      void supabase.storage.from("proofs").remove([claim.photo_path]);
    }
    if (claim.claimed_by === me && claim.resolved_by && claim.resolved_by !== me) {
      setClaimNotice({ seq: ++claimSeq.current, kind: claim.status === "confirmed" ? "confirmed" : "rejected", claim });
    }
  }, [supabase]);

  const removePlayer = useCallback((id: string) => {
    const next = playersRef.current.filter((p) => p.id !== id);
    if (next.length === playersRef.current.length) return;
    playersRef.current = next;
    setPlayers(next);
  }, []);

  // ------------------------------------------------------------------------
  // Chargement complet depuis la base
  // ------------------------------------------------------------------------

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getSession();
    // connexion obligatoire : une ancienne session invité ne compte pas
    const sessionUser = auth.session?.user;
    const uid = sessionUser && !sessionUser.is_anonymous ? sessionUser.id : null;
    userIdRef.current = uid;
    setUserId(uid);
    if (!uid) {
      setPhase("join");
      return;
    }

    const [gameRes, playersRes, eventsRes, claimsRes, reactionsRes] = await Promise.all([
      supabase.from("games").select("*").eq("id", gameId).maybeSingle(),
      supabase.from("game_players").select("*").eq("game_id", gameId),
      supabase.from("game_events").select("*").eq("game_id", gameId),
      // en attente (à confirmer) + confirmées avec photo (galerie des preuves)
      supabase
        .from("game_claims")
        .select("*")
        .eq("game_id", gameId)
        .or("status.eq.pending,and(status.eq.confirmed,photo_path.not.is.null)")
        .order("created_at", { ascending: false }),
      supabase.from("game_reactions").select("*").eq("game_id", gameId),
    ]);
    if (gameRes.error) throw gameRes.error;
    if (playersRes.error) throw playersRes.error;
    if (eventsRes.error) throw eventsRes.error;

    // la RLS ne montre la partie qu'à l'hôte et aux joueurs
    if (!gameRes.data) {
      setPhase("join");
      return;
    }

    let loaded = gameRes.data;
    // durée écoulée : on termine la partie sans attendre la tâche planifiée
    if (isExpired(loaded)) {
      const { data: status } = await supabase.rpc("check_game_expiry", { p_game_id: gameId });
      if (status) loaded = { ...loaded, status };
    }

    setGame(loaded);
    statusRef.current = loaded.status;
    applyPlayers(playersRes.data ?? [], "replace");
    setEvents(eventsRes.data ?? []);
    setClaims(claimsRes.data ?? []);
    setReactions(reactionsRes.data ?? []);

    // en préparation, les phrases changent : on recharge le bingo à chaque fois
    if (!boardLoaded.current || loaded.status === "lobby") {
      boardLoaded.current = true;
      fetchBoard(supabase, gameRes.data.board_id)
        .then((b) => {
          boardRef.current = b;
          setBoard(b);
        })
        .catch(() => {
          boardLoaded.current = false;
        });
    }
    setPhase("ready");
  }, [supabase, gameId, applyPlayers]);

  const reloadBoard = useCallback(async () => {
    const b = await fetchBoard(supabase, publicGame.board_id).catch(() => null);
    if (b) {
      boardRef.current = b;
      setBoard(b);
    }
  }, [supabase, publicGame.board_id]);

  const safeLoad = useCallback(async () => {
    try {
      await load();
    } catch (error) {
      if (errorKey(error) === "errors.network") setConnection("offline");
      else setPhase((p) => (p === "loading" ? "error" : p));
    }
  }, [load]);

  // ------------------------------------------------------------------------
  // Écriture des coches (mode libre)
  // ------------------------------------------------------------------------

  const flushChecks = useCallback(async () => {
    const write = writeRef.current;
    if (write.inflight || !write.dirty || !write.local) return;
    const me = playersRef.current.find((p) => p.user_id === userIdRef.current);
    if (!me) return;

    write.inflight = true;
    try {
      while (write.dirty && write.local) {
        write.dirty = false;
        const { data, error } = await supabase
          .from("game_players")
          .update({ checked: write.local })
          .eq("id", me.id)
          .select()
          .single();
        if (error) throw error;
        if (!write.dirty) {
          // état serveur définitif (has_bingo calculé par la base)
          write.inflight = false;
          write.local = null;
          applyPlayers([data], "merge");
        }
      }
    } catch (error) {
      const key = errorKey(error);
      if (key === "errors.network") {
        write.dirty = true; // renvoyé au retour du réseau
        setConnection("offline");
      } else {
        write.dirty = false;
        write.local = null;
        toast.show(t(key), { tone: "error" });
        void safeLoad();
      }
    } finally {
      write.inflight = false;
    }
  }, [supabase, applyPlayers, safeLoad, toast, t]);

  // ------------------------------------------------------------------------
  // Abonnement Realtime
  // ------------------------------------------------------------------------

  const subscribe = useCallback(async () => {
    const retry = retryRef.current;
    if (retry.timer !== null) {
      window.clearTimeout(retry.timer);
      retry.timer = null;
    }
    if (channelRef.current) {
      const old = channelRef.current;
      channelRef.current = null;
      await supabase.removeChannel(old);
    }

    const { data: auth } = await supabase.auth.getSession();
    const session = auth.session;
    if (!session) return;
    // le jeton doit être connu du socket pour que la RLS filtre les événements
    await supabase.realtime.setAuth(session.access_token);

    setConnection((c) => (c === "live" ? "reconnecting" : c));

    const channel = supabase.channel(`game:${gameId}`, {
      config: { presence: { key: session.user.id } },
    });

    const isCurrent = () => channelRef.current === channel;

    const scheduleRetry = () => {
      if (!isCurrent() || retry.timer !== null) return;
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** retry.attempt);
      retry.attempt += 1;
      retry.timer = window.setTimeout(() => {
        retry.timer = null;
        void subscribe();
      }, delay);
    };

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        (payload: RealtimePostgresChangesPayload<GamePlayer>) => {
          if (payload.eventType === "INSERT") applyPlayers([payload.new], "merge");
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        (payload: RealtimePostgresChangesPayload<GamePlayer>) => {
          if (payload.eventType === "UPDATE") applyPlayers([payload.new], "merge");
        },
      )
      // les DELETE ne sont pas filtrables : on reçoit l'id et on ignore s'il n'est pas à nous
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "game_players" },
        (payload: RealtimePostgresChangesPayload<GamePlayer>) => {
          const id = payload.old && "id" in payload.old ? payload.old.id : undefined;
          if (id) removePlayer(id);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
        (payload: RealtimePostgresChangesPayload<GameEvent>) => {
          if (payload.eventType !== "INSERT") return;
          const event = payload.new;
          setEvents((list) => (list.some((e) => e.id === event.id) ? list : [...list, event]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "game_events" },
        (payload: RealtimePostgresChangesPayload<GameEvent>) => {
          const id = payload.old && "id" in payload.old ? payload.old.id : undefined;
          if (id) setEvents((list) => list.filter((e) => e.id !== id));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_claims", filter: `game_id=eq.${gameId}` },
        (payload: RealtimePostgresChangesPayload<GameClaim>) => {
          if (payload.eventType === "INSERT") applyClaim(payload.new, true);
        },
      )
      // remise à zéro de la partie par l'hôte
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "game_claims" },
        (payload: RealtimePostgresChangesPayload<GameClaim>) => {
          const id = payload.old && "id" in payload.old ? payload.old.id : undefined;
          if (id) setClaims((list) => list.filter((c) => c.id !== id));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_claims", filter: `game_id=eq.${gameId}` },
        (payload: RealtimePostgresChangesPayload<GameClaim>) => {
          if (payload.eventType === "UPDATE") applyClaim(payload.new, false);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_reactions", filter: `game_id=eq.${gameId}` },
        (payload: RealtimePostgresChangesPayload<GameReaction>) => {
          if (payload.eventType !== "INSERT") return;
          const reaction = payload.new;
          setReactions((list) => (list.some((r) => r.id === reaction.id) ? list : [...list, reaction]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "game_reactions" },
        (payload: RealtimePostgresChangesPayload<GameReaction>) => {
          const id = payload.old && "id" in payload.old ? payload.old.id : undefined;
          if (id) setReactions((list) => list.filter((r) => r.id !== id));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload: RealtimePostgresChangesPayload<Game>) => {
          if (payload.eventType !== "UPDATE") return;
          const changed = statusRef.current !== payload.new.status;
          statusRef.current = payload.new.status;
          setGame(payload.new);
          // lancement de la partie : les grilles viennent d'être distribuées
          if (changed) void safeLoad();
        },
      )
      // salle de préparation : phrases ajoutées ou retirées par les membres
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "board_phrases", filter: `board_id=eq.${publicGame.board_id}` },
        () => {
          if (statusRef.current === "lobby") void reloadBoard();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "board_phrases" },
        (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
          const id = payload.old && "id" in payload.old ? payload.old.id : undefined;
          if (id && boardRef.current?.phrases.some((p) => p.id === id)) void reloadBoard();
        },
      )
      .on("presence", { event: "sync" }, () => {
        if (isCurrent()) setOnline(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (!isCurrent()) return;
        if (status === "SUBSCRIBED") {
          retry.attempt = 0;
          setConnection("live");
          void channel.track({ at: Date.now() });
          // rattrape tout ce qui a pu être manqué pendant la déconnexion
          void safeLoad();
          void flushChecks();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "reconnecting");
          scheduleRetry();
        }
      });

    channelRef.current = channel;
  }, [supabase, gameId, publicGame.board_id, applyPlayers, applyClaim, removePlayer, safeLoad, flushChecks, reloadBoard]);

  // chargement initial
  useEffect(() => {
    void safeLoad();
  }, [safeLoad]);

  // abonnement tant qu'on est membre de la partie
  useEffect(() => {
    if (phase !== "ready") return;
    void subscribe();
    const retry = retryRef.current;
    return () => {
      if (retry.timer !== null) window.clearTimeout(retry.timer);
      retry.timer = null;
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [phase, subscribe, supabase]);

  // échéance atteinte pendant qu'on regarde la partie
  const endsAt = game?.status === "playing" ? game.ends_at : null;
  useEffect(() => {
    if (!endsAt) return;
    const delay = new Date(endsAt).getTime() - Date.now();
    // setTimeout plafonne à ~24,8 jours ; au-delà, le rechargement suffira
    if (delay > 2 ** 31 - 1) return;
    const timer = window.setTimeout(() => void safeLoad(), Math.max(0, delay) + 1000);
    return () => window.clearTimeout(timer);
  }, [endsAt, safeLoad]);

  // veille / retour sur l'onglet / réseau
  useEffect(() => {
    if (phase !== "ready") return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      const away = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
      hiddenAtRef.current = null;
      const channel = channelRef.current;
      if (!channel || channel.state !== "joined" || away > STALE_AFTER_MS) {
        void subscribe(); // recharge l'état une fois abonné
      } else {
        void safeLoad();
        void flushChecks();
      }
    };
    const onOnline = () => void subscribe();
    const onOffline = () => setConnection("offline");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [phase, subscribe, safeLoad, flushChecks]);

  // ------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------

  const me = useMemo(() => players.find((p) => p.user_id === userId) ?? null, [players, userId]);
  const isHost = Boolean(game && userId && game.host_id === userId);

  const join = useCallback(
    async (nickname: string) => {
      await requireUser();
      const { error } = await supabase.rpc("join_game", { p_code: publicGame.code, p_nickname: nickname });
      if (error) throw error;
      await load();
    },
    [supabase, publicGame.code, load],
  );

  /**
   * Mode « peer » : proposer la phrase d'une case, avec une photo facultative
   * (déjà compressée). La photo est déposée d'abord dans le dossier du joueur,
   * puis supprimée si la proposition échoue. Renvoie true si c'est proposé.
   */
  const proposeClaim = useCallback(
    async (index: number, photo?: Blob | null): Promise<boolean> => {
      const uid = userIdRef.current;
      const current = playersRef.current.find((p) => p.user_id === uid);
      const cell = current?.grid[index];
      if (!uid || !current || !cell?.id || current.checked[index]) return false;

      let photoPath: string | null = null;
      if (photo) {
        photoPath = `${gameId}/${uid}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("proofs")
          .upload(photoPath, photo, { contentType: "image/jpeg", upsert: false });
        if (uploadError) {
          toast.show(t("errors.photo_upload"), { tone: "error" });
          return false;
        }
      }

      const { data, error } = await supabase.rpc("claim_phrase", {
        p_game_id: gameId,
        p_phrase_id: cell.id,
        p_photo_path: photoPath,
      });
      if (error) {
        if (photoPath) void supabase.storage.from("proofs").remove([photoPath]);
        toast.show(t(errorKey(error)), { tone: "error" });
        void safeLoad();
        return false;
      }
      haptics.tap();
      applyClaim(data, false);
      toast.show(t("game.peer.sent"));
      return true;
    },
    [supabase, gameId, applyClaim, safeLoad, toast, t],
  );

  /** Annuler sa propre proposition (la photo jointe est supprimée). */
  const cancelClaim = useCallback(
    async (claim: GameClaim) => {
      setClaims((list) => list.filter((c) => c.id !== claim.id));
      const { error } = await supabase.rpc("resolve_claim", { p_claim_id: claim.id, p_accept: false });
      if (error) {
        toast.show(t(errorKey(error)), { tone: "error" });
        void safeLoad();
        return;
      }
      if (claim.photo_path) void supabase.storage.from("proofs").remove([claim.photo_path]);
    },
    [supabase, safeLoad, toast, t],
  );

  /** Confirmer (ou contester) la proposition d’un autre joueur. */
  const resolveClaim = useCallback(
    async (claimId: string, accept: boolean) => {
      if (accept) haptics.tap();
      // sort tout de suite de « À confirmer » ; la galerie se met à jour via le temps réel
      setClaims((list) =>
        list.flatMap((c) =>
          c.id !== claimId ? [c] : accept && c.photo_path ? [{ ...c, status: "confirmed" as const }] : [],
        ),
      );
      const { error } = await supabase.rpc("resolve_claim", { p_claim_id: claimId, p_accept: accept });
      if (error) {
        toast.show(t(errorKey(error)), { tone: "error" });
        void safeLoad();
      }
    },
    [supabase, safeLoad, toast, t],
  );

  const toggle = useCallback(
    (index: number) => {
      // mode « peer » : l'écran ouvre la fenêtre de proposition (proposeClaim)
      if (game?.mode === "peer") return;
      const current = playersRef.current.find((p) => p.user_id === userIdRef.current);
      if (!current || !game || game.mode !== "free" || game.status !== "playing") return;
      if (current.grid[index]?.free) return;

      const checked = current.checked.slice();
      checked[index] = !checked[index];
      if (checked[index]) haptics.tap();
      else haptics.untap();

      writeRef.current.local = checked;
      writeRef.current.dirty = true;
      const next = playersRef.current.map((p) => (p.id === current.id ? { ...p, checked } : p));
      playersRef.current = next;
      setPlayers(next);
      void flushChecks();
    },
    [game, flushChecks],
  );

  const validatedIds = useMemo(() => new Set(events.map((e) => e.phrase_id)), [events]);

  const togglePhrase = useCallback(
    async (phraseId: string) => {
      if (!isHost) return;
      const existing = events.find((e) => e.phrase_id === phraseId);
      if (existing) {
        setEvents((list) => list.filter((e) => e.id !== existing.id));
        const { error } = await supabase
          .from("game_events")
          .delete()
          .eq("game_id", gameId)
          .eq("phrase_id", phraseId);
        if (error) {
          toast.show(t(errorKey(error)), { tone: "error" });
          void safeLoad();
        }
      } else {
        haptics.tap();
        const { data, error } = await supabase
          .from("game_events")
          .insert({ game_id: gameId, phrase_id: phraseId })
          .select()
          .single();
        if (error) {
          // déjà validée par un autre onglet : on resynchronise simplement
          if (!/duplicate key/i.test(error.message)) toast.show(t(errorKey(error)), { tone: "error" });
          void safeLoad();
        } else {
          setEvents((list) => (list.some((e) => e.id === data.id) ? list : [...list, data]));
        }
      }
    },
    [isHost, events, supabase, gameId, toast, t, safeLoad],
  );

  const endGame = useCallback(async () => {
    const { data, error } = await supabase
      .from("games")
      .update({ status: "finished" })
      .eq("id", gameId)
      .select()
      .single();
    if (error) toast.show(t(errorKey(error)), { tone: "error" });
    else setGame(data);
  }, [supabase, gameId, toast, t]);

  /** Ajoute ou retire sa réaction sur un bingo ou une proposition. */
  const toggleReaction = useCallback(
    async (targetType: GameReaction["target_type"], targetId: string, emoji: ReactionEmoji) => {
      const uid = userIdRef.current;
      if (!uid) return;
      const mine = reactions.find(
        (r) => r.target_type === targetType && r.target_id === targetId && r.user_id === uid && r.emoji === emoji,
      );
      if (mine) {
        setReactions((list) => list.filter((r) => r.id !== mine.id));
        const { error } = await supabase.from("game_reactions").delete().eq("id", mine.id);
        if (error) void safeLoad();
        return;
      }
      haptics.tap();
      const { data, error } = await supabase
        .from("game_reactions")
        .insert({ game_id: gameId, target_type: targetType, target_id: targetId, emoji })
        .select()
        .single();
      if (error) {
        if (!/duplicate key/i.test(error.message)) toast.show(t(errorKey(error)), { tone: "error" });
        void safeLoad();
        return;
      }
      setReactions((list) => (list.some((r) => r.id === data.id) ? list : [...list, data]));
    },
    [reactions, supabase, gameId, safeLoad, toast, t],
  );

  // ------------------------------------------------------------------------
  // Préparation (partie « lobby »)
  // ------------------------------------------------------------------------

  /** Proposer une phrase pour le bingo ; renvoie true si elle est ajoutée. */
  const addPhrase = useCallback(
    async (text: string): Promise<boolean> => {
      const { data, error } = await supabase.rpc("add_lobby_phrase", { p_game_id: gameId, p_text: text });
      if (error || !data) {
        toast.show(t(errorKey(error)), { tone: "error" });
        return false;
      }
      haptics.tap();
      setBoard((b) => {
        if (!b || b.phrases.some((p) => p.id === data.id)) return b;
        const next = { ...b, phrases: [...b.phrases, data] };
        boardRef.current = next;
        return next;
      });
      return true;
    },
    [supabase, gameId, toast, t],
  );

  const removePhrase = useCallback(
    async (phraseId: string) => {
      setBoard((b) => {
        if (!b) return b;
        const next = { ...b, phrases: b.phrases.filter((p) => p.id !== phraseId) };
        boardRef.current = next;
        return next;
      });
      const { error } = await supabase.rpc("remove_lobby_phrase", { p_game_id: gameId, p_phrase_id: phraseId });
      if (error) {
        toast.show(t(errorKey(error)), { tone: "error" });
        void reloadBoard();
      }
    },
    [supabase, gameId, toast, t, reloadBoard],
  );

  /** L'hôte lance la partie : chacun reçoit sa grille. */
  const startGame = useCallback(async (): Promise<boolean> => {
    const { error } = await supabase.rpc("start_game", { p_game_id: gameId });
    if (error) {
      toast.show(t(errorKey(error)), { tone: "error" });
      return false;
    }
    haptics.alert();
    await safeLoad();
    return true;
  }, [supabase, gameId, toast, t, safeLoad]);

  /** L'hôte change le mode (en préparation), la règle de fin ou la durée. */
  const updateSettings = useCallback(
    async (settings: { mode: Game["mode"]; autoEnd: Game["auto_end"]; durationDays: number | null; keepDeadline: boolean }) => {
      const { data, error } = await supabase.rpc("update_game_settings", {
        p_game_id: gameId,
        p_mode: settings.mode,
        p_auto_end: settings.autoEnd,
        p_duration_days: settings.durationDays,
        p_keep_deadline: settings.keepDeadline,
      });
      if (error || !data) {
        toast.show(t(errorKey(error)), { tone: "error" });
        return false;
      }
      statusRef.current = data.status;
      setGame(data);
      toast.show(t("game.settings.saved"), { tone: "success" });
      return true;
    },
    [supabase, gameId, toast, t],
  );

  /** L'hôte remet la partie à zéro (option : nouvelles grilles pour tous). */
  const resetGame = useCallback(
    async (newGrids: boolean) => {
      const { error } = await supabase.rpc("reset_game", { p_game_id: gameId, p_new_grids: newGrids });
      if (error) {
        toast.show(t(errorKey(error)), { tone: "error" });
        return false;
      }
      haptics.alert();
      await safeLoad();
      toast.show(t("game.reset.done"), { tone: "success" });
      return true;
    },
    [supabase, gameId, toast, t, safeLoad],
  );

  /** L'hôte remet la partie en préparation (brouillon) : grilles retirées, membres gardés. */
  const reopenLobby = useCallback(async () => {
    const { error } = await supabase.rpc("reopen_lobby", { p_game_id: gameId });
    if (error) {
      toast.show(t(errorKey(error)), { tone: "error" });
      return false;
    }
    await safeLoad();
    toast.show(t("game.reopen.done"), { tone: "success" });
    return true;
  }, [supabase, gameId, toast, t, safeLoad]);

  /** L'hôte annule la préparation : la partie disparaît, les phrases restent dans le bingo. */
  const cancelLobby = useCallback(async (): Promise<boolean> => {
    const { error } = await supabase.from("games").delete().eq("id", gameId);
    if (error) {
      toast.show(t(errorKey(error)), { tone: "error" });
      return false;
    }
    return true;
  }, [supabase, gameId, toast, t]);

  const leave = useCallback(async () => {
    if (!me) return;
    const { error } = await supabase.from("game_players").delete().eq("id", me.id);
    if (error) {
      toast.show(t(errorKey(error)), { tone: "error" });
      return;
    }
    removePlayer(me.id);
    if (!isHost) setPhase("join");
  }, [me, isHost, supabase, removePlayer, toast, t]);

  return {
    phase,
    userId,
    game,
    board,
    players,
    me,
    isHost,
    events,
    validatedIds,
    claims,
    claimNotice,
    resolveClaim,
    proposeClaim,
    cancelClaim,
    reactions,
    toggleReaction,
    addPhrase,
    removePhrase,
    startGame,
    cancelLobby,
    updateSettings,
    resetGame,
    reopenLobby,
    connection,
    online,
    notice,
    join,
    toggle,
    togglePhrase,
    endGame,
    leave,
    reload: safeLoad,
  };
}
