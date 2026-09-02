-- Taxonomy added for the expanded catalogue. Applied after seed/seed.sql.
-- tag_types/tags are upserted (never deleted) everywhere in seed/, so these
-- inserts are safe to re-run against a live database too.

INSERT INTO tag_types (id, label, emoji, multi, sort) VALUES
  ('heritage', 'Kitchen it came from', '🏛️', 1, 25)
ON CONFLICT (id) DO UPDATE SET
  label = excluded.label, emoji = excluded.emoji, multi = excluded.multi, sort = excluded.sort;

INSERT INTO tags (id, type_id, label, emoji, sort) VALUES
  ('origin:hatay', 'origin', 'Hatay & Antakya', '🌿', 9),

  ('heritage:armenian',   'heritage', 'Armenian',                '🕯️', 1),
  ('heritage:greek',      'heritage', 'Rum (Greek of Istanbul)', '🏺', 2),
  ('heritage:jewish',     'heritage', 'Sephardic',               '🕎', 3),
  ('heritage:circassian', 'heritage', 'Circassian',              '🏔️', 4),
  ('heritage:arab',       'heritage', 'Arab (Antakya)',          '🫖', 5),

  ('main:potato',   'main', 'Potato',   '🥔', 12),
  ('main:egg',      'main', 'Egg',      '🥚', 13),
  ('main:mushroom', 'main', 'Mushroom', '🍄', 14),

  ('theme:arasicak',    'theme', 'Ara sıcak (hot starter)', '🍲', 13),
  ('theme:make-ahead',  'theme', 'Make ahead',              '📅', 14),
  ('theme:no-cook',     'theme', 'No cooking',              '🙌', 15),
  ('theme:pickle',      'theme', 'Pickles & preserves',     '🥒', 16),
  ('theme:adventurous', 'theme', 'For the brave',           '😈', 17),
  ('theme:bread',       'theme', 'Bread & the board',       '🍞', 18)
ON CONFLICT (id) DO UPDATE SET
  type_id = excluded.type_id, label = excluded.label, emoji = excluded.emoji, sort = excluded.sort;

-- Fruit and the sweet end of the table: melon with cheese, figs, apricots.
INSERT INTO tags (id, type_id, label, emoji, sort) VALUES
  ('main:fruit', 'main', 'Fruit', '🍈', 15),

  ('theme:sweet', 'theme', 'Sweet finish', '🍯', 19)
ON CONFLICT (id) DO UPDATE SET
  type_id = excluded.type_id, label = excluded.label, emoji = excluded.emoji, sort = excluded.sort;
