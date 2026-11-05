import { Room, ROOM_IDLE_TTL_MS, type RoomTimings } from './room';

/** Unambiguous alphabet for 4-character room codes read over voice chat. */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 4;
export const ROOM_GC_INTERVAL_MS = 60_000;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private gcHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly timings: Partial<RoomTimings> = {},
  ) {}

  create(): Room {
    let id = this.nextCode();

    while (this.rooms.has(id)) {
      id = this.nextCode();
    }

    const room = new Room(id, this.timings);
    this.rooms.set(id, room);
    return room;
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  remove(room: Room): void {
    if (this.rooms.get(room.id) !== room) {
      return;
    }

    this.rooms.delete(room.id);
    room.dispose();
  }

  get size(): number {
    return this.rooms.size;
  }

  /** Drop rooms that lost every connection long ago. */
  sweep(): number {
    let removed = 0;

    for (const room of [...this.rooms.values()]) {
      if (room.connectedCount === 0 && room.idleMs > ROOM_IDLE_TTL_MS) {
        this.remove(room);
        removed += 1;
      }
    }

    return removed;
  }

  startGc(): void {
    if (this.gcHandle) {
      return;
    }

    this.gcHandle = setInterval(() => this.sweep(), ROOM_GC_INTERVAL_MS);
    this.gcHandle.unref?.();
  }

  stopGc(): void {
    if (this.gcHandle) {
      clearInterval(this.gcHandle);
      this.gcHandle = null;
    }
  }

  disposeAll(): void {
    this.stopGc();

    for (const room of [...this.rooms.values()]) {
      this.remove(room);
    }
  }

  private nextCode(): string {
    let code = '';

    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }

    return code;
  }
}
