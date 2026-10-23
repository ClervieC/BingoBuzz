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
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create schema extensions;
  grant usage on schema extensions to anon, authenticated;
  create publication supabase_realtime;
`);

// --- migrations -------------------------------------------------------------
const dir = join(ROOT, "supabase/migrations");
for (const file of readdirSync(dir).sort()) {
  await db.exec(readFileSync(join(dir, file), "utf8"));
  console.log("migration OK :", file);
}

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
await expectError(
  q("select public.save_board(null, 'Court', '{}', 5, false, array['a','b'])"),
  /not_enough_phrases/,
  "save_board refuse trop peu de phrases",
);
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

await as(B);
const [pb] = await q("select * from public.join_game($1, 'Bob')", [game.code.toLowerCase()]);
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

// --- anonyme / modèles -----------------------------------------------------------
console.log("\nAccès public et modèles");
await as("anon");
ok((await q("select * from public.boards where is_template")).length === 5, "anon lit les 5 modèles");
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

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
