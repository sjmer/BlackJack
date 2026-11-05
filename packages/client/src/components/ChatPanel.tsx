import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@bj/game';
import { CHAT_MAX_LENGTH, CHAT_MIN_INTERVAL_MS } from '@bj/game';

/** Quick emoji bar — plain Unicode, no picker dependency. */
const QUICK_EMOJI = ['😀', '😂', '😎', '🤔', '😮', '😢', '👍', '👎', '👏', '🙏', '💪', '🔥', '❤️', '🍀', '🎉', '🃏'];

interface ChatPanelProps {
  chat: ChatMessage[];
  /** History replay arrived; only messages after this count as unread. */
  ready: boolean;
  myPlayerId: string | null;
  onSend: (text: string) => void;
}

/**
 * Floating room chat: a bubble button bottom-right that opens a panel with
 * the message log, an emoji quick bar and a rate-cooled input. The server
 * stays authoritative (sanitize + rate limit); the local cooldown just keeps
 * the button honest about it.
 */
export function ChatPanel({ chat, ready, myPlayerId, onSend }: ChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState('');
  const [cooling, setCooling] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const coolTimer = useRef<number | null>(null);
  const lastSeenId = useRef<string | null>(null);

  const lastId = chat.at(-1)?.id ?? null;

  // Count unseen live messages while the panel is closed. Everything that
  // arrives with the initial history replay is already "seen".
  useEffect(() => {
    if (ready && !open && lastId !== null && lastId !== lastSeenId.current) {
      setUnread((count) => count + 1);
    }

    lastSeenId.current = lastId;
  }, [lastId, open, ready]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chat.length, open]);

  useEffect(
    () => () => {
      if (coolTimer.current !== null) {
        window.clearTimeout(coolTimer.current);
      }
    },
    [],
  );

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);

    if (next) {
      setUnread(0);
    }
  };

  const send = () => {
    const text = draft.trim();

    if (text === '' || cooling) {
      return;
    }

    onSend(text);
    setDraft('');
    setCooling(true);
    coolTimer.current = window.setTimeout(() => setCooling(false), CHAT_MIN_INTERVAL_MS);
  };

  return (
    <div className={`chat-dock${open ? ' is-open' : ''}`}>
      {open && (
        <section className="chat-panel" aria-label="房间聊天">
          <header className="chat-panel__head">
            <span className="chat-panel__title">房间聊天</span>
            <button type="button" className="chat-panel__close" onClick={toggleOpen} aria-label="收起聊天">
              ×
            </button>
          </header>

          <div className="chat-panel__list" ref={listRef}>
            {chat.length === 0 && <p className="chat-panel__empty">还没有消息，打个招呼吧</p>}
            {chat.map((message) =>
              message.kind === 'system' ? (
                <p key={message.id} className="chat-message chat-message--system">
                  {message.text}
                </p>
              ) : (
                <p key={message.id} className={`chat-message${message.playerId === myPlayerId ? ' is-you' : ''}`}>
                  <span className="chat-message__name">{message.name}</span>
                  <span className="chat-message__text">{message.text}</span>
                </p>
              ),
            )}
          </div>

          <div className="chat-panel__emoji" aria-label="表情快捷">
            {QUICK_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="chat-emoji"
                onClick={() => setDraft((current) => (current + emoji).slice(0, CHAT_MAX_LENGTH))}
              >
                {emoji}
              </button>
            ))}
          </div>

          <form
            className="chat-panel__form"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <input
              className="chat-panel__input"
              value={draft}
              maxLength={CHAT_MAX_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={cooling ? '发送太频繁，稍等一下…' : '输入消息，Enter 发送'}
              aria-label="聊天消息"
            />
            <button type="submit" className="chat-panel__send" disabled={cooling || draft.trim() === ''}>
              发送
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="chat-fab"
        onClick={toggleOpen}
        aria-label={open ? '收起聊天' : '打开聊天'}
        aria-expanded={open}
      >
        {open ? '×' : '💬'}
        {!open && unread > 0 && (
          <i className="chat-fab__badge">{unread > 99 ? '99+' : unread}</i>
        )}
      </button>
    </div>
  );
}
