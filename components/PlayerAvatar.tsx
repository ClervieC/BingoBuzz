import { avatarColor, defaultAvatar } from "@/lib/avatars";

/** Pastille ronde : emoji du joueur sur sa couleur. */
export function PlayerAvatar({
  userId,
  avatar,
  size = 32,
  className = "",
}: {
  userId: string;
  avatar?: string | null;
  size?: number;
  className?: string;
}) {
  const color = avatarColor(userId);
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.55),
        background: `color-mix(in srgb, ${color} 22%, transparent)`,
        boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${color} 55%, transparent)`,
      }}
    >
      {avatar || defaultAvatar(userId)}
    </span>
  );
}
