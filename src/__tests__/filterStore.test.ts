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

describe('filterStore — addList', () => {
  it('appends the new list and sets it as active', async () => {
    const id = await useFilterStore.getState().addList('couple-1', 'New List', ['uid1']);
    const { searchLists, activeListId, filters } = useFilterStore.getState();
    expect(searchLists).toHaveLength(2);
    expect(activeListId).toBe(id);
    expect(filters).toEqual(DEFAULT_FILTERS);
  });

  it('assigns DEFAULT_FILTERS to the new list', async () => {
    await useFilterStore.getState().addList('couple-1', 'Budget', []);
    const { searchLists, activeListId } = useFilterStore.getState();
    const newList = searchLists.find((l) => l.id === activeListId)!;
    expect(newList.filters).toEqual(DEFAULT_FILTERS);
  });

  it('calls Firestore once', async () => {
    await useFilterStore.getState().addList('couple-1', 'X', []);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });
});

describe('filterStore — removeList', () => {
  it('removes the specified list', async () => {
    const listB: SearchList = { id: 'b', name: 'B', filters: DEFAULT_FILTERS };
    useFilterStore.setState({ searchLists: [DEFAULT_LIST, listB], activeListId: DEFAULT_LIST.id, filters: DEFAULT_FILTERS }, false);

    await useFilterStore.getState().removeList('couple-1', 'b');
    expect(useFilterStore.getState().searchLists).toHaveLength(1);
  });

  it('keeps the current active list when a non-active list is removed', async () => {
    const listB: SearchList = { id: 'b', name: 'B', filters: DEFAULT_FILTERS };
    useFilterStore.setState({ searchLists: [DEFAULT_LIST, listB], activeListId: DEFAULT_LIST.id, filters: DEFAULT_FILTERS }, false);

    const newId = await useFilterStore.getState().removeList('couple-1', 'b');
    expect(newId).toBe(DEFAULT_LIST.id);
    expect(useFilterStore.getState().activeListId).toBe(DEFAULT_LIST.id);
  });

  it('switches to the first remaining list when the active list is removed', async () => {
    const listB: SearchList = { id: 'b', name: 'B', filters: { ...DEFAULT_FILTERS, price_max: 1800 } };
    useFilterStore.setState({ searchLists: [DEFAULT_LIST, listB], activeListId: 'b', filters: listB.filters }, false);

    const newId = await useFilterStore.getState().removeList('couple-1', 'b');
    const { activeListId, filters } = useFilterStore.getState();
    expect(newId).toBe(DEFAULT_LIST.id);
    expect(activeListId).toBe(DEFAULT_LIST.id);
    expect(filters).toEqual(DEFAULT_FILTERS);
  });

  it('returns the current activeListId without calling Firestore when result would be empty', async () => {
    await useFilterStore.getState().removeList('couple-1', DEFAULT_LIST.id);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(useFilterStore.getState().activeListId).toBe(DEFAULT_LIST.id);
  });
});

describe('filterStore — setActiveList', () => {
  it('switches to the specified list and loads its filters', async () => {
    const listB: SearchList = { id: 'b', name: 'B', filters: { ...DEFAULT_FILTERS, surface_min: 40 } };
    useFilterStore.setState({ searchLists: [DEFAULT_LIST, listB], activeListId: DEFAULT_LIST.id, filters: DEFAULT_FILTERS }, false);

    await useFilterStore.getState().setActiveList('couple-1', 'b');
    const { activeListId, filters } = useFilterStore.getState();
    expect(activeListId).toBe('b');
    expect(filters.surface_min).toBe(40);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the id is not found', async () => {
    await useFilterStore.getState().setActiveList('couple-1', 'ghost');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(useFilterStore.getState().activeListId).toBe(DEFAULT_LIST.id);
  });
});
