import { useCallback, useEffect, useState } from 'preact/hooks';
import type { DeviceLink } from '../shared/types';
import { api } from './api';
import { Modal, QrCode } from './ui';

/**
 * "Be the same guest on my other device." Identity here is a random id in
 * localStorage, so the second device has to be handed the first one's id. The
 * QR carries a short pairing code rather than the id itself: the code dies in
 * two minutes and can only be redeemed once, so a photographed screen is worth
 * nothing afterwards.
 */
function PairPanel({ onClose }: { onClose: () => void }) {
  const [link, setLink] = useState<DeviceLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const request = useCallback(() => {
    setError(null);
    setLink(null);
    api
      .createLink()
      .then(setLink)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(request, [request]);

  useEffect(() => {
    if (!link) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((Date.parse(link.expiresAt) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [link]);

  const expired = link != null && secondsLeft === 0;

  return (
    <Modal title="Use this on another device" onClose={onClose}>
      <p class="muted">
        Point the other device's camera at this. It will open the meyhane as you — same name, same votes, same tables — without anyone having to log
        in anywhere.
      </p>
      {error && <p class="link-error">{error}</p>}
      {link && !expired && (
        <div class="pair">
          <QrCode text={link.url} label="Pairing code" />
          <div class="pair-side">
            <p class="muted small">No camera? Open {new URL(link.url).host}/link over there and type:</p>
            <b class="code pair-code">{link.code}</b>
            <p class="muted small">
              Good for {secondsLeft}s, and once only. Anyone who uses it becomes you at the table, so don't put it on the internet.
            </p>
          </div>
        </div>
      )}
      {expired && <p class="muted">That code has gone stale — codes only last a couple of minutes.</p>}
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" onClick={onClose}>
          Close
        </button>
        {(expired || error) && (
          <button class="btn btn-primary" type="button" onClick={request}>
            Give me a fresh code
          </button>
        )}
      </div>
    </Modal>
  );
}

export function PairDeviceButton({ class: cls = 'btn btn-small btn-ghost' }: { class?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button class={cls} type="button" onClick={() => setOpen(true)}>
        📱 Use this on another device
      </button>
      {open && <PairPanel onClose={() => setOpen(false)} />}
    </>
  );
}
