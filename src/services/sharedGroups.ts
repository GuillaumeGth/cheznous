// Every user of the app shares every group: no invite code, no joining. A
// single listener (SharedGroupsSync) keeps the current user a member of all
// groups and makes sure they have an active one. This module holds the pure
// decision logic so it can be unit-tested.

export type GroupSummary = {
  id: string;
  memberIds: string[];
  searchListCount: number;
};

export type SharedGroupsPlan = {
  /** Groups the user isn't a member of yet. */
  toJoin: string[];
  /** No group at all: create one. */
  create: boolean;
  /** New active group to set, or null to keep the current one. */
  activeGroupId: string | null;
};

// The group with the most search lists, then the most members: the one the
// household actually uses, rather than an empty leftover.
function pickDefault(groups: GroupSummary[]): GroupSummary {
  return [...groups].sort(
    (a, b) => b.searchListCount - a.searchListCount || b.memberIds.length - a.memberIds.length,
  )[0];
}

export function planSharedGroups(
  groups: GroupSummary[],
  uid: string,
  currentGroupId: string | null,
): SharedGroupsPlan {
  if (groups.length === 0) return { toJoin: [], create: true, activeGroupId: null };
  const toJoin = groups.filter((g) => !g.memberIds.includes(uid)).map((g) => g.id);
  const currentIsValid = !!currentGroupId && groups.some((g) => g.id === currentGroupId);
  return {
    toJoin,
    create: false,
    activeGroupId: currentIsValid ? null : pickDefault(groups).id,
  };
}
