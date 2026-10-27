/** Avatars proposés en rejoignant une partie. */
export const AVATARS = [
  "🦊", "🐼", "🐸", "🦁", "🐯", "🐨", "🐵", "🐙", "🦄", "🐧", "🦉", "🐝",
  "🐢", "🦖", "🐳", "🦩", "🌵", "🍕", "🌮", "🍩", "🎸", "🚀", "👽", "🤖",
];

const AVATAR_COLORS = ["#7c3aed", "#2563eb", "#0f766e", "#15803d", "#c2410c", "#dc2626", "#db2777", "#ca8a04"];

/** Couleur stable d'un joueur, dérivée de son identifiant. */
export function avatarColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Avatar par défaut (stable) quand le joueur n'en a pas choisi. */
export function defaultAvatar(userId: string): string {
  let h = 7;
  for (let i = 0; i < userId.length; i++) h = (h * 17 + userId.charCodeAt(i)) >>> 0;
  return AVATARS[h % AVATARS.length];
}
