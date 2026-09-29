import { create } from 'zustand';
import { SearchFilters, SearchList, DEFAULT_FILTERS } from '@/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const DEFAULT_LIST: SearchList = {
  id: 'default',
  name: 'Ma recherche',
  filters: DEFAULT_FILTERS,
};

type FilterState = {
  searchLists: SearchList[];
  activeListId: string;
  filters: SearchFilters;
  setSearchLists: (lists: SearchList[], activeId: string) => void;
  setFilters: (filters: SearchFilters) => void;
  syncFilters: (groupId: string, filters: SearchFilters, listId?: string) => Promise<void>;
};

const pushToFirestore = (groupId: string, lists: SearchList[], activeId: string) =>
  updateDoc(doc(db, 'groups', groupId), {
    search_lists: lists,
    active_search_list_id: activeId,
  });

export const useFilterStore = create<FilterState>((set, get) => ({
  searchLists: [DEFAULT_LIST],
  activeListId: DEFAULT_LIST.id,
  filters: DEFAULT_FILTERS,

  setSearchLists: (lists, activeId) => {
    const active = lists.find((l) => l.id === activeId) ?? lists[0];
    set({
      searchLists: lists,
      activeListId: active?.id ?? '',
      filters: active?.filters ?? DEFAULT_FILTERS,
    });
  },

  setFilters: (filters) => set({ filters }),

  syncFilters: async (groupId, filters, listId) => {
    const { searchLists, activeListId } = get();
    const targetId = listId ?? activeListId;
    const updated = searchLists.map((l) => (l.id === targetId ? { ...l, filters } : l));
    set({ filters, searchLists: updated, activeListId: targetId });
    await pushToFirestore(groupId, updated, targetId);
  },
}));
