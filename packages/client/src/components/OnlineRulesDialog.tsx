import { useEffect, useRef } from 'react';
import { BASE_ANTE, INITIAL_CHIPS } from '@bj/game';

interface OnlineRulesDialogProps {
  open: boolean;
  onClose: () => void;
}

export function OnlineRulesDialog({ open, onClose }: OnlineRulesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="rules-dialog"
      aria-labelledby="online-rules-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="rules-dialog__body">
        <header className="rules-dialog__head">
          <div>
            <span className="panel-eyebrow">ONLINE DUEL RULES</span>
            <h2 id="online-rules-title">联机对决说明</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="dialog-close"
            onClick={onClose}
            aria-label="关闭联机对决说明"
          >
            ×
          </button>
        </header>

        <div className="rules-grid">
          <section className="rules-block">
            <span className="rules-block__index">01</span>
            <h3>牌力排名（无庄家）</h3>
            <p>
              同桌最多 5 名玩家直接对决，终局所有手牌统一比大小：<strong>最强唯一则独赢，最强并列或全员爆牌则平局</strong>。
            </p>
            <div className="rules-outcomes">
              <span>1. 天牌 Blackjack（开局2张21点）</span>
              <span>2. 五小龙（摸满5张且未爆牌）</span>
              <span>3. 普通 21 点（3~4张凑成21点）</span>
              <span>4. 普通点数（越接近21点越强）</span>
            </div>
          </section>

          <section className="rules-block">
            <span className="rules-block__index">02</span>
            <h3>轮换暗牌 & 心理博弈</h3>
            <ul className="rules-list">
              <li>
                <span className="rule-chip">暗牌</span>
                <p>对局中每人只有<strong>最新一张牌</strong>对他人隐藏；每次要牌都会翻开上一张暗牌并盖住新摸的牌。</p>
              </li>
              <li>
                <span className="rule-chip">藏爆</span>
                <p>要牌爆点后只停止行动，<strong>不会立即亮出爆牌</strong>（只要明牌未超21点，对手在终局翻牌前不知道你爆没爆）。</p>
              </li>
              <li>
                <span className="rule-chip">轮转</span>
                <p>每局按座位顺序轮流担任「先手」，先后手信息优势公平轮换。</p>
              </li>
            </ul>
          </section>

          <section className="rules-block">
            <span className="rules-block__index">03</span>
            <h3>筹码、加倍与破产保护</h3>
            <div className="dealer-rule">
              <div>
                <strong>{INITIAL_CHIPS}</strong>
                <span>初始筹码</span>
              </div>
              <span className="dealer-rule__divider" aria-hidden="true">
                /
              </span>
              <div>
                <strong>{BASE_ANTE}</strong>
                <span>每局底注</span>
              </div>
            </div>
            <p className="rules-note">
              采用<strong>零和底池制</strong>：独赢玩家拿回本金并<strong>通吃全场所有输家的下注筹码</strong>；多人并列第一时平分输家底池。首轮 2 张牌可选择<strong>加倍（Double）</strong>：追加 {BASE_ANTE} 筹码，只摸 1 张暗牌并立即停牌。筹码不足 {BASE_ANTE} 时自动发放 {INITIAL_CHIPS} 破产补助。
            </p>
          </section>

          <section className="rules-block">
            <span className="rules-block__index">04</span>
            <h3>快捷操作与房间管理</h3>
            <div className="shortcut-grid">
              <span>
                <kbd>H</kbd> 要牌
              </span>
              <span>
                <kbd>S</kbd> 停牌
              </span>
              <span>
                <kbd>D</kbd> 加倍
              </span>
              <span>
                <kbd>Enter</kbd> 准备 / 下一局
              </span>
            </div>
            <p className="rules-note">
              支持关网页重连与同名认领离线座位；离线玩家回合 6 秒自动停牌托管；房主可点击他人座位右上角「✕」移出玩家。
            </p>
          </section>
        </div>

        <footer className="rules-dialog__foot">
          <span>21 点 · 多人玩家对决</span>
          <button type="button" className="dialog-confirm" onClick={onClose}>
            知道了
          </button>
        </footer>
      </div>
    </dialog>
  );
}
