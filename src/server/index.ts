import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env';
import { ensureUser, findNightByCode, getCatalogue, getNightState, getNightSummaries } from './db';
import type { DeviceLink, DeviceLinkClaim, RoomServerMessage, VoteValue } from '../shared/types';

export { NightRoom } from './room';

type Vars = { userId: string };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use('/api/*', cors());

// Live updates: hand the websocket to the night's room. Registered before the
// identity middleware because browsers cannot set headers on a WebSocket
// upgrade; the client identifies itself with a 'hello' message instead.
app.get('/api/nights/:code/ws', async (c) => {
  const code = c.req.param('code');
  const night = await findNightByCode(c.env.DB, code);
  if (!night) return c.json({ error: 'no such night' }, 404);
  return c.env.NIGHT_ROOM.get(c.env.NIGHT_ROOM.idFromName(code)).fetch(c.req.raw);
});

// Identity is a client-generated id sent as a header. This is a friends-only
// app: the id is a bearer token, not a password. Keep it out of URLs.
app.use('/api/*', async (c, next) => {
  const userId = c.req.header('x-user-id');
  if (!userId || !/^[A-Za-z0-9_-]{8,64}$/.test(userId)) {
    return c.json({ error: 'missing or invalid x-user-id header' }, 401);
  }
  c.set('userId', userId);
  await next();
});

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
function randomCode(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function isVote(v: unknown): v is VoteValue {
  return v === -1 || v === 1 || v === 2;
}

function room(env: Env, code: string) {
  return env.NIGHT_ROOM.get(env.NIGHT_ROOM.idFromName(code));
}

async function notify(env: Env, code: string, msg: RoomServerMessage) {
  await room(env, code).fetch('https://room/broadcast', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(msg),
  });
}

// --- catalogue --------------------------------------------------------------

app.get('/api/catalogue', async (c) => {
  const catalogue = await getCatalogue(c.env.DB);
  return c.json(catalogue, 200, { 'cache-control': 'private, max-age=30' });
});

// --- me ---------------------------------------------------------------------

app.get('/api/me/nights', async (c) => {
  const codes = (c.req.query('codes') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  const nights = await getNightSummaries(c.env.DB, codes);
  return c.json({ nights });
});

// --- device links -----------------------------------------------------------
//
// Move an identity to a second device. The code is short enough to read aloud
// or put in a QR, and safe to be short because it lives for two minutes and
// can only be redeemed once. Guessing one inside that window means finding a
// live code among 31^8 of them.

const LINK_TTL_MS = 2 * 60 * 1000;

app.post('/api/me/link', async (c) => {
  const userId = c.get('userId');
  await ensureUser(c.env.DB, userId);
  const now = Date.now();
  const code = randomCode(8);
  await c.env.DB.batch([
    // Only one live link per person, and sweep away anything long dead.
    c.env.DB.prepare('DELETE FROM device_links WHERE user_id = ? OR expires_at < ?').bind(userId, new Date(now - 60 * 60 * 1000).toISOString()),
    c.env.DB.prepare('INSERT INTO device_links (code, user_id, expires_at) VALUES (?, ?, ?)').bind(code, userId, new Date(now + LINK_TTL_MS).toISOString()),
  ]);
  return c.json({ code, url: new URL(`/link/${code}`, c.req.url).toString(), expiresAt: new Date(now + LINK_TTL_MS).toISOString() } satisfies DeviceLink, 201);
});

app.post('/api/me/link/:code/claim', async (c) => {
  const code = c.req.param('code').toLowerCase();
  const now = new Date().toISOString();
  // Spend the code and read it back in one statement, so two devices racing on
  // the same code cannot both win.
  const row = await c.env.DB.prepare('UPDATE device_links SET claimed_at = ? WHERE code = ? AND claimed_at IS NULL AND expires_at > ? RETURNING user_id')
    .bind(now, code, now)
    .first<{ user_id: string }>();
  if (!row) return c.json({ error: 'that code has expired or been used already' }, 404);

  // The joined-nights list lives in localStorage on the first device, so hand
  // the new one its tables too — otherwise it arrives as the right person with
  // an empty home page.
  const nights = await c.env.DB.prepare(
    `SELECT n.code, n.name FROM nights n JOIN night_members m ON m.night_id = n.id
     WHERE m.user_id = ? ORDER BY n.created_at DESC LIMIT 30`,
  )
    .bind(row.user_id)
    .all<{ code: string; name: string }>();
  return c.json({ userId: row.user_id, nights: nights.results } satisfies DeviceLinkClaim);
});

// --- nights -----------------------------------------------------------------

app.post('/api/nights', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ name?: string; displayName?: string }>().catch(() => ({}) as { name?: string; displayName?: string });
  const name = (body.name ?? '').trim().slice(0, 80) || 'Meze Night';
  const displayName = (body.displayName ?? '').trim().slice(0, 40);
  await ensureUser(c.env.DB, userId);

  const id = crypto.randomUUID();
  let code = randomCode();
  for (let i = 0; i < 5 && (await findNightByCode(c.env.DB, code)); i++) code = randomCode();

  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO nights (id, code, name, creator_id) VALUES (?, ?, ?, ?)').bind(id, code, name, userId),
    c.env.DB.prepare('INSERT INTO night_members (night_id, user_id, display_name) VALUES (?, ?, ?)').bind(id, userId, displayName),
  ]);
  const state = await getNightState(c.env.DB, code, userId);
  return c.json(state, 201);
});

app.get('/api/nights/:code', async (c) => {
  const state = await getNightState(c.env.DB, c.req.param('code'), c.get('userId'));
  if (!state) return c.json({ error: 'no such night' }, 404);
  return c.json(state);
});

app.post('/api/nights/:code/join', async (c) => {
  const userId = c.get('userId');
  const code = c.req.param('code');
  const night = await findNightByCode(c.env.DB, code);
  if (!night) return c.json({ error: 'no such night' }, 404);
  const body = await c.req.json<{ displayName?: string }>().catch(() => ({}) as { displayName?: string });
  const displayName = (body.displayName ?? '').trim().slice(0, 40);
  await ensureUser(c.env.DB, userId);
  await c.env.DB.prepare(
    `INSERT INTO night_members (night_id, user_id, display_name) VALUES (?, ?, ?)
     ON CONFLICT (night_id, user_id) DO UPDATE SET display_name = CASE WHEN excluded.display_name = '' THEN night_members.display_name ELSE excluded.display_name END`,
  )
    .bind(night.id, userId, displayName)
    .run();
  await notify(c.env, code, { type: 'refresh', reason: 'join' });
  return c.json(await getNightState(c.env.DB, code, userId));
});

/** Everything below requires membership. */
const member = new Hono<{ Bindings: Env; Variables: Vars & { nightId: string; code: string; creatorId: string } }>();

member.use('*', async (c, next) => {
  const code = c.req.param('code')!;
  const night = await findNightByCode(c.env.DB, code);
  if (!night) return c.json({ error: 'no such night' }, 404);
  const m = await c.env.DB.prepare('SELECT 1 FROM night_members WHERE night_id = ? AND user_id = ?').bind(night.id, c.get('userId')).first();
  if (!m) return c.json({ error: 'join the night first' }, 403);
  c.set('nightId', night.id);
  c.set('code', code);
  c.set('creatorId', night.creatorId);
  await next();
});

member.patch('/me', async (c) => {
  const body = await c.req.json<{ displayName?: string }>();
  const displayName = (body.displayName ?? '').trim().slice(0, 40);
  await c.env.DB.prepare('UPDATE night_members SET display_name = ? WHERE night_id = ? AND user_id = ?').bind(displayName, c.get('nightId'), c.get('userId')).run();
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'rename' });
  return c.json({ ok: true });
});

member.patch('/', async (c) => {
  if (c.get('creatorId') !== c.get('userId')) return c.json({ error: 'only the host can rename the night' }, 403);
  const body = await c.req.json<{ name?: string }>();
  const name = (body.name ?? '').trim().slice(0, 80);
  if (!name) return c.json({ error: 'name required' }, 400);
  await c.env.DB.prepare('UPDATE nights SET name = ? WHERE id = ?').bind(name, c.get('nightId')).run();
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'night-rename' });
  return c.json({ ok: true });
});

// guests

member.delete('/members/:userId', async (c) => {
  if (c.get('creatorId') !== c.get('userId')) return c.json({ error: 'only the host can show someone the door' }, 403);
  const target = c.req.param('userId');
  if (target === c.get('userId')) return c.json({ error: 'the host cannot leave their own table' }, 400);
  const nightId = c.get('nightId');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM option_votes WHERE night_id = ? AND user_id = ?').bind(nightId, target),
    c.env.DB.prepare('DELETE FROM menu_votes WHERE user_id = ? AND menu_id IN (SELECT id FROM menus WHERE night_id = ?)').bind(target, nightId),
    c.env.DB.prepare('DELETE FROM night_members WHERE night_id = ? AND user_id = ?').bind(nightId, target),
  ]);
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'member-removed' });
  return c.json({ ok: true });
});

// options

member.post('/options', async (c) => {
  const body = await c.req.json<{ mezeId?: string; mezeIds?: string[] }>();
  const ids = (body.mezeIds ?? (body.mezeId ? [body.mezeId] : [])).filter((s) => typeof s === 'string').slice(0, 100);
  if (ids.length === 0) return c.json({ error: 'mezeId required' }, 400);
  await c.env.DB.batch(
    ids.map((id) =>
      c.env.DB.prepare('INSERT OR IGNORE INTO night_options (night_id, meze_id, added_by) SELECT ?, id, ? FROM mezes WHERE id = ?').bind(c.get('nightId'), c.get('userId'), id),
    ),
  );
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'option-added' });
  return c.json({ ok: true });
});

// A custom dish that exists only at this table. Deliberately minimal (a short
// name) so the shared catalogue can't be abused; no photo, tags or recipe.
member.post('/custom', async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });
  const name = (body.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 50);
  if (name.length < 2) return c.json({ error: 'give the dish a name (2–50 characters)' }, 400);
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM mezes WHERE night_id = ?').bind(c.get('nightId')).first<{ n: number }>();
  if ((count?.n ?? 0) >= 40) return c.json({ error: 'that is plenty of custom dishes for one night' }, 400);
  const id = `custom-${crypto.randomUUID()}`;
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO mezes (id, name, night_id, art_emoji) VALUES (?, ?, ?, ?)').bind(id, name, c.get('nightId'), '🍽️'),
    c.env.DB.prepare('INSERT INTO night_options (night_id, meze_id, added_by) VALUES (?, ?, ?)').bind(c.get('nightId'), id, c.get('userId')),
  ]);
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'custom-added' });
  return c.json({ id }, 201);
});

member.delete('/options/:mezeId', async (c) => {
  const mezeId = c.req.param('mezeId');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM option_votes WHERE night_id = ? AND meze_id = ?').bind(c.get('nightId'), mezeId),
    c.env.DB.prepare('DELETE FROM menu_items WHERE meze_id = ? AND menu_id IN (SELECT id FROM menus WHERE night_id = ?)').bind(mezeId, c.get('nightId')),
    c.env.DB.prepare('DELETE FROM night_options WHERE night_id = ? AND meze_id = ?').bind(c.get('nightId'), mezeId),
    // custom dishes live and die with their option
    c.env.DB.prepare('DELETE FROM mezes WHERE id = ? AND night_id = ?').bind(mezeId, c.get('nightId')),
  ]);
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'option-removed' });
  return c.json({ ok: true });
});

member.put('/options/:mezeId/vote', async (c) => {
  const mezeId = c.req.param('mezeId');
  const body = await c.req.json<{ value?: unknown }>();
  const exists = await c.env.DB.prepare('SELECT 1 FROM night_options WHERE night_id = ? AND meze_id = ?').bind(c.get('nightId'), mezeId).first();
  if (!exists) return c.json({ error: 'not an option in this night' }, 404);
  if (body.value === null || body.value === undefined) {
    await c.env.DB.prepare('DELETE FROM option_votes WHERE night_id = ? AND meze_id = ? AND user_id = ?').bind(c.get('nightId'), mezeId, c.get('userId')).run();
  } else if (isVote(body.value)) {
    await c.env.DB.prepare(
      `INSERT INTO option_votes (night_id, meze_id, user_id, value) VALUES (?, ?, ?, ?)
       ON CONFLICT (night_id, meze_id, user_id) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
      .bind(c.get('nightId'), mezeId, c.get('userId'), body.value)
      .run();
  } else {
    return c.json({ error: 'value must be -1, 1, 2 or null' }, 400);
  }
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'vote' });
  return c.json({ ok: true });
});

// menus

async function writeMenuItems(db: D1Database, menuId: string, nightId: string, mezeIds: string[]) {
  const unique = [...new Set(mezeIds)].slice(0, 60);
  const stmts = [db.prepare('DELETE FROM menu_items WHERE menu_id = ?').bind(menuId)];
  unique.forEach((mezeId, i) => {
    // only allow mezes that are options in this night
    stmts.push(
      db.prepare('INSERT INTO menu_items (menu_id, meze_id, sort) SELECT ?, meze_id, ? FROM night_options WHERE night_id = ? AND meze_id = ?').bind(menuId, i, nightId, mezeId),
    );
  });
  await db.batch(stmts);
}

member.post('/menus', async (c) => {
  const body = await c.req.json<{ name?: string; mezeIds?: string[] }>();
  const name = (body.name ?? '').trim().slice(0, 80) || 'Untitled menu';
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO menus (id, night_id, name, created_by) VALUES (?, ?, ?, ?)').bind(id, c.get('nightId'), name, c.get('userId')).run();
  if (Array.isArray(body.mezeIds)) await writeMenuItems(c.env.DB, id, c.get('nightId'), body.mezeIds);
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'menu-created' });
  return c.json({ id }, 201);
});

member.patch('/menus/:menuId', async (c) => {
  const menuId = c.req.param('menuId');
  const menu = await c.env.DB.prepare('SELECT id FROM menus WHERE id = ? AND night_id = ?').bind(menuId, c.get('nightId')).first();
  if (!menu) return c.json({ error: 'no such menu' }, 404);
  const body = await c.req.json<{ name?: string; mezeIds?: string[] }>();
  if (typeof body.name === 'string') {
    const name = body.name.trim().slice(0, 80) || 'Untitled menu';
    await c.env.DB.prepare('UPDATE menus SET name = ? WHERE id = ?').bind(name, menuId).run();
  }
  if (Array.isArray(body.mezeIds)) await writeMenuItems(c.env.DB, menuId, c.get('nightId'), body.mezeIds);
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'menu-updated' });
  return c.json({ ok: true });
});

member.delete('/menus/:menuId', async (c) => {
  const menuId = c.req.param('menuId');
  const nightId = c.get('nightId');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE nights SET chosen_menu_id = NULL WHERE id = ? AND chosen_menu_id = ?').bind(nightId, menuId),
    c.env.DB.prepare('DELETE FROM menu_votes WHERE menu_id = ?').bind(menuId),
    c.env.DB.prepare('DELETE FROM menu_items WHERE menu_id = ?').bind(menuId),
    c.env.DB.prepare('DELETE FROM menus WHERE id = ? AND night_id = ?').bind(menuId, nightId),
  ]);
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'menu-deleted' });
  return c.json({ ok: true });
});

member.put('/menus/:menuId/vote', async (c) => {
  const menuId = c.req.param('menuId');
  const menu = await c.env.DB.prepare('SELECT id FROM menus WHERE id = ? AND night_id = ?').bind(menuId, c.get('nightId')).first();
  if (!menu) return c.json({ error: 'no such menu' }, 404);
  const body = await c.req.json<{ value?: unknown }>();
  if (body.value === null || body.value === undefined) {
    await c.env.DB.prepare('DELETE FROM menu_votes WHERE menu_id = ? AND user_id = ?').bind(menuId, c.get('userId')).run();
  } else if (isVote(body.value)) {
    await c.env.DB.prepare(
      `INSERT INTO menu_votes (menu_id, user_id, value) VALUES (?, ?, ?)
       ON CONFLICT (menu_id, user_id) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
      .bind(menuId, c.get('userId'), body.value)
      .run();
  } else {
    return c.json({ error: 'value must be -1, 1, 2 or null' }, 400);
  }
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'menu-vote' });
  return c.json({ ok: true });
});

member.put('/chosen', async (c) => {
  if (c.get('creatorId') !== c.get('userId')) return c.json({ error: 'only the host can choose the menu' }, 403);
  const body = await c.req.json<{ menuId?: string | null }>();
  const menuId = body.menuId ?? null;
  if (menuId) {
    const menu = await c.env.DB.prepare('SELECT id FROM menus WHERE id = ? AND night_id = ?').bind(menuId, c.get('nightId')).first();
    if (!menu) return c.json({ error: 'no such menu' }, 404);
  }
  await c.env.DB.prepare('UPDATE nights SET chosen_menu_id = ? WHERE id = ?').bind(menuId, c.get('nightId')).run();
  await notify(c.env, c.get('code'), { type: 'refresh', reason: 'chosen' });
  return c.json({ ok: true });
});

member.post('/cheers', async (c) => {
  const body = await c.req.json<{ text?: string }>().catch(() => ({}) as { text?: string });
  await notify(c.env, c.get('code'), { type: 'toast', text: (body.text ?? 'Şerefe!').slice(0, 80), from: c.get('userId') });
  return c.json({ ok: true });
});

app.route('/api/nights/:code', member);

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message ?? 'server error' }, 500);
});

export default app;
