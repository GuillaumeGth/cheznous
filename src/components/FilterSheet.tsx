import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable,
  ScrollView, Platform, TextInput, Alert, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GroupMember, SearchFilters, TransactionType, DEFAULT_FILTERS } from '@/types';
import { useFilterStore } from '@/stores/filterStore';
import { useAuthStore } from '@/stores/authStore';
import { pickAndUploadImage } from '@/lib/uploadImage';

type Props = {
  visible: boolean;
  onClose: () => void;
  members: GroupMember[];
  /** Ouvre directement le formulaire de création de recherche. */
  initialAdding?: boolean;
};

const ARRONDISSEMENTS = Array.from({ length: 20 }, (_, i) => i + 1);
const TRANSACTION_OPTIONS: { label: string; value: TransactionType }[] = [
  { label: 'Location', value: 'rent' },
  { label: 'Achat', value: 'buy' },
];

const normalizeFilters = (f?: SearchFilters): SearchFilters => ({ ...DEFAULT_FILTERS, ...(f ?? {}) });
const ROOMS_OPTIONS = [
  { label: 'Tous', value: 0 },
  { label: 'Studio', value: 1 },
  { label: '2 p.', value: 2 },
  { label: '3 p.', value: 3 },
  { label: '4+ p.', value: 4 },
];

export default function FilterSheet({ visible, onClose, members, initialAdding }: Props) {
  const searchLists = useFilterStore((s) => s.searchLists);
  const activeListId = useFilterStore((s) => s.activeListId);
  const groupId = useAuthStore((s) => s.groupId);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState(activeListId);
  const [local, setLocal] = useState<SearchFilters>(DEFAULT_FILTERS);

  const activeListObj = useMemo(
    () => searchLists.find((l) => l.id === activeTab),
    [searchLists, activeTab],
  );
  const totalMembers = useMemo(
    () => (activeListObj?.member_ids?.length ?? members.length) + 1,
    [activeListObj, members.length],
  );
  const likesOptions = useMemo(() => [
    { label: 'Tous', value: 0 },
    ...Array.from({ length: totalMembers - 1 }, (_, i) => ({
      label: String(i + 1),
      value: i + 1,
    })),
  ], [totalMembers]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMemberIds, setNewMemberIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [coverBusy, setCoverBusy] = useState(false);

  const activeCover = useMemo(
    () => searchLists.find((l) => l.id === activeTab)?.cover_photo_url ?? null,
    [searchLists, activeTab],
  );

  useEffect(() => {
    if (visible) {
      setActiveTab(activeListId);
      const list = searchLists.find((l) => l.id === activeListId);
      setLocal(normalizeFilters(list?.filters));
      setAdding(initialAdding ?? searchLists.length === 0);
      setNewName('');
      setNewMemberIds(members.map((m) => m.uid));
      setEditingId(null);
      setEditName('');
    }
  }, [visible]);

  const switchTab = (id: string) => {
    setActiveTab(id);
    const list = searchLists.find((l) => l.id === id);
    if (list) setLocal(normalizeFilters(list.filters));
  };

  const setTransaction = (value: TransactionType) => {
    setLocal((f) =>
      f.transaction_type === value
        ? f
        : { ...f, transaction_type: value, price_min: 0, price_max: 0 },
    );
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

  const changeCover = useCallback(async () => {
    if (!groupId || coverBusy) return;
    setCoverBusy(true);
    try {
      const res = await pickAndUploadImage(`search_covers/${groupId}_${activeTab}.jpg`, [16, 9]);
      if (res.status === 'success') {
        await useFilterStore.getState().setListCover(groupId, activeTab, res.url);
      } else if (res.status === 'no-permission') {
        Alert.alert('Accès refusé', "Autorise l'accès à ta galerie dans les réglages.");
      } else if (res.status === 'error') {
        Alert.alert('Erreur', "Impossible de changer la photo. Réessaie.");
      }
    } finally {
      setCoverBusy(false);
    }
  }, [groupId, activeTab, coverBusy]);

  const removeCover = useCallback(async () => {
    if (!groupId) return;
    await useFilterStore.getState().setListCover(groupId, activeTab, null);
  }, [groupId, activeTab]);

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

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setAdding(false);
  };

  const confirmEdit = async () => {
    const name = editName.trim();
    if (!name || !groupId || !editingId) { setEditingId(null); return; }
    await useFilterStore.getState().renameList(groupId, editingId, name);
    setEditingId(null);
    setEditName('');
  };

  const cancelEdit = () => { setEditingId(null); setEditName(''); };

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
              if (list) setLocal(normalizeFilters(list.filters));
            }
          },
        },
      ],
    );
  };

  const isBuy = local.transaction_type === 'buy';

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
              const isEditing = editingId === list.id;
              if (isEditing) {
                return (
                  <View key={list.id} style={[styles.tab, styles.tabActive, styles.tabEditing]}>
                    <TextInput
                      value={editName}
                      onChangeText={setEditName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={confirmEdit}
                      style={styles.tabEditInput}
                    />
                    <TouchableOpacity onPress={confirmEdit} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                      <Ionicons name="checkmark-circle" size={18} color={editName.trim() ? '#4A6CF7' : '#ccc'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cancelEdit} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                      <Ionicons name="close-circle" size={18} color="#ccc" />
                    </TouchableOpacity>
                  </View>
                );
              }
              return (
                <TouchableOpacity
                  key={list.id}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => switchTab(list.id)}
                  onLongPress={() => startEdit(list.id, list.name)}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {list.name}
                  </Text>
                  {isActive && (
                    <TouchableOpacity
                      style={styles.tabDelete}
                      onPress={() => startEdit(list.id, list.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Ionicons name="pencil" size={12} color="#4A6CF7" />
                    </TouchableOpacity>
                  )}
                  {isActive && searchLists.length > 1 && (
                    <TouchableOpacity
                      style={styles.tabDelete}
                      onPress={() => handleRemove(list.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Ionicons name="close-circle" size={14} color="#4A6CF7" />
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
          {/* Photo de couverture */}
          <View style={styles.coverSection}>
            <Pressable style={styles.coverBox} onPress={changeCover} disabled={coverBusy}>
              {activeCover ? (
                <Image source={{ uri: activeCover }} style={styles.coverImage} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons name="image-outline" size={28} color="#4A6CF7" />
                  <Text style={styles.coverPlaceholderText}>Ajouter une photo de couverture</Text>
                </View>
              )}
              <View style={styles.coverEditBadge}>
                {coverBusy
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={14} color="#fff" />}
              </View>
            </Pressable>
            {activeCover && !coverBusy && (
              <TouchableOpacity onPress={removeCover} style={styles.coverRemoveBtn}>
                <Text style={styles.coverRemoveText}>Retirer la photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Type de transaction */}
          <Section title="Type de transaction">
            <View style={styles.steps}>
              {TRANSACTION_OPTIONS.map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.step, local.transaction_type === value && styles.stepActive]}
                  onPress={() => setTransaction(value)}
                >
                  <Text style={[styles.stepText, local.transaction_type === value && styles.stepTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

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

          {/* Prix */}
          <Section title={isBuy ? 'Prix (€)' : 'Loyer (€/mois)'}>
            <View style={styles.rangeRow}>
              <View style={styles.rangeInputWrap}>
                <Text style={styles.rangeLabel}>Min</Text>
                <TextInput
                  style={styles.rangeInput}
                  keyboardType="numeric"
                  value={local.price_min > 0 ? String(local.price_min) : ''}
                  onChangeText={(t) => setLocal((f) => ({ ...f, price_min: parseInt(t, 10) || 0 }))}
                  placeholder="Aucun"
                  placeholderTextColor="#aaa"
                />
              </View>
              <Text style={styles.rangeSeparator}>—</Text>
              <View style={styles.rangeInputWrap}>
                <Text style={styles.rangeLabel}>Max</Text>
                <TextInput
                  style={styles.rangeInput}
                  keyboardType="numeric"
                  value={local.price_max > 0 ? String(local.price_max) : ''}
                  onChangeText={(t) => setLocal((f) => ({ ...f, price_max: parseInt(t, 10) || 0 }))}
                  placeholder="Aucun"
                  placeholderTextColor="#aaa"
                />
              </View>
            </View>
          </Section>

          {/* Surface */}
          <Section title="Surface (m²)">
            <View style={styles.rangeRow}>
              <View style={styles.rangeInputWrap}>
                <Text style={styles.rangeLabel}>Min</Text>
                <TextInput
                  style={styles.rangeInput}
                  keyboardType="numeric"
                  value={local.surface_min > 0 ? String(local.surface_min) : ''}
                  onChangeText={(t) => setLocal((f) => ({ ...f, surface_min: parseInt(t, 10) || 0 }))}
                  placeholder="Aucun"
                  placeholderTextColor="#aaa"
                />
              </View>
              <Text style={styles.rangeSeparator}>—</Text>
              <View style={styles.rangeInputWrap}>
                <Text style={styles.rangeLabel}>Max</Text>
                <TextInput
                  style={styles.rangeInput}
                  keyboardType="numeric"
                  value={local.surface_max > 0 ? String(local.surface_max) : ''}
                  onChangeText={(t) => setLocal((f) => ({ ...f, surface_max: parseInt(t, 10) || 0 }))}
                  placeholder="Aucun"
                  placeholderTextColor="#aaa"
                />
              </View>
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

          {/* Accord pour matcher (groupes de 2+ personnes) */}
          {totalMembers >= 2 && (
            <Section title="Accord pour matcher">
              <Text style={styles.hint}>
                {(local.min_likes ?? 0) === 0
                  ? 'Unanimité — tous les membres doivent aimer le bien'
                  : `${local.min_likes} like${local.min_likes > 1 ? 's' : ''} suffisent sur ${totalMembers}`}
              </Text>
              <View style={styles.steps}>
                {likesOptions.map(({ label, value }) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.step, (local.min_likes ?? 0) === value && styles.stepActive]}
                    onPress={() => setLocal((f) => ({ ...f, min_likes: value }))}
                  >
                    <Text style={[styles.stepText, (local.min_likes ?? 0) === value && styles.stepTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
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
      {member.photoUrl ? (
        <Image source={{ uri: member.photoUrl }} style={styles.memberChipAvatar} />
      ) : (
        <View style={styles.memberChipAvatarPlaceholder}>
          <Text style={styles.memberChipAvatarLetter}>
            {member.displayName?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
      )}
      <Text style={selected ? styles.memberChipTextSelected : styles.memberChipText}>
        {member.displayName}
      </Text>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={selected ? '#4A6CF7' : '#aaa'}
      />
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
  tabEditing: {
    paddingHorizontal: 8,
    minWidth: 120,
  },
  tabEditInput: {
    flex: 1,
    fontSize: 13,
    color: '#4A6CF7',
    fontWeight: '600',
    paddingVertical: 0,
    minWidth: 60,
  },
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
  coverSection: { marginBottom: 12 },
  coverBox: {
    height: 150,
    borderRadius: 16,
    backgroundColor: '#EEF1FF',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { alignItems: 'center', gap: 8 },
  coverPlaceholderText: { fontSize: 13, color: '#4A6CF7', fontWeight: '600' },
  coverEditBadge: {
    position: 'absolute', bottom: 10, right: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(26,26,46,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  coverRemoveBtn: { alignSelf: 'center', marginTop: 8 },
  coverRemoveText: { fontSize: 13, color: '#FF4444', fontWeight: '600' },
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
  memberChipAvatar: { width: 22, height: 22, borderRadius: 11 },
  memberChipAvatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4A6CF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberChipAvatarLetter: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  rangeInputWrap: {
    flex: 1,
  },
  rangeLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rangeInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1A1A2E',
    backgroundColor: '#F8F9FA',
  },
  rangeSeparator: {
    fontSize: 20,
    color: '#ccc',
    paddingBottom: 10,
  },
});
