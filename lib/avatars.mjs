// Estilos do DiceBear permitidos. Nomes batem com @dicebear/styles/<nome>.json.
export const AVATAR_STYLES = ['lorelei', 'adventurer', 'bottts', 'pixel-art', 'fun-emoji', 'notionists'];
export const AVATAR_LABELS = {lorelei: 'Retrato', adventurer: 'Aventureiro', bottts: 'Robôs', 'pixel-art': 'Pixel', 'fun-emoji': 'Emoji', notionists: 'Rabisco'};
const seedOk = x => typeof x === 'string' && /^[\w-]{1,24}$/.test(x);
export const validAvatar = a => !!a && AVATAR_STYLES.includes(a.style) && seedOk(a.seed);
// Entrada vem do cliente: aceita só estilo da lista e seed simples; senão gera padrão pelo apelido.
export const cleanAvatar = (a, name = '') => validAvatar(a) ? {style: a.style, seed: a.seed} : {style: 'lorelei', seed: String(name).replace(/[^\w-]/g, '_').slice(0, 24) || 'zake'};
