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
  addList: (groupId: string, name: string, memberIds: string[]) => Promise<string>;
  removeList: (groupId: string, id: string) => Promise<string>;
  setActiveList: (groupId: string, id: string) => Promise<void>;
};

const pushToFirestore = (groupId: string, lists: SearchList[], activeId: string) =>
  updateDoc(doc(db, 'couples', groupId), {
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
      activeListId: active?.id ?? DEFAULT_LIST.id,
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

  addList: async (groupId, name, memberIds) => {
    const { searchLists } = get();
    const id = Date.now().toString(36);
    const newList: SearchList = { id, name, filters: DEFAULT_FILTERS, member_ids: memberIds };
    const updated = [...searchLists, newList];
    set({ searchLists: updated, activeListId: id, filters: DEFAULT_FILTERS });
    await pushToFirestore(groupId, updated, id);
    return id;
  },

  removeList: async (groupId, id) => {
    const { searchLists, activeListId } = get();
    const updated = searchLists.filter((l) => l.id !== id);
    if (updated.length === 0) return activeListId;
    const newActiveId = activeListId === id ? updated[0].id : activeListId;
    const active = updated.find((l) => l.id === newActiveId)!;
    set({ searchLists: updated, activeListId: newActiveId, filters: active.filters });
    await pushToFirestore(groupId, updated, newActiveId);
    return newActiveId;
  },

  setActiveList: async (groupId, id) => {
    const { searchLists } = get();
    const active = searchLists.find((l) => l.id === id);
    if (!active) return;
    set({ activeListId: id, filters: active.filters });
    await updateDoc(doc(db, 'couples', groupId), { active_search_list_id: id });
  },
}));
