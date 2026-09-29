import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useGroupById } from '@/hooks/useGroupById';
import { renameGroup, setActiveGroup } from '@/services/groups';
import Toast, { ToastType } from '@/components/Toast';
import { styles } from '@/styles/groupDetail.styles';

export default function GroupDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = typeof params.id === 'string' ? params.id : null;

  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const activeGroupId = useAuthStore((s) => s.groupId);
  const { group, memberProfiles, loading } = useGroupById(groupId);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => setToast({ message, type });
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/groups'));

  const isActive = !!group && group.id === activeGroupId;
  const colocCount = Math.max(0, (group?.member_ids?.length ?? 1) - 1);

  const startEditName = () => {
    setNameDraft(group?.name ?? '');
    setEditingName(true);
  };

  const saveGroupName = async () => {
    setEditingName(false);
    const name = nameDraft.trim();
    if (!group || !name || name === group.name) return;
    try {
      await renameGroup(group.id, name);
    } catch {
      showToast('Impossible de renommer le groupe.', 'error');
    }
  };

  const makeActive = async () => {
    if (!group || !uid) return;
    try {
      await setActiveGroup(uid, group.id);
      showToast('Groupe actif mis à jour !', 'success');
    } catch {
      showToast('Impossible de changer de groupe actif.', 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {group?.name ?? 'Groupe'}
        </Text>
      </View>

      {loading && !group ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A6CF7" />
        </View>
      ) : !group ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#ccc" />
          <Text style={styles.centeredText}>Ce groupe n'existe plus.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Carte groupe */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Le groupe</Text>
            <View style={styles.card}>
              {editingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    style={styles.nameEditInput}
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    onBlur={saveGroupName}
                    onSubmitEditing={saveGroupName}
                    autoFocus
                    returnKeyType="done"
                    placeholder="Nom du groupe"
                    placeholderTextColor="#aaa"
                    maxLength={40}
                  />
                  <TouchableOpacity onPress={saveGroupName} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="checkmark-circle" size={24} color="#4A6CF7" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.nameRow} onPress={startEditName}>
                  <Text style={styles.name}>{group.name ?? 'Notre coloc'}</Text>
                  <Ionicons name="pencil" size={15} color="#4A6CF7" />
                </TouchableOpacity>
              )}

              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Colocs</Text>
                <Text style={styles.value}>
                  {colocCount === 0 ? 'Juste toi' : `${colocCount} coloc${colocCount > 1 ? 's' : ''}`}
                </Text>
              </View>

              {memberProfiles.length > 0 && (
                <>
                  <View style={styles.divider} />
                  {memberProfiles.map((mp) => (
                    <View key={mp.id} style={styles.memberRow}>
                      <Ionicons name="person-circle-outline" size={18} color="#4A6CF7" />
                      <Text style={styles.memberName}>{mp.display_name}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          </View>

          {/* Groupe actif */}
          <View style={styles.section}>
            {isActive ? (
              <View style={styles.activeChip}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={styles.activeChipText}>C'est ton groupe actif</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.activeBtn} onPress={makeActive}>
                <Ionicons name="swap-horizontal" size={18} color="#fff" />
                <Text style={styles.activeBtnText}>Définir comme groupe actif</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type}
        onHide={() => setToast(null)}
      />
    </SafeAreaView>
  );
}
