-- Meze catalogue -------------------------------------------------------------

CREATE TABLE mezes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_tr TEXT,
  description TEXT NOT NULL DEFAULT '',
  photo_url TEXT,               -- NULL: the client draws SVG plate art instead
  photo_thumb_url TEXT,
  photo_credit TEXT,
  art_emoji TEXT,               -- used by the SVG art fallback
  recipe_url TEXT,
  recipe_source TEXT,
  prep_minutes INTEGER,
  ingredient_count INTEGER,
  serves INTEGER,               -- people the ingredient list feeds (as a meze portion)
  night_id TEXT,                -- NULL: global catalogue. Set: a custom dish for one night only.
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Flexible taxonomy: a tag *type* is a facet (origin, dietary, complexity...),
-- a tag is a value within it. Adding a new facet or value is a data change,
-- not a schema change.
CREATE TABLE tag_types (
  id TEXT PRIMARY KEY,          -- e.g. 'origin'
  label TEXT NOT NULL,          -- e.g. 'Place of origin'
  emoji TEXT,
  multi INTEGER NOT NULL DEFAULT 1,  -- can a meze carry several values of this type?
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,          -- e.g. 'origin:aegean'
  type_id TEXT NOT NULL REFERENCES tag_types(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  emoji TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX tags_type ON tags(type_id, sort);
CREATE INDEX mezes_night ON mezes(night_id);

-- Rough ingredient lists so a menu can be turned into a shopping list.
-- quantity/unit are nullable for things like "a handful of parsley".
CREATE TABLE meze_ingredients (
  meze_id TEXT NOT NULL REFERENCES mezes(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  quantity REAL,
  unit TEXT,
  item TEXT NOT NULL,
  note TEXT,
  PRIMARY KEY (meze_id, sort)
);

CREATE TABLE meze_tags (
  meze_id TEXT NOT NULL REFERENCES mezes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (meze_id, tag_id)
);
CREATE INDEX meze_tags_tag ON meze_tags(tag_id);

-- People ---------------------------------------------------------------------

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Meze nights ----------------------------------------------------------------

CREATE TABLE nights (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,   -- short shareable code used in the link
  name TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id),
  chosen_menu_id TEXT,         -- soft reference to menus(id); nullable
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE night_members (
  night_id TEXT NOT NULL REFERENCES nights(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (night_id, user_id)
);

-- The candidate mezes for a night.
CREATE TABLE night_options (
  night_id TEXT NOT NULL REFERENCES nights(id) ON DELETE CASCADE,
  meze_id TEXT NOT NULL REFERENCES mezes(id) ON DELETE CASCADE,
  added_by TEXT REFERENCES users(id),
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (night_id, meze_id)
);

-- value: 2 = strongly for, 1 = for, -1 = against
CREATE TABLE option_votes (
  night_id TEXT NOT NULL REFERENCES nights(id) ON DELETE CASCADE,
  meze_id TEXT NOT NULL REFERENCES mezes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (-1, 1, 2)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (night_id, meze_id, user_id)
);

CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  night_id TEXT NOT NULL REFERENCES nights(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX menus_night ON menus(night_id, created_at);

CREATE TABLE menu_items (
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  meze_id TEXT NOT NULL REFERENCES mezes(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (menu_id, meze_id)
);

CREATE TABLE menu_votes (
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (-1, 1, 2)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (menu_id, user_id)
);
