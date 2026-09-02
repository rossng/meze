import type { Catalogue, Ingredient, Meze, Member, Menu, NightOption, NightState, NightSummary, TagType, Vote, VoteValue } from '../shared/types';

type Row = Record<string, unknown>;

function mezeFromRow(r: Row, tagIds: string[], ingredients: Ingredient[]): Meze {
  return {
    id: r.id as string,
    name: r.name as string,
    nameTr: (r.name_tr as string) ?? null,
    description: (r.description as string) ?? '',
    photoUrl: (r.photo_url as string) ?? null,
    photoThumbUrl: (r.photo_thumb_url as string) ?? null,
    photoCredit: (r.photo_credit as string) ?? null,
    artEmoji: (r.art_emoji as string) ?? null,
    recipeUrl: (r.recipe_url as string) ?? null,
    recipeSource: (r.recipe_source as string) ?? null,
    prepMinutes: (r.prep_minutes as number) ?? null,
    ingredientCount: (r.ingredient_count as number) ?? null,
    serves: (r.serves as number) ?? null,
    nightId: (r.night_id as string) ?? null,
    tagIds,
    ingredients,
  };
}

function groupBy<T>(rows: Row[], key: string, map: (r: Row) => T): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = r[key] as string;
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(map(r));
  }
  return out;
}

const ingredientFromRow = (r: Row): Ingredient => ({
  quantity: (r.quantity as number) ?? null,
  unit: (r.unit as string) ?? null,
  item: r.item as string,
  note: (r.note as string) ?? null,
});

export async function getCatalogue(db: D1Database): Promise<Catalogue> {
  const [types, tags, mezes, mezeTags, ingredients] = await db.batch([
    db.prepare('SELECT * FROM tag_types ORDER BY sort, label'),
    db.prepare('SELECT * FROM tags ORDER BY sort, label'),
    db.prepare('SELECT * FROM mezes WHERE night_id IS NULL ORDER BY name'),
    db.prepare('SELECT mt.meze_id, mt.tag_id FROM meze_tags mt JOIN mezes m ON m.id = mt.meze_id WHERE m.night_id IS NULL'),
    db.prepare('SELECT mi.* FROM meze_ingredients mi JOIN mezes m ON m.id = mi.meze_id WHERE m.night_id IS NULL ORDER BY mi.sort'),
  ]);

  const tagsByType = new Map<string, TagType['tags']>();
  for (const r of tags.results as Row[]) {
    const t = { id: r.id as string, typeId: r.type_id as string, label: r.label as string, emoji: (r.emoji as string) ?? null, sort: r.sort as number };
    if (!tagsByType.has(t.typeId)) tagsByType.set(t.typeId, []);
    tagsByType.get(t.typeId)!.push(t);
  }

  const tagTypes: TagType[] = (types.results as Row[]).map((r) => ({
    id: r.id as string,
    label: r.label as string,
    emoji: (r.emoji as string) ?? null,
    multi: !!r.multi,
    sort: r.sort as number,
    tags: tagsByType.get(r.id as string) ?? [],
  }));

  const tagIdsByMeze = groupBy(mezeTags.results as Row[], 'meze_id', (r) => r.tag_id as string);
  const ingredientsByMeze = groupBy(ingredients.results as Row[], 'meze_id', ingredientFromRow);
  const mezeList: Meze[] = (mezes.results as Row[]).map((r) =>
    mezeFromRow(r, tagIdsByMeze.get(r.id as string) ?? [], ingredientsByMeze.get(r.id as string) ?? []),
  );

  return { mezes: mezeList, tagTypes };
}

export async function ensureUser(db: D1Database, userId: string) {
  await db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').bind(userId).run();
}

function nightFromRow(r: Row): NightState['night'] {
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    creatorId: r.creator_id as string,
    chosenMenuId: (r.chosen_menu_id as string) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function findNightByCode(db: D1Database, code: string) {
  const r = await db.prepare('SELECT * FROM nights WHERE code = ?').bind(code).first<Row>();
  return r ? nightFromRow(r) : null;
}

export async function getNightSummaries(db: D1Database, codes: string[]): Promise<NightSummary[]> {
  if (codes.length === 0) return [];
  const placeholders = codes.map(() => '?').join(',');
  const rows = await db
    .prepare(
      `SELECT n.*, (SELECT COUNT(*) FROM night_members m WHERE m.night_id = n.id) AS member_count
       FROM nights n WHERE n.code IN (${placeholders})`,
    )
    .bind(...codes)
    .all<Row>();
  return rows.results.map((r) => ({ ...nightFromRow(r), memberCount: r.member_count as number }));
}

export async function getNightState(db: D1Database, code: string, userId: string): Promise<NightState | null> {
  const nightRow = await db.prepare('SELECT * FROM nights WHERE code = ?').bind(code).first<Row>();
  if (!nightRow) return null;
  const night = nightFromRow(nightRow);

  const [members, options, optionVotes, menus, menuItems, menuVotes, custom] = await db.batch([
    db.prepare('SELECT * FROM night_members WHERE night_id = ? ORDER BY joined_at').bind(night.id),
    db.prepare('SELECT * FROM night_options WHERE night_id = ? ORDER BY added_at').bind(night.id),
    db.prepare('SELECT meze_id, user_id, value FROM option_votes WHERE night_id = ?').bind(night.id),
    db.prepare('SELECT * FROM menus WHERE night_id = ? ORDER BY created_at').bind(night.id),
    db.prepare('SELECT mi.* FROM menu_items mi JOIN menus m ON m.id = mi.menu_id WHERE m.night_id = ? ORDER BY mi.sort').bind(night.id),
    db.prepare('SELECT mv.* FROM menu_votes mv JOIN menus m ON m.id = mv.menu_id WHERE m.night_id = ?').bind(night.id),
    db.prepare('SELECT * FROM mezes WHERE night_id = ? ORDER BY created_at').bind(night.id),
  ]);

  const memberList: Member[] = (members.results as Row[]).map((r) => ({
    userId: r.user_id as string,
    displayName: r.display_name as string,
    joinedAt: r.joined_at as string,
  }));

  const votesByMeze = new Map<string, Vote[]>();
  for (const r of optionVotes.results as Row[]) {
    const k = r.meze_id as string;
    if (!votesByMeze.has(k)) votesByMeze.set(k, []);
    votesByMeze.get(k)!.push({ userId: r.user_id as string, value: r.value as VoteValue });
  }

  const optionList: NightOption[] = (options.results as Row[]).map((r) => ({
    mezeId: r.meze_id as string,
    addedBy: (r.added_by as string) ?? null,
    addedAt: r.added_at as string,
    votes: votesByMeze.get(r.meze_id as string) ?? [],
  }));

  const itemsByMenu = new Map<string, string[]>();
  for (const r of menuItems.results as Row[]) {
    const k = r.menu_id as string;
    if (!itemsByMenu.has(k)) itemsByMenu.set(k, []);
    itemsByMenu.get(k)!.push(r.meze_id as string);
  }
  const votesByMenu = new Map<string, Vote[]>();
  for (const r of menuVotes.results as Row[]) {
    const k = r.menu_id as string;
    if (!votesByMenu.has(k)) votesByMenu.set(k, []);
    votesByMenu.get(k)!.push({ userId: r.user_id as string, value: r.value as VoteValue });
  }

  const menuList: Menu[] = (menus.results as Row[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
    mezeIds: itemsByMenu.get(r.id as string) ?? [],
    votes: votesByMenu.get(r.id as string) ?? [],
  }));

  const me = memberList.find((m) => m.userId === userId);
  const customMezes = (custom.results as Row[]).map((r) => mezeFromRow(r, [], []));

  return {
    night,
    me: {
      userId,
      displayName: me?.displayName ?? '',
      isCreator: night.creatorId === userId,
      isMember: !!me,
    },
    members: memberList,
    options: optionList,
    menus: menuList,
    customMezes,
  };
}
