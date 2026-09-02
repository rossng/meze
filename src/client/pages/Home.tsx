import { useEffect, useState } from 'preact/hooks';
import type { NightSummary } from '../../shared/types';
import { api } from '../api';
import { navigate } from '../router';
import { forgetNight, rememberNight, setActiveNight, useStore } from '../store';
import { useToast } from '../toast';

const TAGLINES = [
  'Where every vote ends in "şerefe!"',
  'Rakı optional. Opinions mandatory.',
  'Democracy, but with more aubergine.',
  'The garson will be with you shortly.',
  'Small plates. Big feelings.',
];

export function Home() {
  const { nights } = useStore();
  const toast = useToast();
  const [nightName, setNightName] = useState('');
  const [yourName, setYourName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, NightSummary>>({});
  const [tagline] = useState(() => TAGLINES[Math.floor(Math.random() * TAGLINES.length)]);

  useEffect(() => {
    if (nights.length === 0) return;
    api
      .myNights(nights.map((n) => n.code))
      .then((r) => setSummaries(Object.fromEntries(r.nights.map((n) => [n.code, n]))))
      .catch(() => {});
  }, [nights.length]);

  async function create(e: Event) {
    e.preventDefault();
    setBusy(true);
    try {
      const state = await api.createNight(nightName, yourName);
      rememberNight({ code: state.night.code, name: state.night.name });
      setActiveNight(state.night.code);
      toast('The table is laid. Invite your friends!', 'cheers');
      navigate(`/n/${state.night.code}`);
    } catch (err) {
      toast(`Couldn't open the night: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  function join(e: Event) {
    e.preventDefault();
    const c = code.trim().toLowerCase().replace(/.*\/n\//, '').replace(/[^a-z0-9]/g, '');
    if (c) navigate(`/n/${c}`);
  }

  return (
    <div class="home">
      <section class="hero">
        <div class="hero-lights" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${(i * 0.37) % 2}s` }} />
          ))}
        </div>
        <div class="hero-eye" aria-hidden="true">🧿</div>
        <h1 class="hero-title">
          <span class="hero-small">Hoş geldiniz to</span>
          <span class="hero-big">Meze Night</span>
        </h1>
        <p class="hero-tagline">{tagline}</p>
        <p class="hero-sub">Browse the meze, gather your table, vote with your thumbs, and crown a menu.</p>
        <a class="btn btn-ghost" href="/mezes">
          🍆 Just browse the meze first
        </a>
      </section>

      <div class="home-grid">
        <form class="card card-cloth" onSubmit={create}>
          <h2>🍽️ Lay a new table</h2>
          <label>
            <span>What's the occasion?</span>
            <input value={nightName} onInput={(e) => setNightName((e.target as HTMLInputElement).value)} placeholder="Friday meze night at Ayşe's" maxLength={80} />
          </label>
          <label>
            <span>And who are you?</span>
            <input value={yourName} onInput={(e) => setYourName((e.target as HTMLInputElement).value)} placeholder="Your name" maxLength={40} />
          </label>
          <button class="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Setting the table…' : 'Open the meyhane'}
          </button>
        </form>

        <form class="card" onSubmit={join}>
          <h2>🔗 Join a table</h2>
          <p class="muted">Got a link or a code from a friend? Paste it here.</p>
          <label>
            <span>Code or link</span>
            <input value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} placeholder="e.g. k7pm2x" />
          </label>
          <button class="btn" type="submit" disabled={!code.trim()}>
            Pull up a chair
          </button>
        </form>
      </div>

      {nights.length > 0 && (
        <section class="card your-nights">
          <h2>🪑 Your tables</h2>
          <ul class="night-list">
            {nights.map((n) => {
              const s = summaries[n.code];
              return (
                <li key={n.code}>
                  <a href={`/n/${n.code}`} class="night-link" onClick={() => setActiveNight(n.code)}>
                    <span class="night-name">{s?.name ?? n.name}</span>
                    <span class="muted">
                      {s ? `${s.memberCount} guest${s.memberCount === 1 ? '' : 's'}` : ''} · {n.code}
                      {s?.chosenMenuId ? ' · 👑 menu chosen' : ''}
                    </span>
                  </a>
                  <button class="icon-btn" type="button" title="Forget this table" onClick={() => forgetNight(n.code)}>
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
