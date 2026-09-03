import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Menu, SharedMenu } from '../shared/types';
import { api, ApiError, fetchSharedMenu } from './api';
import { menuFileName, renderMenuCardPng, type MenuCardData } from './menucard';
import { useToast } from './toast';
import { Modal, copyText } from './ui';

export function shareText(shared: SharedMenu) {
  return `Here is the menu for ${shared.nightName}\n${shared.url}`;
}

function cardData(shared: SharedMenu): MenuCardData {
  return { nightName: shared.nightName, menuName: shared.menuName, dishes: shared.dishes, guests: shared.guests };
}

/** Draws the card once. The same PNG is used for the preview, the clipboard and the share sheet. */
export function useMenuCard(shared: SharedMenu | null) {
  const [png, setPng] = useState<{ url: string; blob: Blob } | null>(null);
  const [failed, setFailed] = useState(false);
  const key = useMemo(() => (shared ? JSON.stringify(cardData(shared)) : ''), [shared]);
  useEffect(() => {
    if (!shared) return;
    let url: string | undefined;
    let alive = true;
    setPng(null);
    setFailed(false);
    renderMenuCardPng(cardData(shared)).then(
      (blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setPng({ url, blob });
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);
  return { png, failed };
}

export function MenuCardPreview({ shared, png }: { shared: SharedMenu; png: { url: string } | null }) {
  if (!png) return <div class="menu-png menu-png-loading">Drawing the card…</div>;
  return <img class="menu-png" src={png.url} alt={`The menu for ${shared.nightName}: ${shared.dishes.map((d) => d.nameTr ?? d.name).join(', ')}`} />;
}

/**
 * Copy, share and save. The share button hands the OS its own sheet, with the
 * picture attached where the browser allows it, so the menu can go straight to
 * WhatsApp, Messages, Signal or email. Where that isn't available, copying puts
 * the picture and the link on the clipboard together.
 */
export function ShareActions({ shared, png }: { shared: SharedMenu; png: { url: string; blob: Blob } | null }) {
  const toast = useToast();
  const text = shareText(shared);
  // 'image': the sheet will take the card. 'text': only the link. 'none': no sheet.
  const [sheet, setSheet] = useState<'none' | 'text' | 'image'>('none');

  const file = () => (png ? new File([png.blob], menuFileName(shared.nightName), { type: 'image/png' }) : null);

  useEffect(() => {
    if (!navigator.share) return setSheet('none');
    const f = file();
    setSheet(f && navigator.canShare?.({ files: [f], text }) ? 'image' : 'text');
  }, [png, shared.url]);

  async function copyBoth() {
    try {
      if (!png || typeof ClipboardItem === 'undefined') throw new Error('this browser will not copy images');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png.blob, 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      toast('Copied. Paste it into your group chat.', 'cheers');
    } catch {
      copyText(text).then(
        () => toast('Copied the link. This browser will not copy pictures, so use Save the card for that.'),
        () => toast('Could not copy. Select the link in the box above instead.', 'error'),
      );
    }
  }

  async function share() {
    const f = file();
    const withImage = sheet === 'image' && f;
    try {
      await navigator.share(withImage ? { files: [f], text } : { text });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // they closed the sheet
      if (!withImage) return toast('Could not open the share sheet. Copy the link instead.', 'error');
      // Some phones refuse the file at the last moment; send the link on its own.
      await navigator.share({ text }).catch((e2: Error) => e2.name !== 'AbortError' && toast('Could not share the card. Copy the link instead.', 'error'));
    }
  }

  function save() {
    if (!png) return;
    const a = document.createElement('a');
    a.href = png.url;
    a.download = menuFileName(shared.nightName);
    a.click();
  }

  // With the card attached, the share sheet is the best way to send this, so it
  // gets to be the loud button.
  const shareIsBest = sheet === 'image';
  const shareBtn = sheet !== 'none' && (
    <button type="button" class={`btn ${shareIsBest ? 'btn-primary' : 'btn-ghost'}`} onClick={share} disabled={!png}>
      📤 Share
    </button>
  );

  return (
    <>
      <div class="share-actions">
        {shareIsBest && shareBtn}
        <button type="button" class={`btn ${shareIsBest ? 'btn-ghost' : 'btn-primary'}`} onClick={copyBoth} disabled={!png}>
          📋 Copy menu + link
        </button>
        {!shareIsBest && shareBtn}
        <button type="button" class="btn btn-ghost" onClick={save} disabled={!png}>
          ⬇️ Save the card
        </button>
      </div>
      {!isSecureContext && (
        <p class="muted small share-note">
          Sharing and copying need HTTPS, and this page is on a plain http:// address, so the browser has switched them off. Save the card and send it by hand, or open
          the site over HTTPS.
        </p>
      )}
    </>
  );
}

/** The link on its own, in a box you can read out or copy. */
export function ShareLink({ url }: { url: string }) {
  const toast = useToast();
  return (
    <div class="share-link">
      <input readOnly value={url} onFocus={(e) => (e.target as HTMLInputElement).select()} aria-label="Public menu link" />
      <button
        type="button"
        class="btn btn-small btn-ghost"
        onClick={() =>
          copyText(url).then(
            () => toast('Link copied.'),
            () => toast('Could not copy. Select the link and copy it by hand.', 'error'),
          )
        }
      >
        🔗 Copy link
      </button>
    </div>
  );
}

/**
 * Publishes the crowned menu and shows the card. There is one token per menu,
 * so opening this again gives back the link that has already been sent round.
 */
export function ShareMenuModal({ code, menu, isChosen, onClose }: { code: string; menu: Menu; isChosen: boolean; onClose: () => void }) {
  const [shared, setShared] = useState<SharedMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { png, failed } = useMenuCard(shared);

  useEffect(() => {
    // If it is crowned, publish it (asking twice is harmless). If it has been
    // un-crowned since, read the existing link back so it can still be re-sent.
    const load = isChosen ? api.shareMenu(code, menu.id) : menu.shareToken ? fetchSharedMenu(menu.shareToken) : Promise.reject(new ApiError(400, 'crown the menu first, then share it'));
    load.then(setShared, (e: Error) => setError(e.message));
  }, [code, menu.id, isChosen, menu.shareToken]);

  return (
    <Modal title="🖼️ Share the menu" onClose={onClose}>
      {error && <p class="error-text">{error}</p>}
      {!error && (
        <>
          <p class="muted small">Anyone with this link can see the menu. They don't have to join the night. If you un-crown the menu later, the link still works and says so.</p>
          {shared ? <MenuCardPreview shared={shared} png={png} /> : <div class="menu-png menu-png-loading">Drawing the card…</div>}
          {failed && <p class="error-text">Couldn't draw the card. The link below still works.</p>}
          {shared && (
            <>
              <ShareLink url={shared.url} />
              <ShareActions shared={shared} png={png} />
            </>
          )}
        </>
      )}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
