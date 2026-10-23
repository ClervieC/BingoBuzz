# BingoBuzz

Le bingo des phrases qu'on entend partout. Les cases contiennent des phrases ou des événements (« quelqu'un dit "on en reparle" », « il pleut pendant le mariage ») au lieu de numéros. On joue depuis son téléphone via un lien partagé, sans rien installer.

**Stack :** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Supabase (Auth, Postgres, Realtime), déployé sur Vercel.

## Fonctionnalités

- **Création** : titre, emoji et couleur, grille 3×3 / 4×4 / 5×5, case centrale libre (grilles impaires), phrases ajoutées une par une ou collées en liste. On peut mettre plus de phrases que de cases : chaque joueur reçoit un tirage différent.
- **Solo** : on coche au tap (animation + vibration), un appui long affiche la phrase entière. Lignes, colonnes, diagonales et carton plein sont détectés automatiquement, avec des confettis. La progression est gardée dans `localStorage`.
- **Groupe en temps réel** : code à 6 caractères, lien `/play/CODE`, QR code et partage natif. On rejoint avec un pseudo (session anonyme Supabase). Deux modes :
  - **libre** : chacun coche ce qu'il constate ;
  - **validé** : l'hôte confirme une phrase et elle se coche chez tous ceux qui l'ont.

  Classement en direct, « Plus qu'une case ! », alerte BINGO avec la grille du gagnant à vérifier, et resynchronisation au retour sur l'onglet.
- **Bibliothèque** : mes bingos (modifier, dupliquer, supprimer), compte par lien magique ou Google, conversion d'un compte invité en compte permanent, 5 modèles fournis.
- **Partage** : export de la grille en PNG pour les stories, et image Open Graph générée pour chaque partie.
- **Mobile / PWA** : conçu pour 375 px, safe areas iPhone, `dvh`, manifest et icônes, mode sombre, i18n FR (EN prête).

## Structure

```
app/                  routes (App Router)
  play/[code]/        partie de groupe + opengraph-image
  solo/[id]/          mode solo
  boards/[id]/        détail et édition d'un bingo
  auth/callback/      retour des liens magiques / OAuth
components/           UI (grille, bottom sheet, classement…)
hooks/                useGame (temps réel), useSoloGame, useFitText, useLongPress…
lib/                  logique pure (bingo, random, phrases, code), Supabase, i18n
types/                types métier et types de la base
supabase/migrations/  schéma, logique de jeu, RLS, RPC, Realtime, modèles
scripts/test-db.mjs   tests d'intégration SQL (PGlite)
```

### Points de conception

- **Grilles tirées côté serveur.** `join_game()` (Postgres) mélange les phrases avec une graine aléatoire stockée dans `game_players.seed`. Le client ne peut pas choisir ses cases, puisque la colonne `grid` n'est pas modifiable par le joueur.
- **Mélange identique en SQL et en TS.** Fisher-Yates avec un générateur Park–Miller (entiers uniquement), dans `lib/random.ts` et `public.bb_shuffle`. `npm run test:db` vérifie que les deux donnent la même permutation.
- **Bingo calculé par la base.** Un trigger recalcule `has_bingo` à chaque écriture et refuse les coches en mode validé ou dans une partie terminée. `lib/bingo.ts` reste la référence testée pour l'UI (surbrillance, « plus qu'une case »).
- **Mode validé.** L'hôte insère un `game_events` (RLS : hôte uniquement), et un trigger coche la phrase dans toutes les grilles qui la contiennent.
- **Temps réel.** `postgres_changes` sur `games`, `game_players` et `game_events` (filtrés par la RLS), plus `presence` pour savoir qui est en ligne. On se réabonne et on recharge l'état sur `visibilitychange`, `online` et en cas d'erreur de canal (backoff exponentiel).

## Développement local

```bash
npm install
cp .env.example .env.local   # puis renseigner les clés Supabase
npm run dev
```

| Commande | Rôle |
| --- | --- |
| `npm test` | tests Vitest (détection de bingo, mélange, phrases, codes) |
| `npm run test:db` | applique les migrations dans PGlite et teste RLS, RPC et triggers (Node ≥ 22.18) |
| `npm run typecheck` | vérification TypeScript |
| `npm run build` | build de production |

## Déploiement

### 1. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), créer un projet.
2. Dans **Project Settings → API**, noter l'**URL** du projet et la clé **anon / publishable**. N'utilisez jamais la clé `service_role` dans l'application : elle n'en a pas besoin.

### 2. Appliquer les migrations

Avec la CLI Supabase :

```bash
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase db push
```

Sans la CLI, on peut aussi exécuter les fichiers de `supabase/migrations/` un par un, dans l'ordre, dans **SQL Editor**.

Les migrations créent les tables, les fonctions, les policies RLS et la publication Realtime, puis insèrent les 5 modèles.

### 3. Configurer l'authentification

Dans **Authentication** :

- **Sign In / Providers**
  - Activer **Allow anonymous sign-ins** (obligatoire pour rejoindre une partie sans compte).
  - Activer **Allow manual linking** (pour qu'un invité puisse lier son compte Google).
  - **Email** : activé, pour les liens magiques.
  - **Google** : renseigner le Client ID et le secret créés dans Google Cloud Console. L'URI de redirection autorisée côté Google est `https://<ref>.supabase.co/auth/v1/callback`.
- **URL Configuration**
  - **Site URL** : `https://votre-domaine.vercel.app`
  - **Redirect URLs** : ajouter
    - `https://votre-domaine.vercel.app/auth/callback`
    - `http://localhost:3000/auth/callback`
    - `https://*-votre-equipe.vercel.app/auth/callback` (déploiements de preview, optionnel)
- **Rate Limits** : relever la limite des **connexions anonymes**. La valeur par défaut est d'environ 30 par heure **et par IP**, or à une soirée ou un mariage tous les invités partagent souvent le même Wi-Fi. Si les abus vous inquiètent, activez aussi le CAPTCHA (Turnstile).

### 4. Déployer sur Vercel

1. Importer le dépôt sur [vercel.com/new](https://vercel.com/new) (framework détecté : Next.js).
2. Dans **Settings → Environment Variables** (Production, Preview, Development) :

   | Variable | Valeur |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé anon / publishable |
   | `NEXT_PUBLIC_SITE_URL` | `https://votre-domaine.vercel.app` (liens de partage, Open Graph) |

3. Déployer, puis vérifier :
   - le parcours créer un bingo → lancer une partie → l'ouvrir sur un 2ᵉ téléphone ;
   - l'aperçu du lien `/play/CODE` dans WhatsApp, ou avec un outil de débogage Open Graph.

## Internationalisation

Les textes sont dans `lib/i18n/dictionaries/fr.ts`, qui sert de source. `en.ts` est typé `Dictionary` : une clé manquante est une erreur de compilation. La langue est lue dans le cookie `bb_locale` (`fr` par défaut, voir `lib/i18n/server.ts`). Pour activer l'anglais, il suffit de poser ce cookie ou de lire `Accept-Language` dans `getLocale()`.

## Limites connues

- Pas de service worker : l'application s'installe sur l'écran d'accueil mais ne fonctionne pas hors ligne. En partie, les coches faites hors ligne sont renvoyées au retour du réseau.
- Si un bingo est modifié pendant une partie, les grilles déjà distribuées ne changent pas (le texte est copié dans `game_players.grid`). Supprimer une phrase validée annule sa validation.
- Si l'e-mail saisi pour convertir un compte invité appartient déjà à un compte, on se connecte à ce compte et les bingos invités restent liés à l'appareil : ils ne sont pas fusionnés.
