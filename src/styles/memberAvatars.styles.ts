import { StyleSheet } from 'react-native';

const SIZE = 26;

const base = {
  width: SIZE,
  height: SIZE,
  borderRadius: SIZE / 2,
  borderWidth: 2,
  borderColor: '#F8F9FA',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
} as const;

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // Premier avatar : pas de chevauchement
  avatarFirst: { ...base, marginLeft: 0, backgroundColor: '#4A6CF7' },
  // Suivants : chevauchent le précédent
  avatar: { ...base, marginLeft: -9, backgroundColor: '#4A6CF7' },
  image: { width: '100%', height: '100%' },
  letter: { color: '#fff', fontSize: 12, fontWeight: '700' },
  extra: { ...base, marginLeft: -9, backgroundColor: '#C7D0E0' },
  extraText: { color: '#42526E', fontSize: 11, fontWeight: '700' },
});
