import { beforeEach, expect, jest, test } from '@jest/globals';
import type { GameState, Room } from '../src/poker/game-types.ts';

type OpenStore = typeof import('../src/server/room-store.ts').openRoomStore;
const openRoomStore = jest.fn<OpenStore>();
const storeModule = jest.requireActual<typeof import('../src/server/room-store.ts')>(
  '../src/server/room-store.ts',
);
const { RoomStoreUnavailable } = storeModule;

jest.doMock('../src/server/room-store.ts', () => ({ ...storeModule, openRoomStore }));
jest.doMock('../src/server/room-notify.ts', () => ({
  roomChannel: () => undefined,
  notifyRoom: jest.fn(),
}));
const { POST } = jest.requireActual<typeof import('../app/api/game/route.ts')>(
  '../app/api/game/route.ts',
);

const code = 'ABCDEF123456';
const host = 'a'.repeat(64);
const guest = 'b'.repeat(64);
const spectator = 'c'.repeat(64);
type Store = ReturnType<typeof openRoomStore>;

function lobby() {
  const state: GameState = {
    host,
    initial: 2000,
    phase: 'waiting',
    players: [host, guest].map((id, seat) => ({
      id,
      name: `Jogador ${seat + 1}`,
      stack: 2000,
      bet: 0,
      total: 0,
      cards: [],
    })),
    spectators: [{ id: spectator, name: 'Espectador' }],
    board: [],
    result: [],
    hand: 0,
    dealer: -1,
    turn: -1,
    sb: 10,
    bb: 20,
    seconds: 30,
  };
  const row = { code, state, version: 1 };
  const store = {
    create: jest.fn<Store['create']>(),
    deleteStale: jest.fn<Store['deleteStale']>(),
    read: jest.fn<Store['read']>(async () => structuredClone(row)),
    update: jest.fn<Store['update']>(async (_code, version, next) => {
      if (version !== row.version) return false;
      row.state = structuredClone(next);
      row.version++;
      return true;
    }),
  } satisfies Store;
  openRoomStore.mockReturnValue(store);
  return { row, store };
}

function command(token: string, op: 'leave' | 'ready', extra = {}) {
  return POST(
    new Request('http://localhost/api/game', {
      method: 'POST',
      body: JSON.stringify({ code, token, op, ...extra }),
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('Estou pronto relê a sala após uma gravação concorrente e mantém a atualização do outro assento', async () => {
  const { row, store } = lobby();
  store.update.mockImplementationOnce(async () => {
    row.state.players[1].ready = true;
    row.version++;
    return false;
  });

  const response = await command(host, 'ready', { active: true, version: 0 });
  expect(response.status).toBe(200);
  const room: Room = await response.json();
  expect(store.update.mock.calls.map(([, version]) => version)).toEqual([1, 2]);
  expect(room.version).toBe(3);
  expect(room.state.players.map((p) => p.ready)).toEqual([true, true]);
});

test('uma presença antiga deixa de valer quando a partida começa antes da nova tentativa', async () => {
  const { row, store } = lobby();
  store.update.mockImplementationOnce(async () => {
    row.state.phase = 'preflop';
    row.version++;
    return false;
  });
  const response = await command(host, 'ready', { active: true });
  expect(response.status).toBe(400);
  expect(row.state.players[0].ready).toBeUndefined();
  expect(store.update).toHaveBeenCalledTimes(1);
});

test('sair da mesa revalida a sessão se o assento foi recuperado em outro dispositivo', async () => {
  const { row, store } = lobby();
  const newToken = 'd'.repeat(64);
  store.update.mockImplementationOnce(async () => {
    row.state.players[0].sessionToken = newToken;
    row.version++;
    return false;
  });
  expect(await (await command(host, 'leave')).json()).toEqual({ left: true });
  expect(store.update).toHaveBeenCalledTimes(1);
  expect(row.state.players[0].sessionToken).toBe(newToken);
});

test('um espectador sai com versão desatualizada e pode repetir o pedido sem gravar de novo', async () => {
  const { row, store } = lobby();
  const response = await command(spectator, 'leave', { version: 0 });
  expect(response.status).toBe(200);
  expect(row.state.spectators).toEqual([]);
  expect(await (await command(spectator, 'leave')).json()).toEqual({ left: true });
  expect(store.update).toHaveBeenCalledTimes(1);
});

test('uma falha de armazenamento retorna indisponibilidade, sem repetir como se fosse conflito', async () => {
  const { store } = lobby();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    store.update.mockRejectedValueOnce(new RoomStoreUnavailable('update', 'test'));
    const response = await command(host, 'ready', { active: true });
    expect(response.status).toBe(503);
    expect(store.update).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
  }
});
