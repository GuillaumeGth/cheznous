import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable,
  ScrollView, Platform, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GroupMember, SearchFilters, DEFAULT_FILTERS } from '@/types';
import { useFilterStore } from '@/stores/filterStore';
import { useAuthStore } from '@/stores/authStore';

type Props = {
  visible: boolean;
  onClose: () => void;
  members: GroupMember[];
};

const ARRONDISSEMENTS = Array.from({ length: 20 }, (_, i) => i + 1);
const PRICE_STEPS = [1000, 1200, 1500, 1800, 2000, 2500, 3000, 4000, 5000];
const SURFACE_STEPS = [15, 20, 25, 30, 35, 40, 50, 60, 80];
const ROOMS_OPTIONS = [
  { label: 'Tous', value: 0 },
  { label: 'Studio', value: 1 },
  { label: '2 p.', value: 2 },
  { label: '3 p.', value: 3 },
  { label: '4+ p.', value: 4 },
];

export default function FilterSheet({ visible, onClose, members }: Props) {
  const searchLists = useFilterStore((s) => s.searchLists);
  const activeListId = useFilterStore((s) => s.activeListId);
  const groupId = useAuthStore((s) => s.groupId);

  const [activeTab, setActiveTab] = useState(activeListId);
  const [local, setLocal] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMemberIds, setNewMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setActiveTab(activeListId);
      const list = searchLists.find((l) => l.id === activeListId);
      setLocal(list?.filters ?? DEFAULT_FILTERS);
      setAdding(false);
      setNewName('');
      setNewMemberIds(members.map((m) => m.uid));
    }
  }, [visible]);

  const switchTab = (id: string) => {
    setActiveTab(id);
    const list = searchLists.find((l) => l.id === id);
    if (list) setLocal(list.filters);
  };

  const toggleArr = (arr: number) => {
    setLocal((f) => ({
      ...f,
      arrondissements: f.arrondissements.includes(arr)
        ? f.arrondissements.filter((a) => a !== arr)
        : [...f.arrondissements, arr],
    }));
  };

  const apply = async () => {
    if (groupId) await useFilterStore.getState().syncFilters(groupId, local, activeTab);
    onClose();
  };

  const reset = () => setLocal(DEFAULT_FILTERS);

  const toggleMember = useCallback((uid: string) => {
    setNewMemberIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  }, []);

  const confirmAdd = async () => {
    const name = newName.trim();
    if (!name || !groupId || newMemberIds.length === 0) return;
    const id = await useFilterStore.getState().addList(groupId, name, newMemberIds);
    setActiveTab(id);
    setLocal(DEFAULT_FILTERS);
    setAdding(false);
    setNewName('');
    setNewMemberIds(members.map((m) => m.uid));
  };

  const handleRemove = (id: string) => {
    if (!groupId || searchLists.length <= 1) return;
    const listName = searchLists.find((l) => l.id === id)?.name ?? 'cette liste';
    Alert.alert(
      'Supprimer la liste',
      `Supprimer « ${listName} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const newActiveId = await useFilterStore.getState().removeList(groupId, id);
            if (activeTab === id) {
              setActiveTab(newActiveId);
              const list = searchLists.find((l) => l.id === newActiveId);
              if (list) setLocal(list.filters);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Filtres</Text>
          <TouchableOpacity onPress={reset}>
            <Text style={styles.reset}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>

        {/* Search list tabs */}
        <View style={styles.tabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContent}
          >
            {searchLists.map((list) => {
              const isActive = list.id === activeTab;
              return (
                <TouchableOpacity
                  key={list.id}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => switchTab(list.id)}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {list.name}
                  </Text>
                  {isActive && searchLists.length > 1 && (
                    <TouchableOpacity
                      style={styles.tabDelete}
                      onPress={() => handleRemove(list.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={14}
                        color={isActive ? '#4A6CF7' : '#aaa'}
                      />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}

            {!adding && (
              <TouchableOpacity
                style={styles.addTab}
                onPress={() => {
                  setAdding(true);
                  setNewMemberIds(members.map((m) => m.uid));
                }}
              >
                <Ionicons name="add" size={18} color="#4A6CF7" />
              </TouchableOpacity>
            )}
          </ScrollView>

          {adding && (
            <View style={styles.addBlock}>
              <View style={styles.addRow}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nom de la liste"
                  placeholderTextColor="#aaa"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={confirmAdd}
                  style={styles.addInput}
                />
                <TouchableOpacity onPress={confirmAdd} disabled={!newName.trim() || newMemberIds.length === 0}>
                  <Ionicons
                    name="checkmark-circle"
                    size={26}
                    color={newName.trim() && newMemberIds.length > 0 ? '#4A6CF7' : '#ccc'}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setAdding(false); setNewName(''); }}>
                  <Ionicons name="close-circle" size={26} color="#ccc" />
                </TouchableOpacity>
              </View>

              {members.length > 0 && (
                <View style={styles.memberSelector}>
                  <Text style={styles.memberSelectorLabel}>Participants</Text>
                  <View style={styles.memberChips}>
                    {members.map((member) => (
                      <MemberChip
                        key={member.uid}
                        member={member}
                        selected={newMemberIds.includes(member.uid)}
                        onToggle={toggleMember}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Arrondissements */}
          <Section title="Arrondissements">
            <Text style={styles.hint}>
              {local.arrondissements.length === 0
                ? 'Tous les arrondissements'
                : `${local.arrondissements.length} sélectionné${local.arrondissements.length > 1 ? 's' : ''}`}
            </Text>
            <View style={styles.grid}>
              {ARRONDISSEMENTS.map((arr) => (
                <TouchableOpacity
                  key={arr}
                  style={[styles.chip, local.arrondissements.includes(arr) && styles.chipActive]}
                  onPress={() => toggleArr(arr)}
                >
                  <Text style={[styles.chipText, local.arrondissements.includes(arr) && styles.chipTextActive]}>
                    {arr}e
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Prix max */}
          <Section title={`Loyer max — ${local.price_max.toLocaleString('fr-FR')} €/mois`}>
            <View style={styles.steps}>
              {PRICE_STEPS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.step, local.price_max === p && styles.stepActive]}
                  onPress={() => setLocal((f) => ({ ...f, price_max: p }))}
                >
                  <Text style={[styles.stepText, local.price_max === p && styles.stepTextActive]}>
                    {p >= 1000 ? `${p / 1000}k` : p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Surface min */}
          <Section title={`Surface min — ${local.surface_min} m²`}>
            <View style={styles.steps}>
              {SURFACE_STEPS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.step, local.surface_min === s && styles.stepActive]}
                  onPress={() => setLocal((f) => ({ ...f, surface_min: s }))}
                >
                  <Text style={[styles.stepText, local.surface_min === s && styles.stepTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Nb pièces */}
          <Section title="Nombre de pièces">
            <View style={styles.steps}>
              {ROOMS_OPTIONS.map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.step, local.rooms_min === value && styles.stepActive]}
                  onPress={() => setLocal((f) => ({ ...f, rooms_min: value }))}
                >
                  <Text style={[styles.stepText, local.rooms_min === value && styles.stepTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyBtn} onPress={apply}>
            <Text style={styles.applyText}>Appliquer les filtres</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

type MemberChipProps = {
  member: GroupMember;
  selected: boolean;
  onToggle: (uid: string) => void;
};

function MemberChip({ member, selected, onToggle }: MemberChipProps) {
  const handlePress = useCallback(() => onToggle(member.uid), [onToggle, member.uid]);
  return (
    <Pressable
      style={selected ? styles.memberChipSelected : styles.memberChip}
      onPress={handlePress}
    >
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={selected ? '#4A6CF7' : '#aaa'}
      />
      <Text style={selected ? styles.memberChipTextSelected : styles.memberChipText}>
        {member.displayName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  cancel: { fontSize: 16, color: '#888' },
  reset: { fontSize: 16, color: '#4A6CF7' },
  tabsWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#F8F9FA',
    gap: 4,
  },
  tabActive: {
    borderColor: '#4A6CF7',
    backgroundColor: '#EEF1FF',
  },
  tabText: { fontSize: 13, color: '#555', fontWeight: '500' },
  tabTextActive: { color: '#4A6CF7', fontWeight: '600' },
  tabDelete: { marginLeft: 2 },
  addTab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#4A6CF7',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  addInput: {
    flex: 1,
    height: 38,
    borderWidth: 1.5,
    borderColor: '#4A6CF7',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1A1A2E',
    backgroundColor: '#fff',
  },
  hint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 10,
  },
  scroll: { flex: 1, padding: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#F8F9FA',
  },
  chipActive: {
    borderColor: '#4A6CF7',
    backgroundColor: '#EEF1FF',
  },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#4A6CF7', fontWeight: '600' },
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  step: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#F8F9FA',
  },
  stepActive: {
    borderColor: '#4A6CF7',
    backgroundColor: '#4A6CF7',
  },
  stepText: { fontSize: 14, color: '#555', fontWeight: '500' },
  stepTextActive: { color: '#fff', fontWeight: '600' },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  applyBtn: {
    backgroundColor: '#4A6CF7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  addBlock: {
    paddingBottom: 10,
  },
  memberSelector: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  memberSelectorLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberChips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#F8F9FA',
  },
  memberChipSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#4A6CF7',
    backgroundColor: '#EEF1FF',
  },
  memberChipText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  memberChipTextSelected: {
    fontSize: 13,
    color: '#4A6CF7',
    fontWeight: '600',
  },
});
