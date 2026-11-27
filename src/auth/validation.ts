export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
