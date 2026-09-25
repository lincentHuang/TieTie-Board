import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
  ZoomOut,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { BoardItem } from '@/lib/types';

import { C } from '../ui';
import { ItemBody } from './ItemBody';

export type Geometry = Pick<BoardItem, 'x' | 'y' | 'w' | 'h'>;

const MIN_SIZE = 48;
const CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;
/** 腳長出來 / 收回去要多久 */
const LEG_UP = 220;
const LEG_DOWN = 240;

interface Props {
  item: BoardItem;
  /** 現在要站的位置：自由擺放 = 大家同步的位置；排隊 = 隊伍裡的位置 */
  spot: Geometry;
  /** 排隊中：不能拖曳和縮放，在項目上拖曳會變成捲動畫面 */
  queued: boolean;
  /** 切換模式時，等前面的人走了再出發（毫秒） */
  walkDelay: number;
  now: number;
  scale: SharedValue<number>;
  /** 整個畫布共用：有項目正在被操作 */
  busy: SharedValue<boolean>;
  selected: boolean;
  pending: boolean;
  readCount: number;
  memberCount: number;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onCommit: (id: string, geo: Geometry) => void;
}

/** 白板上的一個項目：拖曳移動、選取後拖四個角縮放、點兩下編輯；要換位置時會長出腳自己走過去 */
export function CanvasItem({
  item,
  spot,
  queued,
  walkDelay,
  now,
  scale,
  busy,
  selected,
  pending,
  readCount,
  memberCount,
  onSelect,
  onOpen,
  onCommit,
}: Props) {
  const x = useSharedValue(spot.x);
  const y = useSharedValue(spot.y);
  const w = useSharedValue(spot.w);
  const h = useSharedValue(spot.h);
  const active = useSharedValue(false);
  const start = useSharedValue({ x: 0, y: 0, w: 0, h: 0, ax: 0, ay: 0 });
  // 走路動畫：legs 0 → 1 腳長出來、progress 走了多少、steps 這趟走幾步、dir 往左 -1 / 往右 1
  const legs = useSharedValue(0);
  const progress = useSharedValue(0);
  const steps = useSharedValue(2);
  const dir = useSharedValue(1);
  const reduced = useReducedMotion();
  const goal = useRef<Geometry>({ x: spot.x, y: spot.y, w: spot.w, h: spot.h });
  const wasQueued = useRef(queued);

  // 要站的位置變了（切換模式、隊伍重排、其他人移動了它）→ 長腳走過去；自己正在拖的時候不要被蓋掉
  useEffect(() => {
    if (active.get()) return;
    const switched = wasQueued.current !== queued;
    wasQueued.current = queued;
    const prev = goal.current;
    const to = { x: spot.x, y: spot.y, w: spot.w, h: spot.h };
    if (prev.x === to.x && prev.y === to.y && prev.w === to.w && prev.h === to.h) return;
    goal.current = to;

    const resize = { duration: 260 };
    if (to.w !== prev.w) w.set(withTiming(to.w, resize));
    if (to.h !== prev.h) h.set(withTiming(to.h, resize));

    const dx = to.x - x.get();
    const dy = to.y - y.get();
    const dist = Math.hypot(dx, dy);
    // 自己剛拖完、伺服器回傳同一個位置
    if (dist < 1) {
      x.set(to.x);
      y.set(to.y);
      return;
    }
    if (reduced) {
      x.set(withTiming(to.x, resize));
      y.set(withTiming(to.y, resize));
      return;
    }

    // 切換模式或隊伍重排時照順序出發；其他人移動的就馬上走
    const wait = switched || queued ? walkDelay : 0;
    const duration = Math.min(1600, Math.max(500, dist * 1.3));
    const walk = { duration, easing: Easing.inOut(Easing.quad) };
    steps.set(Math.max(2, Math.round(duration / 120)));
    if (Math.abs(dx) > 1) dir.set(Math.sign(dx));
    legs.set(
      withSequence(withTiming(1, { duration: LEG_UP }), withDelay(wait + duration, withTiming(0, { duration: LEG_DOWN }))),
    );
    progress.set(withSequence(withTiming(0, { duration: 0 }), withDelay(wait + LEG_UP, withTiming(1, walk))));
    x.set(withDelay(wait + LEG_UP, withTiming(to.x, walk)));
    y.set(withDelay(wait + LEG_UP, withTiming(to.y, walk)));
  }, [spot.x, spot.y, spot.w, spot.h, queued, walkDelay, reduced, active, x, y, w, h, legs, progress, steps, dir]);

  const keepAspect = item.type !== 'note';
  const id = item.id;

  const drag = Gesture.Pan()
    .enabled(!queued)
    .minDistance(4)
    .onStart((e) => {
      active.set(true);
      busy.set(true);
      start.set({ x: x.get(), y: y.get(), w: w.get(), h: h.get(), ax: e.absoluteX, ay: e.absoluteY });
      scheduleOnRN(onSelect, id);
    })
    .onUpdate((e) => {
      x.set(start.get().x + (e.absoluteX - start.get().ax) / scale.get());
      y.set(start.get().y + (e.absoluteY - start.get().ay) / scale.get());
    })
    .onFinalize(() => {
      if (!active.get()) return;
      active.set(false);
      busy.set(false);
      scheduleOnRN(onCommit, id, { x: x.get(), y: y.get(), w: w.get(), h: h.get() });
    });

  const tap = Gesture.Tap().onEnd(() => scheduleOnRN(onSelect, id));
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => scheduleOnRN(onOpen, id));

  const gesture = Gesture.Race(drag, Gesture.Exclusive(doubleTap, tap));

  const boxStyle = useAnimatedStyle(() => ({
    left: x.get(),
    top: y.get(),
    width: w.get(),
    height: h.get(),
  }));

  // 腳多長，身體就被撐高多少（腳底剛好踩在原本的底部）；每走一步上下彈一下、左右晃一下
  const legLength = Math.round(Math.min(34, Math.max(16, spot.h * 0.14)));
  const walkStyle = useAnimatedStyle(() => {
    const k = legs.get();
    const beat = Math.sin(progress.get() * steps.get() * Math.PI);
    return {
      transform: [
        { translateY: -legLength * k - Math.abs(beat) * legLength * 0.25 * k },
        { rotate: `${beat * 3 * k}deg` },
      ],
    };
  });

  const outlineStyle = useAnimatedStyle(() => ({
    borderWidth: 2 / scale.get(),
    margin: -4 / scale.get(),
  }));

  return (
    <Animated.View
      entering={ZoomIn.springify().damping(11)}
      exiting={ZoomOut.duration(220)}
      style={[s.box, { zIndex: selected ? 1_000_000 : item.z }, boxStyle]}>
      <Animated.View style={[s.fill, walkStyle]}>
        <View pointerEvents="none" style={[s.legs, { height: legLength }]}>
          {([-1, 1] as const).map((side) => (
            <Leg key={side} side={side} length={legLength} legs={legs} progress={progress} steps={steps} dir={dir} />
          ))}
        </View>

        <GestureDetector gesture={gesture}>
          <View style={s.fill}>
            <ItemBody
              item={item}
              now={now}
              pending={pending}
              readCount={readCount}
              memberCount={memberCount}
              tidy={queued}
              w={w}
              h={h}
            />
            {pending ? <PendingPulse scale={scale} /> : null}
          </View>
        </GestureDetector>

        {selected ? (
          <>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.outline, outlineStyle]} />
            {queued
              ? null
              : CORNERS.map(([cx, cy]) => (
                  <ResizeHandle
                    key={`${cx}${cy}`}
                    cx={cx}
                    cy={cy}
                    {...{ x, y, w, h, scale, active, busy, start, keepAspect }}
                    onEnd={() => onCommit(id, { x: x.get(), y: y.get(), w: w.get(), h: h.get() })}
                  />
                ))}
          </>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

/** 一隻小腳：從項目底部長出來，走路時前後擺動，鞋尖朝著前進方向 */
function Leg({
  side,
  length,
  legs,
  progress,
  steps,
  dir,
}: {
  side: -1 | 1;
  length: number;
  legs: SharedValue<number>;
  progress: SharedValue<number>;
  steps: SharedValue<number>;
  dir: SharedValue<number>;
}) {
  const thick = Math.max(6, Math.round(length * 0.3));
  const legStyle = useAnimatedStyle(() => {
    const k = legs.get();
    const len = length * k;
    const swing = Math.sin(progress.get() * steps.get() * Math.PI) * 28 * side;
    return {
      height: len,
      opacity: k > 0.02 ? 1 : 0,
      // 以大腿根（上緣）為軸心擺動
      transform: [{ translateY: -len / 2 }, { rotate: `${swing}deg` }, { translateY: len / 2 }],
    };
  });
  const shoeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dir.get() * thick * 0.35 }] }));
  return (
    <Animated.View
      style={[s.leg, { left: side < 0 ? '32%' : '68%', width: thick, marginLeft: -thick / 2, borderRadius: thick / 2 }, legStyle]}>
      <Animated.View
        style={[
          s.shoe,
          {
            width: thick * 1.9,
            height: thick * 1.15,
            borderRadius: thick * 0.6,
            left: -thick * 0.45,
            bottom: -thick * 0.45,
          },
          shoeStyle,
        ]}
      />
    </Animated.View>
  );
}

function ResizeHandle({
  cx,
  cy,
  x,
  y,
  w,
  h,
  scale,
  active,
  busy,
  start,
  keepAspect,
  onEnd,
}: {
  cx: -1 | 1;
  cy: -1 | 1;
  x: SharedValue<number>;
  y: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
  scale: SharedValue<number>;
  active: SharedValue<boolean>;
  busy: SharedValue<boolean>;
  start: SharedValue<{ x: number; y: number; w: number; h: number; ax: number; ay: number }>;
  keepAspect: boolean;
  onEnd: () => void;
}) {
  const gesture = Gesture.Pan()
    .minDistance(0)
    .onStart((e) => {
      active.set(true);
      busy.set(true);
      start.set({ x: x.get(), y: y.get(), w: w.get(), h: h.get(), ax: e.absoluteX, ay: e.absoluteY });
    })
    .onUpdate((e) => {
      const st = start.get();
      const dx = (e.absoluteX - st.ax) / scale.get();
      const dy = (e.absoluteY - st.ay) / scale.get();
      let nw = Math.max(MIN_SIZE, st.w + dx * cx);
      let nh = Math.max(MIN_SIZE, st.h + dy * cy);
      if (keepAspect) {
        const ratio = st.w / st.h;
        if (nw / st.w > nh / st.h) nh = nw / ratio;
        else nw = nh * ratio;
      }
      w.set(nw);
      h.set(nh);
      x.set(cx < 0 ? st.x + st.w - nw : st.x);
      y.set(cy < 0 ? st.y + st.h - nh : st.y);
    })
    .onFinalize(() => {
      if (!active.get()) return;
      active.set(false);
      busy.set(false);
      scheduleOnRN(onEnd);
    });

  // 不論縮放多少，把手在螢幕上都一樣大
  const style = useAnimatedStyle(() => {
    const hit = 32 / scale.get();
    return {
      width: hit,
      height: hit,
      left: cx < 0 ? -hit / 2 : undefined,
      right: cx > 0 ? -hit / 2 : undefined,
      top: cy < 0 ? -hit / 2 : undefined,
      bottom: cy > 0 ? -hit / 2 : undefined,
    };
  });
  const dotStyle = useAnimatedStyle(() => ({
    width: 14 / scale.get(),
    height: 14 / scale.get(),
    borderWidth: 2 / scale.get(),
    borderRadius: 3 / scale.get(),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[s.handleHit, style]}>
        <Animated.View style={[s.handleDot, dotStyle]} />
      </Animated.View>
    </GestureDetector>
  );
}

/** 待確認公告右上角一直輕輕跳動的紅點 */
function PendingPulse({ scale }: { scale: SharedValue<number> }) {
  const reduced = useReducedMotion();
  const beat = useSharedValue(0);
  useEffect(() => {
    if (!reduced) beat.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [beat, reduced]);
  const style = useAnimatedStyle(() => {
    const size = 22 / scale.get();
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      top: -size / 3,
      right: -size / 3,
      borderWidth: 3 / scale.get(),
      transform: [{ scale: 1 + beat.get() * 0.25 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[s.pulse, style]} />;
}

const s = StyleSheet.create({
  box: { position: 'absolute' },
  fill: { flex: 1 },
  outline: { borderColor: C.primary, borderRadius: 8 },
  legs: { position: 'absolute', left: 0, right: 0, top: '100%' },
  leg: { position: 'absolute', top: 0, backgroundColor: C.ink },
  shoe: { position: 'absolute', backgroundColor: C.primary },
  handleHit: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  handleDot: { backgroundColor: '#FFF', borderColor: C.primary },
  pulse: { position: 'absolute', backgroundColor: C.primary, borderColor: '#FFF' },
});
