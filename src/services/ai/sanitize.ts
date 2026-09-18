/**
 * Sanitize HTML returned by an AI provider before it is rendered with
 * dangerouslySetInnerHTML. AI output is untrusted input: it may contain
 * prompt-injected markup, event handlers, javascript URLs or SVG payloads.
 */
export function sanitizeAIHtml(input: string): string {
  if (!input) return '';

  if (typeof DOMParser === 'undefined' || typeof document === 'undefined') {
    // Server/test fallback. Keep text and a small set of harmless formatting
    // tags, while removing attributes and every active-content element.
    return input
      .replace(/<\/?(?:script|style|iframe|object|embed|form|input|button|textarea|select|option|svg|math)[^>]*>/gi, '')
      .replace(/\s+on[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(?:href|src|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]+)/gi, '')
      .replace(/<(?!\/?(?:p|br|strong|em|b|i|u|code|pre|h[1-6]|ul|ol|li|div|span)(?:\s|\/?>))/gi, '&lt;');
  }

  const parsed = new DOMParser().parseFromString(input, 'text/html');
  const allowedTags = new Set(['P', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'CODE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'DIV', 'SPAN', 'BLOCKQUOTE', 'HR']);
  const allowedAttrs = new Set(['class']);
  const blockedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION', 'SVG', 'MATH', 'LINK', 'META', 'BASE']);

  const clean = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      const element = child as HTMLElement;
      if (blockedTags.has(element.tagName)) {
        child.remove();
        continue;
      }
      if (!allowedTags.has(element.tagName)) {
        // Preserve readable text from unknown formatting elements, but drop
        // their attributes and element itself.
        const fragment = document.createDocumentFragment();
        while (element.firstChild) fragment.appendChild(element.firstChild);
        element.replaceWith(fragment);
        continue;
      }
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();
        if (!allowedAttrs.has(name) || /(?:javascript|data|vbscript):/i.test(value)) {
          element.removeAttribute(attribute.name);
        }
      }
      clean(element);
    }
  };

  clean(parsed.body);
  return parsed.body.innerHTML;
}

/** Roadmap/API-compatible name for callers that do not care about HTML mode. */
export const sanitizeAiOutput = sanitizeAIHtml;
