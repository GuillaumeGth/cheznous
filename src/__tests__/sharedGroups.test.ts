import { GroupSummary, planSharedGroups } from '@/services/sharedGroups';

const group = (id: string, memberIds: string[], searchListCount = 1): GroupSummary => ({ id, memberIds, searchListCount });

describe('planSharedGroups', () => {
  it('joins every group the user is not a member of', () => {
    const plan = planSharedGroups(
      [group('a', ['me', 'her']), group('b', ['her']), group('c', [])],
      'me',
      'a',
    );
    expect(plan.toJoin).toEqual(['b', 'c']);
    expect(plan.create).toBe(false);
    expect(plan.activeGroupId).toBeNull(); // current one is valid
  });

  it('creates a group when none exists', () => {
    expect(planSharedGroups([], 'me', null)).toEqual({ toJoin: [], create: true, activeGroupId: null });
  });

  it('picks the most used group when there is no valid active one', () => {
    const groups = [group('empty', [], 0), group('solo', ['x'], 1), group('ours', ['me', 'her'], 1)];
    expect(planSharedGroups(groups, 'me', null).activeGroupId).toBe('ours');
    expect(planSharedGroups(groups, 'me', 'deleted-group').activeGroupId).toBe('ours');
  });
});
