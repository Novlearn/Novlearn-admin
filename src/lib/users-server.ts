import { loadProductionUsers } from './production-api';
import 'server-only';
import { readUsersConfiguration } from './users-config';
import { createUsersReader, UsersPgError } from './users-pg';
import {
  USERS_PAGE_SIZE,
  type UserSummary,
  type UsersPage,
  type UsersQuery,
} from './users';

let active:
  | {
      url: string;
      ca: string;
      environment: 'local-copy' | 'production';
      reader: ReturnType<typeof createUsersReader>;
    }
  | undefined;

/** Call only after a fresh server-side Admin authorization. No result caching. */
export async function loadUsers(query: UsersQuery) {
  const config = readUsersConfiguration(process.env);
  if (!config) throw new UsersPgError();
  if (config.environment === 'production') return loadProductionUsers(query);
  if (
    !active ||
    active.url !== config.url ||
    active.ca !== config.ca ||
    active.environment !== config.environment
  ) {
    const previous = active;
    active = {
      url: config.url,
      ca: config.ca,
      environment: config.environment,
      reader: createUsersReader(config),
    };
    // New requests use the new identity immediately; old leases finish/close.
    void previous?.reader.close().catch(() => {});
  }
  return active.reader.read(query);
}

/** Search by display name only. The existing Production RPC also supports email
 * matching, so fetch its bounded pages without a search and filter on the
 * server before returning any rows to the browser. */
export async function loadAllUsersByName(query: UsersQuery) {
  const pageQuery: UsersQuery = {
    ...query,
    query: '',
    after: null,
    before: null,
  };
  const users: UserSummary[] = [];
  let page = await loadUsers(pageQuery);
  for (;;) {
    users.push(...page.items);
    if (!page.next) break;
    page = await loadUsers({ ...pageQuery, after: page.next });
  }

  const needle = query.query.toLocaleLowerCase('fr');
  const matching = needle
    ? users.filter((user) => user.name.toLocaleLowerCase('fr').includes(needle))
    : users;
  return { page, asOf: page.asOf, users: matching };
}

export async function loadUsersByName(query: UsersQuery): Promise<UsersPage> {
  const { page, asOf, users: matching } = await loadAllUsersByName(query);
  const total = matching.length;
  let start = 0;
  if (query.after) {
    const index = matching.findIndex((user) => user.id === query.after);
    start =
      index >= 0
        ? index + 1
        : matching.findIndex((user) => user.id > query.after!);
    if (start < 0) start = total;
  } else if (query.before) {
    const index = matching.findIndex((user) => user.id === query.before);
    const end =
      index >= 0
        ? index
        : matching.findIndex((user) => user.id > query.before!);
    start = Math.max(0, (end < 0 ? total : end) - USERS_PAGE_SIZE);
  }
  const items = matching.slice(start, start + USERS_PAGE_SIZE);
  const previous = start > 0 && items.length ? items[0].id : null;
  const next =
    start + items.length < total && items.length ? items.at(-1)!.id : null;
  return {
    ...page,
    asOf,
    query: query.query,
    cursor: { after: query.after, before: query.before },
    pageSize: USERS_PAGE_SIZE,
    total: String(total),
    items,
    previous,
    next,
  };
}
