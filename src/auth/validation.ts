export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const DELETE_CONFIRM_WORD = 'EXCLUIR';

export function normalizeUsername(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function normalizeEmail(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

export function validateRegistrationInput(input: {
  username?: unknown;
  email?: unknown;
  password?: unknown;
}): { ok: true; username: string; email: string; password: string } | { ok: false; error: string } {
  const username = normalizeUsername(input.username);
  const email = normalizeEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';

  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: 'O apelido deve ter de 3 a 20 caracteres (apenas letras, números e _).',
    };
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'Informe um endereço de e-mail válido.' };
  }
  if (password.length < 8 || password.length > 72) {
    return { ok: false, error: 'A senha deve ter pelo menos 8 caracteres.' };
  }
  return { ok: true, username, email, password };
}

export function validateProfileUpdate(input: {
  username?: unknown;
  display_name?: unknown;
}): { ok: true; username?: string; display_name?: string } | { ok: false; error: string } {
  const out: { username?: string; display_name?: string } = {};
  if (input.username !== undefined) {
    const username = normalizeUsername(input.username);
    if (!USERNAME_RE.test(username)) {
      return {
        ok: false,
        error: 'O apelido único deve ter de 3 a 20 caracteres (apenas letras, números e _).',
      };
    }
    out.username = username;
  }
  if (input.display_name !== undefined) {
    const displayName = typeof input.display_name === 'string' ? input.display_name.trim() : '';
    if (displayName.length < 2 || displayName.length > 24) {
      return { ok: false, error: 'O nome de exibição deve ter de 2 a 24 caracteres.' };
    }
    out.display_name = displayName;
  }
  return { ok: true, ...out };
}

export function validatePasswordChange(input: {
  currentPassword?: unknown;
  newPassword?: unknown;
}): { ok: true; currentPassword: string; newPassword: string } | { ok: false; error: string } {
  const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : '';
  const newPassword = typeof input.newPassword === 'string' ? input.newPassword : '';
  if (!currentPassword) {
    return { ok: false, error: 'Informe sua senha atual.' };
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    return { ok: false, error: 'A nova senha deve ter pelo menos 8 caracteres.' };
  }
  if (currentPassword === newPassword) {
    return { ok: false, error: 'A nova senha deve ser diferente da senha atual.' };
  }
  return { ok: true, currentPassword, newPassword };
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type UserProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_style: string;
  avatar_seed: string;
  role: 'player' | 'admin';
  created_at?: string;
};

export type UserStats = {
  hands_played: number;
  hands_won: number;
  matches_played: number;
  matches_won: number;
  biggest_pot: number;
  total_chips_won: number;
};
