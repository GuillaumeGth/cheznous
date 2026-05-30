import React, { useEffect, useRef } from 'react';
import { Dimensions, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

const COLORS = [
  '#FF0044', '#FF4D88', '#00E676', '#4A6CF7',
  '#FFD700', '#A855F7', '#FF69B4', '#00BCD4', '#FF8C00',
];

const COUNT = 60;

interface Piece {
  id: number;
  x: number;
  color: string;
  w: number;
  h: number;
  delay: number;
  duration: number;
  endRotation: number;
}

function makePieces(): Piece[] {
  return Array.from({ length: COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * (W - 12),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    w: 6 + Math.random() * 8,
    h: 10 + Math.random() * 6,
    delay: Math.random() * 700,
    duration: 2200 + Math.random() * 1300,
    endRotation: 180 + Math.random() * 540,
  }));
}

function ConfettiPiece({ p }: { p: Piece }) {
  const translateY = useSharedValue(-20);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    const hold = p.duration * 0.6 - 80;
    const fade = p.duration * 0.4;

    opacity.value = withDelay(
      p.delay,
      withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(1, { duration: hold }),
        withTiming(0, { duration: fade }),
      ),
    );
    translateY.value = withDelay(
      p.delay,
      withTiming(H + 40, { duration: p.duration, easing: Easing.in(Easing.poly(1.4)) }),
    );
    rotation.value = withDelay(
      p.delay,
      withTiming(p.endRotation, { duration: p.duration, easing: Easing.linear }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        { left: p.x, width: p.w, height: p.h, backgroundColor: p.color },
        aStyle,
      ]}
    />
  );
}

export default function ConfettiOverlay() {
  const pieces = useRef(makePieces()).current;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} p={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
});
