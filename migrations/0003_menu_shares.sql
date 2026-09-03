-- Shareable menus -------------------------------------------------------------
--
-- A crowned menu can be published as a link anyone can open, without joining the
-- night. The token is long and random, and holding it is the whole permission.
-- There is one share per menu, so re-sharing gives out the same link rather than
-- a new one each time.
--
-- The share outlives the crown: if the table changes its mind the link keeps
-- working, and the page says it is no longer the latest menu.

CREATE TABLE menu_shares (
  token TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX menu_shares_menu ON menu_shares(menu_id);
