import { useCallback, useRef } from 'react';

export type SoundName =
  | 'start'
  | 'deal'
  | 'flip'
  | 'click'
  | 'win'
  | 'blackjack'
  | 'lose'
  | 'bust'
  | 'push';

interface ToneOptions {
  at: number;
  frequency: number;
  endFrequency?: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
}

function tone(context: AudioContext, options: ToneOptions): void {
  const { at, frequency, endFrequency, duration, volume, type = 'triangle' } = options;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  if (endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
  }

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.03);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  return new AudioContextCtor();
}

export function useSound(muted: boolean): { play: (sound: SoundName) => void } {
  const contextRef = useRef<AudioContext | null>(null);

  const play = useCallback(
    (sound: SoundName) => {
      if (muted) {
        return;
      }

      try {
        if (!contextRef.current) {
          contextRef.current = getAudioContext();
        }

        const context = contextRef.current;
        if (!context) {
          return;
        }

        if (context.state === 'suspended') {
          void context.resume().catch(() => undefined);
        }

        const now = context.currentTime + 0.012;

        switch (sound) {
          case 'start':
            tone(context, { at: now, frequency: 240, endFrequency: 460, duration: 0.08, volume: 0.03 });
            tone(context, { at: now + 0.07, frequency: 280, endFrequency: 520, duration: 0.08, volume: 0.025 });
            tone(context, { at: now + 0.14, frequency: 320, endFrequency: 610, duration: 0.1, volume: 0.025 });
            break;
          case 'deal':
            tone(context, {
              at: now,
              frequency: 700,
              endFrequency: 260,
              duration: 0.055,
              volume: 0.018,
              type: 'triangle',
            });
            tone(context, {
              at: now + 0.018,
              frequency: 160,
              endFrequency: 115,
              duration: 0.065,
              volume: 0.014,
              type: 'sine',
            });
            break;
          case 'flip':
            tone(context, {
              at: now,
              frequency: 520,
              endFrequency: 180,
              duration: 0.11,
              volume: 0.025,
              type: 'triangle',
            });
            break;
          case 'click':
            tone(context, {
              at: now,
              frequency: 190,
              endFrequency: 145,
              duration: 0.035,
              volume: 0.018,
              type: 'square',
            });
            break;
          case 'win':
            [523.25, 659.25, 783.99].forEach((frequency, index) => {
              tone(context, {
                at: now + index * 0.09,
                frequency,
                duration: 0.18,
                volume: 0.033,
              });
            });
            break;
          case 'blackjack':
            [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
              tone(context, {
                at: now + index * 0.075,
                frequency,
                duration: 0.22,
                volume: 0.032,
              });
            });
            tone(context, {
              at: now + 0.31,
              frequency: 1568,
              endFrequency: 2093,
              duration: 0.26,
              volume: 0.018,
              type: 'sine',
            });
            break;
          case 'lose':
            [220, 174.61, 130.81].forEach((frequency, index) => {
              tone(context, {
                at: now + index * 0.1,
                frequency,
                duration: 0.18,
                volume: 0.024,
                type: 'sawtooth',
              });
            });
            break;
          case 'bust':
            tone(context, {
              at: now,
              frequency: 132,
              endFrequency: 55,
              duration: 0.26,
              volume: 0.045,
              type: 'sawtooth',
            });
            tone(context, {
              at: now + 0.03,
              frequency: 70,
              endFrequency: 42,
              duration: 0.24,
              volume: 0.03,
              type: 'square',
            });
            break;
          case 'push':
            [392, 392].forEach((frequency, index) => {
              tone(context, {
                at: now + index * 0.12,
                frequency,
                duration: 0.12,
                volume: 0.023,
              });
            });
            break;
        }
      } catch {
        // Audio is a garnish. A locked-down browser should still play the game.
      }
    },
    [muted],
  );

  return { play };
}
