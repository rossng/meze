import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Meze, NightState } from '../../shared/types';
import { api } from '../api';
import { useCatalogue } from '../catalogue';
import { needles } from '../lexicon';
import { useStore } from '../store';
import { useToast } from '../toast';
import { MezeDetail, MezeMeta, Modal, Photo, TagChip, fold, tagIndex, useDebounced } from '../ui';

/** A meze matches when, for every facet with a selection, it has at least one selected tag (OR within a facet, AND across facets). */
function matches(meze: Meze, selected: Map<string, Set<string>>) {
  for (const [, tags] of selected) {
    if (tags.size === 0) continue;
    let hit = false;
    for (const t of tags) if (meze.tagIds.includes(t)) hit = true;
    if (!hit) return false;
  }
  return true;
}

export function Explore() {
  const { catalogue, error } = useCatalogue();
  const { active } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const query = useDebounced(q, 120);
  const [selected, setSelected] = useState<Map<string, Set<string>>>(new Map());
  const [openFacets, setOpenFacets] = useState<Set<string>>(new Set());
  const [night, setNight] = useState<NightState | null>(null);
  const [detail, setDetail] = useState<Meze | null>(null);
  const [surprise, setSurprise] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return setNight(null);
    api.night(active).then(setNight, () => setNight(null));
  }, [active]);

  const tags = useMemo(() => (catalogue ? tagIndex(catalogue) : new Map()), [catalogue]);

  const results = useMemo(() => {
    if (!catalogue) return [];
    // Ingredients are searched in both languages: "patlıcan" and "aubergine" find the same dishes.
    const terms = needles(query);
    return catalogue.mezes.filter((m) => {
      if (!matches(m, selected)) return false;
      if (terms.length === 0) return true;
      const hay = fold(
        [
          m.name,
          m.nameTr ?? '',
          m.description,
          ...m.tagIds.map((t) => tags.get(t)?.label ?? ''),
          ...m.ingredients.map((i) => `${i.item} ${i.note ?? ''}`),
        ].join(' '),
      );
      return terms.some((t) => hay.includes(t));
    });
  }, [catalogue, query, selected, tags]);

  function toggleTag(typeId: string, tagId: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(typeId) ?? []);
      if (set.has(tagId)) set.delete(tagId);
      else set.add(tagId);
      next.set(typeId, set);
      return next;
    });
  }

  function toggleFacet(id: string) {
    setOpenFacets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCount = [...selected.values()].reduce((n, s) => n + s.size, 0);
  const onTable = new Set(night?.options.map((o) => o.mezeId) ?? []);

  async function addToNight(meze: Meze) {
    if (!active || !night) return;
    try {
      await api.addOptions(active, [meze.id]);
      setNight({ ...night, options: [...night.options, { mezeId: meze.id, addedBy: null, addedAt: '', votes: [] }] });
      toast(`${meze.name} is on the table!`);
    } catch (e) {
      toast(`Couldn't add it: ${(e as Error).message}`, 'error');
    }
  }

  function surpriseMe() {
    if (results.length === 0) return;
    const pick = results[Math.floor(Math.random() * results.length)];
    setSurprise(pick.id);
    setDetail(pick);
  }

  if (error) return <div class="card error">The kitchen is closed: {error}</div>;
  if (!catalogue) return <div class="loading">Warming the pide…</div>;

  return (
    <div class="explore">
      <header class="page-head">
        <h1>The Meze Menu</h1>
        <p class="muted">
          {catalogue.mezes.length} dishes on the board.{' '}
          {night ? (
            <>
              Adding to <a href={`/n/${night.night.code}`}>{night.night.name}</a>.
            </>
          ) : (
            <>Open or join a table to start adding dishes.</>
          )}
        </p>
      </header>

      <div class="explore-tools">
        <input class="search" type="search" placeholder="Search: aubergine, patlıcan, spicy, Antep…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <button class="btn btn-ghost" type="button" onClick={surpriseMe} title="Let the garson choose">
          🎲 Garson's choice
        </button>
        {selectedCount > 0 && (
          <button class="btn btn-ghost" type="button" onClick={() => setSelected(new Map())}>
            ✕ Clear {selectedCount} filter{selectedCount === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <div class="facets">
        {catalogue.tagTypes.map((type) => {
          const sel = selected.get(type.id) ?? new Set<string>();
          const open = openFacets.has(type.id) || sel.size > 0;
          return (
            <div key={type.id} class={`facet ${open ? 'facet-open' : ''}`}>
              <button class="facet-head" type="button" onClick={() => toggleFacet(type.id)} aria-expanded={open}>
                <span>
                  {type.emoji} {type.label}
                </span>
                {sel.size > 0 ? <span class="badge">{sel.size}</span> : <span class="facet-caret">▾</span>}
              </button>
              {open && (
                <div class="facet-tags">
                  {type.tags.map((t) => (
                    <TagChip key={t.id} tag={t} active={sel.has(t.id)} onClick={() => toggleTag(type.id, t.id)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {results.length === 0 ? (
        <div class="empty">Nothing matches. Even the garson is stumped. Loosen a filter?</div>
      ) : (
        <div class="meze-grid">
          {results.map((m) => (
            <article key={m.id} class={`meze-card ${surprise === m.id ? 'meze-surprise' : ''}`}>
              <button class="meze-photo-btn" type="button" onClick={() => setDetail(m)} aria-label={`About ${m.name}`}>
                <Photo meze={m} />
              </button>
              <div class="meze-body">
                <h3>
                  {m.name}
                  {m.nameTr && m.nameTr !== m.name && <span class="name-tr">{m.nameTr}</span>}
                </h3>
                <p class="meze-desc">{m.description}</p>
                <MezeMeta meze={m} />
                <div class="chips">
                  {m.tagIds.slice(0, 6).map((id) => {
                    const t = tags.get(id);
                    return t ? <TagChip key={id} tag={t} /> : null;
                  })}
                </div>
                <div class="meze-actions">
                  {m.recipeUrl && (
                    <a class="btn btn-small btn-ghost" href={m.recipeUrl} target="_blank" rel="noopener">
                      📖 Recipe{m.recipeSource ? ` · ${m.recipeSource}` : ''}
                    </a>
                  )}
                  {night &&
                    (onTable.has(m.id) ? (
                      <span class="on-table">✓ On the table</span>
                    ) : (
                      <button class="btn btn-small btn-primary" type="button" onClick={() => addToNight(m)}>
                        + Add to table
                      </button>
                    ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <MezeDetail
            meze={detail}
            catalogue={catalogue}
            onPick={setDetail}
            actions={
              night &&
              (onTable.has(detail.id) ? (
                <span class="on-table">✓ On the table</span>
              ) : (
                <button class="btn btn-primary" type="button" onClick={() => addToNight(detail)}>
                  + Add to table
                </button>
              ))
            }
          />
        </Modal>
      )}
    </div>
  );
}
