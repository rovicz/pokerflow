// Estilos do DiceBear permitidos. Nomes batem com @dicebear/styles/<nome>.json.
export const AVATAR_STYLES = [
  'lorelei',
  'adventurer',
  'bottts',
  'pixel-art',
  'fun-emoji',
  'notionists',
] as const;
export const AVATAR_LABELS = {
  lorelei: 'Retrato',
  adventurer: 'Aventureiro',
  bottts: 'Robôs',
  'pixel-art': 'Pixel',
  'fun-emoji': 'Emoji',
  notionists: 'Rabisco',
};
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
export type AvatarInfo = { style: AvatarStyle; seed: string };
const seedOk = (x: unknown): x is string => typeof x === 'string' && /^[\w-]{1,24}$/.test(x);
export function validAvatar(value: unknown): value is AvatarInfo {
  if (!value || typeof value !== 'object' || !('style' in value) || !('seed' in value))
    return false;
  return AVATAR_STYLES.some((style) => style === value.style) && seedOk(value.seed);
}
// Entrada vem do cliente: aceita só estilo da lista e seed simples; senão gera padrão pelo apelido.
export const cleanAvatar = (a: unknown, name = ''): AvatarInfo =>
  validAvatar(a)
    ? { style: a.style, seed: a.seed }
    : {
        style: 'lorelei',
        seed:
          String(name)
            .replace(/[^\w-]/g, '_')
            .slice(0, 24) || 'zake',
      };
