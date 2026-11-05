import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import { Server, type Socket } from 'socket.io';
import { RoomManager } from './manager';
import type { Intent, Room, RoomTimings } from './room';

export interface AppHandle {
  app: Express;
  http: HttpServer;
  io: Server;
  manager: RoomManager;
  close(): Promise<void>;
}

const MAX_NAME_LENGTH = 12;

function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') {
    return '玩家';
  }

  const cleaned = value.trim().slice(0, MAX_NAME_LENGTH);
  return cleaned === '' ? '玩家' : cleaned;
}

/**
 * Build the whole online service: HTTP app + Socket.IO + room manager. In
 * production the same process also serves the built client, so one port
 * carries everything (no mixed-content issues, one thing to tunnel).
 */
export function createApp(options: { clientDist?: string; timings?: Partial<RoomTimings> } = {}): AppHandle {
  const app = express();
  const http = createServer(app);
  const io = new Server(http, { cors: { origin: true } });
  const manager = new RoomManager(options.timings);

  app.disable('x-powered-by');
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: manager.size });
  });

  if (options.clientDist && existsSync(options.clientDist)) {
    app.use(express.static(options.clientDist));

    // SPA fallback: unknown GET paths that are neither API nor the socket
    // endpoint serve the shell page. (Express 5 dropped the '*' route.)
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        next();
        return;
      }

      res.sendFile(resolve(options.clientDist!, 'index.html'));
    });
  }

  io.on('connection', (socket: Socket) => {
    const roomOf = (): Room | undefined => {
      const roomId = socket.data?.roomId;
      return typeof roomId === 'string' ? manager.get(roomId) : undefined;
    };

    socket.on('room:create', (payload: { name?: unknown } | undefined, ack?: (r: unknown) => void) => {
      const room = manager.create();
      socket.data.name = sanitizeName(payload?.name);
      const playerId = randomUUID();
      socket.join(room.id);
      room.attach(socket, playerId);
      ack?.({ roomId: room.id, playerId });
    });

    socket.on(
      'room:join',
      (
        payload: { roomId?: unknown; name?: unknown; playerId?: unknown } | undefined,
        ack?: (r: unknown) => void,
      ) => {
        const roomId = typeof payload?.roomId === 'string' ? payload.roomId : '';
        const room = manager.get(roomId);

        if (!room) {
          ack?.({ error: '房间不存在或已关闭' });
          return;
        }

        const knownPlayerId = typeof payload?.playerId === 'string' && payload.playerId ? payload.playerId : null;
        socket.data.name = sanitizeName(payload?.name);
        let playerId = knownPlayerId ?? randomUUID();

        // Identity without accounts: a joiner carrying no seat in this room
        // adopts the seat of a disconnected player with the same name, so a
        // closed-tab "dead seat" comes back to life with its stats instead
        // of blocking the table forever.
        if (!room.hasSeat(playerId)) {
          playerId = room.findReadoptablePlayerId(socket.data.name) ?? playerId;
        }

        socket.join(room.id);
        room.attach(socket, playerId);
        ack?.({ roomId: room.id, playerId });
      },
    );

    socket.on('intent', (intent: Intent | undefined) => {
      if (!intent || typeof intent.type !== 'string') {
        return;
      }

      roomOf()?.handleIntent(socket, intent);
    });

    socket.on('room:kick', (payload: { seatIndex?: unknown } | undefined) => {
      roomOf()?.handleKick(socket, payload?.seatIndex);
    });

    socket.on('chat', (payload: { text?: unknown } | undefined) => {
      roomOf()?.handleChat(socket, payload?.text);
    });

    socket.on('disconnect', () => {
      const roomId = socket.data?.roomId;

      if (typeof roomId === 'string') {
        manager.get(roomId)?.detach(socket);
      }
    });
  });

  manager.startGc();

  return {
    app,
    http,
    io,
    manager,
    close: async () => {
      manager.disposeAll();
      await new Promise<void>((resolvePromise) => {
        io.close(() => resolvePromise());
      });
      await new Promise<void>((resolvePromise) => {
        http.close(() => resolvePromise());
      });
    },
  };
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const clientDist = resolve(here, '../../client/dist');
  const port = Number(process.env.PORT ?? 3000);

  const handle = createApp({
    clientDist: existsSync(clientDist) ? clientDist : undefined,
  });

  handle.http.listen(port, '0.0.0.0', () => {
    const serving = existsSync(clientDist) ? '页面 + WebSocket' : '仅 WebSocket（未找到 client/dist，前端请用 vite dev）';
    console.log(`[blackjack] 服务已启动: http://127.0.0.1:${port} （${serving}）`);
  });
}

const isDirectRun = process.argv[1] && import.meta.url === `file:///${resolve(process.argv[1]).replace(/\\/g, '/')}`;

if (isDirectRun) {
  main();
}
