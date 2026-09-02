import type { RoomClientMessage, RoomServerMessage } from '../shared/types';
import { getUserId } from './api';

/**
 * Keeps a websocket open to a night's room, reconnecting with back-off.
 * Falls back to polling if the socket can't be established.
 */
export function connectRoom(code: string, onMessage: (m: RoomServerMessage) => void, onStatus: (online: boolean) => void) {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempts = 0;
  let timer: number | undefined;
  let poll: number | undefined;

  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/nights/${code}/ws`;

  function startPolling() {
    if (poll) return;
    poll = window.setInterval(() => onMessage({ type: 'refresh', reason: 'poll' }), 5000);
  }
  function stopPolling() {
    if (poll) window.clearInterval(poll);
    poll = undefined;
  }

  function open() {
    if (closed) return;
    try {
      ws = new WebSocket(url);
    } catch {
      startPolling();
      return;
    }
    ws.onopen = () => {
      attempts = 0;
      stopPolling();
      onStatus(true);
      send({ type: 'hello', userId: getUserId() });
      // Anything might have happened while we were away.
      onMessage({ type: 'refresh', reason: 'reconnect' });
    };
    ws.onmessage = (ev) => {
      try {
        onMessage(JSON.parse(ev.data) as RoomServerMessage);
      } catch {}
    };
    ws.onclose = () => {
      onStatus(false);
      ws = null;
      if (closed) return;
      attempts++;
      if (attempts > 2) startPolling();
      timer = window.setTimeout(open, Math.min(15000, 500 * 2 ** attempts));
    };
    ws.onerror = () => ws?.close();
  }

  function send(m: RoomClientMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  }

  open();

  return {
    send,
    close() {
      closed = true;
      if (timer) window.clearTimeout(timer);
      stopPolling();
      ws?.close();
    },
  };
}
