import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useChat, ATTACHMENT_LIMITS, AttachmentInput } from '@/hooks/useChat';
import { useAuthStore } from '@/stores/authStore';
import { ChatMessage } from '@/types';
import { styles } from '@/styles/chat.styles';

// expo-document-picker is an optional peer — lazy-require so the app doesn't
// crash if the package isn't installed yet (run: npx expo install expo-document-picker).
function getDocumentPicker() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-document-picker') as typeof import('expo-document-picker');
  } catch {
    return null;
  }
}

const IMAGE_MB = Math.round(ATTACHMENT_LIMITS.image / 1024 / 1024);
const FILE_MB = Math.round(ATTACHMENT_LIMITS.file / 1024 / 1024);

export default function ChatScreen() {
  const { matchId, title, address } = useLocalSearchParams<{
    matchId: string;
    title?: string;
    address?: string;
  }>();
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const { messages, isLoading, sendMessage, sendAttachment } = useChat(matchId);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const toSend = text.trim();
    if (!toSend) return;
    setText('');
    await sendMessage(toSend);
  }, [text, sendMessage]);

  const handleAttachment = useCallback(async (attachment: AttachmentInput) => {
    setUploading(true);
    const result = await sendAttachment(attachment);
    setUploading(false);
    if (result === 'too_large') {
      const limit = attachment.type === 'image' ? IMAGE_MB : FILE_MB;
      Alert.alert('Fichier trop lourd', `La taille maximum est ${limit} Mo.`);
    } else if (result === 'error') {
      Alert.alert('Erreur', "L'envoi a échoué, réessayez.");
    }
  }, [sendAttachment]);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès à la galerie dans les réglages.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await handleAttachment({
      uri: asset.uri,
      size: asset.fileSize ?? 0,
      fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      type: 'image',
    });
  }, [handleAttachment]);

  const pickFile = useCallback(async () => {
    const DocumentPicker = getDocumentPicker();
    if (!DocumentPicker) {
      Alert.alert(
        'Module manquant',
        "Installez expo-document-picker : npx expo install expo-document-picker",
      );
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await handleAttachment({
      uri: asset.uri,
      size: asset.size ?? 0,
      fileName: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      type: 'file',
    });
  }, [handleAttachment]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isMe = item.user_id === uid;
    const hasAttachment = !!item.attachment_url;
    const timeStr = new Date(item.created_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    });

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        {!isMe && <Text style={styles.senderName}>{item.display_name}</Text>}

        {hasAttachment && item.attachment_type === 'image' ? (
          <TouchableOpacity onPress={() => Linking.openURL(item.attachment_url!)}>
            <Image
              source={{ uri: item.attachment_url }}
              style={[styles.attachmentImage, isMe ? styles.bubbleMe : styles.bubbleThem]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : hasAttachment && item.attachment_type === 'file' ? (
          <TouchableOpacity
            style={[styles.bubble, styles.bubbleAttachment, isMe ? styles.bubbleMe : styles.bubbleThem]}
            onPress={() => item.attachment_url && Linking.openURL(item.attachment_url)}
          >
            <View style={styles.fileRow}>
              <Ionicons
                name="document-outline"
                size={22}
                color={isMe ? '#fff' : '#4A6CF7'}
              />
              <Text
                style={[styles.fileName, isMe ? styles.fileNameMe : styles.fileNameThem]}
                numberOfLines={2}
              >
                {item.attachment_name ?? 'Fichier'}
              </Text>
              <Ionicons name="download-outline" size={18} color={isMe ? '#ffffffaa' : '#888'} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
              {item.text}
            </Text>
          </View>
        )}

        <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem]}>{timeStr}</Text>
      </View>
    );
  }, [uid]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title ?? 'Discussion'}</Text>
          {address ? <Text style={styles.headerSub} numberOfLines={1}>{address}</Text> : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#4A6CF7" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="chatbubbles-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>Commencez à discuter de ce bien !</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachBtn} onPress={pickImage} disabled={uploading}>
            <Ionicons name="image-outline" size={22} color={uploading ? '#ccc' : '#4A6CF7'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachBtn} onPress={pickFile} disabled={uploading}>
            <Ionicons name="attach-outline" size={22} color={uploading ? '#ccc' : '#4A6CF7'} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Votre message…"
            placeholderTextColor="#aaa"
            multiline
            maxLength={500}
            editable={!uploading}
          />
          {uploading ? (
            <ActivityIndicator color="#4A6CF7" style={styles.sendBtn} />
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim()}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
