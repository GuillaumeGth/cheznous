import React from 'react';
import { View, Text, Image } from 'react-native';
import { styles } from '@/styles/memberAvatars.styles';

export type AvatarMember = {
  uid: string;
  displayName: string;
  photoUrl?: string | null;
};

type Props = {
  members: AvatarMember[];
  max?: number;
};

function MemberAvatars({ members, max = 5 }: Props) {
  if (members.length === 0) return null;

  const shown = members.slice(0, max);
  const extra = members.length - shown.length;

  return (
    <View style={styles.row}>
      {shown.map((m, idx) => (
        <View key={m.uid} style={idx === 0 ? styles.avatarFirst : styles.avatar}>
          {m.photoUrl ? (
            <Image source={{ uri: m.photoUrl }} style={styles.image} />
          ) : (
            <Text style={styles.letter}>
              {m.displayName?.[0]?.toUpperCase() ?? '?'}
            </Text>
          )}
        </View>
      ))}
      {extra > 0 && (
        <View style={styles.extra}>
          <Text style={styles.extraText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

export default React.memo(MemberAvatars);
