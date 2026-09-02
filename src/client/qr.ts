/**
 * A very small QR encoder: byte mode, error correction level L, versions 1–5.
 *
 * That is deliberately the narrow slice of the spec we need. Our payload is a
 * link of ~50 characters, and versions 1–5 at level L are exactly the versions
 * that use a single error-correction block and no version-information area, so
 * there is no block interleaving and no BCH(18,6) here — just data, one Reed–
 * Solomon remainder, and the module layout. Level L is fine for a code that is
 * being read off a bright screen from 30cm away.
 *
 * Returns a square matrix of booleans (true = dark), quiet zone not included.
 */

/** Data codewords available in versions 1–5 at level L, and the EC codewords they carry. */
const VERSIONS = [
  { version: 1, data: 19, ec: 7 },
  { version: 2, data: 34, ec: 10 },
  { version: 3, data: 55, ec: 15 },
  { version: 4, data: 80, ec: 20 },
  { version: 5, data: 108, ec: 26 },
];

// --- GF(256) arithmetic, the field QR uses (primitive polynomial 0x11d) ------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** The generator polynomial for `degree` error-correction codewords. */
function generator(degree: number): number[] {
  let poly = [1];
  for (let d = 0; d < degree; d++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let i = 0; i < poly.length; i++) {
      next[i] ^= poly[i]; // the x term
      next[i + 1] ^= mul(poly[i], EXP[d]);
    }
    poly = next;
  }
  return poly;
}

/** Polynomial long division; the remainder is the error-correction block. */
function remainder(data: number[], degree: number): number[] {
  const gen = generator(degree);
  const rem = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift();
    rem.push(0);
    if (factor !== 0) for (let i = 0; i < degree; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

// --- module layout ----------------------------------------------------------

type Grid = { m: (boolean | null)[][]; reserved: boolean[][]; size: number };

function newGrid(size: number): Grid {
  return {
    size,
    m: Array.from({ length: size }, () => new Array<boolean | null>(size).fill(null)),
    reserved: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  };
}

function place(g: Grid, x: number, y: number, dark: boolean) {
  g.m[y][x] = dark;
  g.reserved[y][x] = true;
}

function finder(g: Grid, ox: number, oy: number) {
  // The 7x7 eye plus its one-module light separator.
  for (let y = -1; y <= 7; y++) {
    for (let x = -1; x <= 7; x++) {
      const px = ox + x;
      const py = oy + y;
      if (px < 0 || py < 0 || px >= g.size || py >= g.size) continue;
      const ring = x >= 0 && x <= 6 && y >= 0 && y <= 6;
      const edge = x === 0 || x === 6 || y === 0 || y === 6;
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      place(g, px, py, ring && (edge || core));
    }
  }
}

function alignment(g: Grid, version: number) {
  if (version < 2) return; // version 1 has none
  // Versions 2–6 have exactly one, centred at (4v+10, 4v+10).
  const c = 4 * version + 10;
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      place(g, c + x, c + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
    }
  }
}

function timingAndReserved(g: Grid) {
  for (let i = 8; i < g.size - 8; i++) {
    place(g, i, 6, i % 2 === 0);
    place(g, 6, i, i % 2 === 0);
  }
  place(g, 8, g.size - 8, true); // the lone dark module
  // Reserve the two format-information strips; they are filled in after masking.
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      g.reserved[8][i] = true;
      g.reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    g.reserved[8][g.size - 1 - i] = true;
    g.reserved[g.size - 1 - i][8] = true;
  }
}

/** Walk the zigzag of two-module columns from the bottom right, laying out the bit stream. */
function layout(g: Grid, bits: number[]) {
  let i = 0;
  let upward = true;
  for (let right = g.size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // the vertical timing column is not a data column
    for (let step = 0; step < g.size; step++) {
      const y = upward ? g.size - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (g.reserved[y][x]) continue;
        g.m[y][x] = i < bits.length ? bits[i] === 1 : false;
        i++;
      }
    }
    upward = !upward;
  }
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Format information: 5 data bits (EC level + mask) with a BCH(15,5) tail. */
function formatBits(mask: number): number[] {
  const data = (0b01 << 3) | mask; // 0b01 = level L
  let rem = data << 10;
  for (let i = 4; i >= 0; i--) if (rem & (1 << (i + 10))) rem ^= 0x537 << i;
  const bits = ((data << 10) | rem) ^ 0x5412;
  return Array.from({ length: 15 }, (_, i) => (bits >> (14 - i)) & 1);
}

function applyFormat(m: boolean[][], mask: number) {
  const size = m.length;
  const f = formatBits(mask).map((b) => b === 1);
  // Copy one: along the top-left eye, reading down the column then along the row.
  for (let i = 0; i <= 5; i++) m[8][i] = f[i];
  m[8][7] = f[6];
  m[8][8] = f[7];
  m[7][8] = f[8];
  for (let i = 9; i < 15; i++) m[14 - i][8] = f[i];
  // Copy two: seven modules up from the bottom-left eye, then eight leftwards
  // from the right edge. The module just above them stays permanently dark.
  for (let i = 0; i < 7; i++) m[size - 1 - i][8] = f[i];
  for (let i = 7; i < 15; i++) m[8][size - 15 + i] = f[i];
}

/**
 * The spec's four penalty rules — long runs, solid blocks, finder-like
 * sequences and an unbalanced light/dark ratio. The mask with the lowest total
 * wins. Implementations differ slightly here (rule 3 is used in its common
 * simplified form, without the surrounding light-run test) and disagree about
 * which mask is best; any of the eight produces a readable code.
 */
function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;

  const line = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      let run = 1;
      for (let j = 1; j < n; j++) {
        if (get(i, j) === get(i, j - 1)) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score++;
        } else run = 1;
      }
    }
  };
  line((i, j) => m[i][j]);
  line((i, j) => m[j][i]);

  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++) {
      const v = m[y][x];
      if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) score += 3;
    }

  // The finder-like 1:1:3:1:1 sequence, which a scanner could mistake for an eye.
  const PATTERN = [true, false, true, true, true, false, true];
  const scanLine = (cells: boolean[]) => {
    for (let i = 0; i + 7 <= cells.length; i++) if (PATTERN.every((p, k) => cells[i + k] === p)) score += 40;
  };
  for (let i = 0; i < n; i++) {
    scanLine(m[i]);
    scanLine(m.map((row) => row[i]));
  }

  const dark = m.flat().filter(Boolean).length;
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

// --- entry point ------------------------------------------------------------

export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec = VERSIONS.find((v) => bytes.length + 2 <= v.data); // 4 mode bits + 8 length bits
  if (!spec) throw new Error(`${bytes.length} bytes is too long for this encoder`);

  const bits: number[] = [];
  const push = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // count field is 8 bits wide for versions 1–9
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, spec.data * 8 - bits.length)); // terminator
  while (bits.length % 8) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let i = 0; codewords.length < spec.data; i++) codewords.push(i % 2 === 0 ? 0xec : 0x11); // pad

  const all = [...codewords, ...remainder(codewords, spec.ec)];
  const stream: number[] = [];
  for (const cw of all) for (let i = 7; i >= 0; i--) stream.push((cw >> i) & 1);

  const size = 17 + 4 * spec.version;
  const g = newGrid(size);
  finder(g, 0, 0);
  finder(g, size - 7, 0);
  finder(g, 0, size - 7);
  alignment(g, spec.version);
  timingAndReserved(g);
  layout(g, stream);

  const base = g.m.map((row) => row.map((v) => v === true));
  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row, y) => row.map((v, x) => (g.reserved[y][x] ? v : v !== MASKS[mask](x, y))));
    applyFormat(candidate, mask);
    const s = penalty(candidate);
    if (s < bestScore) {
      bestScore = s;
      best = candidate;
    }
  }
  return best!;
}
