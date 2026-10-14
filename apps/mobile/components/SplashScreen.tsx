import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Image,
} from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
  Circle,
} from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Deterministic star field matching the web app
const STARS = [
  { x: 5, y: 12, s: 2, o: 0.6 },
  { x: 18, y: 45, s: 1.5, o: 0.4 },
  { x: 30, y: 8, s: 2.5, o: 0.7 },
  { x: 42, y: 72, s: 2, o: 0.5 },
  { x: 55, y: 20, s: 1.5, o: 0.3 },
  { x: 68, y: 88, s: 2.5, o: 0.6 },
  { x: 78, y: 35, s: 2, o: 0.4 },
  { x: 90, y: 60, s: 1.5, o: 0.7 },
  { x: 12, y: 80, s: 2.5, o: 0.5 },
  { x: 25, y: 55, s: 1.5, o: 0.4 },
  { x: 48, y: 92, s: 2, o: 0.6 },
  { x: 62, y: 5, s: 1.5, o: 0.3 },
  { x: 75, y: 78, s: 2.5, o: 0.5 },
  { x: 88, y: 18, s: 2, o: 0.7 },
  { x: 8, y: 38, s: 1.5, o: 0.4 },
  { x: 35, y: 65, s: 2.5, o: 0.6 },
  { x: 52, y: 42, s: 2, o: 0.3 },
  { x: 82, y: 50, s: 1.5, o: 0.5 },
  { x: 95, y: 28, s: 2.5, o: 0.6 },
  { x: 20, y: 95, s: 1.5, o: 0.4 },
  { x: 65, y: 30, s: 2, o: 0.7 },
  { x: 40, y: 15, s: 1.5, o: 0.3 },
  { x: 72, y: 92, s: 2.5, o: 0.5 },
  { x: 15, y: 62, s: 2, o: 0.6 },
];

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Wrap Circle for animated strokeDashoffset
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface SplashScreenProps {
  onFinish?: () => void;
  minDuration?: number;
}

export function SplashScreen({ onFinish, minDuration = 2400 }: SplashScreenProps) {
  const [percent, setPercent] = useState(0);
  const [visible, setVisible] = useState(true);

  // Animation values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const orbitAnim1 = useRef(new Animated.Value(0)).current;
  const orbitAnim2 = useRef(new Animated.Value(0)).current;
  const twinkleAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // 1. Ambient breathing loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.18,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 2. Orbit rotations
    Animated.loop(
      Animated.timing(orbitAnim1, {
        toValue: 1,
        duration: 7000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(orbitAnim2, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 3. Star twinkling
    Animated.loop(
      Animated.sequence([
        Animated.timing(twinkleAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(twinkleAnim, {
          toValue: 0.35,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 4. Logo entrance animation
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // 5. Text reveal animation
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 800,
      delay: 350,
      useNativeDriver: true,
    }).start();

    // 6. Progress countdown animation
    const progressListener = progressAnim.addListener(({ value }) => {
      setPercent(Math.round(value * 100));
    });

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: minDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      // Small pause at 100% then fade out smoothly
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          setVisible(false);
          onFinish?.();
        });
      }, 200);
    });

    return () => {
      progressAnim.removeListener(progressListener);
    };
  }, []);

  if (!visible) return null;

  // Calculate stroke dashoffset for the SVG ring
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const progressBarWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const spin1 = orbitAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spin2 = orbitAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* ── Background Deep Cosmic Radial Gradient ── */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
          <Defs>
            <RadialGradient id="cosmicBg" cx="50%" cy="40%" rx="85%" ry="85%">
              <Stop offset="0%" stopColor="#0f2460" stopOpacity="1" />
              <Stop offset="55%" stopColor="#07122e" stopOpacity="1" />
              <Stop offset="100%" stopColor="#000816" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#cosmicBg)" />
        </Svg>
      </View>

      {/* ── Star Field ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: twinkleAnim }]} pointerEvents="none">
        {STARS.map((star, idx) => (
          <View
            key={idx}
            style={[
              styles.star,
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.s,
                height: star.s,
                borderRadius: star.s / 2,
                opacity: star.o,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* ── Ambient Glow Orbs ── */}
      <Animated.View
        style={[
          styles.glowBlue,
          {
            transform: [{ scale: breatheAnim }],
          },
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.glowRed,
          {
            transform: [{ scale: breatheAnim }],
          },
        ]}
        pointerEvents="none"
      />

      {/* ── Orbital Rings ── */}
      <Animated.View
        style={[
          styles.orbitRingOuter,
          {
            transform: [{ rotateZ: spin1 }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.satelliteRed} />
      </Animated.View>

      <Animated.View
        style={[
          styles.orbitRingInner,
          {
            transform: [{ rotateZ: spin2 }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.satelliteWhite} />
      </Animated.View>

      {/* ── Center SVG Ring & Logo Badge ── */}
      <View style={styles.centerStage}>
        <Svg width={210} height={210} viewBox="0 0 210 210" style={styles.svgRing}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#1d4ed8" />
              <Stop offset="100%" stopColor="#dc2626" />
            </LinearGradient>
          </Defs>
          {/* Subtle Track */}
          <Circle
            cx="105"
            cy="105"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3.5"
          />
          {/* Animated Gradient Fill Ring */}
          <AnimatedCircle
            cx="105"
            cy="105"
            r={RADIUS}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
          />
        </Svg>

        {/* Circular Logo Card */}
        <Animated.View
          style={[
            styles.logoCard,
            {
              transform: [{ scale: logoScale }],
              opacity: logoOpacity,
            },
          ]}
        >
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* ── Brand Typography ── */}
      <Animated.View style={[styles.brandBlock, { opacity: contentFade }]}>
        <Text style={styles.brandTitle}>EDUCARE</Text>
        <Text style={styles.brandSubtitle}>GROUP OF INSTITUTIONS</Text>
      </Animated.View>

      {/* ── Progress Bar & Numeric Indicator ── */}
      <Animated.View style={[styles.progressSection, { opacity: contentFade }]}>
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressBarWidth,
              },
            ]}
          />
        </View>
        <Text style={styles.percentText}>{percent}%</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    backgroundColor: '#07122e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  glowBlue: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
  },
  glowRed: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  orbitRingOuter: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  satelliteRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
    marginTop: -4,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  orbitRingInner: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  satelliteWhite: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginTop: -3,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  centerStage: {
    width: 210,
    height: 210,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svgRing: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  logoCard: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
    padding: 12,
  },
  logoImage: {
    width: 96,
    height: 96,
  },
  brandBlock: {
    marginTop: 28,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
    color: '#FFFFFF',
  },
  brandSubtitle: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 4,
    color: 'rgba(255, 255, 255, 0.42)',
    textTransform: 'uppercase',
  },
  progressSection: {
    marginTop: 28,
    alignItems: 'center',
  },
  progressBarTrack: {
    width: 170,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#dc2626',
  },
  percentText: {
    marginTop: 8,
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: 'monospace',
    color: 'rgba(255, 255, 255, 0.35)',
  },
});
