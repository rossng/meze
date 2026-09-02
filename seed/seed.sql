-- Sample data. Safe to re-run against a live database: mezes, tag_types and
-- tags are upserted (never deleted), so their ids stay stable and nothing
-- that references them by id — night_options, option_votes, menu_items — is
-- ever cascade-deleted. meze_ingredients and meze_tags are pure per-meze leaf
-- tables nothing else points to, so those are safe to wipe and rebuild.
DELETE FROM meze_ingredients WHERE meze_id IN (SELECT id FROM mezes WHERE night_id IS NULL);
DELETE FROM meze_tags WHERE meze_id IN (SELECT id FROM mezes WHERE night_id IS NULL);

-- ---------------------------------------------------------------------------
-- Taxonomy. To add a facet: insert a tag_type. To add a value: insert a tag.
-- ---------------------------------------------------------------------------
INSERT INTO tag_types (id, label, emoji, multi, sort) VALUES
  ('origin',      'Place of origin',   '🗺️', 1, 10),
  ('dietary',     'Dietary',           '🥗', 1, 20),
  ('complexity',  'Complexity',        '🧑‍🍳', 0, 30),
  ('time',        'Time to make',      '⏱️', 0, 40),
  ('ingredients', 'Ingredient count',  '🧺', 0, 50),
  ('main',        'Main ingredient',   '🍆', 1, 60),
  ('temp',        'Served',            '🌡️', 0, 70),
  ('theme',       'Theme',             '🎭', 1, 80)
ON CONFLICT (id) DO UPDATE SET
  label = excluded.label, emoji = excluded.emoji, multi = excluded.multi, sort = excluded.sort;

INSERT INTO tags (id, type_id, label, emoji, sort) VALUES
  ('origin:aegean',        'origin', 'Aegean',                 '🌊', 1),
  ('origin:istanbul',      'origin', 'Istanbul',               '🕌', 2),
  ('origin:mediterranean', 'origin', 'Mediterranean coast',    '☀️', 3),
  ('origin:southeast',     'origin', 'Southeast (Antep, Urfa)','🌶️', 4),
  ('origin:blacksea',      'origin', 'Black Sea',              '🐟', 5),
  ('origin:anatolia',      'origin', 'Central Anatolia',       '🏔️', 6),
  ('origin:thrace',        'origin', 'Thrace & Balkans',       '🫒', 7),
  ('origin:levant',        'origin', 'Shared with the Levant', '🤝', 8),

  ('diet:vegetarian',  'dietary', 'Vegetarian',       '🌱', 1),
  ('diet:vegan',       'dietary', 'Vegan',            '🌿', 2),
  ('diet:gluten-free', 'dietary', 'Gluten free',      '🌾', 3),
  ('diet:dairy-free',  'dietary', 'Dairy free',       '🥛', 4),
  ('diet:nut-free',    'dietary', 'Nut free',         '🥜', 5),
  ('diet:seafood',     'dietary', 'Contains seafood', '🦐', 6),
  ('diet:meat',        'dietary', 'Contains meat',    '🥩', 7),

  ('complexity:easy',    'complexity', 'Easy peasy',   '😌', 1),
  ('complexity:medium',  'complexity', 'Some faff',    '🤔', 2),
  ('complexity:showoff', 'complexity', 'Show-off dish','🎩', 3),

  ('time:quick',    'time', 'Under 20 min',  '⚡', 1),
  ('time:moderate', 'time', '20–45 min',     '🕰️', 2),
  ('time:slow',     'time', 'Over 45 min',   '🐌', 3),

  ('ingredients:few',  'ingredients', '5 or fewer', '🖐️', 1),
  ('ingredients:some', 'ingredients', '6 to 9',     '🧺', 2),
  ('ingredients:many', 'ingredients', '10 or more', '🛒', 3),

  ('main:aubergine', 'main', 'Aubergine',        '🍆', 1),
  ('main:yoghurt',   'main', 'Yoghurt',          '🥣', 2),
  ('main:pulses',    'main', 'Beans & pulses',   '🫘', 3),
  ('main:tomato',    'main', 'Tomato & pepper',  '🍅', 4),
  ('main:cheese',    'main', 'Cheese',           '🧀', 5),
  ('main:seafood',   'main', 'Seafood',          '🦑', 6),
  ('main:meat',      'main', 'Meat & offal',     '🥩', 7),
  ('main:greens',    'main', 'Greens & herbs',   '🌿', 8),
  ('main:grains',    'main', 'Bulgur & grains',  '🌾', 9),
  ('main:veg',       'main', 'Other vegetables', '🥒', 10),
  ('main:nuts',      'main', 'Nuts',             '🌰', 11),

  ('temp:cold', 'temp', 'Cold',  '🧊', 1),
  ('temp:hot',  'temp', 'Hot',   '🔥', 2),

  ('theme:classic',     'theme', 'Meyhane classic',   '🥃', 1),
  ('theme:raki',        'theme', 'Rakı companion',    '🍶', 2),
  ('theme:dip',         'theme', 'Dip / spread',      '🫓', 3),
  ('theme:salad',       'theme', 'Salad',             '🥗', 4),
  ('theme:fried',       'theme', 'Fried & crispy',    '🍳', 5),
  ('theme:stuffed',     'theme', 'Stuffed / rolled',  '🌯', 6),
  ('theme:spicy',       'theme', 'Spicy',             '🌶️', 7),
  ('theme:zeytinyagli', 'theme', 'Zeytinyağlı (olive oil dish)', '🫒', 8),
  ('theme:crowd',       'theme', 'Crowd pleaser',     '🎉', 9),
  ('theme:centrepiece', 'theme', 'Table centrepiece', '👑', 10),
  ('theme:street',      'theme', 'Street food',       '🚶', 11),
  ('theme:seaside',     'theme', 'Seaside',           '⛵', 12)
ON CONFLICT (id) DO UPDATE SET
  type_id = excluded.type_id, label = excluded.label, emoji = excluded.emoji, sort = excluded.sort;

-- ---------------------------------------------------------------------------
-- Mezes. Photos are Wikimedia Commons files (CC licensed) served via
-- Special:FilePath so the URL stays stable if the file is re-encoded.
-- ---------------------------------------------------------------------------
INSERT INTO mezes (id, name, name_tr, description, photo_url, photo_thumb_url, photo_credit, recipe_url, recipe_source, prep_minutes, ingredient_count, serves, art_emoji) VALUES
('hummus', 'Hummus', 'Humus',
 'Chickpeas, tahini, lemon and garlic whipped to a cloud. In Turkey often served warm with butter and pastırma on top, which is frankly the correct decision.',
 '/img/hummus.webp', '/img/hummus-thumb.webp', 'Wikimedia Commons, CC BY-SA 2.0',
 'https://www.giverecipe.com/classic-hummus-parties/', 'Give Recipe', 20, 7, 6, '🫘'),

('cacik', 'Cacık', 'Cacık',
 'Cool yoghurt with grated cucumber, garlic and dried mint. Half dip, half soup, entirely necessary next to anything spicy.',
 '/img/cacik.webp', '/img/cacik-thumb.webp', 'Wikimedia Commons, CC BY-SA 3.0',
 'https://www.giverecipe.com/yogurt-cucumber-dip-cacik/', 'Give Recipe', 10, 6, 4, '🥒'),

('haydari', 'Haydari', 'Haydari',
 'Thick strained yoghurt beaten with garlic, dill and mint, sometimes a little feta. The bouncer of the meze table: nothing gets past it.',
 '/img/haydari.webp', '/img/haydari-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://www.themediterraneandish.com/haydari-turkish-yogurt-dip/', 'The Mediterranean Dish', 15, 6, 6, '🥣'),

('patlican-salatasi', 'Smoky aubergine salad', 'Patlıcan salatası',
 'Aubergines charred over a flame until the skins blister, then chopped with olive oil, lemon and garlic. Tastes like a summer barbecue on the Bosphorus.',
 '/img/patlican-salatasi.webp', '/img/patlican-salatasi-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://cookingorgeous.com/blog/patlican-salatasi-smoky-turkish-eggplant-salad/', 'Cooking Gorgeous', 40, 6, 4, '🍆'),

('babaganus', 'Babaganuş', 'Babaganuş',
 'The smoky aubergine salad''s richer cousin, blended with tahini and yoghurt until silky. Pomegranate seeds on top if you want applause.',
 '/img/babaganus.webp', '/img/babaganus-thumb.webp', 'Wikimedia Commons, public domain',
 'https://vidarbergum.com/recipe/baba-ganoush-moutabal/', 'A Kitchen in Istanbul', 45, 7, 6, '🍆'),

('acili-ezme', 'Spicy tomato & pepper ezme', 'Acılı ezme',
 'Tomatoes, peppers, onion and parsley chopped fine and dressed with pomegranate molasses and chilli. The dish that makes the whole table reach for the rakı.',
 '/img/acili-ezme.webp', '/img/acili-ezme-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://vidarbergum.com/recipe/turkish-ezme-salad/', 'A Kitchen in Istanbul', 25, 10, 6, '🌶️'),

('muhammara', 'Muhammara', 'Muhammara / Acuka',
 'Roasted red peppers pounded with walnuts, breadcrumbs, cumin and pomegranate molasses. Sweet, smoky, nutty, a little bit dangerous.',
 '/img/muhammara.webp', '/img/muhammara-thumb.webp', 'Wikimedia Commons, public domain',
 'https://cookingorgeous.com/blog/muhammara-acuka-red-pepper-dip/', 'Cooking Gorgeous', 30, 9, 6, '🫑'),

('yaprak-sarma', 'Stuffed vine leaves', 'Zeytinyağlı yaprak sarma',
 'Vine leaves rolled tight around rice, onion, currants and pine nuts, cooked in olive oil and lemon. Rolling them is a group activity and a test of friendship.',
 '/img/yaprak-sarma.webp', '/img/yaprak-sarma-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://www.giverecipe.com/meatless-stuffed-grape-leaves/', 'Give Recipe', 120, 11, 8, '🍃'),

('sigara-boregi', 'Cheese cigar pastries', 'Sigara böreği',
 'Thin yufka pastry rolled around feta and parsley, fried until they shatter. Nobody has ever eaten just one.',
 '/img/sigara-boregi.webp', '/img/sigara-boregi-thumb.webp', 'Wikimedia Commons, CC BY-SA 3.0',
 'https://www.themediterraneandish.com/sigara-boregi-turkish-cheese-rolls/', 'The Mediterranean Dish', 35, 5, 4, '🧀'),

('fava', 'Broad bean purée', 'Fava',
 'Dried broad beans simmered down, blended with olive oil and set into a smooth pale slab, sliced and topped with dill and red onion. Quietly elegant.',
 '/img/fava.webp', '/img/fava-thumb.webp', 'Wikimedia Commons, CC BY-SA 3.0',
 'https://ozlemsturkishtable.com/2013/08/broad-beans-dip-with-dill-and-sauteed-red-peppers-zeytinyagli-kirmizi-biberli-fava/', 'Ozlem''s Turkish Table', 60, 7, 6, '🫘'),

('piyaz', 'White bean salad', 'Piyaz',
 'White beans with onion, tomato, parsley and egg in a sharp tahini dressing, the way they do it in Antalya. Meets every köfte it has ever loved.',
 '/img/piyaz.webp', '/img/piyaz-thumb.webp', 'Wikimedia Commons, public domain',
 'https://ozlemsturkishtable.com/2024/08/antalya-style-bean-salad-with-tahini-sauce/', 'Ozlem''s Turkish Table', 20, 9, 4, '🫘'),

('coban-salatasi', 'Shepherd''s salad', 'Çoban salatası',
 'Tomato, cucumber, pepper, onion and parsley, diced small, olive oil and lemon. The salad that keeps the table honest.',
 '/img/coban-salatasi.webp', '/img/coban-salatasi-thumb.webp', 'Wikimedia Commons, CC BY-SA 3.0',
 'https://vidarbergum.com/recipe/turkish-shepherd-salad-coban-salatasi/', 'A Kitchen in Istanbul', 15, 7, 4, '🍅'),

('kisir', 'Spicy bulgur salad', 'Kısır',
 'Fine bulgur soaked with tomato and pepper paste, pomegranate molasses, lots of herbs and spring onion. Scoop it up in lettuce leaves.',
 '/img/kisir.webp', '/img/kisir-thumb.webp', 'Wikimedia Commons, CC BY-SA 3.0',
 'https://vidarbergum.com/recipe/kisir-spicy-turkish-bulgur-wheat-salad/', 'A Kitchen in Istanbul', 30, 11, 6, '🌾'),

('saksuka', 'Fried aubergine in tomato sauce', 'Şakşuka',
 'Cubes of aubergine, courgette and pepper fried then bathed in garlicky tomato sauce. Served cold, usually with yoghurt. Not the egg one.',
 '/img/saksuka.webp', '/img/saksuka-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://vidarbergum.com/recipe/saksuka-turkish-fried-vegetables/', 'A Kitchen in Istanbul', 45, 8, 4, '🍆'),

('imam-bayildi', 'İmam bayıldı', 'İmam bayıldı',
 'Whole aubergines stuffed with onion, tomato and garlic and braised in a heroic amount of olive oil. The imam fainted. You might too.',
 '/img/imam-bayildi.webp', '/img/imam-bayildi-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://vidarbergum.com/recipe/imam-bayildi-turkish-stuffed-aubergines/', 'A Kitchen in Istanbul', 75, 9, 4, '🍆'),

('midye-dolma', 'Stuffed mussels', 'Midye dolma',
 'Mussels stuffed with spiced rice, currants and pine nuts, eaten with a squeeze of lemon, one shell used as the spoon. Istanbul street food royalty.',
 '/img/midye-dolma.webp', '/img/midye-dolma-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://ozlemsturkishtable.com/2015/06/homemade-stuffed-mussels-with-aromatic-rice-midye-dolma/', 'Ozlem''s Turkish Table', 90, 12, 6, '🦪'),

('arnavut-cigeri', 'Albanian-style fried liver', 'Arnavut ciğeri',
 'Cubes of lamb liver dusted in flour and paprika, flash fried, served with sumac-heavy raw onions. The meyhane dish for people who mean business.',
 '/img/arnavut-cigeri.webp', '/img/arnavut-cigeri-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://cookingorgeous.com/blog/arnavut-cigeri/', 'Cooking Gorgeous', 25, 8, 4, '🥩'),

('lakerda', 'Cured bonito', 'Lakerda',
 'Bonito salted and cured until it turns translucent and buttery, sliced thin with red onion. The rakı table''s answer to gravlax. Buy it or cure your own, if you have a week.',
 '/img/lakerda.webp', '/img/lakerda-thumb.webp', 'Wikimedia Commons, CC BY 4.0',
 'https://www.havatopraksu.org/blog/2018/08/01/salt-cured-bonito-lakerda/', 'Hava Toprak Su', 20, 4, 4, '🐟'),

('beyaz-peynir', 'White cheese with olives & melon', 'Beyaz peynir, zeytin, kavun',
 'A slab of brined white cheese, a heap of olives and, in season, a wedge of melon. Zero cooking, one hundred percent meyhane. The rakı''s oldest friend.',
 '/img/beyaz-peynir.webp', '/img/beyaz-peynir-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'http://marmadukescarlet.blogspot.com/2011/07/marinated-beyaz-peynir-turkish-white.html', 'Marmaduke Scarlet', 5, 3, 4, '🧀'),

('enginar', 'Artichokes in olive oil', 'Zeytinyağlı enginar',
 'Artichoke hearts gently cooked with peas, carrot and potato in olive oil and lemon. Spring on a plate, served cold with a lot of dill.',
 '/img/enginar.webp', '/img/enginar-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://www.giverecipe.com/artichoke-with-veggies/', 'Give Recipe', 50, 8, 4, '🌿'),

('barbunya', 'Borlotti beans in olive oil', 'Barbunya pilaki',
 'Speckled borlotti beans stewed with onion, carrot, tomato and garlic in olive oil, served at room temperature with lemon. Humble and unbeatable.',
 '/img/barbunya.webp', '/img/barbunya-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://vidarbergum.com/recipe/turkish-style-borlotti-beans-barbunya-pilaki/', 'A Kitchen in Istanbul', 60, 9, 6, '🫘'),

('mucver', 'Courgette fritters', 'Mücver',
 'Grated courgette with feta, dill, spring onion and egg, fried into lacy golden fritters. Dunk in yoghurt. Repeat.',
 '/img/mucver.webp', '/img/mucver-thumb.webp', 'Wikimedia Commons, CC0',
 'https://vidarbergum.com/recipe/mucver-turkish-courgette-zucchini-fritters/', 'A Kitchen in Istanbul', 35, 9, 4, '🥒'),

('cig-kofte', 'Vegan çiğ köfte', 'Çiğ köfte',
 'Fine bulgur kneaded for ages with pepper paste, spices and a mountain of isot chilli until it turns into something meaty without any meat. Wrap in lettuce with lemon.',
 '/img/cig-kofte.webp', '/img/cig-kofte-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://vidarbergum.com/recipe/cig-kofte-turkish-spicy-bulgur-balls/', 'A Kitchen in Istanbul', 60, 12, 6, '🌶️'),

('kalamar', 'Fried calamari with tarator', 'Kalamar tava',
 'Squid rings in a light crisp batter with a garlicky walnut tarator sauce. The dish every seaside meyhane has, and for good reason.',
 '/img/kalamar.webp', '/img/kalamar-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://www.giverecipe.com/deep-fried-calamari-tarator-sauce/', 'Give Recipe', 40, 9, 4, '🦑'),

('deniz-borulcesi', 'Samphire salad', 'Deniz börülcesi salatası',
 'Sea samphire blanched, stripped from its stems and dressed with garlic, lemon and olive oil. Salty, snappy, tastes like the Aegean.',
 '/img/deniz-borulcesi.webp', '/img/deniz-borulcesi-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://ozlemsturkishtable.com/2013/06/seasonal-samphire-with-salmon-in-cherry-tomatoes-olives-and-anchovies-lets-hear-from-the-residents/', 'Ozlem''s Turkish Table', 20, 5, 4, '🌿'),

('semizotu', 'Purslane with garlic yoghurt', 'Yoğurtlu semizotu',
 'Juicy purslane leaves folded through garlicky yoghurt. Crunchy, cooling, and takes about as long as pouring a drink.',
 '/img/semizotu.webp', '/img/semizotu-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://ozlemsturkishtable.com/2010/04/lambs-lettuce-salad-with-garlic-yoghurt-yogurtlu-semizotu-salatasi/', 'Ozlem''s Turkish Table', 10, 5, 4, '🌿'),

('karides-guvec', 'Prawn casserole', 'Karides güveç',
 'Prawns baked in a clay dish with tomato, peppers, garlic and butter, cheese melted on top. Arrives bubbling. Bread is not optional.',
 '/img/karides-guvec.webp', '/img/karides-guvec-thumb.webp', 'Wikimedia Commons, CC BY-SA 3.0',
 'https://cookingorgeous.com/blog/baked-prawns-karides-guvec/', 'Cooking Gorgeous', 30, 10, 4, '🦐'),

('meze-tabagi', 'The mixed meze platter', 'Karışık meze tabağı',
 'A little of everything: a spoon of each dip, a few olives, some cheese, whatever the kitchen is proud of tonight. For when the table cannot decide.',
 '/img/meze-tabagi.webp', '/img/meze-tabagi-thumb.webp', 'Wikimedia Commons, CC BY-SA 4.0',
 'https://thebitterolive.com/mezze-platter/', 'The Bitter Olive', 30, 12, 6, '🍽️'),

('atom', 'Atom', 'Atom',
 'Thick garlicky yoghurt under a slick of butter that has been sizzled with whole dried chillies. Named after the bomb, tastes like one. A Beyoğlu meyhane speciality.',
 NULL, NULL, NULL, 'https://www.turkeysforlife.com/2024/12/atom-meze-turkish-yoghurt-chilli.html', 'Turkey''s For Life', 15, 5, 4, '💥'),

('topik', 'Topik', 'Topik',
 'An Armenian-Istanbul classic: a chickpea and potato shell wrapped around a filling of onions, currants, pine nuts, tahini and cinnamon, chilled and sliced. Rare, laborious, worth it.',
 NULL, NULL, NULL, 'https://turkishstylecooking.com/topik-recipe.html', 'Turkish Style Cooking', 120, 12, 8, '🌰'),

('girit-ezmesi', 'Cretan feta & herb spread', 'Girit ezmesi',
 'Feta mashed with walnuts, pistachios, lots of fresh herbs, olive oil and a pinch of chilli. Brought to Turkey by Cretan Turks and adopted by every meyhane on the Aegean.',
 NULL, NULL, NULL, 'https://vidarbergum.com/recipe/girit-ezmesi/', 'A Kitchen in Istanbul', 15, 8, 6, '🧀'),

('kopoglu', 'Köpoğlu', 'Köpoğlu',
 'Fried aubergine and peppers in tomato sauce with garlicky yoghurt spooned over the top. Şakşuka''s indulgent cousin.',
 NULL, NULL, NULL, 'https://culinarybackstreets.com/cities-category/istanbul/2024/recipe-24/', 'Culinary Backstreets', 45, 9, 4, '🍆')
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name, name_tr = excluded.name_tr, description = excluded.description,
  photo_url = excluded.photo_url, photo_thumb_url = excluded.photo_thumb_url, photo_credit = excluded.photo_credit,
  recipe_url = excluded.recipe_url, recipe_source = excluded.recipe_source,
  prep_minutes = excluded.prep_minutes, ingredient_count = excluded.ingredient_count, serves = excluded.serves,
  art_emoji = excluded.art_emoji;

INSERT INTO meze_tags (meze_id, tag_id) VALUES
-- hummus
('hummus','origin:levant'),('hummus','origin:southeast'),('hummus','diet:vegetarian'),('hummus','diet:vegan'),('hummus','diet:gluten-free'),('hummus','diet:dairy-free'),('hummus','diet:nut-free'),
('hummus','complexity:easy'),('hummus','time:moderate'),('hummus','ingredients:some'),('hummus','main:pulses'),('hummus','temp:cold'),('hummus','theme:dip'),('hummus','theme:crowd'),
-- cacik
('cacik','origin:anatolia'),('cacik','diet:vegetarian'),('cacik','diet:gluten-free'),('cacik','diet:nut-free'),
('cacik','complexity:easy'),('cacik','time:quick'),('cacik','ingredients:some'),('cacik','main:yoghurt'),('cacik','temp:cold'),('cacik','theme:dip'),('cacik','theme:classic'),('cacik','theme:raki'),
-- haydari
('haydari','origin:istanbul'),('haydari','diet:vegetarian'),('haydari','diet:gluten-free'),('haydari','diet:nut-free'),
('haydari','complexity:easy'),('haydari','time:quick'),('haydari','ingredients:some'),('haydari','main:yoghurt'),('haydari','temp:cold'),('haydari','theme:dip'),('haydari','theme:classic'),('haydari','theme:raki'),('haydari','theme:crowd'),
-- patlican salatasi
('patlican-salatasi','origin:aegean'),('patlican-salatasi','diet:vegetarian'),('patlican-salatasi','diet:vegan'),('patlican-salatasi','diet:gluten-free'),('patlican-salatasi','diet:dairy-free'),('patlican-salatasi','diet:nut-free'),
('patlican-salatasi','complexity:medium'),('patlican-salatasi','time:moderate'),('patlican-salatasi','ingredients:some'),('patlican-salatasi','main:aubergine'),('patlican-salatasi','temp:cold'),('patlican-salatasi','theme:salad'),('patlican-salatasi','theme:classic'),('patlican-salatasi','theme:raki'),
-- babaganus
('babaganus','origin:southeast'),('babaganus','origin:levant'),('babaganus','diet:vegetarian'),('babaganus','diet:gluten-free'),('babaganus','diet:nut-free'),
('babaganus','complexity:medium'),('babaganus','time:moderate'),('babaganus','ingredients:some'),('babaganus','main:aubergine'),('babaganus','temp:cold'),('babaganus','theme:dip'),('babaganus','theme:crowd'),
-- acili ezme
('acili-ezme','origin:southeast'),('acili-ezme','diet:vegetarian'),('acili-ezme','diet:vegan'),('acili-ezme','diet:gluten-free'),('acili-ezme','diet:dairy-free'),('acili-ezme','diet:nut-free'),
('acili-ezme','complexity:easy'),('acili-ezme','time:moderate'),('acili-ezme','ingredients:many'),('acili-ezme','main:tomato'),('acili-ezme','temp:cold'),('acili-ezme','theme:dip'),('acili-ezme','theme:spicy'),('acili-ezme','theme:classic'),('acili-ezme','theme:raki'),
-- muhammara
('muhammara','origin:southeast'),('muhammara','origin:levant'),('muhammara','diet:vegetarian'),('muhammara','diet:vegan'),('muhammara','diet:dairy-free'),
('muhammara','complexity:medium'),('muhammara','time:moderate'),('muhammara','ingredients:some'),('muhammara','main:tomato'),('muhammara','main:nuts'),('muhammara','temp:cold'),('muhammara','theme:dip'),('muhammara','theme:spicy'),
-- yaprak sarma
('yaprak-sarma','origin:aegean'),('yaprak-sarma','origin:istanbul'),('yaprak-sarma','diet:vegetarian'),('yaprak-sarma','diet:vegan'),('yaprak-sarma','diet:gluten-free'),('yaprak-sarma','diet:dairy-free'),
('yaprak-sarma','complexity:showoff'),('yaprak-sarma','time:slow'),('yaprak-sarma','ingredients:many'),('yaprak-sarma','main:grains'),('yaprak-sarma','main:greens'),('yaprak-sarma','temp:cold'),('yaprak-sarma','theme:stuffed'),('yaprak-sarma','theme:zeytinyagli'),('yaprak-sarma','theme:classic'),('yaprak-sarma','theme:centrepiece'),
-- sigara boregi
('sigara-boregi','origin:istanbul'),('sigara-boregi','diet:vegetarian'),('sigara-boregi','diet:nut-free'),
('sigara-boregi','complexity:medium'),('sigara-boregi','time:moderate'),('sigara-boregi','ingredients:few'),('sigara-boregi','main:cheese'),('sigara-boregi','temp:hot'),('sigara-boregi','theme:fried'),('sigara-boregi','theme:stuffed'),('sigara-boregi','theme:crowd'),('sigara-boregi','theme:classic'),
-- fava
('fava','origin:aegean'),('fava','origin:istanbul'),('fava','diet:vegetarian'),('fava','diet:vegan'),('fava','diet:gluten-free'),('fava','diet:dairy-free'),('fava','diet:nut-free'),
('fava','complexity:medium'),('fava','time:slow'),('fava','ingredients:some'),('fava','main:pulses'),('fava','temp:cold'),('fava','theme:dip'),('fava','theme:zeytinyagli'),('fava','theme:classic'),('fava','theme:raki'),
-- piyaz
('piyaz','origin:mediterranean'),('piyaz','diet:vegetarian'),('piyaz','diet:gluten-free'),('piyaz','diet:dairy-free'),('piyaz','diet:nut-free'),
('piyaz','complexity:easy'),('piyaz','time:quick'),('piyaz','ingredients:some'),('piyaz','main:pulses'),('piyaz','temp:cold'),('piyaz','theme:salad'),('piyaz','theme:classic'),
-- coban salatasi
('coban-salatasi','origin:anatolia'),('coban-salatasi','diet:vegetarian'),('coban-salatasi','diet:vegan'),('coban-salatasi','diet:gluten-free'),('coban-salatasi','diet:dairy-free'),('coban-salatasi','diet:nut-free'),
('coban-salatasi','complexity:easy'),('coban-salatasi','time:quick'),('coban-salatasi','ingredients:some'),('coban-salatasi','main:tomato'),('coban-salatasi','main:veg'),('coban-salatasi','temp:cold'),('coban-salatasi','theme:salad'),('coban-salatasi','theme:crowd'),
-- kisir
('kisir','origin:southeast'),('kisir','origin:anatolia'),('kisir','diet:vegetarian'),('kisir','diet:vegan'),('kisir','diet:dairy-free'),('kisir','diet:nut-free'),
('kisir','complexity:easy'),('kisir','time:moderate'),('kisir','ingredients:many'),('kisir','main:grains'),('kisir','temp:cold'),('kisir','theme:salad'),('kisir','theme:spicy'),('kisir','theme:crowd'),
-- saksuka
('saksuka','origin:istanbul'),('saksuka','origin:aegean'),('saksuka','diet:vegetarian'),('saksuka','diet:vegan'),('saksuka','diet:gluten-free'),('saksuka','diet:dairy-free'),('saksuka','diet:nut-free'),
('saksuka','complexity:medium'),('saksuka','time:moderate'),('saksuka','ingredients:some'),('saksuka','main:aubergine'),('saksuka','main:tomato'),('saksuka','temp:cold'),('saksuka','theme:fried'),('saksuka','theme:classic'),
-- imam bayildi
('imam-bayildi','origin:istanbul'),('imam-bayildi','diet:vegetarian'),('imam-bayildi','diet:vegan'),('imam-bayildi','diet:gluten-free'),('imam-bayildi','diet:dairy-free'),('imam-bayildi','diet:nut-free'),
('imam-bayildi','complexity:showoff'),('imam-bayildi','time:slow'),('imam-bayildi','ingredients:some'),('imam-bayildi','main:aubergine'),('imam-bayildi','temp:cold'),('imam-bayildi','theme:stuffed'),('imam-bayildi','theme:zeytinyagli'),('imam-bayildi','theme:centrepiece'),('imam-bayildi','theme:classic'),
-- midye dolma
('midye-dolma','origin:istanbul'),('midye-dolma','origin:aegean'),('midye-dolma','diet:seafood'),('midye-dolma','diet:gluten-free'),('midye-dolma','diet:dairy-free'),
('midye-dolma','complexity:showoff'),('midye-dolma','time:slow'),('midye-dolma','ingredients:many'),('midye-dolma','main:seafood'),('midye-dolma','main:grains'),('midye-dolma','temp:cold'),('midye-dolma','theme:stuffed'),('midye-dolma','theme:street'),('midye-dolma','theme:seaside'),('midye-dolma','theme:centrepiece'),
-- arnavut cigeri
('arnavut-cigeri','origin:istanbul'),('arnavut-cigeri','origin:thrace'),('arnavut-cigeri','diet:meat'),('arnavut-cigeri','diet:dairy-free'),('arnavut-cigeri','diet:nut-free'),
('arnavut-cigeri','complexity:medium'),('arnavut-cigeri','time:moderate'),('arnavut-cigeri','ingredients:some'),('arnavut-cigeri','main:meat'),('arnavut-cigeri','temp:hot'),('arnavut-cigeri','theme:fried'),('arnavut-cigeri','theme:classic'),('arnavut-cigeri','theme:raki'),
-- lakerda
('lakerda','origin:istanbul'),('lakerda','origin:blacksea'),('lakerda','diet:seafood'),('lakerda','diet:gluten-free'),('lakerda','diet:dairy-free'),('lakerda','diet:nut-free'),
('lakerda','complexity:easy'),('lakerda','time:quick'),('lakerda','ingredients:few'),('lakerda','main:seafood'),('lakerda','temp:cold'),('lakerda','theme:classic'),('lakerda','theme:raki'),('lakerda','theme:seaside'),
-- beyaz peynir
('beyaz-peynir','origin:thrace'),('beyaz-peynir','origin:aegean'),('beyaz-peynir','diet:vegetarian'),('beyaz-peynir','diet:gluten-free'),('beyaz-peynir','diet:nut-free'),
('beyaz-peynir','complexity:easy'),('beyaz-peynir','time:quick'),('beyaz-peynir','ingredients:few'),('beyaz-peynir','main:cheese'),('beyaz-peynir','temp:cold'),('beyaz-peynir','theme:classic'),('beyaz-peynir','theme:raki'),
-- enginar
('enginar','origin:aegean'),('enginar','origin:istanbul'),('enginar','diet:vegetarian'),('enginar','diet:vegan'),('enginar','diet:gluten-free'),('enginar','diet:dairy-free'),('enginar','diet:nut-free'),
('enginar','complexity:medium'),('enginar','time:slow'),('enginar','ingredients:some'),('enginar','main:veg'),('enginar','temp:cold'),('enginar','theme:zeytinyagli'),('enginar','theme:classic'),
-- barbunya
('barbunya','origin:aegean'),('barbunya','origin:istanbul'),('barbunya','diet:vegetarian'),('barbunya','diet:vegan'),('barbunya','diet:gluten-free'),('barbunya','diet:dairy-free'),('barbunya','diet:nut-free'),
('barbunya','complexity:easy'),('barbunya','time:slow'),('barbunya','ingredients:some'),('barbunya','main:pulses'),('barbunya','temp:cold'),('barbunya','theme:zeytinyagli'),('barbunya','theme:classic'),
-- mucver
('mucver','origin:aegean'),('mucver','origin:istanbul'),('mucver','diet:vegetarian'),('mucver','diet:nut-free'),
('mucver','complexity:medium'),('mucver','time:moderate'),('mucver','ingredients:some'),('mucver','main:veg'),('mucver','main:cheese'),('mucver','temp:hot'),('mucver','theme:fried'),('mucver','theme:crowd'),
-- cig kofte
('cig-kofte','origin:southeast'),('cig-kofte','diet:vegetarian'),('cig-kofte','diet:vegan'),('cig-kofte','diet:dairy-free'),('cig-kofte','diet:nut-free'),
('cig-kofte','complexity:medium'),('cig-kofte','time:slow'),('cig-kofte','ingredients:many'),('cig-kofte','main:grains'),('cig-kofte','temp:cold'),('cig-kofte','theme:spicy'),('cig-kofte','theme:street'),('cig-kofte','theme:crowd'),
-- kalamar
('kalamar','origin:aegean'),('kalamar','origin:mediterranean'),('kalamar','diet:seafood'),
('kalamar','complexity:medium'),('kalamar','time:moderate'),('kalamar','ingredients:some'),('kalamar','main:seafood'),('kalamar','temp:hot'),('kalamar','theme:fried'),('kalamar','theme:seaside'),('kalamar','theme:crowd'),('kalamar','theme:raki'),
-- deniz borulcesi
('deniz-borulcesi','origin:aegean'),('deniz-borulcesi','diet:vegetarian'),('deniz-borulcesi','diet:vegan'),('deniz-borulcesi','diet:gluten-free'),('deniz-borulcesi','diet:dairy-free'),('deniz-borulcesi','diet:nut-free'),
('deniz-borulcesi','complexity:easy'),('deniz-borulcesi','time:quick'),('deniz-borulcesi','ingredients:few'),('deniz-borulcesi','main:greens'),('deniz-borulcesi','temp:cold'),('deniz-borulcesi','theme:salad'),('deniz-borulcesi','theme:seaside'),('deniz-borulcesi','theme:zeytinyagli'),
-- semizotu
('semizotu','origin:aegean'),('semizotu','origin:anatolia'),('semizotu','diet:vegetarian'),('semizotu','diet:gluten-free'),('semizotu','diet:nut-free'),
('semizotu','complexity:easy'),('semizotu','time:quick'),('semizotu','ingredients:few'),('semizotu','main:greens'),('semizotu','main:yoghurt'),('semizotu','temp:cold'),('semizotu','theme:salad'),
-- karides guvec
('karides-guvec','origin:aegean'),('karides-guvec','origin:mediterranean'),('karides-guvec','diet:seafood'),('karides-guvec','diet:gluten-free'),('karides-guvec','diet:nut-free'),
('karides-guvec','complexity:medium'),('karides-guvec','time:moderate'),('karides-guvec','ingredients:many'),('karides-guvec','main:seafood'),('karides-guvec','temp:hot'),('karides-guvec','theme:seaside'),('karides-guvec','theme:centrepiece'),
-- meze tabagi
('atom','origin:istanbul'),('atom','diet:vegetarian'),('atom','diet:gluten-free'),('atom','diet:nut-free'),
('atom','complexity:easy'),('atom','time:quick'),('atom','ingredients:few'),('atom','main:yoghurt'),('atom','temp:cold'),('atom','theme:dip'),('atom','theme:spicy'),('atom','theme:classic'),('atom','theme:raki'),
('topik','origin:istanbul'),('topik','diet:vegetarian'),('topik','diet:vegan'),('topik','diet:gluten-free'),('topik','diet:dairy-free'),
('topik','complexity:showoff'),('topik','time:slow'),('topik','ingredients:many'),('topik','main:pulses'),('topik','main:nuts'),('topik','temp:cold'),('topik','theme:stuffed'),('topik','theme:classic'),('topik','theme:centrepiece'),
('girit-ezmesi','origin:aegean'),('girit-ezmesi','diet:vegetarian'),('girit-ezmesi','diet:gluten-free'),
('girit-ezmesi','complexity:easy'),('girit-ezmesi','time:quick'),('girit-ezmesi','ingredients:some'),('girit-ezmesi','main:cheese'),('girit-ezmesi','main:nuts'),('girit-ezmesi','main:greens'),('girit-ezmesi','temp:cold'),('girit-ezmesi','theme:dip'),('girit-ezmesi','theme:raki'),('girit-ezmesi','theme:classic'),
('kopoglu','origin:istanbul'),('kopoglu','origin:anatolia'),('kopoglu','diet:vegetarian'),('kopoglu','diet:gluten-free'),('kopoglu','diet:nut-free'),
('kopoglu','complexity:medium'),('kopoglu','time:moderate'),('kopoglu','ingredients:some'),('kopoglu','main:aubergine'),('kopoglu','main:yoghurt'),('kopoglu','temp:cold'),('kopoglu','theme:fried'),('kopoglu','theme:classic'),
('meze-tabagi','origin:istanbul'),('meze-tabagi','diet:vegetarian'),
('meze-tabagi','complexity:easy'),('meze-tabagi','time:moderate'),('meze-tabagi','ingredients:many'),('meze-tabagi','main:cheese'),('meze-tabagi','main:yoghurt'),('meze-tabagi','temp:cold'),('meze-tabagi','theme:classic'),('meze-tabagi','theme:raki'),('meze-tabagi','theme:centrepiece'),('meze-tabagi','theme:crowd');

-- ---------------------------------------------------------------------------
-- Rough ingredient lists (meze portions for the "serves" count on each meze).
-- The linked recipe is authoritative; these exist to build a shopping list.
-- ---------------------------------------------------------------------------
INSERT INTO meze_ingredients (meze_id, sort, quantity, unit, item, note) VALUES
('hummus',1,400,'g','cooked chickpeas','1 large tin'),('hummus',2,4,'tbsp','tahini',NULL),('hummus',3,1,NULL,'lemon','juiced'),('hummus',4,2,'clove','garlic',NULL),('hummus',5,3,'tbsp','olive oil',NULL),('hummus',6,1,'tsp','ground cumin',NULL),('hummus',7,NULL,NULL,'salt & paprika','to finish'),
('cacik',1,500,'g','plain yoghurt',NULL),('cacik',2,1,NULL,'cucumber',NULL),('cacik',3,1,'clove','garlic',NULL),('cacik',4,1,'tsp','dried mint',NULL),('cacik',5,1,'tbsp','olive oil',NULL),('cacik',6,NULL,NULL,'salt',NULL),
('haydari',1,500,'g','thick strained yoghurt (süzme)',NULL),('haydari',2,100,'g','feta',NULL),('haydari',3,2,'clove','garlic',NULL),('haydari',4,1,'bunch','dill',NULL),('haydari',5,1,'tbsp','dried mint',NULL),('haydari',6,2,'tbsp','olive oil',NULL),
('patlican-salatasi',1,3,NULL,'large aubergines',NULL),('patlican-salatasi',2,1,'clove','garlic',NULL),('patlican-salatasi',3,1,NULL,'lemon','juiced'),('patlican-salatasi',4,4,'tbsp','olive oil',NULL),('patlican-salatasi',5,0.5,'bunch','parsley',NULL),('patlican-salatasi',6,NULL,NULL,'salt',NULL),
('babaganus',1,3,NULL,'large aubergines',NULL),('babaganus',2,3,'tbsp','tahini',NULL),('babaganus',3,3,'tbsp','plain yoghurt',NULL),('babaganus',4,1,NULL,'lemon','juiced'),('babaganus',5,2,'clove','garlic',NULL),('babaganus',6,3,'tbsp','olive oil',NULL),('babaganus',7,1,NULL,'pomegranate','seeds, to finish'),
('acili-ezme',1,4,NULL,'ripe tomatoes',NULL),('acili-ezme',2,2,NULL,'green peppers',NULL),('acili-ezme',3,1,NULL,'red pepper',NULL),('acili-ezme',4,1,NULL,'onion',NULL),('acili-ezme',5,1,'bunch','parsley',NULL),('acili-ezme',6,2,'tbsp','pomegranate molasses',NULL),('acili-ezme',7,1,'tbsp','pepper paste (biber salçası)',NULL),('acili-ezme',8,1,'tsp','pul biber (chilli flakes)',NULL),('acili-ezme',9,3,'tbsp','olive oil',NULL),('acili-ezme',10,0.5,NULL,'lemon','juiced'),
('muhammara',1,3,NULL,'red peppers','roasted'),('muhammara',2,120,'g','walnuts',NULL),('muhammara',3,40,'g','breadcrumbs',NULL),('muhammara',4,2,'tbsp','pomegranate molasses',NULL),('muhammara',5,1,'clove','garlic',NULL),('muhammara',6,1,'tsp','ground cumin',NULL),('muhammara',7,1,'tsp','pul biber (chilli flakes)',NULL),('muhammara',8,4,'tbsp','olive oil',NULL),('muhammara',9,0.5,NULL,'lemon','juiced'),
('yaprak-sarma',1,60,NULL,'vine leaves','1 jar, brined'),('yaprak-sarma',2,300,'g','short-grain rice',NULL),('yaprak-sarma',3,3,NULL,'onions',NULL),('yaprak-sarma',4,3,'tbsp','pine nuts',NULL),('yaprak-sarma',5,3,'tbsp','currants',NULL),('yaprak-sarma',6,150,'ml','olive oil',NULL),('yaprak-sarma',7,2,NULL,'lemons',NULL),('yaprak-sarma',8,1,'bunch','dill',NULL),('yaprak-sarma',9,1,'bunch','mint',NULL),('yaprak-sarma',10,1,'tsp','allspice',NULL),('yaprak-sarma',11,1,'tsp','sugar',NULL),
('sigara-boregi',1,1,'pack','yufka or filo pastry','about 6 sheets'),('sigara-boregi',2,250,'g','feta',NULL),('sigara-boregi',3,0.5,'bunch','parsley',NULL),('sigara-boregi',4,1,NULL,'egg',NULL),('sigara-boregi',5,500,'ml','sunflower oil','for frying'),
('fava',1,250,'g','dried split broad beans (fava)',NULL),('fava',2,1,NULL,'onion',NULL),('fava',3,100,'ml','olive oil',NULL),('fava',4,1,NULL,'lemon',NULL),('fava',5,1,'bunch','dill',NULL),('fava',6,1,NULL,'red onion','to serve'),('fava',7,1,'tsp','sugar',NULL),
('piyaz',1,400,'g','cooked white beans','1 large tin'),('piyaz',2,1,NULL,'onion',NULL),('piyaz',3,2,NULL,'tomatoes',NULL),('piyaz',4,2,NULL,'eggs','hard boiled'),('piyaz',5,3,'tbsp','tahini',NULL),('piyaz',6,1,NULL,'lemon','juiced'),('piyaz',7,2,'clove','garlic',NULL),('piyaz',8,0.5,'bunch','parsley',NULL),('piyaz',9,1,'tsp','sumac',NULL),
('coban-salatasi',1,3,NULL,'tomatoes',NULL),('coban-salatasi',2,1,NULL,'cucumber',NULL),('coban-salatasi',3,2,NULL,'green peppers',NULL),('coban-salatasi',4,1,NULL,'red onion',NULL),('coban-salatasi',5,0.5,'bunch','parsley',NULL),('coban-salatasi',6,3,'tbsp','olive oil',NULL),('coban-salatasi',7,1,NULL,'lemon','juiced'),
('kisir',1,250,'g','fine bulgur',NULL),('kisir',2,2,'tbsp','tomato paste',NULL),('kisir',3,1,'tbsp','pepper paste (biber salçası)',NULL),('kisir',4,3,'tbsp','pomegranate molasses',NULL),('kisir',5,1,'bunch','parsley',NULL),('kisir',6,4,NULL,'spring onions',NULL),('kisir',7,2,NULL,'tomatoes',NULL),('kisir',8,1,NULL,'cucumber',NULL),('kisir',9,1,NULL,'lemon','juiced'),('kisir',10,4,'tbsp','olive oil',NULL),('kisir',11,1,'tsp','pul biber (chilli flakes)',NULL),
('saksuka',1,2,NULL,'aubergines',NULL),('saksuka',2,1,NULL,'courgette',NULL),('saksuka',3,2,NULL,'green peppers',NULL),('saksuka',4,3,NULL,'tomatoes',NULL),('saksuka',5,3,'clove','garlic',NULL),('saksuka',6,1,'tbsp','tomato paste',NULL),('saksuka',7,200,'ml','sunflower oil','for frying'),('saksuka',8,1,'tsp','sugar',NULL),
('imam-bayildi',1,4,NULL,'small aubergines',NULL),('imam-bayildi',2,3,NULL,'onions',NULL),('imam-bayildi',3,3,NULL,'tomatoes',NULL),('imam-bayildi',4,4,'clove','garlic',NULL),('imam-bayildi',5,150,'ml','olive oil',NULL),('imam-bayildi',6,0.5,'bunch','parsley',NULL),('imam-bayildi',7,1,'tsp','sugar',NULL),('imam-bayildi',8,1,NULL,'lemon',NULL),('imam-bayildi',9,1,NULL,'green pepper',NULL),
('midye-dolma',1,30,NULL,'large fresh mussels','in shell'),('midye-dolma',2,200,'g','short-grain rice',NULL),('midye-dolma',3,2,NULL,'onions',NULL),('midye-dolma',4,2,'tbsp','pine nuts',NULL),('midye-dolma',5,2,'tbsp','currants',NULL),('midye-dolma',6,100,'ml','olive oil',NULL),('midye-dolma',7,1,'tsp','allspice',NULL),('midye-dolma',8,1,'tsp','cinnamon',NULL),('midye-dolma',9,0.5,'tsp','black pepper',NULL),('midye-dolma',10,1,'tbsp','tomato paste',NULL),('midye-dolma',11,0.5,'bunch','dill',NULL),('midye-dolma',12,2,NULL,'lemons','to serve'),
('arnavut-cigeri',1,500,'g','lamb liver',NULL),('arnavut-cigeri',2,3,'tbsp','plain flour',NULL),('arnavut-cigeri',3,1,'tsp','paprika',NULL),('arnavut-cigeri',4,1,'tsp','pul biber (chilli flakes)',NULL),('arnavut-cigeri',5,2,NULL,'red onions',NULL),('arnavut-cigeri',6,1,'tbsp','sumac',NULL),('arnavut-cigeri',7,0.5,'bunch','parsley',NULL),('arnavut-cigeri',8,100,'ml','sunflower oil','for frying'),
('lakerda',1,300,'g','lakerda (cured bonito)','from a Turkish deli'),('lakerda',2,1,NULL,'red onion',NULL),('lakerda',3,1,NULL,'lemon',NULL),('lakerda',4,2,'tbsp','olive oil',NULL),
('beyaz-peynir',1,300,'g','beyaz peynir (Turkish white cheese)',NULL),('beyaz-peynir',2,200,'g','mixed olives',NULL),('beyaz-peynir',3,0.5,NULL,'melon','in season'),
('enginar',1,4,NULL,'artichoke hearts','fresh or frozen'),('enginar',2,1,NULL,'onion',NULL),('enginar',3,1,NULL,'carrot',NULL),('enginar',4,1,NULL,'potato',NULL),('enginar',5,100,'g','peas',NULL),('enginar',6,100,'ml','olive oil',NULL),('enginar',7,1,NULL,'lemon',NULL),('enginar',8,0.5,'bunch','dill',NULL),
('barbunya',1,400,'g','borlotti beans','dried, soaked; or 2 tins'),('barbunya',2,1,NULL,'onion',NULL),('barbunya',3,1,NULL,'carrot',NULL),('barbunya',4,2,NULL,'tomatoes',NULL),('barbunya',5,3,'clove','garlic',NULL),('barbunya',6,1,'tbsp','tomato paste',NULL),('barbunya',7,100,'ml','olive oil',NULL),('barbunya',8,1,'tsp','sugar',NULL),('barbunya',9,1,NULL,'lemon','to serve'),
('mucver',1,3,NULL,'courgettes',NULL),('mucver',2,150,'g','feta',NULL),('mucver',3,2,NULL,'eggs',NULL),('mucver',4,4,'tbsp','plain flour',NULL),('mucver',5,4,NULL,'spring onions',NULL),('mucver',6,0.5,'bunch','dill',NULL),('mucver',7,0.5,'bunch','parsley',NULL),('mucver',8,150,'ml','sunflower oil','for frying'),('mucver',9,200,'g','plain yoghurt','to serve'),
('cig-kofte',1,300,'g','fine bulgur',NULL),('cig-kofte',2,2,'tbsp','tomato paste',NULL),('cig-kofte',3,2,'tbsp','pepper paste (biber salçası)',NULL),('cig-kofte',4,3,'tbsp','isot (Urfa chilli)',NULL),('cig-kofte',5,1,NULL,'onion',NULL),('cig-kofte',6,3,'clove','garlic',NULL),('cig-kofte',7,2,'tbsp','pomegranate molasses',NULL),('cig-kofte',8,1,'tsp','ground cumin',NULL),('cig-kofte',9,4,'tbsp','olive oil',NULL),('cig-kofte',10,1,'bunch','parsley',NULL),('cig-kofte',11,1,NULL,'lettuce','to serve'),('cig-kofte',12,2,NULL,'lemons','to serve'),
('kalamar',1,500,'g','squid','cleaned, in rings'),('kalamar',2,100,'g','plain flour',NULL),('kalamar',3,1,'tsp','baking powder',NULL),('kalamar',4,200,'ml','sparkling water',NULL),('kalamar',5,500,'ml','sunflower oil','for frying'),('kalamar',6,80,'g','walnuts','for the tarator'),('kalamar',7,2,'slice','stale white bread','for the tarator'),('kalamar',8,2,'clove','garlic',NULL),('kalamar',9,1,NULL,'lemon',NULL),
('deniz-borulcesi',1,300,'g','samphire',NULL),('deniz-borulcesi',2,2,'clove','garlic',NULL),('deniz-borulcesi',3,1,NULL,'lemon','juiced'),('deniz-borulcesi',4,4,'tbsp','olive oil',NULL),('deniz-borulcesi',5,1,'tsp','pul biber (chilli flakes)','optional'),
('semizotu',1,300,'g','purslane',NULL),('semizotu',2,400,'g','plain yoghurt',NULL),('semizotu',3,2,'clove','garlic',NULL),('semizotu',4,2,'tbsp','olive oil',NULL),('semizotu',5,NULL,NULL,'salt',NULL),
('karides-guvec',1,500,'g','raw prawns','peeled'),('karides-guvec',2,3,NULL,'tomatoes',NULL),('karides-guvec',3,2,NULL,'green peppers',NULL),('karides-guvec',4,4,'clove','garlic',NULL),('karides-guvec',5,50,'g','butter',NULL),('karides-guvec',6,1,'tbsp','tomato paste',NULL),('karides-guvec',7,100,'g','kaşar or mozzarella','grated'),('karides-guvec',8,1,'tsp','pul biber (chilli flakes)',NULL),('karides-guvec',9,0.5,'bunch','parsley',NULL),('karides-guvec',10,1,NULL,'crusty bread','to serve'),
('meze-tabagi',1,200,'g','hummus',NULL),('meze-tabagi',2,200,'g','haydari or cacık',NULL),('meze-tabagi',3,200,'g','beyaz peynir',NULL),('meze-tabagi',4,200,'g','mixed olives',NULL),('meze-tabagi',5,150,'g','acılı ezme',NULL),('meze-tabagi',6,12,NULL,'stuffed vine leaves',NULL),('meze-tabagi',7,1,NULL,'cucumber',NULL),('meze-tabagi',8,3,NULL,'tomatoes',NULL),('meze-tabagi',9,100,'g','pickles (turşu)',NULL),('meze-tabagi',10,2,NULL,'pide or flatbreads',NULL),('meze-tabagi',11,0.5,'bunch','parsley',NULL),('meze-tabagi',12,1,NULL,'lemon',NULL),
('atom',1,500,'g','thick strained yoghurt (süzme)',NULL),('atom',2,2,'clove','garlic',NULL),('atom',3,60,'g','butter',NULL),('atom',4,8,NULL,'whole dried red chillies',NULL),('atom',5,1,'tsp','pul biber (chilli flakes)',NULL),
('topik',1,400,'g','cooked chickpeas',NULL),('topik',2,2,NULL,'potatoes','boiled'),('topik',3,4,NULL,'onions',NULL),('topik',4,4,'tbsp','tahini',NULL),('topik',5,3,'tbsp','currants',NULL),('topik',6,3,'tbsp','pine nuts',NULL),('topik',7,1,'tsp','cinnamon',NULL),('topik',8,1,'tsp','allspice',NULL),('topik',9,1,'tsp','ground cumin',NULL),('topik',10,4,'tbsp','olive oil',NULL),('topik',11,1,NULL,'lemon',NULL),('topik',12,NULL,NULL,'muslin or cheesecloth','for shaping'),
('girit-ezmesi',1,300,'g','feta',NULL),('girit-ezmesi',2,60,'g','walnuts',NULL),('girit-ezmesi',3,40,'g','pistachios',NULL),('girit-ezmesi',4,0.5,'bunch','parsley',NULL),('girit-ezmesi',5,0.5,'bunch','dill',NULL),('girit-ezmesi',6,4,'tbsp','olive oil',NULL),('girit-ezmesi',7,1,'tsp','dried oregano',NULL),('girit-ezmesi',8,1,'tsp','pul biber (chilli flakes)',NULL),
('kopoglu',1,2,NULL,'aubergines',NULL),('kopoglu',2,2,NULL,'green peppers',NULL),('kopoglu',3,3,NULL,'tomatoes',NULL),('kopoglu',4,3,'clove','garlic',NULL),('kopoglu',5,300,'g','plain yoghurt',NULL),('kopoglu',6,1,'tbsp','tomato paste',NULL),('kopoglu',7,200,'ml','sunflower oil','for frying'),('kopoglu',8,0.5,'bunch','parsley',NULL),('kopoglu',9,1,'tsp','pul biber (chilli flakes)',NULL);
