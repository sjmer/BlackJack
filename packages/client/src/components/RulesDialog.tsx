import { useEffect, useRef } from 'react';

interface RulesDialogProps {
  open: boolean;
  onClose: () => void;
}

export function RulesDialog({ open, onClose }: RulesDialogProps) {
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
      aria-labelledby="rules-title"
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
            <span className="panel-eyebrow">HOUSE RULES</span>
            <h2 id="rules-title">玩法说明</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="dialog-close"
            onClick={onClose}
            aria-label="关闭玩法说明"
          >
            ×
          </button>
        </header>

        <div className="rules-grid">
          <section className="rules-block">
            <span className="rules-block__index">01</span>
            <h3>牌的点数</h3>
            <ul className="rules-list">
              <li>
                <span className="rule-chip">A</span>
                <p>可以算 1 点或 11 点，自动取对玩家最有利且不超过 21 的值。</p>
              </li>
              <li>
                <span className="rule-chip">2—10</span>
                <p>按牌面数字计算。</p>
              </li>
              <li>
                <span className="rule-chip">J Q K</span>
                <p>都算 10 点。</p>
              </li>
            </ul>
            <div className="rules-example">
              <span>A + 9 = 20</span>
              <span>A + 9 + 5 = 15</span>
            </div>
          </section>

          <section className="rules-block">
            <span className="rules-block__index">02</span>
            <h3>庄家怎么走</h3>
            <div className="dealer-rule">
              <div>
                <strong>≤ 16</strong>
                <span>必须要牌</span>
              </div>
              <span className="dealer-rule__divider" aria-hidden="true">
                /
              </span>
              <div>
                <strong>≥ 17</strong>
                <span>必须停牌</span>
              </div>
            </div>
            <p className="rules-note">软 17 同样停牌。庄家不做任何自由选择。</p>
          </section>

          <section className="rules-block">
            <span className="rules-block__index">03</span>
            <h3>你的操作</h3>
            <p>
              开局各发两张牌，庄家第二张是暗牌。你可以不断<strong>要牌</strong>，或选择
              <strong>停牌</strong>把回合交给庄家。
            </p>
            <div className="rules-outcomes">
              <span>超过 21 点即爆牌</span>
              <span>开局两张 21 点为 Blackjack</span>
              <span>点数相同为平局</span>
              <span>Blackjack 胜过普通 21 点</span>
            </div>
          </section>

          <section className="rules-block">
            <span className="rules-block__index">04</span>
            <h3>快捷操作</h3>
            <div className="shortcut-grid">
              <span>
                <kbd>H</kbd> 要牌
              </span>
              <span>
                <kbd>S</kbd> 停牌
              </span>
              <span>
                <kbd>Enter</kbd> 开局 / 下一局
              </span>
              <span>
                <kbd>?</kbd> 打开玩法
              </span>
            </div>
            <p className="rules-note">
              首版为单人对庄、一副牌每局重洗。暂不包含下注、加倍、分牌与保险。
            </p>
          </section>
        </div>

        <footer className="rules-dialog__foot">
          <span>21 点 · 单人对庄</span>
          <button type="button" className="dialog-confirm" onClick={onClose}>
            知道了
          </button>
        </footer>
      </div>
    </dialog>
  );
}
