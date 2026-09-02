import { DurableObject } from 'cloudflare:workers';
import type { RoomClientMessage, RoomServerMessage } from '../shared/types';
import type { Env } from './env';

interface Attachment {
  userId: string | null;
}

/**
 * One NightRoom per meze night. It does not own any data: D1 is the source of
 * truth. The room just fans out "something changed, refetch" messages and
 * tracks who is currently connected. Uses the WebSocket hibernation API so it
 * costs nothing while idle.
 */
export class NightRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/ws')) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ userId: null } satisfies Attachment);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname.endsWith('/broadcast') && request.method === 'POST') {
      const body = (await request.json()) as RoomServerMessage;
      this.broadcast(body);
      return Response.json({ ok: true, clients: this.ctx.getWebSockets().length });
    }

    return new Response('not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string') return;
    let msg: RoomClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'hello') {
      ws.serializeAttachment({ userId: msg.userId } satisfies Attachment);
      this.broadcastPresence();
    } else if (msg.type === 'cheers') {
      const att = ws.deserializeAttachment() as Attachment;
      this.broadcast({ type: 'toast', text: String(msg.text).slice(0, 80), from: att.userId ?? undefined });
    }
  }

  async webSocketClose(ws: WebSocket) {
    try {
      ws.close();
    } catch {}
    this.broadcastPresence();
  }

  async webSocketError(ws: WebSocket) {
    try {
      ws.close();
    } catch {}
    this.broadcastPresence();
  }

  private broadcastPresence() {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.userId) ids.add(att.userId);
    }
    this.broadcast({ type: 'presence', userIds: [...ids] });
  }

  private broadcast(msg: RoomServerMessage) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // socket already gone; hibernation API will clean it up
      }
    }
  }
}
