import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { F, Ionicons } from '@/components/ui';

const MAX_ZOOM = 4;
/** 點兩下放大到幾倍 */
const TAP_ZOOM = 2.5;
/** 沒放大時，手指橫向滑超過這個距離就換張、往下滑超過就關掉 */
const SWIPE = 60;
const DISMISS = 120;

/** 全螢幕看照片：左右滑或按箭頭換張，兩指縮放、點兩下放大，放大後可以拖著看；往下滑關掉 */
export function PhotoViewer({ photos, start = 0, onClose }: { photos: string[]; start?: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(Math.min(Math.max(0, start), photos.length - 1));
  const many = photos.length > 1;
  const go = (step: number) => setIndex((i) => Math.min(photos.length - 1, Math.max(0, i + step)));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* Android 的 Modal 是另一個視窗，要自己包一層手勢才收得到 */}
      <GestureHandlerRootView style={s.screen}>
        {/* 換張時整個重新掛載，縮放與位置自動歸零 */}
        <ZoomableImage key={index} uri={photos[index]} onSwipe={go} onClose={onClose} />

        <View pointerEvents="box-none" style={[s.top, { paddingTop: insets.top + 10 }]}>
          <Text style={s.count}>{many ? `${index + 1} / ${photos.length}` : ''}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={s.btn} accessibilityLabel="關閉">
            <Ionicons name="close" size={24} color="#FFF" />
          </Pressable>
        </View>

        {many && index > 0 ? (
          <Pressable onPress={() => go(-1)} style={[s.btn, s.arrow, { left: 12 }]} accessibilityLabel="上一張">
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
        ) : null}
        {many && index < photos.length - 1 ? (
          <Pressable onPress={() => go(1)} style={[s.btn, s.arrow, { right: 12 }]} accessibilityLabel="下一張">
            <Ionicons name="chevron-forward" size={24} color="#FFF" />
          </Pressable>
        ) : null}

        <Text pointerEvents="none" style={[s.hint, { bottom: insets.bottom + 16 }]}>
          點兩下放大・兩指縮放・往下滑關閉
        </Text>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ZoomableImage({ uri, onSwipe, onClose }: { uri: string; onSwipe: (step: number) => void; onClose: () => void }) {
  const size = useSharedValue({ w: 1, h: 1 });
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  /** 兩指剛放上去時的縮放、位置、焦點（焦點以畫面中心為原點） */
  const pinchFrom = useSharedValue({ scale: 1, tx: 0, ty: 0, fx: 0, fy: 0 });
  /** 單指拖曳時：位置 = anchor + 手指移動量 */
  const anchor = useSharedValue({ x: 0, y: 0 });
  const pinching = useSharedValue(false);
  const pinched = useSharedValue(false);

  /** 放開手指後：縮放拉回 1–MAX_ZOOM 倍，圖片邊緣不要被拖進畫面裡 */
  const settle = () => {
    'worklet';
    const k = Math.min(MAX_ZOOM, Math.max(1, scale.get()));
    const maxX = ((k - 1) * size.get().w) / 2;
    const maxY = ((k - 1) * size.get().h) / 2;
    scale.set(withTiming(k));
    tx.set(withTiming(Math.min(maxX, Math.max(-maxX, tx.get()))));
    ty.set(withTiming(Math.min(maxY, Math.max(-maxY, ty.get()))));
  };

  // 以兩指中間為中心縮放：焦點底下那一點在縮放過程中一直留在手指中間
  const pinch = Gesture.Pinch()
    .onStart((e) => {
      pinching.set(true);
      pinched.set(true);
      const { w, h } = size.get();
      pinchFrom.set({ scale: scale.get(), tx: tx.get(), ty: ty.get(), fx: e.focalX - w / 2, fy: e.focalY - h / 2 });
    })
    .onUpdate((e) => {
      const from = pinchFrom.get();
      const { w, h } = size.get();
      const next = Math.min(MAX_ZOOM * 1.5, Math.max(0.6, from.scale * e.scale));
      const k = next / from.scale;
      scale.set(next);
      tx.set(e.focalX - w / 2 - k * (from.fx - from.tx));
      ty.set(e.focalY - h / 2 - k * (from.fy - from.ty));
    })
    .onEnd(() => {
      pinching.set(false);
      settle();
    });

  const pan = Gesture.Pan()
    .onBegin(() => pinched.set(false))
    .onStart((e) => anchor.set({ x: tx.get() - e.translationX, y: ty.get() - e.translationY }))
    .onUpdate((e) => {
      // 兩指時位置交給 pinch；只記下差距，放開一指繼續拖才不會跳
      if (pinching.get() || e.numberOfPointers > 1) {
        anchor.set({ x: tx.get() - e.translationX, y: ty.get() - e.translationY });
        return;
      }
      tx.set(anchor.get().x + e.translationX);
      ty.set(anchor.get().y + e.translationY);
    })
    .onEnd((e) => {
      if (pinched.get() || scale.get() > 1.01) {
        settle();
        return;
      }
      const { translationX: dx, translationY: dy } = e;
      if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) scheduleOnRN(onSwipe, dx < 0 ? 1 : -1);
      else if (dy > DISMISS) scheduleOnRN(onClose);
      tx.set(withTiming(0));
      ty.set(withTiming(0));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.get() > 1.01) {
        scale.set(withTiming(1));
        tx.set(withTiming(0));
        ty.set(withTiming(0));
        return;
      }
      // 點哪裡就放大哪裡
      const { w, h } = size.get();
      const maxX = ((TAP_ZOOM - 1) * w) / 2;
      const maxY = ((TAP_ZOOM - 1) * h) / 2;
      scale.set(withTiming(TAP_ZOOM));
      tx.set(withTiming(Math.min(maxX, Math.max(-maxX, (e.x - w / 2) * (1 - TAP_ZOOM)))));
      ty.set(withTiming(Math.min(maxY, Math.max(-maxY, (e.y - h / 2) * (1 - TAP_ZOOM)))));
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  return (
    // 手勢掛在不會動的外框上，手指座標才不會跟著縮放跑掉
    <GestureDetector gesture={gesture}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => size.set({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {/* 圖片本身不收手指：網頁上拖 <img> 會變成瀏覽器的「拖曳圖片」，把手勢取消掉 */}
        <Animated.View pointerEvents="none" style={[s.fill, imageStyle]}>
          <Image source={{ uri }} style={s.fill} contentFit="contain" accessibilityLabel="照片" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#140F1F' },
  fill: { flex: 1 },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  count: { color: '#FFF', fontSize: 16, fontFamily: F.display },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { position: 'absolute', top: '50%', marginTop: -22 },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#FFFFFF99',
    fontSize: 13,
    fontFamily: F.display,
  },
});
