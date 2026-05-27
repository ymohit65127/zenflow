// Implements {{variable.path}} template expression evaluation
// Built-in functions: formatDate, uppercase, lowercase, concat, length, etc.

// ─── Built-in functions ────────────────────────────────────────────────────────

const builtinFunctions: Record<string, (...args: unknown[]) => unknown> = {
  // Date
  now: () => new Date().toISOString(),
  today: () => new Date().toISOString().slice(0, 10),
  addDays: (date: unknown, n: unknown) => {
    const d = new Date(date as string);
    d.setDate(d.getDate() + Number(n));
    return d.toISOString();
  },
  addHours: (date: unknown, n: unknown) => {
    const d = new Date(date as string);
    d.setHours(d.getHours() + Number(n));
    return d.toISOString();
  },
  formatDate: (date: unknown, fmt: unknown) => {
    const d = new Date(date as string);
    const f = String(fmt ?? 'YYYY-MM-DD');
    return f
      .replace('YYYY', String(d.getFullYear()))
      .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
      .replace('DD', String(d.getDate()).padStart(2, '0'))
      .replace('HH', String(d.getHours()).padStart(2, '0'))
      .replace('mm', String(d.getMinutes()).padStart(2, '0'));
  },
  diffDays: (a: unknown, b: unknown) => {
    const diff = new Date(b as string).getTime() - new Date(a as string).getTime();
    return Math.floor(diff / 86_400_000);
  },

  // String
  uppercase: (s: unknown) => String(s ?? '').toUpperCase(),
  lowercase: (s: unknown) => String(s ?? '').toLowerCase(),
  trim: (s: unknown) => String(s ?? '').trim(),
  replace: (s: unknown, from: unknown, to: unknown) => String(s ?? '').replaceAll(String(from), String(to ?? '')),
  substring: (s: unknown, start: unknown, end?: unknown) =>
    String(s ?? '').slice(Number(start), end !== undefined ? Number(end) : undefined),
  concat: (...parts: unknown[]) => parts.map(String).join(''),
  length: (s: unknown) => (Array.isArray(s) ? s.length : String(s ?? '').length),

  // Number
  parseInt: (s: unknown) => parseInt(String(s), 10),
  parseFloat: (s: unknown) => parseFloat(String(s)),
  round: (n: unknown, decimals?: unknown) => Number(Number(n).toFixed(Number(decimals ?? 0))),
  abs: (n: unknown) => Math.abs(Number(n)),
  min: (...args: unknown[]) => Math.min(...args.map(Number)),
  max: (...args: unknown[]) => Math.max(...args.map(Number)),

  // Array
  first: (arr: unknown) => (Array.isArray(arr) ? arr[0] : undefined),
  last: (arr: unknown) => (Array.isArray(arr) ? arr[arr.length - 1] : undefined),
  count: (arr: unknown) => (Array.isArray(arr) ? arr.length : 0),
  join: (arr: unknown, sep?: unknown) =>
    Array.isArray(arr) ? arr.map(String).join(String(sep ?? ', ')) : '',

  // Utility
  uuid: () => crypto.randomUUID(),
  jsonParse: (s: unknown) => { try { return JSON.parse(String(s)); } catch { return null; } },
  jsonStringify: (v: unknown) => JSON.stringify(v),
  isNull: (v: unknown) => v === null || v === undefined,
  coalesce: (...args: unknown[]) => args.find((a) => a !== null && a !== undefined) ?? null,
  toString: (v: unknown) => String(v ?? ''),
  toNumber: (v: unknown) => Number(v),
};

// ─── Expression evaluator ──────────────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    // Handle array access: items[0]
    const arrMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrMatch) {
      const [, key, idx] = arrMatch;
      current = (current as Record<string, unknown>)[key!];
      if (Array.isArray(current)) {
        current = current[parseInt(idx!, 10)];
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

function parseFunctionCall(expr: string): { name: string; args: string[] } | null {
  const match = expr.match(/^(\w+)\((.*)\)$/s);
  if (!match) return null;
  const name = match[1]!;
  const argsStr = match[2]!.trim();
  if (!argsStr) return { name, args: [] };

  // Simple argument split (handles nested quotes but not nested parens)
  const args: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let depth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i]!;
    if (inString) {
      current += ch;
      if (ch === stringChar) inString = false;
    } else if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return { name, args };
}

function evaluateArgument(arg: string, context: Record<string, unknown>): unknown {
  const trimmed = arg.trim();
  // String literal
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  // Nested function call
  if (trimmed.includes('(')) {
    const fc = parseFunctionCall(trimmed);
    if (fc && builtinFunctions[fc.name]) {
      const args = fc.args.map((a) => evaluateArgument(a, context));
      return builtinFunctions[fc.name]!(...args);
    }
  }
  // Variable path
  return getNestedValue(context, trimmed);
}

function evaluateExpression(expr: string, context: Record<string, unknown>): unknown {
  const trimmed = expr.trim();

  // functions.now(), functions.addDays(...), etc.
  if (trimmed.startsWith('functions.')) {
    const funcExpr = trimmed.slice(10);
    const fc = parseFunctionCall(funcExpr);
    if (fc && builtinFunctions[fc.name]) {
      const args = fc.args.map((a) => evaluateArgument(a, context));
      return builtinFunctions[fc.name]!(...args);
    }
    return undefined;
  }

  // secrets.KEY — return placeholder (real implementation would look up org secrets)
  if (trimmed.startsWith('secrets.')) {
    return process.env[`ZENFLOW_SECRET_${trimmed.slice(8).toUpperCase()}`] ?? '';
  }

  // Dot-notation path access: trigger.deal.name
  return getNestedValue(context, trimmed);
}

// ─── Main interpolate function ─────────────────────────────────────────────────

export function interpolate(template: unknown, context: Record<string, unknown>): unknown {
  if (typeof template === 'string') {
    // Full-expression mode: {{expr}} where the entire string is one expression
    const fullMatch = template.match(/^\{\{(.+)\}\}$/s);
    if (fullMatch) {
      const result = evaluateExpression(fullMatch[1]!, context);
      return result ?? '';
    }

    // Multi-interpolation mode: replace all {{expr}} within string
    return template.replace(/\{\{(.+?)\}\}/g, (_, expr: string) => {
      try {
        return String(evaluateExpression(expr, context) ?? '');
      } catch {
        return `{{${expr.trim()}}}`;
      }
    });
  }

  if (Array.isArray(template)) {
    return template.map((item) => interpolate(item, context));
  }

  if (typeof template === 'object' && template !== null) {
    return Object.fromEntries(
      Object.entries(template as Record<string, unknown>).map(([k, v]) => [
        k,
        interpolate(v, context),
      ])
    );
  }

  return template;
}
