import { openRoomStore } from '../../../../src/server/room-store.ts';
export const runtime = 'nodejs';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

// Chamada diária pelo Vercel Cron (vercel.json). O Vercel envia `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return new Response('Unauthorized', { status: 401 });
  const deleted = await openRoomStore().deleteStale(Date.now() - SEVEN_DAYS);
  return Response.json({ deleted });
}
