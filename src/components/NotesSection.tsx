import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useListingNotes } from '@/hooks/useListingNotes';
import { styles } from '@/styles/notesSection.styles';

type Props = {
  listingId: string;
  members: { id: string; display_name: string }[];
  myUid: string | undefined;
};

export default function NotesSection({ listingId, members, myUid }: Props) {
  const notes = useListingNotes(listingId, members, myUid);
  if (notes.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="pencil-outline" size={12} color="#aaa" />
        <Text style={styles.headerText}>Notes ({notes.length})</Text>
      </View>
      {notes.map((note) => (
        <View key={note.userId} style={styles.noteRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {note.displayName[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.noteContent}>
            <Text style={styles.noteName}>
              {note.isMine ? 'Toi' : note.displayName}
            </Text>
            <Text style={styles.noteText} numberOfLines={3}>{note.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
