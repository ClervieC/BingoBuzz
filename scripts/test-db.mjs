// Test d'intégration des migrations Supabase dans PGlite (Postgres compilé en WASM).
// Bouchonne le minimum de Supabase (rôles anon/authenticated, auth.uid()) puis vérifie
// RLS, RPC, triggers et la parité du mélange / de la détection SQL ↔ TypeScript.
// Usage : npm run test:db   (Node ≥ 22.18 pour importer les fichiers .ts)
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { shuffle } = await import(pathToFileURL(join(ROOT, "lib/random.ts")).href);
const { hasBingo } = await import(pathToFileURL(join(ROOT, "lib/bingo.ts")).href);

const db = new PGlite({ extensions: { pgcrypto } });
let passed = 0;
let failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log("  ✓", label); }
  else { failed++; console.log("  ✗", label); }
}
async function expectError(promise, pattern, label) {
  try { await promise; ok(false, `${label} (aucune erreur)`); }
  catch (e) { ok(pattern.test(e.message), `${label} → ${e.message}`); }
}

// --- bouchon Supabase ------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key, email text,
    created_at timestamptz default now(), last_sign_in_at timestamptz,
    raw_app_meta_data jsonb default '{"providers":["email"]}', raw_user_meta_data jsonb default '{}'
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create schema extensions;
  grant usage on schema extensions to anon, authenticated;
  create publication supabase_realtime;

  -- Storage : le strict nécessaire pour les policies du bucket « proofs »
  create schema storage;
  grant usage on schema storage to anon, authenticated;
  create table storage.buckets (
    id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text, name text,
    owner uuid default auth.uid()
  );
  alter table storage.objects enable row level security;
  grant select, insert, delete on storage.objects to authenticated;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant execute on function storage.foldername(text) to anon, authenticated;
`);

// --- migrations -------------------------------------------------------------
const dir = join(ROOT, "supabase/migrations");
for (const file of readdirSync(dir).sort()) {
  await db.exec(readFileSync(join(dir, file), "utf8"));
  console.log("migration OK :", file);
}
await db.exec(readFileSync(join(dir, "20261027000015_lobby.sql"), "utf8"));
console.log("migration ré-exécutée sans erreur : 20261027000015_lobby.sql");

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const C = "00000000-0000-0000-0000-00000000000c";
const D = "00000000-0000-0000-0000-00000000000d";
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}'), ('${D}')`);

async function as(uid) {
  await db.exec("reset role");
  if (uid === "anon") {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  } else {
    await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;

// --- parité TS / SQL ---------------------------------------------------------
console.log("\nParité du mélange et de la détection");
await db.exec("reset role");
{
  const [{ r }] = await q("select public.bb_shuffle(array[1,2,3,4,5,6,7,8,9], 42) as r");
  ok(JSON.stringify(r) === JSON.stringify([9, 5, 1, 2, 3, 6, 4, 8, 7]), `bb_shuffle(1..9, 42) = ${JSON.stringify(r)}`);

  let same = true;
  for (let seed = 1; seed <= 200; seed++) {
    const n = 9 + (seed % 25);
    const items = Array.from({ length: n }, (_, i) => i + 1);
    const [{ r: sql }] = await q("select public.bb_shuffle($1::int[], $2) as r", [items, seed * 7919]);
    if (JSON.stringify(sql) !== JSON.stringify(shuffle(items, seed * 7919))) { same = false; break; }
  }
  ok(same, "bb_shuffle == shuffle (TS) pour 200 graines et tailles 9..33");

  let state = 7;
  let sameBingo = true;
  for (let i = 0; i < 300; i++) {
    const size = 3 + (i % 3);
    const checked = Array.from({ length: size * size }, () => (state = (state * 48271) % 2147483647) % 3 !== 0);
    const [{ r }] = await q("select public.bb_has_bingo($1::jsonb, $2) as r", [JSON.stringify(checked), size]);
    if (r !== hasBingo(checked, size)) { sameBingo = false; break; }
  }
  ok(sameBingo, "bb_has_bingo == hasBingo (TS) sur 300 grilles 3×3..5×5");
}

// --- bingos --------------------------------------------------------------------
console.log("\nBingos et RLS");
const phrases = ["Un", "Deux", "deux", " ", "Trois", "Quatre", "Cinq", "Six", "Sept", "Huit", "Neuf", "Dix"];
await as(A);
const [{ id: boardId }] = await q(
  "select public.save_board(null, 'Test', '{\"emoji\":\"🎉\",\"color\":\"blue\"}', 3, true, $1) as id",
  [phrases],
);
ok(Boolean(boardId), "save_board crée un bingo");
const savedPhrases = await q("select text from public.board_phrases where board_id = $1 order by position", [boardId]);
ok(savedPhrases.length === 10, `doublons et vides retirés (${savedPhrases.length} phrases)`);
// brouillon : moins de phrases que de cases (vérifié au lancement d'une partie)
const [{ id: shortId }] = await q("select public.save_board(null, 'Court', '{}', 5, false, array['a','b']) as id");
ok(Boolean(shortId), "save_board accepte un brouillon incomplet");
await expectError(q("select * from public.create_game($1)", [shortId]), /not_enough_phrases/, "pas de partie sur un brouillon incomplet");
await q("delete from public.boards where id = $1", [shortId]);
// édition : les ids des phrases conservées ne changent pas
const before = await q("select id, text from public.board_phrases where board_id = $1 and text = 'Trois'", [boardId]);
await q("select public.save_board($1, 'Test 2', '{\"emoji\":\"🎉\",\"color\":\"blue\"}', 3, true, $2)", [
  boardId, ["Trois", "Un", "Deux", "Quatre", "Cinq", "Six", "Sept", "Huit", "Onze"],
]);
const after = await q("select id, position from public.board_phrases where board_id = $1 and text = 'Trois'", [boardId]);
ok(after[0].id === before[0].id && after[0].position === 0, "save_board garde l'id des phrases conservées et réordonne");
ok((await q("select count(*)::int as n from public.board_phrases where board_id = $1", [boardId]))[0].n === 9, "save_board supprime les phrases retirées");

await as(B);
ok((await q("select * from public.boards where id = $1", [boardId])).length === 0, "B ne voit pas le bingo de A");
await q("update public.boards set title = 'pirate' where id = $1", [boardId]);
await as(A);
ok((await q("select title from public.boards where id = $1", [boardId]))[0].title === "Test 2", "B ne peut pas modifier le bingo de A");
await expectError(
  q("insert into public.boards (owner_id, title, is_template) values ($1, 'x', true)", [A]),
  /row-level security/,
  "impossible de créer un modèle",
);

// --- partie libre ---------------------------------------------------------------
console.log("\nPartie en mode libre");
await as(A);
const [game] = await q("select * from public.create_game($1, 'free')", [boardId]);
ok(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(game.code), `create_game → code ${game.code}`);

// verrou : modifiable tant qu'aucun joueur n'a rejoint
const editPhrases = ["Trois", "Un", "Deux", "Quatre", "Cinq", "Six", "Sept", "Huit", "Onze", "Douze"];
const saveEdit = () =>
  q("select public.save_board($1, 'Test 2', '{\"emoji\":\"🎉\",\"color\":\"blue\"}', 3, true, $2)", [boardId, editPhrases]);
ok((await q("select public.board_locked($1) as l", [boardId]))[0].l === false, "partie créée sans joueur : bingo non verrouillé");
await saveEdit();
ok((await q("select count(*)::int as n from public.board_phrases where board_id = $1", [boardId]))[0].n === 10, "l'hôte ajoute des phrases avant l'arrivée des joueurs");

await as(B);
const [pb] = await q("select * from public.join_game($1, 'Bob')", [game.code.toLowerCase()]);
await as(A);
ok((await q("select public.board_locked($1) as l", [boardId]))[0].l === true, "un joueur a rejoint : bingo verrouillé");
await expectError(saveEdit(), /board_locked/, "save_board refuse de modifier un bingo verrouillé");
await as(B);
ok(pb.grid.length === 9 && pb.grid[4].free === true && pb.checked[4] === true, "join_game : grille 3×3, centre libre coché");
ok(new Set(pb.grid.filter((c) => !c.free).map((c) => c.id)).size === 8, "8 phrases distinctes");
const [pb2] = await q("select * from public.join_game($1, 'Bobby')", [game.code]);
ok(pb2.id === pb.id && JSON.stringify(pb2.grid) === JSON.stringify(pb.grid) && pb2.nickname === "Bobby", "rejoindre à nouveau garde la grille");
ok((await q("select * from public.boards where id = $1", [boardId])).length === 1, "un joueur peut lire le bingo de la partie");

const row0 = [true, true, true, false, true, false, false, false, false];
const [upd] = await q("update public.game_players set checked = $1 where id = $2 returning has_bingo, bingo_at", [JSON.stringify(row0), pb.id]);
ok(upd.has_bingo === true && upd.bingo_at !== null, "ligne complète → has_bingo calculé par la base");
const [upd2] = await q("update public.game_players set checked = $1 where id = $2 returning has_bingo, bingo_at", [
  JSON.stringify([true, true, false, false, true, false, false, false, false]), pb.id,
]);
ok(upd2.has_bingo === false && upd2.bingo_at === null, "décocher → has_bingo repasse à false");
await expectError(
  q("update public.game_players set checked = $1 where id = $2", [JSON.stringify(Array(9).fill(false)), pb.id]),
  /invalid_checked/,
  "la case libre ne peut pas être décochée",
);
await expectError(
  q("update public.game_players set checked = '[true]' where id = $1", [pb.id]),
  /invalid_checked/,
  "longueur de checked vérifiée",
);
await expectError(
  q("update public.game_players set grid = '[]' where id = $1", [pb.id]),
  /permission denied/,
  "la grille n'est pas modifiable par le joueur",
);
await expectError(
  q("insert into public.game_players (game_id, user_id, nickname, seed, grid, checked) values ($1, $2, 'x', 1, '[]', '[]')", [game.id, B]),
  /permission denied/,
  "insertion directe interdite (passer par join_game)",
);

await as(C);
const [pc] = await q("select * from public.join_game($1, 'Chloé')", [game.code]);
ok(JSON.stringify(pc.grid) !== JSON.stringify(pb.grid) || pc.seed !== pb.seed, "C reçoit sa propre grille");
const r = await q("update public.game_players set checked = $1 where id = $2 returning id", [JSON.stringify(row0), pb.id]);
ok(r.length === 0, "C ne peut pas modifier la ligne de B");
ok((await q("select * from public.game_players where game_id = $1", [game.id])).length === 2, "C voit les deux joueurs");
await expectError(
  q("insert into public.game_events (game_id, phrase_id) values ($1, $2)", [game.id, pb.grid[0].id]),
  /row-level security/,
  "un joueur ne peut pas valider de phrase",
);
await q("update public.games set status = 'finished' where id = $1", [game.id]);
await as(A);
ok((await q("select status from public.games where id = $1", [game.id]))[0].status === "playing", "un joueur ne peut pas terminer la partie");

await as(A);
const [ended] = await q("update public.games set status = 'finished' where id = $1 returning ended_at", [game.id]);
ok(ended.ended_at !== null, "l'hôte termine la partie (ended_at)");
ok((await q("select public.board_locked($1) as l", [boardId]))[0].l === false, "partie terminée : bingo de nouveau modifiable");
await as(B);
await expectError(
  q("update public.game_players set checked = $1 where id = $2", [JSON.stringify(row0), pb.id]),
  /game_finished/,
  "plus de coches après la fin",
);
await as(D);
await expectError(q("select * from public.join_game($1, 'Zoé')", [game.code]), /game_finished/, "impossible de rejoindre une partie terminée");

// --- partie validée -------------------------------------------------------------
console.log("\nPartie en mode validé");
await as(A);
const [vgame] = await q("select * from public.create_game($1, 'validated')", [boardId]);
await as(B);
const [vb] = await q("select * from public.join_game($1, 'Bob')", [vgame.code]);
await expectError(
  q("update public.game_players set checked = $1 where id = $2", [JSON.stringify(row0), vb.id]),
  /validated_mode/,
  "en mode validé le joueur ne coche pas lui-même",
);
await as(A);
const target = vb.grid[0].id;
await q("insert into public.game_events (game_id, phrase_id) values ($1, $2)", [vgame.id, target]);
await as(B);
let [vb2] = await q("select checked from public.game_players where id = $1", [vb.id]);
ok(vb2.checked[0] === true, "validation de l'hôte → cochée chez le joueur");
await as(A);
for (const i of [1, 2]) {
  await q("insert into public.game_events (game_id, phrase_id) values ($1, $2)", [vgame.id, vb.grid[i].id]);
}
await as(B);
[vb2] = await q("select checked, has_bingo from public.game_players where id = $1", [vb.id]);
ok(vb2.has_bingo === true, "3 validations sur une ligne → BINGO");
await as(C);
const [vc] = await q("select * from public.join_game($1, 'Chloé')", [vgame.code]);
const expected = vc.grid.map((c) => c.free === true || [vb.grid[0].id, vb.grid[1].id, vb.grid[2].id].includes(c.id));
ok(JSON.stringify(vc.checked) === JSON.stringify(expected), "un retardataire reçoit les phrases déjà validées");
await as(A);
await q("delete from public.game_events where game_id = $1 and phrase_id = $2", [vgame.id, target]);
await as(B);
[vb2] = await q("select checked, has_bingo from public.game_players where id = $1", [vb.id]);
ok(vb2.checked[0] === false && vb2.has_bingo === false, "annuler une validation décoche et retire le bingo");
await as(A);
const outsider = (await q("select id from public.board_phrases where board_id = '00000000-0000-4000-8000-000000000001' limit 1"))[0].id;
await expectError(
  q("insert into public.game_events (game_id, phrase_id) values ($1, $2)", [vgame.id, outsider]),
  /row-level security/,
  "l'hôte ne peut valider qu'une phrase de ce bingo",
);

// un bingo ne se joue qu'une fois à la fois : relancer renvoie la partie en cours
const [again] = await q("select * from public.create_game($1, 'free')", [boardId]);
ok(again.id === vgame.id && again.mode === "validated", "relancer un bingo en cours renvoie la même partie");
await q("update public.games set status = 'finished' where id = $1", [vgame.id]);
const [afterEnd] = await q("select * from public.create_game($1, 'free')", [boardId]);
ok(afterEnd.id !== vgame.id, "une fois la partie terminée, on peut en relancer une");
await q("update public.games set status = 'finished' where id = $1", [afterEnd.id]);

// --- partie validée par le groupe (peer) ------------------------------------------
console.log("\nPartie validée par le groupe");
await as(A);
const [peer] = await q("select * from public.create_game($1, 'peer')", [boardId]);
await as(B);
const [peerB] = await q("select * from public.join_game($1, 'Bob')", [peer.code]);
await as(C);
const [peerC] = await q("select * from public.join_game($1, 'Chloé')", [peer.code]);
const shared = peerB.grid.find((c) => !c.free && peerC.grid.some((d) => d.id === c.id));
const onlyB = peerB.grid.filter((c) => !c.free && c.id !== shared.id);
const notInB = (await q("select id from public.board_phrases where board_id = $1", [boardId])).find(
  (p) => !peerB.grid.some((c) => c.id === p.id),
);

await as(B);
const [claim1] = await q("select * from public.claim_phrase($1, $2)", [peer.id, shared.id]);
ok(claim1.status === "pending", "un joueur propose une phrase de sa grille");
await expectError(q("select * from public.claim_phrase($1, $2)", [peer.id, shared.id]), /claim_exists/, "une seule proposition en attente par phrase");
await expectError(q("select * from public.claim_phrase($1, $2)", [peer.id, notInB.id]), /not_in_grid/, "on ne propose que les phrases de sa grille");
await expectError(
  q("update public.game_players set checked = $1 where id = $2", [JSON.stringify(peerB.checked.map(() => true)), peerB.id]),
  /validated_mode/,
  "en mode groupe, pas de coche directe",
);
await expectError(q("select * from public.resolve_claim($1, true)", [claim1.id]), /own_claim/, "on ne confirme pas sa propre proposition");

await as(D);
await expectError(q("select * from public.resolve_claim($1, true)", [claim1.id]), /not_member|claim_not_found/, "un non-membre ne peut pas confirmer");
ok((await q("select * from public.game_claims where game_id = $1", [peer.id])).length === 0, "un non-membre ne voit pas les propositions");

await as(C);
ok((await q("select * from public.game_claims where game_id = $1", [peer.id])).length === 1, "les joueurs voient les propositions");
const [confirmed] = await q("select * from public.resolve_claim($1, true)", [claim1.id]);
ok(confirmed.status === "confirmed" && confirmed.resolved_by === C, "un autre joueur confirme");
const idxB = peerB.grid.findIndex((c) => c.id === shared.id);
const idxC = peerC.grid.findIndex((c) => c.id === shared.id);
const [bAfter] = await q("select checked from public.game_players where id = $1", [peerB.id]);
const [cAfter] = await q("select checked from public.game_players where id = $1", [peerC.id]);
ok(bAfter.checked[idxB] === true && cAfter.checked[idxC] === true, "confirmée → cochée chez tous ceux qui l'ont");

await as(B);
await expectError(q("select * from public.claim_phrase($1, $2)", [peer.id, shared.id]), /already_validated/, "une phrase déjà validée ne se repropose pas");
const [claim2] = await q("select * from public.claim_phrase($1, $2)", [peer.id, onlyB[0].id]);
await as(C);
const [rejected] = await q("select * from public.resolve_claim($1, false)", [claim2.id]);
const idx2 = peerB.grid.findIndex((c) => c.id === onlyB[0].id);
await as(B);
const [bAfter2] = await q("select checked from public.game_players where id = $1", [peerB.id]);
ok(rejected.status === "rejected" && bAfter2.checked[idx2] === false, "contestée → rien n'est coché");
const [claim3] = await q("select * from public.claim_phrase($1, $2)", [peer.id, onlyB[0].id]);
ok(claim3.status === "pending", "une phrase contestée peut être reproposée");
const [cancelled] = await q("select * from public.resolve_claim($1, false)", [claim3.id]);
ok(cancelled.status === "rejected", "l'auteur peut annuler sa proposition");

// preuve photo (optionnelle) : bucket privé, dossier <partie>/<joueur>/
const photoPath = `${peer.id}/${B}/preuve.jpg`;
await q("insert into storage.objects (bucket_id, name) values ('proofs', $1)", [photoPath]);
ok(true, "un joueur dépose une photo dans son dossier");
await expectError(
  q("insert into storage.objects (bucket_id, name) values ('proofs', $1)", [`${peer.id}/${C}/triche.jpg`]),
  /row-level security/,
  "impossible de déposer dans le dossier d'un autre",
);
const [withPhoto] = await q("select * from public.claim_phrase($1, $2, $3)", [peer.id, onlyB[1].id, photoPath]);
ok(withPhoto.photo_path === photoPath, "proposition avec photo");
await expectError(
  q("select * from public.claim_phrase($1, $2, $3)", [peer.id, onlyB[2].id, `${peer.id}/${C}/x.jpg`]),
  /invalid_photo/,
  "la photo doit venir du dossier de l'auteur",
);
await as(C);
ok((await q("select name from storage.objects where bucket_id = 'proofs'")).length === 1, "les joueurs de la partie voient la photo");
await as(D);
ok((await q("select name from storage.objects where bucket_id = 'proofs'")).length === 0, "un non-membre ne voit pas la photo");
await as(B);
await q("select * from public.resolve_claim($1, false)", [withPhoto.id]);

await as(A);
await q("update public.games set status = 'finished' where id = $1", [peer.id]);
const [freeGame] = await q("select * from public.create_game($1, 'free')", [boardId]);
await as(B);
const [freeB] = await q("select * from public.join_game($1, 'Bob')", [freeGame.code]);
await expectError(
  q("select * from public.claim_phrase($1, $2)", [freeGame.id, freeB.grid.find((c) => !c.free).id]),
  /wrong_mode/,
  "les propositions n'existent qu'en mode groupe",
);

// --- anonyme / modèles -----------------------------------------------------------
console.log("\nAccès public et modèles");
await as("anon");
ok((await q("select * from public.boards where is_template and locale = 'fr'")).length === 5, "anon lit les 5 modèles français");
ok((await q("select * from public.boards where is_template and locale = 'en'")).length === 5, "… et les 5 modèles anglais");
const [pub] = await q("select * from public.get_game_public($1)", [vgame.code]);
ok(pub.player_count === 2 && pub.title === "Test 2", "get_game_public accessible sans session");
await expectError(q("select * from public.games"), /permission denied/, "anon ne lit pas les parties");
await expectError(q("select public.create_game($1)", [boardId]), /permission denied/, "anon ne crée pas de partie");

await as(C);
const [{ id: dup }] = await q("select public.duplicate_board('00000000-0000-4000-8000-000000000002') as id");
const [dupBoard] = await q("select owner_id, is_template, title from public.boards where id = $1", [dup]);
ok(dupBoard.owner_id === C && dupBoard.is_template === false, `duplicate_board d'un modèle → « ${dupBoard.title} » appartient à C`);
const [tg] = await q("select * from public.create_game('00000000-0000-4000-8000-000000000005', 'free')");
ok(Boolean(tg.code), "partie créée depuis un modèle");
await expectError(q("select public.create_game($1)", [boardId]), /board_not_found/, "pas de partie sur le bingo d'un autre");

await as(A);
await q("delete from public.boards where id = $1", [boardId]);
await as(A);
ok((await q("select * from public.games where board_id = $1", [boardId])).length === 0, "supprimer un bingo supprime ses parties");

// --- fin automatique, expiration, réactions, push ----------------------------------
console.log("\nFin automatique, réactions, push");
const NOEL = "00000000-0000-4000-8000-000000000003";
const EURO = "00000000-0000-4000-8000-000000000004";
await as(B);
const [auto] = await q("select * from public.create_game($1, 'free', 'first_bingo')", [NOEL]);
ok(auto.auto_end === "first_bingo", "partie avec fin au premier bingo");
const [autoB] = await q("select * from public.join_game($1, 'Bob')", [auto.code]);
await as(D);
const [autoD] = await q("select * from public.join_game($1, 'Dan')", [auto.code]);
await as(B);
const firstRow = autoB.checked.map((v, i) => v || i < 5);
await q("update public.game_players set checked = $1 where id = $2", [JSON.stringify(firstRow), autoB.id]);
ok((await q("select status from public.games where id = $1", [auto.id]))[0].status === "finished", "premier bingo → partie terminée automatiquement");

const [timed] = await q("select * from public.create_game($1, 'free', 'manual', 3)", [EURO]);
ok(timed.ends_at !== null, "partie avec durée → date de fin");
await expectError(q("select * from public.create_game($1, 'free', 'manual', 90)", [NOEL]), /invalid_duration/, "durée bornée à 30 jours");
await db.exec("reset role");
await q("update public.games set ends_at = now() - interval '1 minute' where id = $1", [timed.id]);
await as(B);
const [timedB] = await q("select * from public.join_game($1, 'Bob')", [timed.code]);
await expectError(
  q("update public.game_players set checked = $1 where id = $2", [JSON.stringify(timedB.checked.map(() => true)), timedB.id]),
  /game_finished/,
  "plus de coches après l'échéance",
);
ok((await q("select public.check_game_expiry($1) as s", [timed.id]))[0].s === "finished", "check_game_expiry termine une partie échue");
await expectError(q("select public.finish_expired_games()"), /permission denied/, "finish_expired_games réservée au serveur");

// réactions
await as(D);
await q("insert into public.game_reactions (game_id, target_type, target_id, emoji) values ($1, 'bingo', $2, '🔥')", [auto.id, autoB.id]);
ok((await q("select * from public.game_reactions where game_id = $1", [auto.id])).length === 1, "un joueur réagit au bingo d'un autre");
await expectError(
  q("insert into public.game_reactions (game_id, target_type, target_id, emoji) values ($1, 'bingo', $2, '🔥')", [auto.id, autoB.id]),
  /duplicate key/,
  "une seule fois le même emoji",
);
await expectError(
  q("insert into public.game_reactions (game_id, target_type, target_id, emoji) values ($1, 'bingo', $2, '💩')", [auto.id, autoB.id]),
  /check constraint/,
  "emojis limités à la liste",
);
await expectError(
  q("insert into public.game_reactions (game_id, target_type, target_id, emoji) values ($1, 'bingo', $2, '😂')", [auto.id, peerB.id]),
  /row-level security/,
  "la cible doit appartenir à la partie",
);
await as(A);
await expectError(
  q("insert into public.game_reactions (game_id, target_type, target_id, emoji) values ($1, 'bingo', $2, '😂')", [auto.id, autoB.id]),
  /row-level security/,
  "un non-membre ne réagit pas",
);
ok((await q("select * from public.game_reactions where game_id = $1", [auto.id])).length === 0, "un non-membre ne voit pas les réactions");
await as(D);
await q("delete from public.game_reactions where game_id = $1", [auto.id]);
ok((await q("select * from public.game_reactions where game_id = $1", [auto.id])).length === 0, "on retire sa réaction");

// abonnements push
await as(B);
await q("select public.save_push_subscription('https://push.example/abc', 'k', 'a', 'en')");
ok((await q("select * from public.push_subscriptions")).length === 1, "un appareil s'abonne");
await as(D);
ok((await q("select * from public.push_subscriptions")).length === 0, "on ne voit pas les abonnements des autres");
await q("select public.save_push_subscription('https://push.example/abc', 'k', 'a', 'fr')");
await db.exec("reset role");
const owners = await q("select user_id from public.push_subscriptions where endpoint = 'https://push.example/abc'");
ok(owners.length === 1 && owners[0].user_id === D, "le même appareil passe au nouveau compte");
await as(D);
await q("insert into public.game_reactions (game_id, target_type, target_id, emoji) values ($1, 'bingo', $2, '👏')", [auto.id, autoB.id]);
const [{ data: exportedD }] = await q("select public.export_my_data() as data");
ok(
  exportedD.reactions.length === 1 && exportedD.push_devices.length === 1 && exportedD.account.id === D,
  "export_my_data inclut réactions et appareils",
);
ok(!JSON.stringify(exportedD.push_devices).includes('"auth"'), "export sans les clés de chiffrement push");
await expectError(q("select public.bb_export_my_data_v12()"), /permission denied/, "ancienne version de l'export non appelable");
void autoD;

// --- Préparation collaborative ---------------------------------------------------
console.log("\nPréparation collaborative");
await as(B);
const [{ id: draftId }] = await q(
  "select public.save_board(null, 'Brouillon', '{\"emoji\":\"📝\",\"color\":\"teal\"}', 3, true, array['Un', 'Deux', 'Trois']) as id",
);
ok(Boolean(draftId), "un bingo incomplet s'enregistre en brouillon");
await expectError(q("select * from public.create_game($1)", [draftId]), /not_enough_phrases/, "pas de partie immédiate sur un brouillon");
await expectError(
  q("select * from public.create_game($1, 'free', 'manual', null, true)", [NOEL]),
  /lobby_template/,
  "pas de préparation sur un modèle partagé",
);
const [lobby] = await q("select * from public.create_game($1, 'free', 'manual', 2, true)", [draftId]);
ok(lobby.status === "lobby" && lobby.ends_at === null && lobby.duration_days === 2, "partie en préparation, durée gardée pour le lancement");
const [lobbyAgain] = await q("select * from public.create_game($1, 'free', 'manual', null, true)", [draftId]);
ok(lobbyAgain.id === lobby.id, "une seule préparation à la fois par bingo");
await expectError(
  q("update public.games set status = 'playing' where id = $1", [lobby.id]),
  /use_start_game/,
  "on ne lance pas sans distribuer les grilles",
);

await as(D);
const [lobbyD] = await q("select * from public.join_game($1, 'Dan')", [lobby.code]);
ok(lobbyD.grid.length === 0, "on rejoint la préparation sans grille");
for (const text of ["Quatre", "Cinq", "Six", "Sept"]) {
  await q("select * from public.add_lobby_phrase($1, $2)", [lobby.id, text]);
}
ok((await q("select * from public.board_phrases where board_id = $1", [draftId])).length === 7, "un invité ajoute des phrases et les voit toutes");
await expectError(q("select * from public.add_lobby_phrase($1, '  cinq ')", [lobby.id]), /phrase_exists/, "pas de doublon (casse et espaces ignorés)");
const [hostPhrase] = await q("select id from public.board_phrases where board_id = $1 and text = 'Un'", [draftId]);
await expectError(q("select public.remove_lobby_phrase($1, $2)", [lobby.id, hostPhrase.id]), /phrase_not_found/, "un invité ne retire pas les phrases des autres");
const [own] = await q("select id from public.board_phrases where board_id = $1 and text = 'Sept'", [draftId]);
await q("select public.remove_lobby_phrase($1, $2)", [lobby.id, own.id]);
ok((await q("select * from public.board_phrases where board_id = $1", [draftId])).length === 6, "un invité retire sa phrase");
await expectError(q("select * from public.start_game($1)", [lobby.id]), /game_not_found/, "seul l'hôte lance la partie");
await as(A);
await expectError(q("select * from public.add_lobby_phrase($1, 'Intrus')", [lobby.id]), /not_member/, "un non-membre n'ajoute rien");

await as(B);
await expectError(q("select * from public.start_game($1)", [lobby.id]), /not_enough_phrases/, "lancement impossible sans assez de phrases");
ok((await q("select status from public.games where id = $1", [lobby.id]))[0].status === "lobby", "la préparation continue après un lancement refusé");
await q("select * from public.add_lobby_phrase($1, 'Huit')", [lobby.id]);
await q("select * from public.add_lobby_phrase($1, 'Neuf')", [lobby.id]);
const [started] = await q("select * from public.start_game($1)", [lobby.id]);
ok(started.status === "playing" && started.ends_at !== null, "l'hôte lance : partie en jeu, échéance calculée");
await as(D);
const [dealt] = await q("select * from public.game_players where id = $1", [lobbyD.id]);
ok(dealt.grid.length === 9 && dealt.checked[4] === true, "chaque membre reçoit sa grille au lancement");
await expectError(q("select * from public.add_lobby_phrase($1, 'Trop tard')", [lobby.id]), /not_lobby/, "plus d'ajout une fois la partie lancée");
await as(B);
ok((await q("select public.board_locked($1) as l", [draftId]))[0].l === true, "le bingo est verrouillé une fois lancé");
const [{ data: exportedLobbyD }] = await (async () => { await as(D); return q("select public.export_my_data() as data"); })();
ok(exportedLobbyD.contributed_phrases.length === 3, "export : phrases proposées dans le bingo d'un autre");

await as(B);
const [{ id: draftSettingsId }] = await q("select public.save_board(null, 'Réglages', '{}', 3, false, array['a','b','c','d','e','f','g','h','i']) as id");
// réglages modifiés par l'hôte
await as(B);
const [lobby2] = await q("select * from public.create_game($1, 'free', 'manual', null, true)", [draftSettingsId]);
const [set1] = await q("select * from public.update_game_settings($1, 'peer', 'full_card', 7)", [lobby2.id]);
ok(set1.mode === "peer" && set1.auto_end === "full_card" && set1.duration_days === 7 && set1.ends_at === null, "en préparation : mode, fin et durée modifiables");
await as(D);
await expectError(q("select * from public.update_game_settings($1, 'free', 'manual')", [lobby2.id]), /game_not_found/, "seul l'hôte change les réglages");
await as(B);
await q("delete from public.games where id = $1", [lobby2.id]);
const [running] = await q("select * from public.create_game($1, 'free', 'manual', 1)", [draftSettingsId]);
await expectError(q("select * from public.update_game_settings($1, 'validated', 'manual')", [running.id]), /mode_locked/, "en jeu, le mode ne change plus");
const [kept] = await q("select * from public.update_game_settings($1, 'free', 'manual', null, true)", [running.id]);
ok(kept.ends_at === running.ends_at || String(kept.ends_at) === String(running.ends_at), "en jeu : on peut garder l'échéance");
const [extended] = await q("select * from public.update_game_settings($1, 'free', 'manual', 7)", [running.id]);
ok(new Date(extended.ends_at) > new Date(running.ends_at), "en jeu : on prolonge la partie");
const [noLimit] = await q("select * from public.update_game_settings($1, 'free', 'manual', null)", [running.id]);
ok(noLimit.ends_at === null, "en jeu : on retire la limite de temps");
const [runningB] = await q("select * from public.join_game($1, 'Bob')", [running.code]);
await q("update public.game_players set checked = $1 where id = $2", [JSON.stringify(runningB.checked.map((v, i) => v || i < 3)), runningB.id]);
const [endedBySettings] = await q("select * from public.update_game_settings($1, 'free', 'first_bingo')", [running.id]);
ok(endedBySettings.status === "finished", "passer à « fin au 1er bingo » termine si un bingo existe déjà");

// remise à zéro par l'hôte (la partie « running » vient d'être terminée par un bingo)
await as(D);
await expectError(q("select * from public.reset_game($1)", [running.id]), /game_not_found/, "seul l'hôte remet à zéro");
await as(B);
const [reset] = await q("select * from public.reset_game($1)", [running.id]);
const [afterReset] = await q("select * from public.game_players where id = $1", [runningB.id]);
ok(
  reset.status === "playing" && !afterReset.has_bingo && afterReset.checked.every((v) => v === false)
    && JSON.stringify(afterReset.grid) === JSON.stringify(runningB.grid),
  "remise à zéro : partie relancée, coches effacées, même grille",
);
const [resetNew] = await q("select * from public.reset_game($1, true)", [running.id]);
const [afterNew] = await q("select * from public.game_players where id = $1", [runningB.id]);
ok(resetNew.status === "playing" && afterNew.grid.length === 9 && afterNew.seed !== undefined, "remise à zéro avec nouvelles grilles");

// retour en préparation
await as(D);
await expectError(q("select * from public.reopen_lobby($1)", [running.id]), /game_not_found/, "seul l'hôte remet en préparation");
await as(B);
const [reopened] = await q("select * from public.reopen_lobby($1)", [running.id]);
const [afterReopen] = await q("select * from public.game_players where id = $1", [runningB.id]);
ok(reopened.status === "lobby" && reopened.ends_at === null && afterReopen.grid.length === 0, "retour en préparation : grilles retirées, membres gardés");
ok((await q("select public.board_locked($1) as l", [draftSettingsId]))[0].l === false, "le bingo redevient modifiable");
await q("select * from public.add_lobby_phrase($1, 'Nouvelle idée')", [running.id]);
const [relaunched] = await q("select * from public.start_game($1)", [running.id]);
const [afterRelaunch] = await q("select * from public.game_players where id = $1", [runningB.id]);
ok(relaunched.status === "playing" && afterRelaunch.grid.length === 9, "relancée avec de nouvelles grilles");
await expectError(q("select * from public.reopen_lobby($1)", [auto.id]), /lobby_template/, "pas de préparation sur un modèle partagé");

// --- RGPD : export et suppression du compte ----------------------------------------
console.log("\nRGPD");
await as(B);
const [bJoin] = await q("select * from public.join_game($1, 'Bob')", [tg.code]);
await as(C);
await q("select * from public.join_game($1, 'Chloé')", [tg.code]);
const [{ data: exported }] = await q("select public.export_my_data() as data");
ok(exported.account.id === C, "export_my_data : identité du compte");
ok(exported.boards.length === 1 && exported.boards[0].phrases.length > 0, "export_my_data : bingos avec leurs phrases");
ok(exported.hosted_games.length === 1 && exported.hosted_games[0].code === tg.code, "export_my_data : parties animées");
ok(
  exported.participations.length === 1 && exported.participations[0].nickname === "Chloé" && exported.participations[0].grid.length === 16,
  "export_my_data : participations avec la grille",
);
await as(B);
const [{ data: exportedB }] = await q("select public.export_my_data() as data");
ok(!JSON.stringify(exportedB).includes(dup), "export_my_data ne contient pas les données des autres");
await as("anon");
await expectError(q("select public.export_my_data()"), /permission denied/, "anon ne peut pas exporter");
await expectError(q("select public.delete_my_account()"), /permission denied/, "anon ne peut pas supprimer de compte");

await as(C);
await q("select public.delete_my_account()");
await db.exec("reset role");
const left = await q(
  `select (select count(*)::int from auth.users where id = $1) as users,
          (select count(*)::int from public.boards where owner_id = $1) as boards,
          (select count(*)::int from public.games where host_id = $1) as games,
          (select count(*)::int from public.game_players where user_id = $1) as players,
          (select count(*)::int from public.game_players where id = $2) as guest_in_deleted_game`,
  [C, bJoin.id],
);
ok(
  Object.values(left[0]).every((n) => n === 0),
  `delete_my_account efface compte, bingos, parties animées, participations ${JSON.stringify(left[0])}`,
);
ok((await q("select count(*)::int as n from auth.users where id = $1", [B]))[0].n === 1, "les autres comptes sont intacts");

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
