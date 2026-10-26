import Image from "next/image";

/**
 * Logo bingoBuzz : icône + texte. Le texte existe en deux versions
 * (« bingo » foncé ou clair) : `.only-light` / `.only-dark` (globals.css)
 * affichent la bonne selon le thème, sans JavaScript.
 * Fichiers générés par `npm run brand` dans public/brand/.
 */
export function Logo({
  size = 34,
  wordmark = true,
  priority = false,
  className = "",
}: {
  /** hauteur de l'icône en px */
  size?: number;
  wordmark?: boolean;
  priority?: boolean;
  className?: string;
}) {
  // wordmark.png : 480×96 (ratio 5)
  const textHeight = Math.round(size * 0.62);
  const textWidth = textHeight * 5;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Image
        src="/brand/icon.png"
        width={size}
        height={size}
        alt={wordmark ? "" : "bingoBuzz"}
        priority={priority}
        className="logo-icon shrink-0"
      />
      {wordmark && (
        <>
          <Image
            src="/brand/wordmark.png"
            width={textWidth}
            height={textHeight}
            alt="bingoBuzz"
            priority={priority}
            className="only-light"
          />
          <Image
            src="/brand/wordmark-dark.png"
            width={textWidth}
            height={textHeight}
            alt=""
            aria-hidden
            priority={priority}
            className="only-dark"
          />
        </>
      )}
    </span>
  );
}
