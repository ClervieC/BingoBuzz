import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";

/** Conditions d'utilisation. Point de départ à faire relire par un juriste. */
export function TermsContent({ locale }: { locale: Locale }) {
  return locale === "en" ? <TermsEn /> : <TermsFr />;
}

function TermsFr() {
  return (
    <>
      <p>
        Les présentes conditions encadrent l’utilisation de BingoBuzz. En créant un compte, tu les acceptes. Si tu
        n’es pas d’accord, n’utilise pas le service.
      </p>

      <h2>1. Le service</h2>
      <p>
        BingoBuzz permet de créer des grilles de bingo composées de phrases ou d’événements, d’y jouer seul ou à
        plusieurs en temps réel, et de partager des parties par lien, code ou QR code.
      </p>

      <h2>2. Éditeur</h2>
      <p>
        Le service est édité par {LEGAL.publisher}, {LEGAL.publisherAddress}. Contact :{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>3. Compte</h2>
      <ul>
        <li>Un compte est nécessaire pour utiliser le service (e-mail et mot de passe, ou compte Google).</li>
        <li>Tu dois fournir une adresse e-mail valide et garder ton mot de passe confidentiel.</li>
        <li>Tu es responsable de l’activité réalisée depuis ton compte.</li>
        <li>Le service s’adresse aux personnes de 15 ans et plus, ou plus jeunes avec l’accord d’un parent.</li>
      </ul>

      <h2>4. Tes contenus</h2>
      <p>
        Tu restes propriétaire des bingos et des phrases que tu crées. Tu nous autorises à les stocker et à les
        afficher aux joueurs des parties qui les utilisent, uniquement pour faire fonctionner le service.
      </p>
      <p>Tu t’engages à ne pas publier de contenus :</p>
      <ul>
        <li>illicites, haineux, discriminatoires, violents ou à caractère sexuel explicite ;</li>
        <li>harcelants, diffamatoires ou visant à humilier une personne identifiable ;</li>
        <li>contenant des données personnelles de tiers sans leur accord ;</li>
        <li>portant atteinte aux droits d’autrui (droit d’auteur, marques, vie privée).</li>
      </ul>
      <p>Nous pouvons retirer un contenu contraire à ces règles et, en cas d’abus répété, suspendre le compte.</p>

      <h2>5. Parties et partage</h2>
      <p>
        Toute personne connectée disposant du lien ou du code d’une partie peut la rejoindre. Ton pseudo, ta grille et
        ta progression sont visibles des autres joueurs de la partie. Partage tes liens avec les personnes de ton choix.
      </p>

      <h2>6. Disponibilité et responsabilité</h2>
      <p>
        Nous faisons de notre mieux pour que BingoBuzz fonctionne en continu, sans pouvoir le garantir : le service est
        fourni « en l’état » et peut être interrompu pour maintenance ou en cas de panne. Dans les limites permises par
        la loi, nous ne sommes pas responsables des dommages indirects liés à son utilisation, ni des contenus publiés
        par les utilisateurs.
      </p>

      <h2>7. Propriété intellectuelle</h2>
      <p>
        L’application, son nom, son design et son code restent la propriété de l’éditeur. Les modèles de bingo fournis
        peuvent être copiés et modifiés librement dans l’application.
      </p>

      <h2>8. Fin d’utilisation</h2>
      <p>
        Tu peux supprimer ton compte à tout moment depuis <strong>Réglages → Supprimer mon compte</strong> ; tes données
        sont alors effacées. Nous pouvons fermer un compte en cas de manquement grave aux présentes conditions.
      </p>

      <h2>9. Données personnelles</h2>
      <p>
        Le traitement de tes données est décrit dans la <Link href="/privacy">politique de confidentialité</Link>.
      </p>

      <h2>10. Modifications</h2>
      <p>
        Nous pouvons faire évoluer ces conditions. En cas de changement important, tu seras invité à les accepter de
        nouveau lors de ta prochaine connexion.
      </p>

      <h2>11. Droit applicable</h2>
      <p>
        Ces conditions sont régies par le droit français. En cas de litige, une solution amiable sera recherchée avant
        toute action ; à défaut, les tribunaux compétents sont ceux désignés par la loi.
      </p>
    </>
  );
}

function TermsEn() {
  return (
    <>
      <p>
        These terms govern the use of BingoBuzz. By creating an account, you accept them. If you do not agree, please do
        not use the service.
      </p>

      <h2>1. The service</h2>
      <p>
        BingoBuzz lets you build bingo grids made of phrases or events, play them alone or with others in real time,
        and share games by link, code or QR code.
      </p>

      <h2>2. Publisher</h2>
      <p>
        The service is published by {LEGAL.publisher}, {LEGAL.publisherAddress}. Contact:{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>3. Account</h2>
      <ul>
        <li>An account is required to use the service (email and password, or a Google account).</li>
        <li>You must provide a valid email address and keep your password confidential.</li>
        <li>You are responsible for activity carried out from your account.</li>
        <li>The service is intended for people aged 15 and over, or younger with a parent’s consent.</li>
      </ul>

      <h2>4. Your content</h2>
      <p>
        You keep ownership of the bingos and phrases you create. You allow us to store them and show them to players of
        the games that use them, solely to run the service.
      </p>
      <p>You agree not to post content that is:</p>
      <ul>
        <li>illegal, hateful, discriminatory, violent or sexually explicit;</li>
        <li>harassing, defamatory or meant to humiliate an identifiable person;</li>
        <li>containing third parties’ personal data without their consent;</li>
        <li>infringing other people’s rights (copyright, trademarks, privacy).</li>
      </ul>
      <p>We may remove content that breaks these rules and, for repeated abuse, suspend the account.</p>

      <h2>5. Games and sharing</h2>
      <p>
        Any signed-in person with a game’s link or code can join it. Your nickname, grid and progress are visible to the
        other players of that game. Share your links with people you choose.
      </p>

      <h2>6. Availability and liability</h2>
      <p>
        We do our best to keep BingoBuzz running but cannot guarantee it: the service is provided “as is” and may be
        interrupted for maintenance or outages. To the extent permitted by law, we are not liable for indirect damages
        arising from its use, nor for content posted by users.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The app, its name, design and code remain the publisher’s property. The provided bingo templates may be freely
        copied and edited within the app.
      </p>

      <h2>8. Ending your use</h2>
      <p>
        You can delete your account at any time from <strong>Settings → Delete my account</strong>; your data is then
        erased. We may close an account in case of serious breach of these terms.
      </p>

      <h2>9. Personal data</h2>
      <p>
        How we process your data is described in the <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these terms. In case of significant changes, you will be asked to accept them again the next time
        you sign in.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These terms are governed by French law. In case of dispute, an amicable solution will be sought first; failing
        that, the courts designated by law shall have jurisdiction.
      </p>
    </>
  );
}
