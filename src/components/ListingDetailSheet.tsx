import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  Modal, View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, Dimensions, Linking, FlatList, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Listing } from '@/types';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.88;
const DISMISS_THRESHOLD = 80;

type Props = {
  listing: Listing | null;
  onClose: () => void;
};

export default function ListingDetailSheet({ listing, onClose }: Props) {
  const translateY = useSharedValue(SHEET_H);
  const backdropOpacity = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [visibleImageIndex, setVisibleImageIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const close = useCallback(() => {
    translateY.value = withSpring(SHEET_H, { damping: 20, stiffness: 200 });
    backdropOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (listing) {
      setFullscreenIndex(null);
      setVisibleImageIndex(0);
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      backdropOpacity.value = withTiming(1, { duration: 250 });
    }
  }, [listing]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 800) {
        runOnJS(close)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const openFullscreen = useCallback((index: number) => {
    setFullscreenIndex(index);
    setVisibleImageIndex(index);
  }, []);

  const closeFullscreen = useCallback(() => {
    setFullscreenIndex(null);
  }, []);

  if (!listing) return null;

  const totalPrice = listing.price + listing.charges;

  return (
    <Modal transparent visible animationType="none" onRequestClose={fullscreenIndex !== null ? closeFullscreen : close}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + 12 }]}>
        <GestureDetector gesture={pan}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Image carousel */}
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                setVisibleImageIndex(idx);
              }}
            >
              {listing.images.map((uri, i) => (
                <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => openFullscreen(i)}>
                  <Image source={{ uri }} style={styles.image} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {listing.images.length > 1 && (
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {visibleImageIndex + 1} / {listing.images.length}
                </Text>
              </View>
            )}
            <View style={styles.expandHint}>
              <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.8)" />
            </View>
          </View>

          <View style={styles.body}>
            {/* Price block */}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{listing.price.toLocaleString('fr-FR')} €/mois</Text>
              {listing.charges > 0 && (
                <Text style={styles.charges}>+ {listing.charges} € cc</Text>
              )}
              <TouchableOpacity
                style={styles.externalLink}
                onPress={() => Linking.openURL(listing.url)}
              >
                <Ionicons name="open-outline" size={18} color="#4A6CF7" />
              </TouchableOpacity>
            </View>
            {listing.charges > 0 && (
              <Text style={styles.totalPrice}>
                Total : {totalPrice.toLocaleString('fr-FR')} € charges comprises
              </Text>
            )}
            {listing.deposit > 0 && (
              <Text style={styles.deposit}>
                Dépôt de garantie : {listing.deposit.toLocaleString('fr-FR')} €
              </Text>
            )}

            <Text style={styles.title}>{listing.title}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color="#888" />
              <Text style={styles.address}>
                {listing.address} — {listing.arrondissement}ème arr.
              </Text>
            </View>

            {listing.available_from ? (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color="#888" />
                <Text style={styles.metaText}>
                  Disponible le{' '}
                  {new Date(listing.available_from).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </Text>
              </View>
            ) : null}

            <View style={styles.features}>
              <Feature icon="resize-outline" label={`${listing.surface} m²`} />
              <Feature
                icon="bed-outline"
                label={listing.rooms === 1 ? 'Studio' : `${listing.rooms} pièces`}
              />
              {listing.floor !== null && (
                <Feature icon="business-outline" label={`Étage ${listing.floor}`} />
              )}
              {listing.has_elevator && <Feature icon="arrow-up-circle-outline" label="Ascenseur" />}
              {listing.has_balcony && <Feature icon="leaf-outline" label="Balcon" />}
              {listing.has_terrace && <Feature icon="sunny-outline" label="Terrasse" />}
              {listing.has_parking && <Feature icon="car-outline" label="Parking" />}
            </View>

            {listing.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.description}>{listing.description}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </Animated.View>

      {/* Fullscreen image viewer */}
      {fullscreenIndex !== null && (
        <View style={styles.fullscreen}>
          <StatusBar hidden />
          <FlatList
            ref={flatListRef}
            data={listing.images}
            horizontal
            pagingEnabled
            initialScrollIndex={fullscreenIndex}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({
              length: SCREEN_W,
              offset: SCREEN_W * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              setVisibleImageIndex(idx);
            }}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          />

          {/* Counter */}
          <View style={[styles.fullscreenCounter, { top: insets.top + 16 }]}>
            <Text style={styles.fullscreenCounterText}>
              {visibleImageIndex + 1} / {listing.images.length}
            </Text>
          </View>

          {/* Close */}
          <TouchableOpacity
            style={[styles.fullscreenClose, { top: insets.top + 8 }]}
            onPress={closeFullscreen}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </Modal>
  );
}

function Feature({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  return (
    <View style={styles.feature}>
      <Ionicons name={icon} size={15} color="#4A6CF7" />
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
  },
  image: {
    width: SCREEN_W,
    height: 240,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  expandHint: {
    position: 'absolute',
    bottom: 10,
    right: 12,
  },
  body: {
    padding: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  externalLink: {
    marginLeft: 'auto',
    padding: 4,
  },
  price: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  charges: {
    fontSize: 14,
    color: '#888',
  },
  totalPrice: {
    fontSize: 13,
    color: '#555',
    marginTop: 3,
  },
  deposit: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  address: {
    fontSize: 13,
    color: '#888',
    flex: 1,
  },
  metaText: {
    fontSize: 13,
    color: '#555',
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  featureText: {
    fontSize: 13,
    color: '#4A6CF7',
    fontWeight: '500',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 21,
  },
  fullscreen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullscreenImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  fullscreenClose: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCounter: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  fullscreenCounterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
