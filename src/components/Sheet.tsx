import { useEffect, useRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollOffset,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { C, F, Ionicons } from './ui';
import { useBlockPullToClose } from './useBlockPullToClose';

/** 往下拖超過這個距離（或甩得夠快）放開就關掉，不然彈回去 */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/**
 * 從下方滑出的面板（寬螢幕時置中）：往下拖頂端的把手或標題就能關掉；
 * 手機 App 上內容已經捲到最上面時，往下拉內容也會跟著關掉（跟系統的面板一樣）。
 * 網頁版只有頂端可以拖：手勢套件會把拖得動的區塊設成 touch-action: none，整片內容都設的話就捲不動了
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const reduced = useReducedMotion();
  // 面板往下移了多少：0 = 完全打開；一開始在畫面外，打開時滑上來
  const offset = useSharedValue(reduced ? 0 : screenH);
  const cardH = useSharedValue(screenH);
  const closing = useSharedValue(false);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  /** 這次拖曳從哪裡開始算（內容還在捲的時候不算，捲到頂才開始拉面板） */
  const dragBase = useSharedValue(0);
  const headRef = useRef<View>(null);

  useEffect(() => {
    if (visible && !reduced) offset.set(withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, [visible, reduced, offset]);

  // 網頁：在 iPhone 的 LINE 瀏覽器裡往下拖標題，不要變成關掉整個網頁
  useBlockPullToClose(headRef, visible);

  /** 先滑下去再真的關掉（按 ✕、點旁邊、往下拖、Android 返回鍵都一樣） */
  const dismiss = () => {
    if (closing.get()) return;
    closing.set(true);
    if (reduced) return onClose();
    offset.set(
      withTiming(cardH.get() + insets.bottom + 40, { duration: 200, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) scheduleOnRN(onClose);
      }),
    );
  };

  const release = (velocityY: number) => {
    'worklet';
    if (offset.get() > Math.min(DISMISS_DISTANCE, cardH.get() * 0.35) || (velocityY > DISMISS_VELOCITY && offset.get() > 8)) {
      scheduleOnRN(dismiss);
    } else {
      offset.set(withSpring(0, { damping: 18, stiffness: 220 }));
    }
  };

  // 頂端（把手＋標題）：隨時都能往下拖
  const headPan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onUpdate((e) => {
      if (closing.get()) return;
      // 往上拉只給一點點阻力感，不會整個被拉走
      offset.set(e.translationY > 0 ? e.translationY : e.translationY * 0.15);
    })
    .onEnd((e) => release(e.velocityY));

  // 內容：捲到最上面再往下拉才拖得動面板；手指往下才啟動，左右滑（例如橫向的標籤列）不會被搶走
  const scrollGesture = Gesture.Native();
  const bodyPan = Gesture.Pan()
    .enabled(Platform.OS !== 'web')
    .activeOffsetY(12)
    .failOffsetX([-18, 18])
    .onStart((e) => dragBase.set(e.translationY))
    // 手勢在 UI 執行緒才會呼叫 scrollTo(scrollRef)，不是渲染時讀 ref
    // eslint-disable-next-line react-hooks/refs
    .onUpdate((e) => {
      if (closing.get()) return;
      if (offset.get() <= 0 && scrollY.get() > 0) {
        // 內容還在往上捲：等捲到頂再開始拉
        dragBase.set(e.translationY);
        return;
      }
      offset.set(Math.max(0, e.translationY - dragBase.get()));
      // 面板被拉下來的時候內容不要跟著捲
      if (offset.get() > 0) scrollTo(scrollRef, 0, 0, false);
    })
    .onEnd((e) => {
      if (offset.get() > 0) release(e.velocityY);
    });

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, 1 - offset.get() / Math.max(1, cardH.get()))),
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      {/* Android 的 Modal 是另一個視窗，要自己包一層手勢才收得到 */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.dim, dimStyle]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="關閉" />
          <Animated.View
            style={[s.card, { paddingBottom: Math.max(insets.bottom, 16) }, cardStyle]}
            onLayout={(e) => cardH.set(e.nativeEvent.layout.height)}>
            <GestureDetector gesture={headPan}>
              <View ref={headRef} style={s.handle}>
                <View style={s.grabber} />
                <View style={s.head}>
                  <Text style={s.title}>{title}</Text>
                  <Pressable onPress={dismiss} hitSlop={12} style={s.close} accessibilityLabel="關閉">
                    <Ionicons name="close" size={20} color={C.sub} />
                  </Pressable>
                </View>
              </View>
            </GestureDetector>
            <GestureDetector gesture={Gesture.Simultaneous(bodyPan, scrollGesture)}>
              <Animated.ScrollView
                ref={scrollRef}
                style={s.body}
                contentContainerStyle={{ paddingBottom: 12 }}
                keyboardShouldPersistTaps="handled"
                // 捲到頂再往下拉是要關面板，不要彈一下
                bounces={false}
                overScrollMode="never"
                scrollEventThrottle={16}>
                {children}
              </Animated.ScrollView>
            </GestureDetector>
            {footer ? <View style={s.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  dim: { backgroundColor: '#3B2A5A66' },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: C.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...(Platform.OS === 'web' ? { marginBottom: 'auto', marginTop: 'auto', borderRadius: 32 } : null),
  },
  // 把手和標題一起當拖曳的地方，手指比較好抓
  handle: { paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontFamily: F.display, color: C.ink },
  body: { paddingHorizontal: 20 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12 },
});
