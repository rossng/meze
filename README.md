# Meze Night 🧿

A small, slightly over-the-top meyhane-themed app for exploring Turkish meze, gathering
a table of friends, voting with your thumbs, and crowning a menu. Everything is live:
votes, menus and names update for everyone at the table as they happen.

Stack: TypeScript, [Hono](https://hono.dev), Cloudflare Workers, D1 (SQLite), one Durable
Object per night for WebSocket fan-out, Preact on the client (bundled with esbuild, no framework
CLI).

## Run it locally

```sh
npm install
npm run images           # download + crush the catalogue photos into public/img (once; cached)
npm run db:reset:local   # apply migrations + seed the sample catalogue into local D1
npm run dev              # esbuild watch + wrangler dev on http://localhost:8787
```

Everything (D1, the Durable Object, static assets) runs locally under `wrangler dev`; no
Cloudflare account is needed. Open two browser windows on the same night link to see the
live updates.

Smoke-test the API against a running dev server:

```sh
./scripts/smoke.sh
```

## Deploy

Everything — API, database, WebSockets and the static frontend — runs as a single Cloudflare
Worker, and the whole thing fits in the free tier. There are no secrets to configure: the only
bindings are `DB`, `NIGHT_ROOM` and `ASSETS`, all declared in `wrangler.toml`.

One-time account setup:

```sh
npx wrangler login
npx wrangler d1 create meze   # paste the printed database_id into wrangler.toml
```

Keep the binding in `wrangler.toml` as `DB` — `wrangler` suggests `meze`, but `src/server/env.ts`
expects `DB`. The `database_id` is account-scoped and safe to commit.

You also need a `workers.dev` subdomain on the account (once, via the dashboard: Workers &
Pages → onboarding). It applies to every Worker on the account, so name it after yourself rather
than after this app. A freshly registered subdomain takes a few minutes to get its TLS
certificate; until then requests fail with a handshake error rather than a 404.

Then, to ship:

```sh
npm run db:migrate:remote   # schema
npm run db:seed:remote      # taxonomy + the meze catalogue
npm run deploy              # esbuild bundle + worker + public/ assets
```

Only `npm run deploy` is needed for subsequent code changes; re-run the seed only when
`seed/` changes. `db:seed:remote` is safe to re-run against a live database: mezes, tag_types
and tags are upserted by id rather than deleted, so a night that has already voted on or
menu'd a catalogue dish keeps that history even if the dish's copy, photo or tags change.
The app lands at `https://meze.<your-subdomain>.workers.dev`.

**Custom domains.** A Worker route like `example.com/meze*` requires the zone's nameservers to
point at Cloudflare — there's no CNAME-only option on the free plan. Serving the frontend from
GitHub Pages instead is not workable here: the client calls the API same-origin (`api.ts` uses
bare `/api/...` paths and `live.ts` derives its WebSocket URL from `location.host`), and the SPA
router assumes it is mounted at the root.

## How it fits together

```
src/server/index.ts   Hono API (/api/*). Mutations write to D1 then poke the night's room.
src/server/db.ts      Query layer; builds the catalogue and the full NightState.
src/server/room.ts    NightRoom Durable Object: WebSocket hibernation, presence, broadcast.
src/shared/types.ts   Types shared by server and client.
src/client/           Preact SPA: Home (create/join), Explore (filter catalogue), Night (vote, menus).
src/client/lexicon.ts Turkish <-> English ingredient words used to widen a search.
src/client/qr.ts      Small QR encoder, used to hand an identity to a second device.
migrations/           D1 schema.  seed/seed.sql   taxonomy + the original mezes.
seed/catalogue/       Authored entries (JSON) -> seed/mezes/*.sql via npm run catalogue.
public/               index.html, styles.css, and the built app.js.
```

**Identity.** There are no accounts. The browser generates an id, keeps it in `localStorage`,
and sends it as `x-user-id`. A person names themselves per night, and can rename at any time.
Joined nights are remembered locally so you can switch between tables from the nav.

**A second device.** Because the id is a bearer token kept in one browser, being the same guest
on another device means copying it there. "Use this on another device" (on the home page and in
the night header) calls `POST /api/me/link` for a pairing code and shows it as a QR; the phone opens
`/link/<code>` and `POST`s to claim it, which hands back the id and the list of tables that
identity belongs to. The QR deliberately carries the code and not the id itself: a `device_links`
row lives two minutes and can only be claimed once, so a photographed screen is worthless
afterwards, whereas the id never rotates. Only the device showing the QR can be scanned, so the
other direction means reading the code out instead.
`src/client/qr.ts` is a ~250-line QR encoder (byte mode, level L, versions 1–5) so nothing has
to be fetched to draw one.

**Live updates.** D1 is the only source of truth. After every mutation the worker POSTs a
`refresh` to the night's Durable Object, which fans it out to connected sockets; clients then
refetch the night state. The room also tracks who is online and relays "Şerefe!" toasts.
If the socket cannot connect the client falls back to polling.

**Taxonomy.** `tag_types` are facets (origin, dietary, complexity, time, ingredient count,
main ingredient, served hot/cold, theme) and `tags` are values. Adding a facet or a value is
an `INSERT`, not a migration, and the Explore page renders whatever is in the tables.

**Search.** Explore matches a query against names (both languages), the description, tag
labels and the ingredient list. `src/client/lexicon.ts` pairs Turkish and English ingredient
words, so "patlıcan" and "aubergine" return the same dishes; add a group when an ingredient
arrives that isn't covered.

**Photos.** `seed/photos.json` maps each meze to its source image (Wikimedia Commons).
`scripts/images.mjs` downloads a 1200px render, centre-crops to 4:3 and writes two crushed WebPs
(800px and a 320px thumbnail) into `public/img`; cards use `srcset` so phones fetch the small one.
The processed images are committed so a deploy needs no network. A meze with no photo gets
generated SVG plate art, which is also what custom dishes use.

**Ingredients & shopping.** Each meze has a rough ingredient list and a `serves` count (as a
meze portion). A menu's shopping list scales every dish to the number of people and can be copied
as text. Ingredients are not merged across dishes; the UI suggests pasting into an LLM for that.

**Custom dishes.** Anyone at a table can add a dish that isn't in the catalogue. It's a `mezes`
row with `night_id` set and only a name (max 50 chars), invisible to other nights, and deleted
when removed from the table.

**Hosts** can rename the night, crown a menu, and remove guests (their votes go too).

**The catalogue.** 128 mezes. The original set lives inline in `seed/seed.sql`; everything
added since is authored as JSON in `seed/catalogue/` and compiled to `seed/mezes/*.sql`
(grouped by category) with `npm run catalogue`, which also checks that `ingredient_count`
matches the ingredient rows and that every dish has a `temp` tag. Seeding concatenates
`seed/seed.sql` with `seed/mezes/*.sql`, so `seed/mezes/00-taxonomy.sql` holds the tags added
after the original taxonomy.

**Adding mezes without redeploying.** Mezes, tags and their links are plain rows, so a future
admin endpoint or an `INSERT` via `wrangler d1 execute` is all that's needed. Nothing about
the catalogue is baked into the code.

## Data model

`mezes` ⟷ `meze_tags` ⟷ `tags` → `tag_types`

`nights` (code, creator, chosen_menu_id) → `night_members`, `night_options` (candidate mezes),
`option_votes` (2 / 1 / −1 per person per meze), `menus` → `menu_items`, `menu_votes`.

`device_links` (code → user_id, short-lived, single use) sits off to the side: it only exists to
move an identity between devices.

## Credits

Photos are from Wikimedia Commons under their respective CC licences (credit shown on each
meze's detail view). Recipes link out to their authors' sites.
