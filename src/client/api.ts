import type { Catalogue, DeviceLink, DeviceLinkClaim, NightState, NightSummary, VoteValue } from '../shared/types';

const USER_KEY = 'meze:userId';

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getUserId(): string {
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = newId();
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

/** Adopt an identity handed over from another device. */
export function setUserId(id: string) {
  localStorage.setItem(USER_KEY, id);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', 'x-user-id': getUserId() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  catalogue: () => call<Catalogue>('GET', '/api/catalogue'),
  myNights: (codes: string[]) => call<{ nights: NightSummary[] }>('GET', `/api/me/nights?codes=${encodeURIComponent(codes.join(','))}`),
  createNight: (name: string, displayName: string) => call<NightState>('POST', '/api/nights', { name, displayName }),
  night: (code: string) => call<NightState>('GET', `/api/nights/${code}`),
  join: (code: string, displayName: string) => call<NightState>('POST', `/api/nights/${code}/join`, { displayName }),
  rename: (code: string, displayName: string) => call('PATCH', `/api/nights/${code}/me`, { displayName }),
  renameNight: (code: string, name: string) => call('PATCH', `/api/nights/${code}`, { name }),
  addOptions: (code: string, mezeIds: string[]) => call('POST', `/api/nights/${code}/options`, { mezeIds }),
  removeOption: (code: string, mezeId: string) => call('DELETE', `/api/nights/${code}/options/${mezeId}`),
  voteOption: (code: string, mezeId: string, value: VoteValue | null) => call('PUT', `/api/nights/${code}/options/${mezeId}/vote`, { value }),
  createMenu: (code: string, name: string, mezeIds: string[]) => call<{ id: string }>('POST', `/api/nights/${code}/menus`, { name, mezeIds }),
  updateMenu: (code: string, menuId: string, patch: { name?: string; mezeIds?: string[] }) => call('PATCH', `/api/nights/${code}/menus/${menuId}`, patch),
  deleteMenu: (code: string, menuId: string) => call('DELETE', `/api/nights/${code}/menus/${menuId}`),
  voteMenu: (code: string, menuId: string, value: VoteValue | null) => call('PUT', `/api/nights/${code}/menus/${menuId}/vote`, { value }),
  choose: (code: string, menuId: string | null) => call('PUT', `/api/nights/${code}/chosen`, { menuId }),
  addCustom: (code: string, name: string) => call<{ id: string }>('POST', `/api/nights/${code}/custom`, { name }),
  removeMember: (code: string, userId: string) => call('DELETE', `/api/nights/${code}/members/${userId}`),
  createLink: () => call<DeviceLink>('POST', '/api/me/link'),
  claimLink: (code: string) => call<DeviceLinkClaim>('POST', `/api/me/link/${code}/claim`),
  cheers: (code: string, text: string) => call('POST', `/api/nights/${code}/cheers`, { text }),
};
