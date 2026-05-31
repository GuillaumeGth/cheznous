import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useGroups } from '@/hooks/useGroups';
import { Group } from '@/types';
import { styles } from '@/styles/groupsList.styles';

export default function GroupsListScreen() {
  const activeGroupId = useAuthStore((s) => s.groupId);
  const { groups, loading } = useGroups();

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'));
  const openGroup = (id: string) => router.push(`/groups/${id}`);
  const createOrJoin = () => router.push('/(auth)/invite?from=groups');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.title}>Mes groupes</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A6CF7" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {groups.length === 0 ? (
            <Text style={styles.empty}>
              Tu n'as pas encore de groupe de recherche. Crée-en un ou rejoins celui d'un coloc.
            </Text>
          ) : (
            groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                isActive={group.id === activeGroupId}
                onPress={openGroup}
              />
            ))
          )}

          <TouchableOpacity style={styles.addBtn} onPress={createOrJoin}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Créer ou rejoindre un groupe</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function GroupCard({
  group, isActive, onPress,
}: {
  group: Group;
  isActive: boolean;
  onPress: (id: string) => void;
}) {
  const memberCount = group.member_ids?.length ?? 1;
  const colocCount = Math.max(0, memberCount - 1);
  const sub = colocCount === 0
    ? 'Juste toi'
    : `${colocCount} coloc${colocCount > 1 ? 's' : ''}`;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(group.id)}>
      <View style={styles.cardIcon}>
        <Ionicons name="people" size={22} color="#4A6CF7" />
      </View>
      <View style={styles.cardTexts}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {group.name ?? 'Notre coloc'}
          </Text>
          {isActive && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Actif</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );
}
