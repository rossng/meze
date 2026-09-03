export type VoteValue = -1 | 1 | 2;

export interface TagType {
  id: string;
  label: string;
  emoji: string | null;
  multi: boolean;
  sort: number;
  tags: Tag[];
}

export interface Tag {
  id: string;
  typeId: string;
  label: string;
  emoji: string | null;
  sort: number;
}

export interface Ingredient {
  quantity: number | null;
  unit: string | null;
  item: string;
  note: string | null;
}

export interface Meze {
  id: string;
  name: string;
  nameTr: string | null;
  description: string;
  photoUrl: string | null;
  photoThumbUrl: string | null;
  photoCredit: string | null;
  artEmoji: string | null;
  recipeUrl: string | null;
  recipeSource: string | null;
  prepMinutes: number | null;
  ingredientCount: number | null;
  serves: number | null;
  /** Set when the meze is a custom dish belonging to one night. */
  nightId: string | null;
  tagIds: string[];
  ingredients: Ingredient[];
}

export interface Catalogue {
  mezes: Meze[];
  tagTypes: TagType[];
}

export interface Vote {
  userId: string;
  value: VoteValue;
}

export interface NightSummary {
  id: string;
  code: string;
  name: string;
  creatorId: string;
  chosenMenuId: string | null;
  createdAt: string;
  memberCount: number;
}

/** A short-lived, single-use code that moves an identity to another device. */
export interface DeviceLink {
  code: string;
  url: string;
  expiresAt: string;
}

export interface DeviceLinkClaim {
  userId: string;
  nights: { code: string; name: string }[];
}

export interface Member {
  userId: string;
  displayName: string;
  joinedAt: string;
}

export interface NightOption {
  mezeId: string;
  addedBy: string | null;
  addedAt: string;
  votes: Vote[];
}

export interface Menu {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  mezeIds: string[];
  votes: Vote[];
  /** Set once this menu has been published to a link; see SharedMenu. */
  shareToken: string | null;
}

export interface NightState {
  night: Omit<NightSummary, 'memberCount'>;
  me: { userId: string; displayName: string; isCreator: boolean; isMember: boolean };
  members: Member[];
  options: NightOption[];
  menus: Menu[];
  /** Custom dishes added to this night only; not in the global catalogue. */
  customMezes: Meze[];
}

/** Messages from the room (Durable Object) to clients. */
export type RoomServerMessage =
  | { type: 'refresh'; reason?: string }
  | { type: 'presence'; userIds: string[] }
  | { type: 'toast'; text: string; from?: string };

/** Messages from clients to the room. */
export type RoomClientMessage =
  | { type: 'hello'; userId: string }
  | { type: 'cheers'; text: string };

/** One dish as it appears on a published menu card. */
export interface SharedDish {
  name: string;
  nameTr: string | null;
  artEmoji: string | null;
}

/**
 * A menu published to a link. It carries no night code and no user ids, so a
 * viewer needs no identity to fetch it.
 */
export interface SharedMenu {
  token: string;
  url: string;
  nightName: string;
  menuName: string;
  dishes: SharedDish[];
  /** Guest names, in the order they pulled up a chair. */
  guests: string[];
  /** False once the table has un-crowned this menu or crowned another. */
  isCurrent: boolean;
  createdAt: string;
}
