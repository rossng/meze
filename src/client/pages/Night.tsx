import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Catalogue, Menu, Meze, NightOption, NightState, VoteValue } from '../../shared/types';
import { api, ApiError, getUserId } from '../api';
import { useCatalogue } from '../catalogue';
import { connectRoom } from '../live';
import { PairDeviceButton } from '../pair';
import { navigate } from '../router';
import { rememberNight, setActiveNight } from '../store';
import { useToast } from '../toast';
import { ShoppingList } from '../shopping';
import { Avatar, MezeDetail, Modal, Photo, Score, VoteButtons, VoterRow, score } from '../ui';

type Tab = 'table' | 'menus' | 'guests';

const CHEERS = ['Şerefe! 🥂', 'Afiyet olsun! 🍆', 'More rakı! 🥃', 'Garson! Another plate! 🍽️', 'Hadi bakalım! 💃', 'Ellerine sağlık! 👏'];

export function Night({ code }: { code: string }) {
  const { catalogue } = useCatalogue();
  const toast = useToast();
  const [state, setState] = useState<NightState | null>(null);
  const [missing, setMissing] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState<Tab>('table');
  const [nameDraft, setNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const roomRef = useRef<ReturnType<typeof connectRoom> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.night(code);
      setState(s);
      rememberNight({ code, name: s.night.name });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
    }
  }, [code]);

  useEffect(() => {
    setActiveNight(code);
    refresh();
    const room = connectRoom(
      code,
      (m) => {
        if (m.type === 'refresh') refresh();
        else if (m.type === 'presence') setOnline(new Set(m.userIds));
        else if (m.type === 'toast') toast(m.text, 'cheers');
      },
      setConnected,
    );
    roomRef.current = room;
    return () => room.close();
  }, [code, refresh]);

  const mezeById = useMemo(() => new Map([...(catalogue?.mezes ?? []), ...(state?.customMezes ?? [])].map((m) => [m.id, m])), [catalogue, state?.customMezes]);
  const memberById = useMemo(() => new Map((state?.members ?? []).map((m) => [m.userId, m])), [state]);

  if (missing)
    return (
      <div class="card error">
        <h2>No such table</h2>
        <p>That code doesn't match any meze night. Check the link, or <a href="/">open a new one</a>.</p>
      </div>
    );
  if (!state || !catalogue) return <div class="loading">Finding your table…</div>;

  const me = state.me;
  const needsJoin = !me.isMember;
  const needsName = me.isMember && !me.displayName;

  async function join(e: Event) {
    e.preventDefault();
    try {
      const s = await api.join(code, nameDraft);
      setState(s);
      rememberNight({ code, name: s.night.name });
      toast(`Welcome to the table, ${nameDraft || 'friend'}!`, 'cheers');
    } catch (err) {
      toast(`Couldn't join: ${(err as Error).message}`, 'error');
    }
  }

  async function saveName(e: Event) {
    e.preventDefault();
    const n = nameDraft.trim();
    if (!n) return;
    await api.rename(code, n).catch((err) => toast(err.message, 'error'));
    setEditingName(false);
    refresh();
  }

  function copyLink() {
    const url = `${location.origin}/n/${code}`;
    navigator.clipboard?.writeText(url).then(
      () => toast('Invite link copied. Send it to the hungry.'),
      () => toast(url),
    );
  }

  function cheers() {
    const text = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    const from = me.displayName ? `${me.displayName}: ` : '';
    api.cheers(code, from + text).catch(() => {});
  }

  const optionsSorted = [...state.options].sort((a, b) => score(b.votes) - score(a.votes) || a.addedAt.localeCompare(b.addedAt));
  const chosen = state.menus.find((m) => m.id === state.night.chosenMenuId) ?? null;

  return (
    <div class="night">
      {(needsJoin || needsName) && (
        <Modal title={needsJoin ? `Join "${state.night.name}"` : 'What shall we call you?'}>
          <form onSubmit={join} class="stack">
            <p class="muted">
              {needsJoin ? `${state.members.length} guest${state.members.length === 1 ? '' : 's'} at the table so far.` : 'Your friends need to know whose thumbs are whose.'}
            </p>
            <label>
              <span>Your name</span>
              <input autoFocus value={nameDraft} onInput={(e) => setNameDraft((e.target as HTMLInputElement).value)} placeholder="Ayşe, Mehmet, The Aubergine Whisperer…" maxLength={40} />
            </label>
            <button class="btn btn-primary" type="submit">
              {needsJoin ? 'Pull up a chair' : "That's me"}
            </button>
          </form>
        </Modal>
      )}

      <header class="night-head">
        <div class="night-title">
          <NightName state={state} code={code} onSaved={refresh} />
          <div class="night-sub">
            <span class={`live-dot ${connected ? 'live-on' : ''}`} title={connected ? 'Live' : 'Reconnecting…'} />
            <span class="muted">
              code <b class="code">{code}</b>
            </span>
            <button class="btn btn-small btn-ghost" type="button" onClick={copyLink}>
              🔗 Copy invite link
            </button>
            <PairDeviceButton />
            <button class="btn btn-small btn-cheers" type="button" onClick={cheers}>
              🥃 Şerefe!
            </button>
          </div>
        </div>
        <div class="night-me">
          {editingName ? (
            <form onSubmit={saveName} class="inline-form">
              <input autoFocus value={nameDraft} onInput={(e) => setNameDraft((e.target as HTMLInputElement).value)} maxLength={40} />
              <button class="btn btn-small btn-primary" type="submit">
                Save
              </button>
              <button class="btn btn-small btn-ghost" type="button" onClick={() => setEditingName(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button
              class="me-chip"
              type="button"
              onClick={() => {
                setNameDraft(me.displayName);
                setEditingName(true);
              }}
              title="Change your name at this table"
            >
              <Avatar member={memberById.get(me.userId)} online size="md" />
              <span>
                {me.displayName || 'Name yourself'}
                {me.isCreator && <span class="host-badge">host</span>}
              </span>
              <span class="muted">✎</span>
            </button>
          )}
        </div>
      </header>

      {chosen && (
        <div class="chosen-banner">
          <span class="crown">👑</span>
          <div>
            <b>Tonight we're eating: {chosen.name}</b>
            <div class="chosen-items">{chosen.mezeIds.map((id) => mezeById.get(id)?.name ?? '?').join(' · ')}</div>
          </div>
        </div>
      )}

      <nav class="tabs" role="tablist">
        <button class={tab === 'table' ? 'tab tab-active' : 'tab'} role="tab" aria-selected={tab === 'table'} onClick={() => setTab('table')}>
          🍆 The table <span class="badge">{state.options.length}</span>
        </button>
        <button class={tab === 'menus' ? 'tab tab-active' : 'tab'} role="tab" aria-selected={tab === 'menus'} onClick={() => setTab('menus')}>
          📜 Menus <span class="badge">{state.menus.length}</span>
        </button>
        <button class={tab === 'guests' ? 'tab tab-active' : 'tab'} role="tab" aria-selected={tab === 'guests'} onClick={() => setTab('guests')}>
          🪑 Guests <span class="badge">{state.members.length}</span>
        </button>
      </nav>

      {tab === 'table' && <TableTab code={code} state={state} options={optionsSorted} mezeById={mezeById} catalogue={catalogue} online={online} toast={toast} />}
      {tab === 'menus' && <MenusTab code={code} state={state} options={optionsSorted} mezeById={mezeById} online={online} toast={toast} refresh={refresh} />}
      {tab === 'guests' && <GuestsTab code={code} state={state} online={online} toast={toast} />}
    </div>
  );
}

function NightName({ state, code, onSaved }: { state: NightState; code: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.night.name);
  const toast = useToast();
  if (!state.me.isCreator) return <h1>{state.night.name}</h1>;
  if (!editing)
    return (
      <h1>
        <button
          class="title-btn"
          type="button"
          title="Rename this night"
          onClick={() => {
            setDraft(state.night.name);
            setEditing(true);
          }}
        >
          {state.night.name} <span class="muted small">✎</span>
        </button>
      </h1>
    );
  return (
    <form
      class="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        await api.renameNight(code, draft).catch((err) => toast(err.message, 'error'));
        setEditing(false);
        onSaved();
      }}
    >
      <input class="title-input" autoFocus value={draft} onInput={(e) => setDraft((e.target as HTMLInputElement).value)} maxLength={80} />
      <button class="btn btn-small btn-primary" type="submit">
        Save
      </button>
      <button class="btn btn-small btn-ghost" type="button" onClick={() => setEditing(false)}>
        Cancel
      </button>
    </form>
  );
}

// --- The table: options & votes ----------------------------------------------

function TableTab({
  code,
  state,
  options,
  mezeById,
  catalogue,
  online,
  toast,
}: {
  code: string;
  state: NightState;
  options: NightOption[];
  mezeById: Map<string, Meze>;
  catalogue: Catalogue;
  online: Set<string>;
  toast: (t: string, k?: 'info' | 'error' | 'cheers') => void;
}) {
  const [detail, setDetail] = useState<Meze | null>(null);
  const [customName, setCustomName] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const myId = getUserId();
  const onTable = new Set(options.map((o) => o.mezeId));

  async function addCustom(e: Event) {
    e.preventDefault();
    const name = customName.trim();
    if (name.length < 2) return;
    try {
      await api.addCustom(code, name);
      toast(`${name} is on the table. Chef's special!`);
      setCustomName('');
      setAddingCustom(false);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }
  async function addFromCatalogue(meze: Meze) {
    try {
      await api.addOptions(code, [meze.id]);
      toast(`${meze.name} is on the table!`);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const customForm = (
    <form class="custom-form" onSubmit={addCustom}>
      <input
        autoFocus
        value={customName}
        onInput={(e) => setCustomName((e.target as HTMLInputElement).value)}
        placeholder="Grandma's secret börek…"
        maxLength={50}
        aria-label="Custom dish name"
      />
      <button class="btn btn-small btn-primary" type="submit" disabled={customName.trim().length < 2}>
        Add
      </button>
      <button class="btn btn-small btn-ghost" type="button" onClick={() => setAddingCustom(false)}>
        Cancel
      </button>
    </form>
  );

  async function vote(mezeId: string, value: VoteValue | null) {
    try {
      await api.voteOption(code, mezeId, value);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function remove(meze: Meze) {
    if (!confirm(`Take ${meze.name} off the table? Any votes on it go too.`)) return;
    await api.removeOption(code, meze.id).catch((e) => toast(e.message, 'error'));
  }

  if (options.length === 0)
    return (
      <div class="empty card">
        <p>The table is bare! Somebody call the garson.</p>
        <div class="empty-actions">
          <a class="btn btn-primary" href="/mezes">
            🍆 Browse the meze and add some
          </a>
          {addingCustom ? customForm : (
            <button class="btn btn-ghost" type="button" onClick={() => setAddingCustom(true)}>
              ✍️ Add your own dish
            </button>
          )}
        </div>
      </div>
    );

  return (
    <div class="table-tab">
      <div class="tab-tools">
        <p class="muted">Vote with your thumbs. 👍👍 must have · 👍 yes please · 👎 not for me. Everyone sees everything, live.</p>
        <div class="tab-tools-actions">
          <a class="btn btn-ghost btn-small" href="/mezes">
            + Add more meze
          </a>
          {addingCustom ? customForm : (
            <button class="btn btn-ghost btn-small" type="button" onClick={() => setAddingCustom(true)} title="A dish that isn't in the catalogue, for this table only">
              ✍️ Your own dish
            </button>
          )}
        </div>
      </div>
      <ol class="options">
        {options.map((o, i) => {
          const meze = mezeById.get(o.mezeId);
          if (!meze) return null;
          const mine = o.votes.find((v) => v.userId === myId)?.value ?? null;
          const s = score(o.votes);
          return (
            <li key={o.mezeId} class={`option ${s >= 4 ? 'option-hot' : ''}`}>
              <div class="option-rank">{i + 1}</div>
              <button class="option-photo" type="button" onClick={() => setDetail(meze)} aria-label={`About ${meze.name}`}>
                <Photo meze={meze} />
              </button>
              <div class="option-body">
                <div class="option-title">
                  <h3>
                    {meze.name}
                    {meze.nameTr && meze.nameTr !== meze.name && <span class="name-tr">{meze.nameTr}</span>}
                  </h3>
                  <Score votes={o.votes} />
                </div>
                <VoterRow votes={o.votes} members={state.members} online={online} />
                <VoteButtons mine={mine} onVote={(v) => vote(o.mezeId, v)} />
                <div class="option-links">
                  {meze.recipeUrl && (
                    <a href={meze.recipeUrl} target="_blank" rel="noopener">
                      📖 Recipe
                    </a>
                  )}
                  {meze.nightId && <span class="custom-badge">chef's special</span>}
                  <button class="link-btn" type="button" onClick={() => setDetail(meze)}>
                    ℹ️ Details
                  </button>
                  <button class="link-btn danger" type="button" onClick={() => remove(meze)}>
                    ✕ Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <MezeDetail
            meze={detail}
            catalogue={catalogue}
            onPick={setDetail}
            actions={
              onTable.has(detail.id) ? (
                <span class="on-table">✓ On the table</span>
              ) : (
                <button class="btn btn-primary" type="button" onClick={() => addFromCatalogue(detail)}>
                  + Add to table
                </button>
              )
            }
          />
        </Modal>
      )}
    </div>
  );
}

// --- Menus --------------------------------------------------------------------

function MenusTab({
  code,
  state,
  options,
  mezeById,
  online,
  toast,
  refresh,
}: {
  code: string;
  state: NightState;
  options: NightOption[];
  mezeById: Map<string, Meze>;
  online: Set<string>;
  toast: (t: string, k?: 'info' | 'error' | 'cheers') => void;
  refresh: () => void;
}) {
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<Menu | null>(null);
  const [shopping, setShopping] = useState<Menu | null>(null);
  const myId = getUserId();
  const menus = [...state.menus].sort((a, b) => {
    if (a.id === state.night.chosenMenuId) return -1;
    if (b.id === state.night.chosenMenuId) return 1;
    return score(b.votes) - score(a.votes) || a.createdAt.localeCompare(b.createdAt);
  });

  async function vote(menuId: string, value: VoteValue | null) {
    await api.voteMenu(code, menuId, value).catch((e) => toast(e.message, 'error'));
  }
  async function crown(menu: Menu) {
    const isChosen = state.night.chosenMenuId === menu.id;
    await api.choose(code, isChosen ? null : menu.id).catch((e) => toast(e.message, 'error'));
    if (!isChosen) toast(`👑 ${menu.name} it is!`, 'cheers');
  }
  async function del(menu: Menu) {
    if (!confirm(`Tear up "${menu.name}"?`)) return;
    await api.deleteMenu(code, menu.id).catch((e) => toast(e.message, 'error'));
  }

  const topPicks = options.filter((o) => score(o.votes) > 0).map((o) => o.mezeId);

  return (
    <div class="menus-tab">
      <div class="tab-tools">
        <p class="muted">Compose a menu from the table's options. Anyone can suggest one, everyone can vote, the host crowns the winner.</p>
        <button class="btn btn-primary btn-small" type="button" onClick={() => setComposing(true)} disabled={options.length === 0}>
          📜 Compose a menu
        </button>
      </div>

      {menus.length === 0 && (
        <div class="empty card">
          <p>No menus yet. {options.length === 0 ? 'Add some meze to the table first.' : 'Be the first to propose one!'}</p>
          {topPicks.length > 0 && (
            <button class="btn btn-ghost" type="button" onClick={() => setComposing(true)}>
              ✨ Start from the {topPicks.length} crowd favourites
            </button>
          )}
        </div>
      )}

      <div class="menu-grid">
        {menus.map((menu) => {
          const isChosen = state.night.chosenMenuId === menu.id;
          const mine = menu.votes.find((v) => v.userId === myId)?.value ?? null;
          const author = state.members.find((m) => m.userId === menu.createdBy);
          return (
            <article key={menu.id} class={`menu-card ${isChosen ? 'menu-chosen' : ''}`}>
              {isChosen && <div class="menu-crown">👑 Chosen</div>}
              <header class="menu-head">
                <h3>{menu.name}</h3>
                <Score votes={menu.votes} />
              </header>
              <p class="muted small">
                Proposed by {author?.displayName || 'a mystery guest'} · {menu.mezeIds.length} dish{menu.mezeIds.length === 1 ? '' : 'es'}
              </p>
              <ul class="menu-items">
                {menu.mezeIds.map((id) => {
                  const m = mezeById.get(id);
                  if (!m) return null;
                  const opt = options.find((o) => o.mezeId === id);
                  return (
                    <li key={id}>
                      <Photo meze={m} class="photo-tiny" size="tiny" />
                      <span>{m.name}</span>
                      {opt && <Score votes={opt.votes} />}
                    </li>
                  );
                })}
                {menu.mezeIds.length === 0 && <li class="muted">An empty plate. Edit to add dishes.</li>}
              </ul>
              <VoterRow votes={menu.votes} members={state.members} online={online} />
              <VoteButtons mine={mine} onVote={(v) => vote(menu.id, v)} compact />
              <div class="menu-actions">
                <button class="link-btn" type="button" onClick={() => setEditing(menu)}>
                  ✎ Edit
                </button>
                <button class="link-btn" type="button" onClick={() => setShopping(menu)} disabled={menu.mezeIds.length === 0}>
                  🛒 Shopping list
                </button>
                {state.me.isCreator && (
                  <button class={`link-btn ${isChosen ? '' : 'gold'}`} type="button" onClick={() => crown(menu)}>
                    {isChosen ? '⭕ Un-crown' : '👑 Crown this menu'}
                  </button>
                )}
                <button class="link-btn danger" type="button" onClick={() => del(menu)}>
                  ✕ Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {shopping && <ShoppingList menu={shopping} mezeById={mezeById} defaultPeople={state.members.length} onClose={() => setShopping(null)} />}

      {(composing || editing) && (
        <MenuComposer
          code={code}
          options={options}
          mezeById={mezeById}
          initial={editing ?? (menus.length === 0 && topPicks.length > 0 ? { name: 'The crowd favourites', mezeIds: topPicks } : null)}
          onClose={() => {
            setComposing(false);
            setEditing(null);
            refresh();
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

const MENU_NAMES = ['The Big Spread', 'Light & Zesty', 'Aubergine Appreciation Society', 'Vegetarian Feast', 'Seaside Special', 'The Classics', 'Rakı Companions', "The Host's Pick"];

function MenuComposer({
  code,
  options,
  mezeById,
  initial,
  onClose,
  toast,
}: {
  code: string;
  options: NightOption[];
  mezeById: Map<string, Meze>;
  initial: { id?: string; name: string; mezeIds: string[] } | null;
  onClose: () => void;
  toast: (t: string, k?: 'info' | 'error' | 'cheers') => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [picked, setPicked] = useState<string[]>(initial?.mezeIds ?? []);
  const [busy, setBusy] = useState(false);
  const menuId = initial?.id;

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  // Edits to an existing menu are saved live, keystroke by keystroke (debounced),
  // so others at the table see them happen.
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!menuId) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api.updateMenu(code, menuId, { name, mezeIds: picked }).catch((e) => toast(e.message, 'error'));
    }, 350);
    return () => window.clearTimeout(saveTimer.current);
  }, [name, picked, menuId, code]);

  async function create(e: Event) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createMenu(code, name || MENU_NAMES[Math.floor(Math.random() * MENU_NAMES.length)], picked);
      toast('Menu proposed. Let the voting begin!', 'cheers');
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={menuId ? 'Edit menu' : 'Compose a menu'} onClose={onClose}>
      <form class="composer" onSubmit={create}>
        <label>
          <span>Menu name</span>
          <div class="inline-form">
            <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Give it a name" maxLength={80} />
            <button class="btn btn-small btn-ghost" type="button" onClick={() => setName(MENU_NAMES[Math.floor(Math.random() * MENU_NAMES.length)])} title="Random name">
              🎲
            </button>
          </div>
        </label>
        <p class="muted small">Tap dishes to add them. Sorted by the table's votes.</p>
        <ul class="picker">
          {options.map((o) => {
            const m = mezeById.get(o.mezeId);
            if (!m) return null;
            const on = picked.includes(o.mezeId);
            return (
              <li key={o.mezeId}>
                <button type="button" class={`pick ${on ? 'pick-on' : ''}`} onClick={() => toggle(o.mezeId)} aria-pressed={on}>
                  <Photo meze={m} class="photo-tiny" size="tiny" />
                  <span class="pick-name">{m.name}</span>
                  <Score votes={o.votes} />
                  <span class="pick-check">{on ? '✓' : '+'}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div class="modal-actions">
          <span class="muted">{picked.length} dish{picked.length === 1 ? '' : 'es'} picked</span>
          {menuId ? (
            <button class="btn btn-primary" type="button" onClick={onClose}>
              Done
            </button>
          ) : (
            <button class="btn btn-primary" type="submit" disabled={busy || picked.length === 0}>
              Propose this menu
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

// --- Guests -------------------------------------------------------------------

function GuestsTab({ code, state, online, toast }: { code: string; state: NightState; online: Set<string>; toast: (t: string, k?: 'info' | 'error' | 'cheers') => void }) {
  async function remove(m: { userId: string; displayName: string }) {
    if (!confirm(`Show ${m.displayName || 'this guest'} the door? Their votes go with them.`)) return;
    await api.removeMember(code, m.userId).catch((e) => toast(e.message, 'error'));
  }
  const voteCounts = new Map<string, number>();
  for (const o of state.options) for (const v of o.votes) voteCounts.set(v.userId, (voteCounts.get(v.userId) ?? 0) + 1);
  return (
    <ul class="guests">
      {state.members.map((m) => (
        <li key={m.userId} class="guest">
          <Avatar member={m} online={online.has(m.userId)} size="md" />
          <div>
            <b>{m.displayName || 'Unnamed guest'}</b>
            {m.userId === state.night.creatorId && <span class="host-badge">host</span>}
            {m.userId === state.me.userId && <span class="muted small"> (you)</span>}
            <div class="muted small">
              {online.has(m.userId) ? '🟢 at the table' : '⚪ away'} · {voteCounts.get(m.userId) ?? 0} vote{voteCounts.get(m.userId) === 1 ? '' : 's'}
            </div>
          </div>
          {state.me.isCreator && m.userId !== state.me.userId && (
            <button class="icon-btn guest-remove" type="button" title="Remove from the table" onClick={() => remove(m)}>
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function NightRedirect() {
  useEffect(() => navigate('/'), []);
  return null;
}
