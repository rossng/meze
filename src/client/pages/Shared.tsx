import { useEffect, useState } from 'preact/hooks';
import type { SharedMenu } from '../../shared/types';
import { fetchSharedMenu } from '../api';
import { MenuCardPreview, ShareActions, ShareLink, useMenuCard } from '../share';

/**
 * A published menu, for anyone holding the link. No identity and no membership
 * needed: it shows the card, who is coming and what they are eating.
 */
export function Shared({ token }: { token: string }) {
  const [shared, setShared] = useState<SharedMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { png, failed } = useMenuCard(shared);

  useEffect(() => {
    fetchSharedMenu(token).then(setShared, (e: Error) => setError(e.message));
  }, [token]);

  if (error)
    return (
      <div class="card error">
        <h2>No menu here</h2>
        <p>{error}</p>
        <p>
          <a href="/">Start a meze night of your own →</a>
        </p>
      </div>
    );
  if (!shared) return <div class="loading">Fetching the menu…</div>;

  return (
    <div class="shared-page">
      {!shared.isCurrent && (
        <div class="stale-banner">
          ⚠️ <b>This isn't the latest menu any more.</b> The table has changed its mind since it was shared. Ask whoever sent it for the new one.
        </div>
      )}
      <MenuCardPreview shared={shared} png={png} />
      {failed && <p class="error-text">Couldn't draw the card on this device. The menu is written out below.</p>}

      <section class="shared-text">
        <h2>{shared.menuName}</h2>
        <ol class="shared-dishes">
          {shared.dishes.map((d, i) => (
            <li key={i}>
              <b>{d.nameTr || d.name}</b>
              {d.nameTr && d.nameTr !== d.name && <span class="muted small"> {d.name}</span>}
            </li>
          ))}
          {shared.dishes.length === 0 && <li class="muted">Nothing on the menu yet.</li>}
        </ol>
        {shared.guests.length > 0 && (
          <p class="muted">
            <b>At the table:</b> {shared.guests.join(' · ')}
          </p>
        )}
      </section>

      <ShareLink url={shared.url} />
      <ShareActions shared={shared} png={png} />

      <p class="muted small shared-cta">
        Want one of these? <a href="/">Start your own meze night</a> and get your friends voting.
      </p>
    </div>
  );
}
