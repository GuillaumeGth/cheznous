import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useListingNotes } from '@/hooks/useListingNotes';
import NoteModal from '@/components/NoteModal';
import { styles } from '@/styles/listingNotesPanel.styles';

type Props = {
  listingId: string;
  listingTitle: string;
  members: { id: string; display_name: string }[];
};

// "Notes" section of the listing detail sheet: every member's note + editing mine.
export default function ListingNotesPanel({ listingId, listingTitle, members }: Props) {
  const myUid = useAuthStore((s) => s.firebaseUser?.uid);
  const { notes, saveMyNote } = useListingNotes(listingId, members, myUid);
  const [editing, setEditing] = useState(false);

  const myNote = notes.find((n) => n.isMine)?.text ?? '';

  const openEditor = useCallback(() => setEditing(true), []);
  const closeEditor = useCallback(() => setEditing(false), []);
  const handleSave = useCallback((text: string) => {
    saveMyNote(text).catch(() => {});
  }, [saveMyNote]);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Notes</Text>
        <TouchableOpacity style={styles.editBtn} onPress={openEditor} hitSlop={8}>
          <Ionicons name={myNote ? 'create-outline' : 'add'} size={16} color="#4A6CF7" />
          <Text style={styles.editBtnText}>{myNote ? 'Modifier ma note' : 'Laisser une note'}</Text>
        </TouchableOpacity>
      </View>

      {notes.length === 0 ? (
        <Text style={styles.empty}>Aucune note pour l'instant</Text>
      ) : (
        notes.map((note) => (
          <View key={note.userId} style={styles.noteRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {note.displayName[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.noteContent}>
              <Text style={styles.noteName}>{note.isMine ? 'Toi' : note.displayName}</Text>
              <Text style={styles.noteText}>{note.text}</Text>
            </View>
          </View>
        ))
      )}

      <NoteModal
        visible={editing}
        initialText={myNote}
        listingTitle={listingTitle}
        onSave={handleSave}
        onClose={closeEditor}
      />
    </View>
  );
}
