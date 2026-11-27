import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabase } from '../../../src/lib/supabase/server.ts';

export const runtime = 'nodejs';

const ALLOWED_TYPES: EmailOtpType[] = ['signup', 'recovery', 'magiclink', 'email_change', 'email'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/?auth=confirmed';

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.redirect(new URL('/?auth=unavailable', request.url));
  }

  // Suporte ao callback PKCE (?code=...) usado pelo mailer nativo do Supabase (fallback).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL('/?auth=expired', request.url));
    }
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  if (!tokenHash || !rawType || !ALLOWED_TYPES.includes(rawType)) {
    return NextResponse.redirect(new URL('/?auth=invalid', request.url));
  }

  // Tenta com o type recebido; caso seja um reenvio (magiclink) chegando como signup, faz fallback para magiclink.
  let { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType });
  if (error && rawType === 'signup') {
    const retry = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    error = retry.error;
  }

  if (error) {
    return NextResponse.redirect(new URL('/?auth=expired', request.url));
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}
