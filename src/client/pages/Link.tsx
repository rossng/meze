import { useState } from 'preact/hooks';
import { api, getUserId, setUserId } from '../api';
import { navigate } from '../router';
import { getJoinedNights, rememberNights, setActiveNight } from '../store';
import { useToast } from '../toast';

/**
 * The far end of "use this on another device": redeem a pairing code and take on the
 * identity it belongs to. Claiming spends the code, so it waits for a tap
 * rather than firing on load — a stray prefetch or a tap of the back button
 * would otherwise burn it.
 */
export function Link({ code: fromUrl }: { code?: string }) {
  const toast = useToast();
  const [code, setCode] = useState(fromUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strays = getJoinedNights().length;

  async function claim(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const claim = await api.claimLink(code.trim().toLowerCase());
      if (claim.userId !== getUserId()) setUserId(claim.userId);
      rememberNights(claim.nights);
      setActiveNight(claim.nights[0]?.code ?? null);
      toast('Same you, second device. Hoş geldiniz again!', 'cheers');
      navigate(claim.nights[0] ? `/n/${claim.nights[0].code}` : '/');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div class="home">
      <form class="card card-cloth link-card" onSubmit={claim}>
        <h2>📱 Same person, another device</h2>
        <p class="muted">
          Open the meyhane on the device you normally use, tap <strong>Use this on another device</strong>, and type the code it shows you here.
          Scanning the QR does the same thing without the typing.
        </p>
        <label>
          <span>Pairing code</span>
          <input
            value={code}
            onInput={(e) => setCode((e.target as HTMLInputElement).value)}
            placeholder="e.g. k7pm2xqd"
            autocapitalize="none"
            autocomplete="off"
            spellcheck={false}
          />
        </label>
        {strays > 0 && (
          <p class="muted">
            Heads up: this device already has {strays} table{strays === 1 ? '' : 's'} of its own. They stay on the list, but any votes cast here so
            far belong to the guest you are about to stop being.
          </p>
        )}
        {error && <p class="link-error">{error}</p>}
        <button class="btn btn-primary" type="submit" disabled={busy || code.trim().length < 4}>
          {busy ? 'Checking the guest list…' : "That's me"}
        </button>
      </form>
    </div>
  );
}
