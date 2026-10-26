import type { Locale } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";

/** Politique de confidentialité. Point de départ à faire relire par un juriste. */
export function PrivacyContent({ locale }: { locale: Locale }) {
  return locale === "en" ? <PrivacyEn /> : <PrivacyFr />;
}

function PrivacyFr() {
  return (
    <>
      <p>
        Cette politique explique quelles données BingoBuzz traite, pourquoi, combien de temps, et comment exercer
        tes droits conformément au Règlement général sur la protection des données (RGPD) et à la loi Informatique et
        Libertés.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        {LEGAL.publisher}, {LEGAL.publisherAddress}. Contact pour toute question sur tes données :{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>2. Données que nous traitons</h2>
      <ul>
        <li>
          <strong>Compte</strong> : adresse e-mail, mot de passe (stocké sous forme hachée par notre prestataire
          d’authentification, jamais lisible par nous), date de création et de dernière connexion. Si tu te connectes
          avec Google : l’e-mail, le nom et la photo de profil transmis par Google.
        </li>
        <li>
          <strong>Contenus</strong> : tes bingos (titre, phrases, emoji, couleur, taille de grille) et les parties que
          tu crées (code, mode, statut).
        </li>
        <li>
          <strong>Participation aux parties</strong> : pseudo, grille, cases cochées, date de bingo, phrases validées
          si tu animes une partie, propositions faites en mode « validé par le groupe ».
        </li>
        <li>
          <strong>Photos de preuve (facultatives)</strong> : si tu choisis d’en joindre une à une proposition. Elle est
          réduite et ré-encodée sur ton téléphone avant l’envoi, ce qui supprime ses métadonnées (dont la position GPS).
        </li>
        <li>
          <strong>Réactions</strong> (emoji sur un bingo ou une proposition), visibles par les joueurs de la partie.
        </li>
        <li>
          <strong>Notifications (facultatives)</strong> : si tu les actives, l’adresse technique d’envoi fournie par ton
          navigateur pour cet appareil, et la langue des messages.
        </li>
        <li>
          <strong>Acceptation des conditions</strong> : date et version des conditions acceptées, fin de l’accueil
          (onboarding).
        </li>
        <li>
          <strong>Données techniques</strong> : adresse IP et journaux techniques conservés par nos hébergeurs pour
          assurer la sécurité et le bon fonctionnement du service.
        </li>
      </ul>
      <p>Nous ne collectons aucune donnée sensible et ne demandons rien d’autre que ce qui est nécessaire au jeu.</p>

      <h2>3. Finalités et bases légales</h2>
      <ul>
        <li>
          Fournir le service (compte, création de bingos, parties en direct) : <strong>exécution du contrat</strong>{" "}
          (art. 6.1.b RGPD), c’est-à-dire les conditions d’utilisation que tu acceptes.
        </li>
        <li>
          Sécuriser le service et prévenir les abus : <strong>intérêt légitime</strong> (art. 6.1.f).
        </li>
        <li>
          Conserver la preuve de ton acceptation des conditions : <strong>intérêt légitime</strong>.
        </li>
      </ul>
      <p>Aucune publicité, aucune revente de données, aucun profilage.</p>

      <h2>4. Qui voit quoi</h2>
      <ul>
        <li>Les joueurs d’une même partie voient ton pseudo, ta grille et ta progression.</li>
        <li>Les photos de preuve sont visibles uniquement par les joueurs de la partie concernée (liens temporaires).</li>
        <li>Les joueurs d’une partie peuvent lire le bingo (titre et phrases) utilisé pour cette partie.</li>
        <li>
          Toute personne disposant du lien d’une partie voit son titre, son code et le nombre de joueurs (pour l’aperçu
          du lien partagé).
        </li>
        <li>Tes autres bingos ne sont visibles que par toi.</li>
      </ul>

      <h2>5. Durée de conservation</h2>
      <p>
        Tes données sont conservées tant que ton compte existe. Quand tu supprimes ton compte, elles sont effacées
        immédiatement : profil, bingos, parties que tu animes, participations, validations et photos de preuve. Une photo
        est aussi supprimée quand tu annules la proposition correspondante ; les photos qui ne sont plus rattachées à
        aucune partie sont effacées chaque jour automatiquement. Désactiver les notifications supprime l’abonnement de
        l’appareil. Les journaux techniques
        de nos hébergeurs sont conservés pour des durées limitées fixées par ces derniers.
      </p>

      <h2>6. Sous-traitants et transferts</h2>
      <ul>
        <li>
          <strong>Supabase</strong> (authentification, base de données, temps réel, stockage des photos). Données
          hébergées dans la région :{" "}
          {LEGAL.dataRegion}.
        </li>
        <li>
          <strong>Vercel</strong> (hébergement et diffusion de l’application).
        </li>
        <li>
          <strong>Google</strong>, uniquement si tu choisis « Continuer avec Google ».
        </li>
        <li>
          <strong>Service de notifications de ton navigateur</strong> (Google, Apple ou Mozilla), uniquement si tu
          actives les notifications : il achemine des messages chiffrés de bout en bout jusqu’à ton appareil.
        </li>
      </ul>
      <p>
        Certains de ces prestataires sont établis aux États-Unis. Les transferts éventuels hors de l’Union européenne
        sont encadrés par les clauses contractuelles types de la Commission européenne et/ou le Data Privacy Framework
        UE–États-Unis.
      </p>

      <h2>7. Cookies et stockage local</h2>
      <p>BingoBuzz n’utilise que des traceurs strictement nécessaires, exemptés de consentement :</p>
      <ul>
        <li>cookies de session (préfixe <code>sb-</code>) pour te garder connecté ;</li>
        <li>
          cookies de préférences <code>bb_locale</code> (langue) et <code>bb_theme</code> (apparence) ;
        </li>
        <li>
          stockage local du navigateur : progression en mode solo, dernier pseudo utilisé, bingos déjà célébrés.
        </li>
      </ul>
      <p>Aucun cookie publicitaire ni de mesure d’audience.</p>

      <h2>8. Tes droits</h2>
      <p>
        Tu disposes des droits d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité.
        Tu peux les exercer directement dans l’application :
      </p>
      <ul>
        <li>
          <strong>Réglages → Télécharger mes données</strong> : copie complète de tes données au format JSON (accès et
          portabilité) ;
        </li>
        <li>
          <strong>Réglages → Supprimer mon compte</strong> : effacement immédiat et définitif ;
        </li>
        <li>tes bingos et ton pseudo sont modifiables à tout moment.</li>
      </ul>
      <p>
        Tu peux aussi écrire à <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> ; nous répondons
        sous un mois. Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL (
        <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer">
          cnil.fr
        </a>
        ).
      </p>

      <h2>9. Sécurité</h2>
      <p>
        Connexions chiffrées (HTTPS), mots de passe hachés, règles d’accès appliquées par la base de données elle-même
        : chacun ne peut lire et modifier que ce qui le concerne.
      </p>

      <h2>10. Âge minimum</h2>
      <p>
        BingoBuzz s’adresse aux personnes de 15 ans et plus. En dessous, l’inscription nécessite l’accord d’un titulaire
        de l’autorité parentale.
      </p>

      <h2>11. Modifications</h2>
      <p>
        En cas de changement important, la date ci-dessus est mise à jour et nous te le signalons dans l’application.
      </p>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <p>
        This policy explains what data BingoBuzz processes, why, for how long, and how to exercise your rights under
        the EU General Data Protection Regulation (GDPR).
      </p>

      <h2>1. Data controller</h2>
      <p>
        {LEGAL.publisher}, {LEGAL.publisherAddress}. Contact for any question about your data:{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>2. Data we process</h2>
      <ul>
        <li>
          <strong>Account</strong>: email address, password (stored hashed by our authentication provider, never
          readable by us), creation and last sign-in dates. If you sign in with Google: the email, name and profile
          picture provided by Google.
        </li>
        <li>
          <strong>Content</strong>: your bingos (title, phrases, emoji, colour, grid size) and the games you create
          (code, mode, status).
        </li>
        <li>
          <strong>Game participation</strong>: nickname, grid, ticked cells, bingo time, validated phrases if you host
          a game, suggestions made in “group-validated” mode.
        </li>
        <li>
          <strong>Proof photos (optional)</strong>: if you choose to attach one to a suggestion. It is resized and
          re-encoded on your phone before upload, which strips its metadata (including GPS location).
        </li>
        <li>
          <strong>Reactions</strong> (emoji on a bingo or a suggestion), visible to players of the game.
        </li>
        <li>
          <strong>Notifications (optional)</strong>: if you turn them on, the technical delivery address your browser
          provides for this device, and the language of the messages.
        </li>
        <li>
          <strong>Acceptance of the terms</strong>: date and version of the accepted terms, onboarding completion.
        </li>
        <li>
          <strong>Technical data</strong>: IP address and technical logs kept by our hosting providers for security
          and reliability.
        </li>
      </ul>
      <p>We collect no sensitive data and nothing beyond what the game needs.</p>

      <h2>3. Purposes and legal bases</h2>
      <ul>
        <li>
          Providing the service (account, bingos, live games): <strong>performance of a contract</strong> (Art. 6(1)(b)
          GDPR), i.e. the terms of use you accept.
        </li>
        <li>
          Securing the service and preventing abuse: <strong>legitimate interest</strong> (Art. 6(1)(f)).
        </li>
        <li>
          Keeping proof that you accepted the terms: <strong>legitimate interest</strong>.
        </li>
      </ul>
      <p>No advertising, no data selling, no profiling.</p>

      <h2>4. Who sees what</h2>
      <ul>
        <li>Players in the same game see your nickname, grid and progress.</li>
        <li>Proof photos are visible only to players of that game (temporary links).</li>
        <li>Players in a game can read the bingo (title and phrases) used for that game.</li>
        <li>Anyone with a game link sees its title, code and player count (for the link preview).</li>
        <li>Your other bingos are visible only to you.</li>
      </ul>

      <h2>5. Retention</h2>
      <p>
        Your data is kept as long as your account exists. When you delete your account, it is erased immediately:
        profile, bingos, games you host, participations, validations and proof photos. A photo is also deleted when you
        cancel its suggestion; photos no longer attached to any game are erased automatically every day. Turning
        notifications off deletes the device subscription. Technical logs are kept by our hosting
        providers for limited periods set by them.
      </p>

      <h2>6. Processors and transfers</h2>
      <ul>
        <li>
          <strong>Supabase</strong> (authentication, database, realtime, photo storage). Data hosted in:{" "}
          {LEGAL.dataRegion}.
        </li>
        <li>
          <strong>Vercel</strong> (application hosting and delivery).
        </li>
        <li>
          <strong>Google</strong>, only if you choose “Continue with Google”.
        </li>
        <li>
          <strong>Your browser’s push service</strong> (Google, Apple or Mozilla), only if you turn notifications on:
          it delivers end-to-end encrypted messages to your device.
        </li>
      </ul>
      <p>
        Some of these providers are based in the United States. Any transfer outside the EU relies on the European
        Commission’s Standard Contractual Clauses and/or the EU–US Data Privacy Framework.
      </p>

      <h2>7. Cookies and local storage</h2>
      <p>BingoBuzz only uses strictly necessary trackers, which do not require consent:</p>
      <ul>
        <li>session cookies (prefix <code>sb-</code>) to keep you signed in;</li>
        <li>
          preference cookies <code>bb_locale</code> (language) and <code>bb_theme</code> (appearance);
        </li>
        <li>browser local storage: solo mode progress, last nickname used, bingos already celebrated.</li>
      </ul>
      <p>No advertising or analytics cookies.</p>

      <h2>8. Your rights</h2>
      <p>
        You have the rights of access, rectification, erasure, restriction, objection and portability. You can exercise
        them directly in the app:
      </p>
      <ul>
        <li>
          <strong>Settings → Download my data</strong>: full copy of your data as JSON (access and portability);
        </li>
        <li>
          <strong>Settings → Delete my account</strong>: immediate and permanent erasure;
        </li>
        <li>your bingos and nickname can be edited at any time.</li>
      </ul>
      <p>
        You can also write to <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>; we answer within one
        month. You may lodge a complaint with your supervisory authority (in France, the{" "}
        <a href="https://www.cnil.fr/en" target="_blank" rel="noreferrer">
          CNIL
        </a>
        ).
      </p>

      <h2>9. Security</h2>
      <p>
        Encrypted connections (HTTPS), hashed passwords, and access rules enforced by the database itself: everyone can
        only read and change what concerns them.
      </p>

      <h2>10. Minimum age</h2>
      <p>BingoBuzz is intended for people aged 15 and over. Below that age, a parent or guardian must consent.</p>

      <h2>11. Changes</h2>
      <p>If we make significant changes, the date above is updated and we let you know in the app.</p>
    </>
  );
}
