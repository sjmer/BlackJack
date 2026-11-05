import { useCallback, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ChatMessage, TableView } from '@bj/game';

const SESSION_KEY = 'bj.online.session.v1';

export interface OnlineSession {
  roomId: string;
  playerId: string;
  name: string;
}

export type OnlineStatus = 'idle' | 'connecting' | 'joined' | 'error';

interface RoomInfo {
  roomId?: string;
  playerId?: string;
  error?: string;
}

function loadSession(): OnlineSession | null {
  try {
    // localStorage (not sessionStorage): the identity must outlive the tab,
    // so closing the browser and coming back still restores the seat.
    const raw = localStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<OnlineSession>;

    if (typeof parsed.roomId === 'string' && typeof parsed.playerId === 'string' && typeof parsed.name === 'string') {
      return { roomId: parsed.roomId, playerId: parsed.playerId, name: parsed.name };
    }
  } catch {
    // Storage may be unavailable; reconnect is a convenience only.
  }

  return null;
}

function saveSession(session: OnlineSession | null): void {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Never block play on storage.
  }
}

/** Client-side mirror of the server log, capped the same way. */
const CHAT_VIEW_LIMIT = 100;

export interface OnlineGameApi {
  status: OnlineStatus;
  error: string | null;
  view: TableView | null;
  session: OnlineSession | null;
  chat: ChatMessage[];
  /** Chat history has been replayed; live messages arrive from now on. */
  chatReady: boolean;
  createRoom: (name: string) => void;
  joinRoom: (roomId: string, name: string) => void;
  tryResume: () => boolean;
  leave: () => void;
  intent: (type: string, extra?: Record<string, unknown>) => void;
  kick: (seatIndex: number) => void;
  sendChat: (text: string) => void;
  clearError: () => void;
}

/**
 * One socket per mounted online screen. The server is authoritative: this
 * hook only sends intents and renders whatever sanitized view comes back.
 * Listeners are attached when a socket instance is created (they follow the
 * instance, not the component lifecycle, because leave() drops the instance
 * and a later create/join builds a fresh one). After a transport-level
 * reconnect the session is re-attached by replaying room:join with the
 * stored player id.
 */
export function useOnlineGame(): OnlineGameApi {
  const socketRef = useRef<Socket | null>(null);
  const sessionRef = useRef<OnlineSession | null>(null);
  const resumeRef = useRef(false);
  const leaveRef = useRef<() => void>(() => {});
  // Timestamp of the latest transport-reconnect replay of room:join. A
  // room:replaced arriving right after it is our own echo (the server swapped
  // the lingering half-open socket for this very page's fresh one), not
  // another window stealing the seat.
  const selfJoinAt = useRef(0);

  const [status, setStatus] = useState<OnlineStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<TableView | null>(null);
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  /** True once the room's chat:history replay arrived — later messages are "live". */
  const [chatReady, setChatReady] = useState(false);

  const pushChat = useCallback((message: ChatMessage) => {
    setChat((current) => {
      const next = [...current, message];
      return next.length > CHAT_VIEW_LIMIT ? next.slice(next.length - CHAT_VIEW_LIMIT) : next;
    });
  }, []);

  const replaceChat = useCallback((messages: ChatMessage[]) => {
    setChat(messages.slice(-CHAT_VIEW_LIMIT));
    setChatReady(true);
  }, []);

  const leave = useCallback(() => {
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    sessionRef.current = null;
    saveSession(null);
    setSession(null);
    setView(null);
    setChat([]);
    setChatReady(false);
    setError(null);
    setStatus('idle');
  }, []);

  leaveRef.current = leave;

  const ensureSocket = useCallback((): Socket => {
    if (socketRef.current) {
      return socketRef.current;
    }

    const socket = io({ autoConnect: false });

    socket.on('state', (next: TableView) => {
      setView(next);
    });

    socket.on('chat', (message: ChatMessage) => {
      pushChat(message);
    });

    socket.on('chat:history', (messages: ChatMessage[]) => {
      replaceChat(Array.isArray(messages) ? messages : []);
    });

    // Transport reconnected: re-attach to the room with the stored identity.
    socket.on('connect', () => {
      const current = sessionRef.current;

      if (!current) {
        return;
      }

      selfJoinAt.current = Date.now();
      socket.emit('room:join', current, (info: RoomInfo) => {
        if (info?.error) {
          setError('房间已关闭');
          leaveRef.current();
        }
      });
    });

    // A refused/failed connection must never spin forever: surface a clear
    // error when the user just asked to join or create, and stay quiet for
    // background resumes so opening the menu offline stays pleasant.
    socket.on('connect_error', () => {
      if (resumeRef.current) {
        resumeRef.current = false;
        saveSession(null);
        setStatus('idle');
        socket.disconnect();
        return;
      }

      if (!sessionRef.current) {
        setError('连不上服务器：请先启动游戏服务（双击 start.cmd 或运行 pnpm start），然后再试');
        setStatus('error');
        socket.disconnect();
      }
    });

    socket.on('room:replaced', () => {
      // Our own reconnect echo: the server swapped the lingering half-open
      // socket for this page's fresh connection, and the notice for the old
      // connection arrives on the very same client instance. The fresh
      // connection is still seated — keep playing, no error, no leave.
      if (Date.now() - selfJoinAt.current < 1500) {
        return;
      }

      // leave() resets the error state, so it must run FIRST and the
      // message afterwards, or the notice would never show.
      leaveRef.current();
      setError('同一玩家已在其他窗口入座，此窗口已退出');
    });

    socket.on('room:closed', () => {
      leaveRef.current();
      setError('房间已关闭');
    });

    socket.on('room:kicked', () => {
      leaveRef.current();
      setError('你已被房主移出房间');
    });

    socketRef.current = socket;
    return socket;
  }, []);

  const createRoom = useCallback(
    (name: string) => {
      const socket = ensureSocket();
      resumeRef.current = false;
      setError(null);
      setStatus('connecting');
      socket.connect();
      socket.emit('room:create', { name }, (info: RoomInfo) => {
        if (!info?.roomId || !info?.playerId) {
          setError('创建房间失败，请稍后再试');
          setStatus('error');
          return;
        }

        const next: OnlineSession = { roomId: info.roomId, playerId: info.playerId, name };
        saveSession(next);
        sessionRef.current = next;
        setSession(next);
        setStatus('joined');
      });
    },
    [ensureSocket],
  );

  const joinRoom = useCallback(
    (roomId: string, name: string) => {
      const socket = ensureSocket();
      resumeRef.current = false;
      setError(null);
      setStatus('connecting');
      socket.connect();
      socket.emit('room:join', { roomId, name }, (info: RoomInfo) => {
        if (info?.error || !info?.playerId) {
          setError(info?.error ?? '加入房间失败');
          setStatus('error');
          return;
        }

        const next: OnlineSession = { roomId: info.roomId ?? roomId.toUpperCase(), playerId: info.playerId, name };
        saveSession(next);
        sessionRef.current = next;
        setSession(next);
        setStatus('joined');
      });
    },
    [ensureSocket],
  );

  const tryResume = useCallback((): boolean => {
    const saved = loadSession();

    if (!saved) {
      return false;
    }

    const socket = ensureSocket();
    resumeRef.current = true;
    setStatus('connecting');
    socket.connect();
    socket.emit('room:join', saved, (info: RoomInfo) => {
      if (info?.error || !info?.playerId) {
        saveSession(null);
        setStatus('idle');
        return;
      }

      sessionRef.current = saved;
      setSession(saved);
      setStatus('joined');
    });

    return true;
  }, [ensureSocket]);

  const intent = useCallback((type: string, extra: Record<string, unknown> = {}) => {
    socketRef.current?.emit('intent', { type, ...extra });
  }, []);

  const kick = useCallback((seatIndex: number) => {
    socketRef.current?.emit('room:kick', { seatIndex });
  }, []);

  const sendChat = useCallback((text: string) => {
    socketRef.current?.emit('chat', { text });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    status,
    error,
    view,
    session,
    chat,
    chatReady,
    createRoom,
    joinRoom,
    tryResume,
    leave,
    intent,
    kick,
    sendChat,
    clearError,
  };
}
