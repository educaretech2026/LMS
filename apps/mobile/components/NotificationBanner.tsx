import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  PanResponder,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  AlertCircle,
  CheckCircle2,
  Info,
  Calendar,
  X,
  ChevronRight,
} from 'lucide-react-native';

export type BannerType = 'info' | 'success' | 'warning' | 'error' | 'academic';

export interface BannerData {
  id: string;
  title: string;
  message: string;
  type?: BannerType;
  link?: string;
  onPress?: () => void;
  duration?: number;
}

interface NotificationBannerProps {
  banner: BannerData | null;
  onDismiss: () => void;
}

export function NotificationBanner({ banner, onDismiss }: NotificationBannerProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (banner) {
      if (timerRef.current) clearTimeout(timerRef.current);

      // Slide and fade in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 8,
          speed: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss timer
      const timeout = banner.duration || 4500;
      timerRef.current = setTimeout(() => {
        dismissBanner();
      }, timeout);
    } else {
      dismissBanner();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [banner]);

  const dismissBanner = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  // Pan responder to dismiss on swipe up
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy < -10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -20) {
          dismissBanner();
        }
      },
    })
  ).current;

  if (!banner) return null;

  const getTheme = (type: BannerType = 'info') => {
    switch (type) {
      case 'success':
        return {
          bg: '#064e3b',
          border: '#059669',
          iconBg: '#10b981',
          icon: <CheckCircle2 size={20} color="#FFFFFF" />,
          accent: '#34d399',
        };
      case 'warning':
        return {
          bg: '#78350f',
          border: '#d97706',
          iconBg: '#f59e0b',
          icon: <AlertCircle size={20} color="#FFFFFF" />,
          accent: '#fbbf24',
        };
      case 'error':
        return {
          bg: '#7f1d1d',
          border: '#dc2626',
          iconBg: '#ef4444',
          icon: <AlertCircle size={20} color="#FFFFFF" />,
          accent: '#f87171',
        };
      case 'academic':
        return {
          bg: '#1e1b4b',
          border: '#6366f1',
          iconBg: '#4f46e5',
          icon: <Calendar size={20} color="#FFFFFF" />,
          accent: '#818cf8',
        };
      case 'info':
      default:
        return {
          bg: '#0c2340',
          border: '#2563eb',
          iconBg: '#1d4ed8',
          icon: <Bell size={20} color="#FFFFFF" />,
          accent: '#60a5fa',
        };
    }
  };

  const theme = getTheme(banner.type);
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? 12 : 24);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          top: topInset + 6,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          if (banner.onPress) {
            banner.onPress();
          }
          dismissBanner();
        }}
        style={[
          styles.card,
          {
            backgroundColor: theme.bg,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: theme.iconBg }]}>
          {theme.icon}
        </View>

        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: '#FFFFFF' }]} numberOfLines={1}>
              {banner.title}
            </Text>
            <Text style={[styles.tag, { color: theme.accent }]}>
              {(banner.type || 'Alert').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {banner.message}
          </Text>
        </View>

        {banner.link || banner.onPress ? (
          <ChevronRight size={18} color="#94A3B8" style={styles.chevron} />
        ) : null}

        <TouchableOpacity
          onPress={dismissBanner}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={16} color="#94A3B8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  tag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  chevron: {
    marginRight: 6,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
