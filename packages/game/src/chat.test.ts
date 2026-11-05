import { describe, expect, it } from 'vitest';
import { CHAT_MAX_LENGTH, sanitizeChatText } from './chat';

describe('chat sanitizing', () => {
  it('trims whitespace and strips control characters', () => {
    expect(sanitizeChatText('  你好 \n world\t')).toBe('你好  world');
    expect(sanitizeChatText('a\u0000b')).toBe('ab');
  });

  it('clamps overly long messages', () => {
    expect(sanitizeChatText('x'.repeat(500))).toHaveLength(CHAT_MAX_LENGTH);
  });

  it('rejects non-string input as empty', () => {
    expect(sanitizeChatText(undefined)).toBe('');
    expect(sanitizeChatText(42)).toBe('');
    expect(sanitizeChatText({ text: 'hi' })).toBe('');
  });
});
