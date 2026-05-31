import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useGroups } from '@/hooks/useGroups';
import { Group } from '@/types';
import { styles } from '@/styles/chatListScreen.styles';

const SAFE_EDGES = ['top'] as const;

function GroupRow({ group, onPress }: { group: Group; onPress: (id: string) => void }) {
  const handlePress = useCallback(() => onPress(group.id), [group.id, onPress]);
  const memberCount = group.member_ids?.length ?? 1;
  const meta = memberCount === 1 ? '1 membre' : `${memberCount} membres`;

  return (
    <TouchableOpacity style={styles.groupRow} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.groupIconWrap}>
        <Ionicons name="chatbubbles-outline" size={22} color="#4A6CF7" />
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName} numberOfLines={1}>{group.name ?? 'Mon groupe'}</Text>
        <Text style={styles.groupMeta}>{meta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#1A1A2E" style={styles.chevron} />
    </TouchableOpacity>
  );
}

export default function ChatListScreen() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const { groups, loading } = useGroups();
  const router = useRouter();

  const handleGroupPress = useCallback((groupId: string) => {
    router.push(`/group-chat/${groupId}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Group }) => (
    <GroupRow group={item} onPress={handleGroupPress} />
  ), [handleGroupPress]);

  const keyExtractor = useCallback((item: Group) => item.id, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={SAFE_EDGES}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#4A6CF7" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={SAFE_EDGES}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
      </View>
      {groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Aucun groupe</Text>
          <Text style={styles.emptyDesc}>Rejoins ou crée un groupe pour commencer à chatter</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.groupList}
        />
      )}
    </SafeAreaView>
  );
}
