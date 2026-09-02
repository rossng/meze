import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Catalogue, Ingredient, Member, Meze, Tag, Vote, VoteValue } from '../shared/types';
import { qrMatrix } from './qr';

// --- catalogue helpers --------------------------------------------------------

export function tagIndex(cat: Catalogue) {
  const byId = new Map<string, Tag>();
  for (const t of cat.tagTypes) for (const tag of t.tags) byId.set(tag.id, tag);
  return byId;
}

export function score(votes: Vote[]) {
  return votes.reduce((s, v) => s + v.value, 0);
}

/** Lowercase and strip Turkish diacritics so a search for "sigara boregi" finds "sigara böreği". */
export function fold(s: string) {
  return s
    .replace(/\u0131/g, 'i')
    .replace(/\u0130/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function initials(name: string) {
  const n = name.trim();
  if (!n) return '?';
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

const AVATAR_COLOURS = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8e7dbe', '#ff7b9c', '#4cc9f0', '#80b918', '#f77f00', '#c77dff'];
export function avatarColour(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

// --- small components ---------------------------------------------------------

export function Avatar({ member, online, size = 'sm' }: { member: Member | undefined; online?: boolean; size?: 'sm' | 'md' }) {
  const name = member?.displayName || 'Mystery guest';
  return (
    <span class={`avatar avatar-${size} ${online ? 'online' : ''}`} style={{ background: avatarColour(member?.userId ?? 'x') }} title={name}>
      {initials(member?.displayName || '?')}
    </span>
  );
}

export function TagChip({ tag, active, onClick }: { tag: Tag; active?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag class={`chip ${active ? 'chip-active' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      {tag.emoji ? <span class="chip-emoji">{tag.emoji}</span> : null}
      {tag.label}
    </Tag>
  );
}

const VOTE_META: Record<VoteValue, { emoji: string; label: string; cls: string }> = {
  2: { emoji: '👍👍', label: 'Must have', cls: 'vote-strong' },
  1: { emoji: '👍', label: 'Yes please', cls: 'vote-for' },
  [-1]: { emoji: '👎', label: 'Not for me', cls: 'vote-against' },
};

export function VoteButtons({ mine, onVote, compact }: { mine: VoteValue | null; onVote: (v: VoteValue | null) => void; compact?: boolean }) {
  const order: VoteValue[] = [2, 1, -1];
  return (
    <div class={`votes ${compact ? 'votes-compact' : ''}`} role="group" aria-label="Vote">
      {order.map((v) => {
        const m = VOTE_META[v];
        const active = mine === v;
        return (
          <button
            key={v}
            type="button"
            class={`vote ${m.cls} ${active ? 'vote-active' : ''}`}
            title={m.label}
            aria-pressed={active}
            onClick={() => onVote(active ? null : v)}
          >
            <span class="vote-emoji">{m.emoji}</span>
            {!compact && <span class="vote-label">{m.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function VoterRow({ votes, members, online }: { votes: Vote[]; members: Member[]; online: Set<string> }) {
  if (votes.length === 0) return <div class="voters voters-empty">No votes yet. Be the first!</div>;
  const byUser = new Map(members.map((m) => [m.userId, m]));
  const groups: { v: VoteValue; votes: Vote[] }[] = ([2, 1, -1] as VoteValue[]).map((v) => ({ v, votes: votes.filter((x) => x.value === v) })).filter((g) => g.votes.length);
  return (
    <div class="voters">
      {groups.map((g) => (
        <span key={g.v} class="voter-group">
          <span class="voter-emoji">{VOTE_META[g.v].emoji}</span>
          {g.votes.map((vote) => (
            <Avatar key={vote.userId} member={byUser.get(vote.userId)} online={online.has(vote.userId)} />
          ))}
        </span>
      ))}
    </div>
  );
}

export function Score({ votes }: { votes: Vote[] }) {
  const s = score(votes);
  return (
    <span class={`score ${s > 0 ? 'score-pos' : s < 0 ? 'score-neg' : ''}`} title="Total score: must-have +2, yes +1, no −1">
      {s > 0 ? `+${s}` : s}
    </span>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ComponentChildren; onClose?: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div class="modal-head">
          <h2>{title}</h2>
          {onClose && (
            <button class="icon-btn" type="button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Renders a QR matrix as one SVG path, so it stays crisp at any size. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const modules = useMemo(() => qrMatrix(text), [text]);
  const n = modules.length;
  const d = modules
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')))
    .join('');
  return (
    <svg class="qr" viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={label} shape-rendering="crispEdges">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff6e5" />
      <path d={d} fill="#10192e" />
    </svg>
  );
}

export function MezeMeta({ meze }: { meze: Meze }) {
  return (
    <div class="meze-meta">
      {meze.prepMinutes != null && <span title="Time to make">⏱ {meze.prepMinutes} min</span>}
      {meze.ingredientCount != null && <span title="Number of ingredients">🧺 {meze.ingredientCount} ingredients</span>}
    </div>
  );
}

/**
 * Meze photo. Uses the crushed thumbnail/full pair with srcset so cards load
 * fast; falls back to generated SVG plate art when there is no photo (custom
 * dishes, or catalogue entries we couldn't find a free photo for).
 */
export function Photo({ meze, class: cls, size = 'card' }: { meze: Meze; class?: string; size?: 'card' | 'large' | 'tiny' }) {
  const [failed, setFailed] = useState(false);
  if (!meze.photoUrl || failed) return <PlateArt meze={meze} class={cls} />;
  const thumb = meze.photoThumbUrl ?? meze.photoUrl;
  const src = size === 'tiny' ? thumb : size === 'large' ? meze.photoUrl : thumb;
  const srcset = meze.photoThumbUrl && size !== 'tiny' ? `${meze.photoThumbUrl} 320w, ${meze.photoUrl} 800w` : undefined;
  const sizes = size === 'large' ? '(max-width: 640px) 100vw, 560px' : '(max-width: 640px) 100vw, 320px';
  return (
    <img
      class={`photo ${cls ?? ''}`}
      src={src}
      srcset={srcset}
      sizes={srcset ? sizes : undefined}
      alt={meze.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

const ART_PALETTE = [
  ['#f2c14e', '#7a1e2c'], ['#2a9d8f', '#f2c14e'], ['#e76f51', '#264653'], ['#8e7dbe', '#ffe08a'],
  ['#d7263d', '#fff6e5'], ['#1f8a8a', '#fff6e5'], ['#f4a261', '#10192e'], ['#80b918', '#7a1e2c'],
];

/** Generated illustration: a plate on a checked cloth with the meze's emoji. */
export function PlateArt({ meze, class: cls }: { meze: Meze; class?: string }) {
  let h = 0;
  for (let i = 0; i < meze.id.length; i++) h = (h * 31 + meze.id.charCodeAt(i)) >>> 0;
  const [cloth, accent] = ART_PALETTE[h % ART_PALETTE.length];
  const emoji = meze.artEmoji || '🍽️';
  const pid = `cloth-${h}`;
  return (
    <svg class={`photo photo-art ${cls ?? ''}`} viewBox="0 0 400 300" role="img" aria-label={`${meze.name} (illustration)`}>
      <defs>
        <pattern id={pid} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill={cloth} />
          <rect width="20" height="20" fill="rgba(255,255,255,0.28)" />
          <rect x="20" y="20" width="20" height="20" fill="rgba(255,255,255,0.28)" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill={`url(#${pid})`} />
      <ellipse cx="200" cy="165" rx="150" ry="118" fill="rgba(0,0,0,0.18)" />
      <ellipse cx="200" cy="155" rx="150" ry="118" fill="#fff6e5" />
      <ellipse cx="200" cy="155" rx="150" ry="118" fill="none" stroke={accent} stroke-width="6" />
      <ellipse cx="200" cy="155" rx="112" ry="86" fill="none" stroke={accent} stroke-width="2" stroke-dasharray="6 8" opacity="0.7" />
      <text x="200" y="185" text-anchor="middle" font-size="96">
        {emoji}
      </text>
      <text x="200" y="278" text-anchor="middle" font-family="Lobster, cursive" font-size="22" fill="#fff6e5" stroke="rgba(0,0,0,0.35)" stroke-width="3" paint-order="stroke">
        {meze.nameTr ?? meze.name}
      </text>
    </svg>
  );
}

// --- ingredients & shopping ---------------------------------------------------

/** Round a scaled quantity to something a shopper can read. */
export function formatQty(q: number) {
  if (q >= 100) return String(Math.round(q / 10) * 10);
  if (q >= 10) return String(Math.round(q));
  if (q >= 2) return String(Math.round(q * 2) / 2);
  const quarter = Math.max(0.25, Math.round(q * 4) / 4);
  const whole = Math.floor(quarter);
  const frac = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' }[quarter - whole] ?? '';
  return `${whole || ''}${frac}` || '1';
}

export function scaleIngredient(ing: Ingredient, factor: number) {
  return ing.quantity == null ? ing : { ...ing, quantity: ing.quantity * factor };
}

export function ingredientLine(ing: Ingredient) {
  const qty = ing.quantity == null ? '' : formatQty(ing.quantity);
  const unit = ing.unit ? (ing.unit === 'clove' && (ing.quantity ?? 1) > 1 ? 'cloves' : ing.unit) : '';
  const head = [qty, unit].filter(Boolean).join(ing.unit && ['g', 'ml', 'kg', 'l'].includes(ing.unit) ? '' : ' ');
  return `${head ? head + ' ' : ''}${ing.item}${ing.note ? ` (${ing.note})` : ''}`;
}

export function IngredientList({ meze, people }: { meze: Meze; people?: number }) {
  if (meze.ingredients.length === 0) return <p class="muted small">No ingredient list for this one. Check the recipe.</p>;
  const factor = people && meze.serves ? people / meze.serves : 1;
  return (
    <ul class="ingredients">
      {meze.ingredients.map((ing, i) => (
        <li key={i}>{ingredientLine(scaleIngredient(ing, factor))}</li>
      ))}
    </ul>
  );
}

// --- similar mezes ----------------------------------------------------------

const FACET_WEIGHT: Record<string, number> = { main: 3, theme: 2, temp: 1.5, origin: 1, dietary: 0.5, complexity: 0.5, time: 0.5, ingredients: 0.25 };

/** Weighted tag overlap; main ingredient and theme count most. */
export function similarMezes(meze: Meze, all: Meze[], n = 4) {
  const facet = (id: string) => id.split(':')[0];
  const mine = new Set(meze.tagIds);
  return all
    .filter((m) => m.id !== meze.id && !m.nightId)
    .map((m) => {
      let score = 0;
      for (const t of m.tagIds) if (mine.has(t)) score += FACET_WEIGHT[facet(t)] ?? 0.5;
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.m);
}

/**
 * The full meze detail, shared by Explore and Night. `actions` renders beside
 * the recipe link; `onPick` swaps the dialog to a similar meze.
 */
export function MezeDetail({
  meze,
  catalogue,
  onPick,
  actions,
}: {
  meze: Meze;
  catalogue: Catalogue;
  onPick?: (m: Meze) => void;
  actions?: ComponentChildren;
}) {
  const tags = tagIndex(catalogue);
  const similar = onPick ? similarMezes(meze, catalogue.mezes) : [];
  return (
    <div class="detail">
      <Photo meze={meze} class="photo-large" size="large" />
      {meze.nameTr && meze.nameTr !== meze.name && <p class="name-tr">{meze.nameTr}</p>}
      {meze.nightId && <p class="muted small">A custom dish for this table only.</p>}
      {meze.description && <p>{meze.description}</p>}
      <MezeMeta meze={meze} />
      {meze.tagIds.length > 0 && (
        <div class="chips">
          {meze.tagIds.map((id) => {
            const t = tags.get(id);
            return t ? <TagChip key={id} tag={t} /> : null;
          })}
        </div>
      )}
      {meze.ingredients.length > 0 && (
        <details class="detail-ingredients">
          <summary>
            🧺 Ingredients {meze.serves ? <span class="muted small">· serves {meze.serves} as a meze</span> : null}
          </summary>
          <IngredientList meze={meze} />
          <p class="muted small">Rough amounts; the recipe is the boss.</p>
        </details>
      )}
      {meze.photoCredit && <p class="credit">Photo: {meze.photoCredit}</p>}
      <div class="modal-actions">
        {meze.recipeUrl ? (
          <a class="btn btn-ghost" href={meze.recipeUrl} target="_blank" rel="noopener">
            📖 Recipe{meze.recipeSource ? ` on ${meze.recipeSource}` : ''}
          </a>
        ) : (
          <span />
        )}
        {actions}
      </div>
      {similar.length > 0 && (
        <div class="similar">
          <h3>If you like this, try…</h3>
          <div class="similar-row">
            {similar.map((m) => (
              <button key={m.id} type="button" class="similar-card" onClick={() => onPick?.(m)}>
                <Photo meze={m} size="tiny" class="photo-tiny" />
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}
