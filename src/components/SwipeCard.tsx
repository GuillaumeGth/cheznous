import React, { useCallback } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Listing } from '@/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;
const CARD_H = SCREEN_H * 0.72;
const SWIPE_THRESHOLD = 100;

type Props = {
  listing: Listing;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  isTop: boolean;
  index: number;
  onInfoPress?: () => void;
  partnerNote?: string | null;
  partnerName?: string | null;
};

export default function SwipeCard({ listing, onSwipeLeft, onSwipeRight, onUndo, canUndo, isTop, index, onInfoPress, partnerNote, partnerName }: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [imageIndex, setImageIndex] = React.useState(0);

  const handleSwipeLeft = useCallback(() => onSwipeLeft(), [onSwipeLeft]);
  const handleSwipeRight = useCallback(() => onSwipeRight(), [onSwipeRight]);

  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.3;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(SCREEN_W * 1.5);
        runOnJS(handleSwipeRight)();
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SCREEN_W * 1.5);
        runOnJS(handleSwipeLeft)();
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_W / 2, 0, SCREEN_W / 2],
      [-12, 0, 12],
      Extrapolation.CLAMP,
    );
    const scale = isTop ? 1 : interpolate(index, [1, 2], [0.95, 0.9]);
    const offsetY = isTop ? 0 : interpolate(index, [1, 2], [12, 24]);

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + offsetY },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-20, -80], [0, 1], Extrapolation.CLAMP),
  }));

  const { arrondissement, price, charges, surface, rooms, floor, has_elevator, has_balcony } = listing;
  const totalPrice = price + charges;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]}>
       <Pressable style={styles.pressable} onPress={onInfoPress} disabled={!isTop || !onInfoPress}>
        {/* Image carousel */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: listing.images[imageIndex] ?? listing.images[0] }}
            style={styles.image}
            resizeMode="cover"
          />
          {listing.images.length > 1 && (
            <View style={styles.imageDots}>
              {listing.images.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setImageIndex(i)}>
                  <View style={[styles.dot, i === imageIndex && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Like overlay */}
          <Animated.View style={[styles.overlay, styles.likeOverlay, likeOpacity]}>
            <Text style={styles.likeText}>J'ADORE</Text>
          </Animated.View>

          {/* Nope overlay */}
          <Animated.View style={[styles.overlay, styles.nopeOverlay, nopeOpacity]}>
            <Text style={styles.nopeText}>PASSE</Text>
          </Animated.View>

          {/* Arrondissement badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{arrondissement}ème</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.priceRow}>
            <View>
              <View style={styles.priceWithCharges}>
                <Text style={styles.price}>{price.toLocaleString('fr-FR')} €/mois</Text>
                {charges > 0 && (
                  <Text style={styles.charges}>+{charges} € charges</Text>
                )}
              </View>
              <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
              <Text style={styles.address} numberOfLines={1}>{listing.address}</Text>
            </View>
            {onInfoPress && (
              <TouchableOpacity style={styles.detailsBtn} onPress={onInfoPress}>
                <Ionicons name="information-circle-outline" size={14} color="#4A6CF7" />
                <Text style={styles.detailsBtnText}>Voir les{'\n'}détails</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.tags}>
            <Tag iconName="resize-outline" label={`${surface} m²`} />
            <Tag iconName="bed-outline" label={rooms === 1 ? 'Studio' : `${rooms} pièces`} />
            {floor !== null && <Tag iconName="business-outline" label={`Étage ${floor}`} />}
            {has_elevator && <Tag iconName="arrow-up-circle-outline" label="Ascenseur" />}
            {has_balcony && <Tag iconName="leaf-outline" label="Balcon" />}
          </View>

          {partnerNote ? (
            <View style={styles.partnerNote}>
              <Ionicons name="pencil" size={12} color="#4A6CF7" />
              <Text style={styles.partnerNoteName}>{partnerName ?? 'Ton partenaire'} :</Text>
              <Text style={styles.partnerNoteText} numberOfLines={2}>{partnerNote}</Text>
            </View>
          ) : null}

        </View>
       </Pressable>

        {isTop && (
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={onSwipeLeft} activeOpacity={0.85}>
              <LinearGradient colors={['#FF0044', '#FF4D88']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardActionBtn}>
                <Ionicons name="close" size={28} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={onUndo} disabled={!canUndo} activeOpacity={0.85}>
              <LinearGradient colors={['#FFD54F', '#FFA000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardUndoBtn}>
                <Ionicons name="arrow-undo" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSwipeRight} activeOpacity={0.85}>
              <LinearGradient colors={['#00E676', '#00C853']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardActionBtn}>
                <Ionicons name="heart" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

function Tag({ iconName, label }: { iconName: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={styles.tag}>
      <Ionicons name={iconName} size={12} color="#4A6CF7" />
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageDots: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
  overlay: {
    position: 'absolute',
    top: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 3,
  },
  likeOverlay: {
    left: 20,
    borderColor: '#00C851',
    transform: [{ rotate: '-15deg' }],
  },
  nopeOverlay: {
    right: 20,
    borderColor: '#FF4444',
    transform: [{ rotate: '15deg' }],
  },
  likeText: {
    color: '#00C851',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  nopeText: {
    color: '#FF4444',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  info: {
    padding: 16,
    backgroundColor: '#fff',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceWithCharges: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  charges: {
    fontSize: 13,
    color: '#888',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  address: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#4A6CF7',
    fontWeight: '500',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
  },
  detailsBtnText: {
    fontSize: 12,
    color: '#4A6CF7',
    fontWeight: '600',
  },
  partnerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  partnerNoteName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A6CF7',
    flexShrink: 0,
  },
  partnerNoteText: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 10,
    backgroundColor: '#fff',
  },
  cardActionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  cardUndoBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFA000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});
