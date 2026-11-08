const QTY = /^(\d+)(?:\.(\d{1,6}))?$/;
const ZERO = BigInt(0);
const ONE = BigInt(1);

export function parseQty(input: string): string | null {
  const text = input.trim();
  const match = QTY.exec(text);
  if (!match) return null;
  const whole = match[1].replace(/^0+(?=\d)/, "");
  const frac = match[2] ?? "";
  return frac.length > 0 ? `${whole}.${frac}` : whole;
}

function parts(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  return {
    sign: match[1] === "-" ? -ONE : ONE,
    whole: match[2],
    frac: match[3] ?? "",
  };
}

function scaled(value: string, scale: number): bigint | null {
  const part = parts(value);
  if (!part) return null;
  const frac = part.frac.padEnd(scale, "0");
  if (frac.length > scale) return null;
  return part.sign * BigInt(`${part.whole}${frac}`);
}

function formatScaled(value: bigint, scale: number): string {
  const negative = value < ZERO;
  const digits = (negative ? -value : value).toString().padStart(scale + 1, "0");
  if (scale === 0) return `${negative ? "-" : ""}${digits}`;
  const whole = digits.slice(0, -scale);
  const frac = digits.slice(-scale);
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

function scaleOf(value: string) {
  return parts(value)?.frac.length ?? 0;
}

export function cmpQty(left: string, right: string): number {
  const scale = Math.max(scaleOf(left), scaleOf(right));
  const a = scaled(left, scale);
  const b = scaled(right, scale);
  if (a === null || b === null) return Number.NaN;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function addQty(left: string, right: string): string | null {
  const scale = Math.max(scaleOf(left), scaleOf(right));
  const a = scaled(left, scale);
  const b = scaled(right, scale);
  if (a === null || b === null) return null;
  return formatScaled(a + b, scale);
}

export function subQty(left: string, right: string): string | null {
  if (cmpQty(left, right) < 0) return null;
  const scale = Math.max(scaleOf(left), scaleOf(right));
  const a = scaled(left, scale);
  const b = scaled(right, scale);
  if (a === null || b === null) return null;
  return formatScaled(a - b, scale);
}

export function signedDiff(after: string, before: string): string | null {
  const scale = Math.max(scaleOf(after), scaleOf(before));
  const a = scaled(after, scale);
  const b = scaled(before, scale);
  if (a === null || b === null) return null;
  return formatScaled(a - b, scale);
}

export function isZeroQty(value: string) {
  return cmpQty(value, "0") === 0;
}

export function isPositiveQty(value: string) {
  return cmpQty(value, "0") > 0;
}
