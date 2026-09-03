import type { SharedDish } from '../shared/types';

/**
 * Draws the menu as a PNG: cream paper, gold rules, Turkish names large with the
 * English underneath, like the card propped on a table at a wedding. Same
 * palette as the rest of the app, dressed up a bit.
 *
 * Canvas rather than an SVG converted to an image, because the result has to go
 * on the clipboard and into a chat message, and a PNG works everywhere.
 */

export interface MenuCardData {
  nightName: string;
  menuName: string;
  dishes: SharedDish[];
  guests: string[];
}

const SCALE = 2; // device pixels per unit, so the card is crisp when pasted
const W = 900;
const MIN_H = 1200;
const PAD = 104; // where text lives, inside the borders

const CREAM = '#fff6e5';
const INK = '#241b16';
const WINE = '#7a1e2c';
const GOLD = '#c9992a'; // the app's gold, darkened enough to read on cream
const MUTED = '#7b6f66';

const display = (px: number) => `400 ${px}px Lobster, 'Brush Script MT', cursive`;
const body = (px: number, weight = 400, italic = false) => `${italic ? 'italic ' : ''}${weight} ${px}px Nunito, system-ui, sans-serif`;

type Block =
  | { kind: 'text'; lines: string[]; font: string; color: string; lineHeight: number; gapBefore: number; tracking?: number }
  | { kind: 'rule'; gapBefore: number; height: number };

function wrap(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number): string[] {
  ctx.font = font;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = words[0];
  for (const w of words.slice(1)) {
    if (ctx.measureText(`${line} ${w}`).width <= maxWidth) line += ` ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  lines.push(line);
  return lines;
}

/** Names run together with dots between, then wrap as one paragraph. */
function joinWrapped(ctx: CanvasRenderingContext2D, names: string[], font: string, maxWidth: number): string[] {
  ctx.font = font;
  const lines: string[] = [];
  let line = '';
  for (const name of names) {
    const next = line ? `${line} · ${name}` : name;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = name;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Longer menus get smaller type, down to a floor where it is still readable. */
function dishSize(n: number) {
  if (n <= 6) return 46;
  if (n <= 9) return 40;
  if (n <= 13) return 34;
  if (n <= 18) return 29;
  return 25;
}

function plan(ctx: CanvasRenderingContext2D, data: MenuCardData): Block[] {
  const inner = W - PAD * 2;
  const blocks: Block[] = [];
  const text = (lines: string[], font: string, color: string, lineHeight: number, gapBefore: number, tracking?: number) =>
    blocks.push({ kind: 'text', lines, font, color, lineHeight, gapBefore, tracking });

  text(['🧿'], body(44), INK, 52, 0);
  text(['MEZE NIGHT'], body(19, 700), WINE, 26, 10, 6);
  text(wrap(ctx, data.nightName, display(66), inner), display(66), INK, 74, 26);
  text(wrap(ctx, data.menuName, body(26, 400, true), inner), body(26, 400, true), MUTED, 34, 12);
  blocks.push({ kind: 'rule', gapBefore: 34, height: 22 });

  const ds = dishSize(data.dishes.length);
  if (data.dishes.length === 0) {
    text(['An empty plate, so far.'], body(26, 400, true), MUTED, 36, 30);
  }
  data.dishes.forEach((dish, i) => {
    const primary = dish.nameTr || dish.name;
    const secondary = dish.nameTr && dish.nameTr !== dish.name ? dish.name : null;
    text(wrap(ctx, primary, display(ds), inner), display(ds), INK, ds * 1.16, i === 0 ? 30 : ds * 0.62);
    if (secondary) text(wrap(ctx, secondary, body(ds * 0.5, 400, true), inner), body(ds * 0.5, 400, true), MUTED, ds * 0.62, 2);
  });

  blocks.push({ kind: 'rule', gapBefore: 40, height: 22 });
  if (data.guests.length > 0) {
    text(['AT THE TABLE'], body(18, 700), WINE, 24, 26, 5);
    text(joinWrapped(ctx, data.guests, body(25, 700), inner), body(25, 700), INK, 34, 14);
  }
  text(['Afiyet olsun'], display(38), WINE, 46, 34);
  return blocks;
}

function drawFrame(ctx: CanvasRenderingContext2D, h: number) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, h);

  // A faint weave, so the paper is not completely flat.
  ctx.save();
  ctx.strokeStyle = 'rgba(122, 30, 44, 0.05)';
  ctx.lineWidth = 1;
  for (let x = -h; x < W + h; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h, h);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  ctx.strokeRect(30, 30, W - 60, h - 60);
  ctx.strokeStyle = 'rgba(122, 30, 44, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(44, 44, W - 88, h - 88);

  ctx.fillStyle = GOLD;
  ctx.font = body(22);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [x, y] of [
    [37, 37],
    [W - 37, 37],
    [37, h - 37],
    [W - 37, h - 37],
  ]) {
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.fillText('◆', x, y + 1);
  }
}

/** A gold rule with a diamond in the middle. */
function drawRule(ctx: CanvasRenderingContext2D, y: number) {
  const half = (W - PAD * 2) / 2;
  const cx = W / 2;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 26, y);
    ctx.lineTo(cx + dir * half, y);
    ctx.stroke();
  }
  ctx.fillStyle = GOLD;
  ctx.font = body(20);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❖', cx, y);
}

/** The webfonts arrive late, and drawing before they do gives us Times. */
async function waitForFonts() {
  const fonts = [display(66), body(25, 700), body(26, 400, true), body(19, 700)];
  await Promise.all(fonts.map((f) => document.fonts.load(f, 'Şerefe Afiyet').catch(() => undefined)));
  await document.fonts.ready;
}

export async function renderMenuCard(data: MenuCardData): Promise<HTMLCanvasElement> {
  await waitForFonts();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const blocks = plan(ctx, data);
  const content = blocks.reduce((h, b) => h + b.gapBefore + (b.kind === 'rule' ? b.height : b.lines.length * b.lineHeight), 0);
  const h = Math.max(MIN_H, Math.ceil(content + PAD * 2));

  canvas.width = W * SCALE;
  canvas.height = h * SCALE;
  ctx.scale(SCALE, SCALE);
  drawFrame(ctx, h);

  // Centre the type in whatever space is left over.
  let y = PAD + Math.max(0, (h - PAD * 2 - content) / 2);
  ctx.textAlign = 'center';
  for (const b of blocks) {
    y += b.gapBefore;
    if (b.kind === 'rule') {
      drawRule(ctx, y + b.height / 2);
      y += b.height;
      continue;
    }
    ctx.font = b.font;
    ctx.fillStyle = b.color;
    ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = b.tracking ? `${b.tracking}px` : '0px';
    for (const line of b.lines) {
      y += b.lineHeight;
      ctx.fillText(line, W / 2, y - b.lineHeight * 0.24);
    }
    ctx.letterSpacing = '0px';
  }
  return canvas;
}

export async function renderMenuCardPng(data: MenuCardData): Promise<Blob> {
  const canvas = await renderMenuCard(data);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not draw the menu'))), 'image/png'));
}

/**
 * A tidy file name, e.g. "kadikoy-yaz-sofrasi-menu.png". Turkish letters are
 * folded rather than dropped, or "Kadıköy" would come out as "kad-k-y".
 */
export function menuFileName(nightName: string) {
  const slug =
    nightName
      .replace(/[\u0131\u0130]/g, 'i')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'meze';
  return `${slug}-menu.png`;
}
