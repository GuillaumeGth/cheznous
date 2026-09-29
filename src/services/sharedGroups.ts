// Everyone using the app forms one single, implicit group: no invite code, no
// group screens, one search. Under the hood that's one `groups` doc (the
// "home" group) that every user joins automatically (SharedGroupsSync). This
// module holds the pure decision logic so it can be unit-tested.

export type GroupSummary = {
  id: string;
  memberIds: string[];
  searchListCount: number;
};

export type HomeGroupPlan = {
  /** No group at all: create the home group. */
  create: boolean;
  /** The group everyone uses (null only when `create`). */
  homeGroupId: string | null;
  /** The user isn't a member of the home group yet. */
  join: boolean;
  /** The home group has no search yet: give it the default one. */
  seedSearch: boolean;
};

// Should there ever be several groups, every client must pick the same one:
// the one with the most searches, then the most members, then the smallest id.
function pickHome(groups: GroupSummary[]): GroupSummary {
  return [...groups].sort(
    (a, b) => b.searchListCount - a.searchListCount
      || b.memberIds.length - a.memberIds.length
      || a.id.localeCompare(b.id),
  )[0];
}

export function planHomeGroup(groups: GroupSummary[], uid: string): HomeGroupPlan {
  if (groups.length === 0) return { create: true, homeGroupId: null, join: false, seedSearch: false };
  const home = pickHome(groups);
  return {
    create: false,
    homeGroupId: home.id,
    join: !home.memberIds.includes(uid),
    seedSearch: home.searchListCount === 0,
  };
}
