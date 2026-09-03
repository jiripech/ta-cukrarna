/**
 * Minimal JSONC reader: JSON with `//` line comments, `/* block comments *\/`
 * and trailing commas - the format used for the hand-edited
 * /opening-hours.jsonc file.
 *
 * A single state-machine pass strips comments and trailing commas while
 * respecting string literals (a "//" inside a string or a comma inside a
 * string is data, not syntax). Returns null on any parse failure so callers
 * can fall back to their defaults.
 */
export function parseJsonc<T = unknown>(text: string): T | null {
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1); // strip BOM
  }

  let out = '';
  let inString = false;

  const skipLineComment = (from: number): number => {
    let j = from;
    while (j < text.length && text[j] !== '\n') j++;
    return j;
  };
  const skipBlockComment = (from: number): number => {
    let j = from + 2;
    while (j + 1 < text.length && !(text[j] === '*' && text[j + 1] === '/')) {
      j++;
    }
    return Math.min(j + 2, text.length);
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < text.length) {
        out += text[++i];
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === '/' && text[i + 1] === '/') {
      i = skipLineComment(i) - 1;
      continue;
    }

    if (ch === '/' && text[i + 1] === '*') {
      i = skipBlockComment(i) - 1;
      continue;
    }

    if (ch === ',') {
      // Lookahead past whitespace/comments: drop the comma when a closing
      // brace/bracket follows (trailing comma), keep it otherwise.
      let j = i + 1;
      for (;;) {
        while (j < text.length && /\s/.test(text[j])) j++;
        if (text[j] === '/' && text[j + 1] === '/') {
          j = skipLineComment(j);
          continue;
        }
        if (text[j] === '/' && text[j + 1] === '*') {
          j = skipBlockComment(j);
          continue;
        }
        break;
      }
      if (text[j] === '}' || text[j] === ']') {
        continue;
      }
      out += ch;
      continue;
    }

    out += ch;
  }

  try {
    return JSON.parse(out) as T;
  } catch {
    return null;
  }
}
