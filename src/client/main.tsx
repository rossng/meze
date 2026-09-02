import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import { Explore } from './pages/Explore';
import { Home } from './pages/Home';
import { Link } from './pages/Link';
import { Night } from './pages/Night';
import { onLinkClick, usePath } from './router';
import { setActiveNight, useStore } from './store';
import { ToastProvider } from './toast';

function Nav() {
  const { nights, active } = useStore();
  const path = usePath();
  const current = nights.find((n) => n.code === active);
  return (
    <nav class="topnav">
      <a href="/" class="brand">
        <span class="brand-eye">🧿</span> Meze Night
      </a>
      <div class="topnav-links">
        <a href="/mezes" class={path === '/mezes' ? 'active' : ''}>
          The Meze
        </a>
        {nights.length > 0 && (
          <label class="night-switcher" title="Switch table">
            <span class="sr-only">Current table</span>
            <select
              value={active ?? ''}
              onChange={(e) => {
                const code = (e.target as HTMLSelectElement).value;
                if (!code) return;
                setActiveNight(code);
                history.pushState(null, '', `/n/${code}`);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            >
              {!current && <option value="">Pick a table…</option>}
              {nights.map((n) => (
                <option key={n.code} value={n.code}>
                  🪑 {n.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </nav>
  );
}

function App() {
  const path = usePath();
  useEffect(() => {
    document.addEventListener('click', onLinkClick);
    return () => document.removeEventListener('click', onLinkClick);
  }, []);
  useEffect(() => window.scrollTo(0, 0), [path]);

  let page;
  const night = path.match(/^\/n\/([a-z0-9]+)\/?$/i);
  const link = path.match(/^\/link(?:\/([a-z0-9]+))?\/?$/i);
  if (night) page = <Night code={night[1].toLowerCase()} key={night[1]} />;
  else if (link) page = <Link code={link[1]?.toLowerCase()} />;
  else if (path === '/mezes') page = <Explore />;
  else page = <Home />;

  return (
    <ToastProvider>
      <div class="lace-top" aria-hidden="true" />
      <Nav />
      <main class="page">{page}</main>
      <footer class="footer">
        <span>Photos via Wikimedia Commons (CC licensed). Recipes belong to their authors.</span>
        <span>Afiyet olsun 🧿</span>
      </footer>
    </ToastProvider>
  );
}

render(<App />, document.getElementById('app')!);
