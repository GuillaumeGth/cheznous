import { GroupSummary, planHomeGroup } from '@/services/sharedGroups';

const group = (id: string, memberIds: string[], searchListCount = 1): GroupSummary => ({ id, memberIds, searchListCount });

describe('planHomeGroup', () => {
  it('creates the home group when none exists', () => {
    expect(planHomeGroup([], 'me')).toEqual({ create: true, homeGroupId: null, join: false, seedSearch: false });
  });

  it('joins the home group when the user is not a member yet', () => {
    expect(planHomeGroup([group('home', ['her'])], 'me')).toEqual({
      create: false, homeGroupId: 'home', join: true, seedSearch: false,
    });
    expect(planHomeGroup([group('home', ['her', 'me'])], 'me').join).toBe(false);
  });

  it('seeds the default search when the home group has none', () => {
    expect(planHomeGroup([group('home', ['me'], 0)], 'me').seedSearch).toBe(true);
  });

  it('picks the same home group for everyone when several exist', () => {
    const groups = [group('b', ['x'], 1), group('empty', [], 0), group('a', ['x'], 1), group('ours', ['me', 'her'], 1)];
    expect(planHomeGroup(groups, 'me').homeGroupId).toBe('ours');
    expect(planHomeGroup(groups, 'her').homeGroupId).toBe('ours');
    expect(planHomeGroup([group('b', []), group('a', [])], 'me').homeGroupId).toBe('a'); // tie → smallest id
  });
});
