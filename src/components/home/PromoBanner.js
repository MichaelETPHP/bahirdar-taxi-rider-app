import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Animated, Dimensions, Linking, Share, PanResponder,
} from 'react-native';
import { X, Share2, ExternalLink, Play } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { getActivePromotions } from '../../services/promotionService';

const { height: SH } = Dimensions.get('window');
const CARD_HEIGHT = Math.min(SH * 0.72, 560);
const FOOTER_HEIGHT = 84;
const SWIPE_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 0.6;

function youtubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return m?.[1] ?? null;
}

function versionedUrl(url, version) {
  if (!url) return url;
  const v = encodeURIComponent(String(version ?? ''));
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}v=${v}`;
}

function MediaContent({ promo }) {
  if (promo.media_type === 'video' && promo.video_url) {
    const ytId = youtubeId(promo.video_url);

    if (ytId) {
      const thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      return (
        <TouchableOpacity
          style={styles.media}
          activeOpacity={0.9}
          onPress={() => Linking.openURL(promo.video_url).catch(() => {})}
        >
          <Image source={{ uri: thumb }} style={styles.media} resizeMode="cover" />
          <View style={styles.ytPlayOverlay}>
            <View style={styles.ytPlayBtn}>
              <Play size={26} color="#fff" fill="#fff" />
            </View>
            <View style={styles.ytBadge}>
              <Text style={styles.ytBadgeText}>YouTube · Tap to watch</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <Video
        source={{ uri: promo.video_url }}
        style={styles.media}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        useNativeControls
      />
    );
  }

  if (promo.image_url) {
    return (
      <Image
        source={{ uri: versionedUrl(promo.image_url, promo.updated_at || promo.id) }}
        style={styles.media}
        resizeMode="cover"
      />
    );
  }

  return <View style={[styles.media, { backgroundColor: colors.primaryLight }]} />;
}

export default function PromoBanner() {
  const insets = useSafeAreaInsets();
  const [promo,     setPromo]     = useState(null);
  const [visible,   setVisible]   = useState(false);
  const slideAnim    = useRef(new Animated.Value(CARD_HEIGHT + 80)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const dragY        = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getActivePromotions();
        const list = res?.data;
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setPromo(list[0]);
          setVisible(true);
          Animated.parallel([
            Animated.spring(slideAnim, {
              toValue: 0, useNativeDriver: true, tension: 50, friction: 10,
            }),
            Animated.timing(backdropAnim, {
              toValue: 1, duration: 300, useNativeDriver: true,
            }),
          ]).start();
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const dismiss = () => {
    dragY.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: CARD_HEIGHT + 80, duration: 280, useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0, duration: 240, useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  };

  const dismissFromDrag = (fromDy) => {
    dragY.setValue(0);
    slideAnim.setValue(fromDy);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: CARD_HEIGHT + 80, duration: 220, useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) dragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > SWIPE_THRESHOLD || gs.vy > VELOCITY_THRESHOLD) {
          dismissFromDrag(gs.dy);
        } else {
          Animated.spring(dragY, {
            toValue: 0, useNativeDriver: true, tension: 80, friction: 8,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const handleAction = async () => {
    if (!promo) return;
    const isShare = promo.button_name?.toLowerCase().includes('share');
    if (isShare) {
      try {
        await Share.share({
          message: promo.link_url ?? 'Check out this offer from CityBird!',
          url: promo.link_url ?? undefined,
        });
      } catch (_) {}
    } else if (promo.link_url) {
      Linking.openURL(promo.link_url).catch(() => {});
    }
    dismiss();
  };

  if (!visible || !promo) return null;

  const isShare = promo.button_name?.toLowerCase().includes('share');

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={dismiss}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.card,
          { bottom: insets.bottom + 16, transform: [{ translateY: Animated.add(slideAnim, dragY) }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.handle} />

        <View style={styles.mediaWrap}>
          <MediaContent promo={promo} />
          <TouchableOpacity style={styles.closeBtn} onPress={dismiss} activeOpacity={0.85}>
            <X size={14} color="#1a1a1a" />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleAction} activeOpacity={0.85}>
            {isShare
              ? <Share2 size={15} color={colors.white} />
              : <ExternalLink size={15} color={colors.white} />}
            <Text style={styles.actionText}>{promo.button_name || 'Learn More'}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 9999,
    elevation: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: CARD_HEIGHT,
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e0',
    marginTop: 10,
    marginBottom: 6,
  },
  mediaWrap: {
    flex: 1,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  ytPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  ytPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  ytBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  ytBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  footer: {
    height: FOOTER_HEIGHT,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
  },
  actionText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.2,
  },
});
