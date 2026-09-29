import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Platform, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupMember, SearchFilters, TransactionType, DEFAULT_FILTERS } from '@/types';
import { useFilterStore } from '@/stores/filterStore';
import { useAuthStore } from '@/stores/authStore';
import FeedSourcePicker from '@/components/FeedSourcePicker';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Other users of the app (the single search involves everyone). */
  members: GroupMember[];
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

export default function FilterSheet({ visible, onClose, members }: Props) {
  const searchLists = useFilterStore((s) => s.searchLists);
  const activeListId = useFilterStore((s) => s.activeListId);
  const groupId = useAuthStore((s) => s.groupId);
  const insets = useSafeAreaInsets();

  const [local, setLocal] = useState<SearchFilters>(DEFAULT_FILTERS);

  // Everyone using the app takes part in the single search (+1 = me).
  const totalMembers = members.length + 1;
  const likesOptions = useMemo(() => [
    { label: 'Tous', value: 0 },
    ...Array.from({ length: totalMembers - 1 }, (_, i) => ({
      label: String(i + 1),
      value: i + 1,
    })),
  ], [totalMembers]);

  useEffect(() => {
    if (visible) setLocal(normalizeFilters(searchLists.find((l) => l.id === activeListId)?.filters));
  }, [visible]);

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
    if (groupId && activeListId) await useFilterStore.getState().syncFilters(groupId, local, activeListId);
    onClose();
  };

  const reset = () => setLocal(DEFAULT_FILTERS);

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

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Source des annonces (alerte Jinka liée à cette recherche) */}
          <Section title="Source des annonces">
            <FeedSourcePicker groupId={groupId} listId={activeListId} />
          </Section>

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
