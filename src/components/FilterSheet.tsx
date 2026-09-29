import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Platform, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchFilters, DEFAULT_FILTERS } from '@/types';
import { useFilterStore } from '@/stores/filterStore';
import { useAuthStore } from '@/stores/authStore';
import FeedSourcePicker from '@/components/FeedSourcePicker';

type Props = {
  visible: boolean;
  onClose: () => void;
};

// Keeps only the current fields: filters saved before the refinements were
// narrowed down may still carry legacy keys (arrondissements, min_likes…).
const normalizeFilters = (f?: Partial<SearchFilters>): SearchFilters => ({
  price_min: f?.price_min ?? DEFAULT_FILTERS.price_min,
  price_max: f?.price_max ?? DEFAULT_FILTERS.price_max,
  surface_min: f?.surface_min ?? DEFAULT_FILTERS.surface_min,
  surface_max: f?.surface_max ?? DEFAULT_FILTERS.surface_max,
  rooms_min: f?.rooms_min ?? DEFAULT_FILTERS.rooms_min,
});
const ROOMS_OPTIONS = [
  { label: 'Tous', value: 0 },
  { label: 'Studio', value: 1 },
  { label: '2 p.', value: 2 },
  { label: '3 p.', value: 3 },
  { label: '4+ p.', value: 4 },
];

export default function FilterSheet({ visible, onClose }: Props) {
  const searchLists = useFilterStore((s) => s.searchLists);
  const activeListId = useFilterStore((s) => s.activeListId);
  const groupId = useAuthStore((s) => s.groupId);
  const insets = useSafeAreaInsets();

  const [local, setLocal] = useState<SearchFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    if (visible) setLocal(normalizeFilters(searchLists.find((l) => l.id === activeListId)?.filters));
  }, [visible]);

  const apply = async () => {
    if (groupId && activeListId) await useFilterStore.getState().syncFilters(groupId, local, activeListId);
    onClose();
  };

  const reset = () => setLocal(DEFAULT_FILTERS);

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

          {/* Prix */}
          <Section title="Loyer (€/mois)">
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
