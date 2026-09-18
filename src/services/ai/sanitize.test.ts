import { describe, expect, it } from 'vitest';
import { sanitizeAIHtml } from './sanitize';

describe('sanitizeAIHtml', () => {
  it('removes active content and event handlers from AI output', () => {
    const clean = sanitizeAIHtml('<p class="text-cyan-300">Hello</p><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">bad link</a>');
    expect(clean).not.toMatch(/script|onerror|javascript:/i);
    expect(clean).toContain('Hello');
  });

  it('keeps harmless formatting and drops unknown tags', () => {
    const clean = sanitizeAIHtml('<strong>Bold</strong><mark data-x="1">text</mark><code>code</code>');
    expect(clean).toContain('<strong>Bold</strong>');
    expect(clean).toContain('text');
    expect(clean).toContain('<code>code</code>');
  });
});
