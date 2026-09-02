-- Taxonomy added for the expanded catalogue. Applied after seed/seed.sql, which
-- clears and rebuilds tag_types/tags, so these inserts live here rather than there.

INSERT INTO tag_types (id, label, emoji, multi, sort) VALUES
  ('heritage', 'Kitchen it came from', '🏛️', 1, 25);

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
  ('theme:bread',       'theme', 'Bread & the board',       '🍞', 18);

-- Fruit and the sweet end of the table: melon with cheese, figs, apricots.
INSERT INTO tags (id, type_id, label, emoji, sort) VALUES
  ('main:fruit', 'main', 'Fruit', '🍈', 15),

  ('theme:sweet', 'theme', 'Sweet finish', '🍯', 19);
