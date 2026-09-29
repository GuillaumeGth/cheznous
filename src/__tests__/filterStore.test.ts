jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  updateDoc: jest.fn().mockResolvedValue(undefined),
}));

import { useFilterStore, DEFAULT_LIST } from '@/stores/filterStore';
import { DEFAULT_FILTERS, SearchList } from '@/types';
import { updateDoc } from 'firebase/firestore';

const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;

const baseState = {
  searchLists: [DEFAULT_LIST],
  activeListId: DEFAULT_LIST.id,
  filters: DEFAULT_FILTERS,
};

beforeEach(() => {
  useFilterStore.setState(baseState, false);
  mockUpdateDoc.mockClear();
});

describe('filterStore — setSearchLists', () => {
  it('sets the active list and loads its filters', () => {
    const lists: SearchList[] = [
      { id: 'a', name: 'A', filters: { ...DEFAULT_FILTERS, price_max: 1000 } },
      { id: 'b', name: 'B', filters: { ...DEFAULT_FILTERS, price_max: 2000 } },
    ];
    useFilterStore.getState().setSearchLists(lists, 'b');
    const { activeListId, filters } = useFilterStore.getState();
    expect(activeListId).toBe('b');
    expect(filters.price_max).toBe(2000);
  });

  it('falls back to the first list when activeId is not found', () => {
    const lists: SearchList[] = [
      { id: 'a', name: 'A', filters: DEFAULT_FILTERS },
    ];
    useFilterStore.getState().setSearchLists(lists, 'nonexistent');
    expect(useFilterStore.getState().activeListId).toBe('a');
  });
});

describe('filterStore — setFilters', () => {
  it('updates filters in state', () => {
    useFilterStore.getState().setFilters({ ...DEFAULT_FILTERS, price_max: 1500 });
    expect(useFilterStore.getState().filters.price_max).toBe(1500);
  });
});

describe('filterStore — syncFilters', () => {
  it('updates state and calls Firestore once', async () => {
    const newFilters = { ...DEFAULT_FILTERS, rooms_min: 2 };
    await useFilterStore.getState().syncFilters('couple-1', newFilters);
    expect(useFilterStore.getState().filters.rooms_min).toBe(2);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('updates the correct list when listId override is provided', async () => {
    const listB: SearchList = { id: 'b', name: 'B', filters: DEFAULT_FILTERS };
    useFilterStore.setState({ searchLists: [DEFAULT_LIST, listB], activeListId: DEFAULT_LIST.id, filters: DEFAULT_FILTERS }, false);

    await useFilterStore.getState().syncFilters('couple-1', { ...DEFAULT_FILTERS, price_max: 999 }, 'b');

    const updated = useFilterStore.getState().searchLists.find((l) => l.id === 'b')!;
    expect(updated.filters.price_max).toBe(999);
  });

  it('updates activeListId to the overridden listId', async () => {
    const listB: SearchList = { id: 'b', name: 'B', filters: DEFAULT_FILTERS };
    useFilterStore.setState({ searchLists: [DEFAULT_LIST, listB], activeListId: DEFAULT_LIST.id, filters: DEFAULT_FILTERS }, false);

    await useFilterStore.getState().syncFilters('couple-1', DEFAULT_FILTERS, 'b');

    expect(useFilterStore.getState().activeListId).toBe('b');
  });
});
