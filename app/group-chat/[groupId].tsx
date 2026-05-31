import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useGroupById } from '@/hooks/useGroupById';
import { useGroupChat } from '@/hooks/useGroupChat';
import { GroupMessage } from '@/types';
import { styles } from '@/styles/groupChatScreen.styles';

const SAFE_EDGES = ['bottom'] as const;
const KAV_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : undefined;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Sub-components (module-level, never re-created on parent render) ───────

const SystemMessage = memo(function SystemMessage({ message }: { message: GroupMessage }) {
  return (
    <View style={styles.systemRow}>
      <View style={styles.systemBubble}>
        <Text style={styles.systemText}>{message.text}</Text>
      </View>
    </View>
  );
});

type ReactionButtonsProps = {
  messageId: string;
  reactions: Record<string, 'like' | 'dislike'>;
  myUid: string;
  onReact: (messageId: string, reaction: 'like' | 'dislike' | null) => void;
};

const ReactionButtons = memo(function ReactionButtons({
  messageId, reactions, myUid, onReact,
}: ReactionButtonsProps) {
  const likeCount = Object.values(reactions).filter((r) => r === 'like').length;
  const dislikeCount = Object.values(reactions).filter((r) => r === 'dislike').length;
  const myReaction = reactions[myUid] ?? null;

  const handleLike = useCallback(() => {
    onReact(messageId, myReaction === 'like' ? null : 'like');
  }, [messageId, myReaction, onReact]);

  const handleDislike = useCallback(() => {
    onReact(messageId, myReaction === 'dislike' ? null : 'dislike');
  }, [messageId, myReaction, onReact]);

  const likeActive = myReaction === 'like';
  const dislikeActive = myReaction === 'dislike';

  return (
    <View style={styles.reactionsRow}>
      <TouchableOpacity
        style={[styles.reactionBtn, likeActive ? styles.reactionBtnLikeActive : styles.reactionBtnNeutral]}
        onPress={handleLike}
        activeOpacity={0.7}
      >
        <Ionicons
          name={likeActive ? 'thumbs-up' : 'thumbs-up-outline'}
          size={16}
          color={likeActive ? '#fff' : '#34C759'}
        />
        <Text style={[styles.reactionCount, likeActive ? styles.reactionCountActive : styles.reactionCountLike]}>
          {likeCount}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.reactionBtn, dislikeActive ? styles.reactionBtnDislikeActive : styles.reactionBtnNeutral]}
        onPress={handleDislike}
        activeOpacity={0.7}
      >
        <Ionicons
          name={dislikeActive ? 'thumbs-down' : 'thumbs-down-outline'}
          size={16}
          color={dislikeActive ? '#fff' : '#FF3B30'}
        />
        <Text style={[styles.reactionCount, dislikeActive ? styles.reactionCountActive : styles.reactionCountDislike]}>
          {dislikeCount}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

type ListingShareProps = {
  message: GroupMessage;
  isMine: boolean;
  myUid: string;
  onReact: (messageId: string, reaction: 'like' | 'dislike' | null) => void;
};

const ListingShareMessage = memo(function ListingShareMessage({
  message, isMine, myUid, onReact,
}: ListingShareProps) {
  const listing = message.listing;
  if (!listing) return null;

  const thumb = listing.images?.[0];
  const price = listing.price ? `${listing.price.toLocaleString('fr-FR')} €/mois` : null;
  const surface = listing.surface ? `${listing.surface} m²` : null;
  const arr = listing.arrondissement ? `${listing.arrondissement}e arr.` : null;
  const meta = [surface, arr].filter(Boolean).join(' · ');

  return (
    <View style={styles.shareGroup}>
      {!isMine && <Text style={styles.shareAuthor}>{message.display_name}</Text>}
      <View style={[styles.shareCard, isMine ? styles.shareCardMine : styles.shareCardTheirs]}>
        <Text style={styles.shareCaption}>{message.text}</Text>
        <View style={styles.listingRow}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.listingThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.listingThumb, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="business-outline" size={28} color="#aaa" />
            </View>
          )}
          <View style={styles.listingInfo}>
            <Text style={styles.listingTitle} numberOfLines={2}>{listing.title}</Text>
            {price && <Text style={styles.listingPrice}>{price}</Text>}
            {meta ? <Text style={styles.listingMeta}>{meta}</Text> : null}
          </View>
        </View>
        <ReactionButtons
          messageId={message.id}
          reactions={message.reactions ?? {}}
          myUid={myUid}
          onReact={onReact}
        />
        <Text style={styles.shareTime}>{formatTime(message.created_at)}</Text>
      </View>
    </View>
  );
});

type TextMessageProps = {
  message: GroupMessage;
  isMine: boolean;
  showAuthor: boolean;
};

const TextMessage = memo(function TextMessage({ message, isMine, showAuthor }: TextMessageProps) {
  return (
    <View style={styles.messageGroup}>
      {!isMine && showAuthor && (
        <Text style={styles.authorLabel}>{message.display_name}</Text>
      )}
      <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
            {message.text}
          </Text>
          <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
            {formatTime(message.created_at)}
          </Text>
        </View>
      </View>
    </View>
  );
});

// ─── List item shape ─────────────────────────────────────────────────────────

type MessageItem = { msg: GroupMessage; showAuthor: boolean };

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const myUid = useAuthStore((s) => s.firebaseUser?.uid ?? '');

  const { group, memberProfiles, loading: groupLoading } = useGroupById(groupId ?? null);
  const { messages, isLoading, sendMessage, reactToMessage } = useGroupChat(groupId ?? null);

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList<MessageItem>>(null);

  const groupName = group?.name ?? 'Chat du groupe';
  const memberCount = group?.member_ids?.length ?? memberProfiles.length + 1;
  const subtitle = memberCount === 1 ? '1 membre' : `${memberCount} membres`;

  // Scroll to bottom on new messages only, not on full re-renders.
  const prevLengthRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    await sendMessage(text);
  }, [inputText, sendMessage]);

  const handleReact = useCallback((messageId: string, reaction: 'like' | 'dislike' | null) => {
    reactToMessage(messageId, reaction);
  }, [reactToMessage]);

  // Pure derivation — no side-effects. showAuthor = first message from this
  // sender in a consecutive run, so the name isn't repeated on every bubble.
  const items = useMemo<MessageItem[]>(() => (
    messages.map((msg, index) => ({
      msg,
      showAuthor: index === 0 || messages[index - 1].user_id !== msg.user_id,
    }))
  ), [messages]);

  const renderItem = useCallback(({ item }: { item: MessageItem }) => {
    const { msg, showAuthor } = item;
    const isMine = msg.user_id === myUid;

    if (msg.type === 'system') return <SystemMessage message={msg} />;
    if (msg.type === 'listing_share') {
      return (
        <ListingShareMessage
          message={msg}
          isMine={isMine}
          myUid={myUid}
          onReact={handleReact}
        />
      );
    }
    return <TextMessage message={msg} isMine={isMine} showAuthor={showAuthor} />;
  }, [myUid, handleReact]);

  const keyExtractor = useCallback((item: MessageItem) => item.msg.id, []);

  if (groupLoading && !group) {
    return (
      <SafeAreaView style={styles.safe} edges={SAFE_EDGES}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A6CF7" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={SAFE_EDGES}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR} keyboardVerticalOffset={0}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4A6CF7" />
            <Text style={styles.loadingText}>Chargement…</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.messageList}
            // Initial scroll — no animation to avoid jank on first load
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={styles.inputArea}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message…"
            placeholderTextColor="#aaa"
            multiline
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
