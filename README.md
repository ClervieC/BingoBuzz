# BingoBuzz

Le bingo des phrases qu'on entend partout. Les cases contiennent des phrases ou des événements (« quelqu'un dit "on en reparle" », « il pleut pendant le mariage ») au lieu de numéros. On joue depuis son téléphone via un lien partagé, sans rien installer.

**Stack :** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Supabase (Auth, Postgres, Realtime), déployé sur Vercel.

## Fonctionnalités

- **Création** : titre, emoji et couleur, grille 3×3 / 4×4 / 5×5, case centrale libre (grilles impaires), phrases ajoutées une par une ou collées en liste. On peut mettre plus de phrases que de cases : chaque joueur reçoit un tirage différent.
- **Solo** : on coche au tap (animation + vibration), un appui long affiche la phrase entière. Lignes, colonnes, diagonales et carton plein sont détectés automatiquement, avec des confettis. La progression est gardée dans `localStorage`.
- **Connexion obligatoire** : Google, ou compte e-mail + mot de passe (avec confirmation de l’adresse et « mot de passe oublié »). Sans compte, l'accueil (`/`) est l'écran de connexion. Le proxy (`proxy.ts`) y renvoie toute autre page, sauf `/play/CODE` qui reste publique pour l'aperçu des liens partagés et propose de se connecter. Après la connexion, on revient sur la page demandée. Une fois connecté, `/login` sert de page « Compte » (déconnexion).
- **Groupe en temps réel** : code à 6 caractères, lien `/play/CODE`, QR code et partage natif. On rejoint avec un pseudo. Un bingo ne se joue qu’une fois à la fois par animateur : l’ouvrir pendant une partie ramène sur la grille. Trois modes :
  - **libre** : chacun coche ce qu'il constate ;
  - **validé** : l'hôte confirme une phrase et elle se coche chez tous ceux qui l'ont.
  - **par le groupe** : un joueur propose une case (photo de preuve facultative), un autre la confirme ; elle se coche alors chez tous ceux qui l’ont.

  Classement en direct, « Plus qu'une case ! », alerte BINGO avec la grille du gagnant à vérifier, et resynchronisation au retour sur l'onglet.
- **Bibliothèque** : mes bingos (modifier, dupliquer, supprimer) et 5 modèles fournis.
- **Modification d’un bingo** : possible tant qu’aucune partie en cours n’a de joueur (`board_locked()`, vérifié aussi par `save_board`). L’hôte peut ajouter des phrases depuis l’onglet « Animer » avant que quelqu’un rejoigne ; le bingo se déverrouille à la fin de la partie.
- **Partage** : export de la grille en PNG pour les stories, et image Open Graph générée pour chaque partie.
- **Mobile / PWA** : conçu pour 375 px, safe areas iPhone, `dvh`, manifest, icônes Android (dont « maskable ») et icône d’écran d’accueil iOS (`app/apple-icon.png`, 180×180 opaque).
- **Logo** : source dans `assets/brand/logo-source.png`. `npm run brand` régénère toutes les déclinaisons (favicon, icône iOS, icônes PWA, texte clair et sombre dans `public/brand/`). Le composant `<Logo>` affiche la bonne version selon le thème.
- **Animations** : apparition en cascade, logo qui rebondit, cartes qui flottent ou gigotent, compteurs qui « pop » (classes dans `globals.css`, coupées si le système demande de réduire les animations).
- **Préférences** : thème clair / sombre / système et langue FR / EN, modifiables dans **Réglages** et dès l'écran de connexion (cookies `bb_theme` et `bb_locale`, lus par le serveur pour éviter tout flash au chargement).
- **Onboarding** : 3 écrans à la première connexion (`/welcome`), puis acceptation des conditions si elle n'a pas déjà eu lieu à l'inscription.

## RGPD

| Exigence | Où |
| --- | --- |
| Accès et portabilité (art. 15 et 20) | **Réglages → Télécharger mes données**. La fonction `export_my_data()` renvoie un JSON complet : compte, bingos et phrases, parties animées, participations avec grilles, validations. |
| Effacement (art. 17) | **Réglages → Supprimer mon compte** (confirmation en tapant `SUPPRIMER`). `delete_my_account()` supprime l'utilisateur, et les clés étrangères en cascade effacent toutes ses données. L'app vide aussi son `localStorage`. |
| Information | `/privacy` (politique de confidentialité) et `/terms` (conditions d'utilisation), en FR et EN, accessibles sans compte. |
| Consentement aux conditions | Case obligatoire à l'inscription (e-mail ou Google). La date et la version sont stockées dans `user_metadata` (`terms_accepted_at`, `terms_version`). Un compte Google créé depuis l'onglet « Se connecter » accepte les conditions à la fin de l'onboarding. |
| Nouvelle version des conditions | Changer `LEGAL.version` dans `lib/legal.ts` : le proxy renvoie chacun vers `/welcome` pour les accepter à nouveau. |
| Cookies | Uniquement des cookies strictement nécessaires (session, langue, thème), donc pas de bandeau de consentement. |
| Photos de preuve | Facultatives, dans le bucket **privé** `proofs` (dossier `<partie>/<joueur>/`). Visibles seulement par les joueurs de la partie (liens signés valables une heure). Compressées sur le téléphone (métadonnées EXIF et GPS supprimées). Effacées quand on annule la proposition ou qu’on supprime son compte. |

> ⚠️ **À compléter avant la mise en ligne** : les champs entre crochets de `lib/legal.ts` (éditeur, adresse, e-mail de contact, région Supabase). Les textes de `components/legal/` sont un point de départ : faites-les relire par un juriste.

## Structure

```
app/                  routes (App Router)
  play/[code]/        partie de groupe + opengraph-image
  solo/[id]/          mode solo
  boards/[id]/        détail et édition d'un bingo
  auth/callback/      retour de Google, des e-mails de confirmation et de réinitialisation
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
| `npm run brand` | régénère les icônes et logos à partir de `assets/brand/logo-source.png` |
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

La connexion est obligatoire : il faut activer Google (et éventuellement l'e-mail) et **désactiver** le mode invité.

#### a. Créer les identifiants Google

1. Ouvrir [Google Cloud Console](https://console.cloud.google.com/), puis créer un projet ou en choisir un.
2. **APIs & Services → OAuth consent screen** (ou **Google Auth Platform → Branding**) :
   - type **External** ;
   - nom de l'application (« BingoBuzz »), e-mail d'assistance ;
   - domaine autorisé : `supabase.co`, plus votre domaine si vous en avez un ;
   - scopes : `openid`, `email`, `profile` (ceux par défaut).
   - Tant que l'application est en mode **Testing**, seuls les comptes ajoutés dans **Test users** peuvent se connecter. Cliquez sur **Publish app** pour l'ouvrir à tous.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** :
   - type : **Web application** ;
   - **Authorized JavaScript origins** : `https://votre-domaine.vercel.app` et `http://localhost:3000` ;
   - **Authorized redirect URIs** : `https://<ref>.supabase.co/auth/v1/callback`. C'est l'URL de **Supabase**, pas celle de l'application. Elle est affichée dans Supabase, dans la fiche du provider Google.
4. Copier le **Client ID** et le **Client secret**.

#### b. Configurer Supabase (Authentication)

- **Sign In / Providers**
  - **Google** : l'activer et coller le Client ID et le Client secret.
  - **Email** : activé, avec **Confirm email** activé (l’inscription envoie un lien de confirmation ; l’app prévient que l’e-mail peut arriver dans les spams). Dans **Authentication → Sign In / Providers → Email**, la longueur minimale du mot de passe doit rester à 6 (valeur par défaut de Supabase, utilisée par l’app).
  - **Allow anonymous sign-ins** : **désactivé**.
- **URL Configuration**
  - **Site URL** : `https://votre-domaine.vercel.app`
  - **Redirect URLs** : ajouter
    - `https://votre-domaine.vercel.app/auth/callback`
    - `http://localhost:3000/auth/callback`
    - `https://*-votre-equipe.vercel.app/auth/callback` (déploiements de preview, optionnel)
- **Rate Limits** : pour les e-mails de confirmation et de réinitialisation, la limite d'envoi d'e-mails du SMTP intégré à Supabase est très basse (quelques e-mails par heure). Pour un vrai usage, configurez votre propre SMTP (**Authentication → Emails → SMTP Settings**) ou n'utilisez que Google.

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
- Supprimer un bingo efface ses parties et propositions, mais pas les fichiers photo correspondants dans Supabase Storage. L’API Storage doit les supprimer elle-même ; prévoir une tâche planifiée (Edge Function + cron) qui retire les fichiers de `proofs` dont la partie n’existe plus.
- Les bingos créés avec une ancienne session invité (avant la connexion obligatoire) ne sont pas rattachés au nouveau compte.
- `next start` sert le dernier build : après avoir modifié `.env.local`, relancez `npm run build`, car les variables `NEXT_PUBLIC_*` sont figées au build.
