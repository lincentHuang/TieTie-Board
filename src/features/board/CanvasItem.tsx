import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { C, Ionicons } from '@/components/ui';
import type { BoardItem, Geometry } from '@/lib/types';

import { ItemBody } from './ItemBody';
import type { Move, Nervous } from './wander';

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
/** 拖著跑的時候：手指在螢幕上移動多少像素算半步（移動越快，腳跑越快） */
const STRIDE = 22;
/** 慢慢走向畫面中間時，每一小段走多久 */
const STROLL_MS = 2400;
/** 拖得比這個快（手指在螢幕上每秒移動的像素）才會撞開別張；比較慢就小心翼翼跨過去 */
const BUMP_SPEED = 700;
/** 跨過去時：腳伸長多少把身體撐高（腳長的倍數）、步伐放慢多少倍 */
const TIPTOE_RISE = 0.5;
const TIPTOE_STRIDE = 1.6;
/** 被撞到：先推到不重疊的地方再多留一點縫，然後帶著撞過來的速度滑一段（最多滑多遠、滑多久） */
const BUMP_GAP = 6;
const BUMP_CARRY = 0.22;
const BUMP_MAX = 220;
const BUMP_MS = 340;
/** 緊張跺腳：每隔多久跺一次（會再加一點隨機，大家才不會同時跺）、一次跺多久、一秒跺幾下 */
/** 點兩下：第二下要在第一下放開後多久內、離第一下多近（螢幕像素）才算 */
const DOUBLE_TAP_MS = 400;
const DOUBLE_TAP_DIST = 40;
const clock = () => {
  'worklet';
  return Date.now();
};
const FRET = {
  1: { every: 20_000, length: 1600, beats: 1.6 },
  2: { every: 8_000, length: 2600, beats: 2.4 },
} as const;

/** 正在被拖的項目在白板上的位置與速度（白板座標，每秒），其他項目被快速撞到就會被推開、慢慢碰到就讓它跨過去 */
export interface Hit {
  on: boolean;
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

/** 多選時整批一起拖：on = 正在拖，(dx, dy) = 從開始拖到現在移動了多少（白板座標） */
export interface GroupDrag {
  on: boolean;
  dx: number;
  dy: number;
}

interface Props {
  item: BoardItem;
  /** 現在要站的位置：自由擺放 = 大家同步的位置；排隊 = 隊伍裡的位置 */
  spot: Geometry;
  /** 排隊中：不能拖曳和縮放，在項目上拖曳會變成捲動畫面 */
  queued: boolean;
  /** 切換模式時，等前面的人走了再出發（毫秒） */
  walkDelay: number;
  move: Move;
  nervous: Nervous;
  now: number;
  scale: SharedValue<number>;
  /** 整個畫布共用：有項目正在被操作 */
  busy: SharedValue<boolean>;
  /** 整個畫布共用：多選時整批一起拖 */
  group: SharedValue<GroupDrag>;
  /** 整個畫布共用：正在被拖的項目，快速撞到的會被推開 */
  hit: SharedValue<Hit>;
  /** 整個畫布共用：正在被拖的項目底下有幾張正被它跨著 */
  stepOver: SharedValue<number>;
  selected: boolean;
  /** 長按進入的多選模式：每個項目左上角出現勾選圈，點一下是加入 / 拿掉 */
  multi: boolean;
  /** 可不可以拖：不行的話在它上面拖曳會變成捲動畫面 */
  draggable: boolean;
  pending: boolean;
  readCount: number;
  memberCount: number;
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
  onOpen: (id: string) => void;
  onCommit: (id: string, geo: Geometry) => void;
  onCommitGroup: (dx: number, dy: number) => void;
}

/**
 * 白板上的一個項目：點一下選取、選取後拖曳移動、拖四個角縮放、點兩下打開來看、長按多選；
 * 要換位置時會長出腳自己走過去，被拖著的時候腳在下面跑（拖越快跑越快），跑得快撞到別張會把它推開、
 * 慢慢走過去就踮起腳小心翼翼跨過去；
 * 沒看的公告會一陣子就站起來緊張地跺腳，點一下就收起腳
 */
export function CanvasItem({
  item,
  spot,
  queued,
  walkDelay,
  move,
  nervous,
  now,
  scale,
  busy,
  group,
  hit,
  stepOver,
  selected,
  multi,
  draggable,
  pending,
  readCount,
  memberCount,
  onTap,
  onLongPress,
  onOpen,
  onCommit,
  onCommitGroup,
}: Props) {
  const x = useSharedValue(spot.x);
  const y = useSharedValue(spot.y);
  const w = useSharedValue(spot.w);
  const h = useSharedValue(spot.h);
  const active = useSharedValue(false);
  const start = useSharedValue({ x: 0, y: 0, w: 0, h: 0, ax: 0, ay: 0 });
  const touchAt = useSharedValue({ ax: 0, ay: 0 });
  // 走路動畫：legs 0 → 1 腳長出來、stand 0 → 1 身體被腳撐高（拖著跑的時候不撐高，才會一直黏在手指下）、
  // phase 走到第幾步（每 π 換一隻腳）、dir 往左 -1 / 往右 1
  const legs = useSharedValue(0);
  const stand = useSharedValue(0);
  const phase = useSharedValue(0);
  const dir = useSharedValue(1);
  // 跺腳：stomp 0 → 1 有多用力、stompPhase 跺到第幾下
  const stomp = useSharedValue(0);
  const stompPhase = useSharedValue(0);
  // 拖著跑時往前傾、被撞到時晃一下（度）
  const lean = useSharedValue(0);
  const wobble = useSharedValue(0);
  const runLast = useSharedValue({ x: 0, y: 0 });
  // 被撞開、正在滑：這時候不要被其他移動蓋掉
  const knocked = useSharedValue(false);
  const contact = useSharedValue(false);
  // 跨過去：tiptoe 0 → 1 自己正踮著腳跨過別張；straddled 自己正被跨著、duck 0 → 1 縮一下讓它過
  const tiptoe = useSharedValue(0);
  const straddled = useSharedValue(false);
  const duck = useSharedValue(0);
  // 正在緊張跺腳；被點過之後下一次就不跺（安靜一陣子）
  const fretting = useSharedValue(false);
  const calmed = useSharedValue(false);
  // 上一次點一下的時間和位置（螢幕座標），用來認點兩下
  const lastTap = useSharedValue({ at: 0, x: 0, y: 0 });
  const reduced = useReducedMotion();
  const goal = useRef<Geometry>({ x: spot.x, y: spot.y, w: spot.w, h: spot.h });
  const wasQueued = useRef(queued);
  const id = item.id;
  /** 多選時跟著整批一起拖 */
  const inGroup = multi && selected;
  const groupBase = useSharedValue({ x: 0, y: 0 });
  /** 可以被撞開：自由擺放、不是正在一起拖的那一批 */
  const bumpable = !queued && !inGroup;

  // 整批一起拖：開始時記下自己的位置，之後照同一個位移走，腳也跟著跑；放開時就停在那裡，等存好的位置傳回來
  useAnimatedReaction(
    () => group.get(),
    (g, prev) => {
      if (!inGroup) return;
      const was = prev?.on ?? false;
      if (g.on && !was) {
        groupBase.set({ x: x.get(), y: y.get() });
        legs.set(withTiming(1, { duration: 160 }));
      }
      // 剛放開的那一格也要走到最後的位移（可能跟最後一次移動在同一格，沒被看到）
      if (!g.on && !was) return;
      x.set(groupBase.get().x + g.dx);
      y.set(groupBase.get().y + g.dy);
      if (g.on && prev && was) {
        const ddx = g.dx - prev.dx;
        phase.set(phase.get() + ((Math.hypot(ddx, g.dy - prev.dy) * scale.get()) / STRIDE) * Math.PI);
        if (Math.abs(ddx) > 0.5) dir.set(Math.sign(ddx));
      }
      if (!g.on) legs.set(withTiming(0, { duration: LEG_DOWN }));
    },
    [inGroup],
  );

  // 被正在拖的項目碰到：
  // - 跑得快撞過來 → 推到旁邊不重疊的地方，帶著撞過來的速度再滑一段，晃一下；停下來才存位置（大家都看得到）
  // - 慢慢走過來 → 縮一下讓它小心翼翼跨過去，不推開；跨到一半才加速也不會被撞飛，離開了才算數
  useAnimatedReaction(
    () => hit.get(),
    (r) => {
      const ix = x.get();
      const iy = y.get();
      const iw = w.get();
      const ih = h.get();
      const ox = Math.min(r.x + r.w, ix + iw) - Math.max(r.x, ix);
      const oy = Math.min(r.y + r.h, iy + ih) - Math.max(r.y, iy);
      if (!r.on || r.id === id || !bumpable || active.get() || ox <= 0 || oy <= 0) {
        contact.set(false);
        if (straddled.get()) {
          straddled.set(false);
          stepOver.set(Math.max(0, stepOver.get() - 1));
          duck.set(withSpring(0, { damping: 6, stiffness: 180 }));
        }
        return;
      }
      if (straddled.get()) return;
      if (!contact.get() && Math.hypot(r.vx, r.vy) * scale.get() < BUMP_SPEED) {
        straddled.set(true);
        stepOver.set(stepOver.get() + 1);
        duck.set(withTiming(1, { duration: 180 }));
        return;
      }
      // 往重疊比較少的方向推（推最少的距離），方向是離開撞過來的那張
      let nx = ix;
      let ny = iy;
      let kx = 0;
      let ky = 0;
      let side = 1;
      if (ox < oy) {
        side = ix + iw / 2 >= r.x + r.w / 2 ? 1 : -1;
        nx = ix + side * (ox + BUMP_GAP);
        kx = side * Math.min(BUMP_MAX, Math.max(0, r.vx * side) * BUMP_CARRY);
      } else {
        side = iy + ih / 2 >= r.y + r.h / 2 ? 1 : -1;
        ny = iy + side * (oy + BUMP_GAP);
        ky = side * Math.min(BUMP_MAX, Math.max(0, r.vy * side) * BUMP_CARRY);
      }
      const tx = nx + kx;
      const ty = ny + ky;
      const slide = { duration: BUMP_MS, easing: Easing.out(Easing.cubic) };
      x.set(nx);
      y.set(ny);
      x.set(
        withTiming(tx, slide, (done) => {
          // 被打斷（又被撞一次、被手指抓起來）也要解除，不然之後的移動都會被擋掉
          knocked.set(false);
          if (done) scheduleOnRN(onCommit, id, { x: tx, y: ty, w: iw, h: ih });
        }),
      );
      y.set(withTiming(ty, slide));
      knocked.set(true);
      if (!contact.get()) {
        wobble.set(
          withSequence(withTiming(side * (ox < oy ? 9 : 5), { duration: 70 }), withSpring(0, { damping: 5, stiffness: 160 })),
        );
      }
      contact.set(true);
    },
    [id, bumpable, onCommit],
  );

  // 自己正被拖著、底下有別張正被跨著：踮起腳、腳伸長把身體撐高，小心翼翼跨過去
  useAnimatedReaction(
    () => active.get() && stepOver.get() > 0,
    (on, was) => {
      if (was === null || on === was) return;
      tiptoe.set(withTiming(on ? 1 : 0, { duration: on ? 200 : 260 }));
    },
  );

  // 要站的位置變了（切換模式、隊伍重排、其他人移動了它）→ 長腳走過去；自己正在拖、正在被撞開的時候不要被蓋掉
  useEffect(() => {
    if (active.get() || knocked.get() || (inGroup && group.get().on)) return;
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

    // 被擠開：不長腳，直接被推過去
    if (move === 'shove') {
      const push = { damping: 16, stiffness: 140 };
      x.set(withSpring(to.x, push));
      y.set(withSpring(to.y, push));
      return;
    }

    // 切換模式或隊伍重排時照順序出發；其他人移動的就馬上走；走向畫面中間時慢慢走
    const wait = switched || queued ? walkDelay : 0;
    const duration = move === 'stroll' ? STROLL_MS : Math.min(1600, Math.max(500, dist * 1.3));
    const walk = { duration, easing: move === 'stroll' ? Easing.linear : Easing.inOut(Easing.quad) };
    const steps = Math.max(2, Math.round(duration / (move === 'stroll' ? 200 : 120)));
    if (Math.abs(dx) > 1) dir.set(Math.sign(dx));
    // 本來就在跺腳：先停下來再走
    stomp.set(withTiming(0, { duration: 120 }));
    fretting.set(false);
    // 動畫物件不能共用，每個值各給一份
    const up = () =>
      withSequence(withTiming(1, { duration: LEG_UP }), withDelay(wait + duration, withTiming(0, { duration: LEG_DOWN })));
    legs.set(up());
    stand.set(up());
    phase.set(withDelay(wait + LEG_UP, withTiming(phase.get() + steps * Math.PI, walk)));
    x.set(withDelay(wait + LEG_UP, withTiming(to.x, walk)));
    y.set(withDelay(wait + LEG_UP, withTiming(to.y, walk)));
  }, [spot.x, spot.y, spot.w, spot.h, queued, walkDelay, move, reduced, active, knocked, inGroup, group, x, y, w, h, legs, stand, phase, stomp, fretting, dir]);

  // 沒看的公告：每隔一陣子站起來緊張地跺腳（越緊急越常跺）；正在走路、被拖、剛被點過的時候不跺
  useEffect(() => {
    if (!nervous || reduced) return;
    const { every, length, beats } = FRET[nervous];
    let timer: ReturnType<typeof setTimeout>;
    let done: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      timer = setTimeout(fret, every * (0.7 + Math.random() * 0.6));
    };
    function fret() {
      later();
      if (calmed.get()) return calmed.set(false);
      if (active.get() || knocked.get() || legs.get() > 0.01) return;
      fretting.set(true);
      const up = () => withSequence(withTiming(1, { duration: LEG_UP }), withDelay(length, withTiming(0, { duration: LEG_DOWN })));
      legs.set(up());
      stand.set(up());
      stomp.set(withSequence(withDelay(LEG_UP, withTiming(1, { duration: 120 })), withDelay(length - 240, withTiming(0, { duration: 120 }))));
      stompPhase.set(0);
      stompPhase.set(withDelay(LEG_UP, withTiming((length / 1000) * beats * 2 * Math.PI, { duration: length, easing: Easing.linear })));
      done = setTimeout(() => fretting.set(false), LEG_UP + length + LEG_DOWN);
    }
    // 第一次早一點跺，剛打開 App 就看得到誰在緊張
    timer = setTimeout(fret, 1500 + Math.random() * 2500);
    return () => {
      clearTimeout(timer);
      clearTimeout(done);
    };
  }, [nervous, reduced, active, knocked, legs, stand, stomp, stompPhase, fretting, calmed]);

  const keepAspect = item.type !== 'note';

  const drag = Gesture.Pan()
    .enabled(draggable)
    .minDistance(4)
    // 從手指按下的地方算起（不是開始拖的那一刻），項目才會一直黏在手指下
    .onBegin((e) => touchAt.set({ ax: e.absoluteX, ay: e.absoluteY }))
    .onStart((e) => {
      active.set(true);
      busy.set(true);
      start.set({ x: x.get(), y: y.get(), w: w.get(), h: h.get(), ...touchAt.get() });
      // 正在走路、跺腳、被撞開：停下來，被手指拎著跑
      cancelAnimation(x);
      cancelAnimation(y);
      knocked.set(false);
      fretting.set(false);
      stand.set(withTiming(0, { duration: 160 }));
      stomp.set(0);
      stepOver.set(0);
      if (inGroup) {
        group.set({ on: true, dx: 0, dy: 0 });
        return;
      }
      legs.set(withTiming(1, { duration: 160 }));
      runLast.set({ x: e.absoluteX, y: e.absoluteY });
      // 用滑鼠直接拖沒選取的項目：順便選起來
      if (!selected) scheduleOnRN(onTap, id);
    })
    .onUpdate((e) => {
      const st = start.get();
      const sc = scale.get();
      const dx = (e.absoluteX - st.ax) / sc;
      const dy = (e.absoluteY - st.ay) / sc;
      if (inGroup) {
        group.set({ on: true, dx, dy });
        return;
      }
      x.set(st.x + dx);
      y.set(st.y + dy);
      // 腳在下面跑：手指移動越多，步伐換越快（跨過別張時放慢）；往移動的方向傾一點
      const last = runLast.get();
      const stride = STRIDE * (1 + (TIPTOE_STRIDE - 1) * tiptoe.get());
      phase.set(phase.get() + (Math.hypot(e.absoluteX - last.x, e.absoluteY - last.y) / stride) * Math.PI);
      runLast.set({ x: e.absoluteX, y: e.absoluteY });
      if (Math.abs(e.velocityX) > 40) dir.set(Math.sign(e.velocityX));
      lean.set(lean.get() * 0.8 + Math.max(-12, Math.min(12, e.velocityX / 140)) * 0.2);
      // 告訴其他項目：我在這裡、跑多快，快的話撞到的會被推開、慢的話就跨過去
      hit.set({ on: true, id, x: st.x + dx, y: st.y + dy, w: w.get(), h: h.get(), vx: e.velocityX / sc, vy: e.velocityY / sc });
    })
    .onFinalize(() => {
      if (!active.get()) return;
      active.set(false);
      busy.set(false);
      legs.set(withTiming(0, { duration: LEG_DOWN }));
      lean.set(withSpring(0, { damping: 8, stiffness: 160 }));
      if (inGroup) {
        const { dx, dy } = group.get();
        group.set({ on: false, dx, dy });
        scheduleOnRN(onCommitGroup, dx, dy);
      } else {
        hit.set({ ...hit.get(), on: false });
        scheduleOnRN(onCommit, id, { x: x.get(), y: y.get(), w: w.get(), h: h.get() });
      }
    });

  // 按著不動一下子 → 進入多選（手指一動就變成拖曳或捲動畫面）
  const longPress = Gesture.LongPress()
    .minDuration(450)
    .onStart(() => scheduleOnRN(onLongPress, id));
  // 點一下：正在跺腳的話先收起腳、站回原本的位置，下一次也不跺（安靜一陣子）
  // 點兩下自己算時間，不用手勢套件的 numberOfTaps(2)：手機瀏覽器上那個常常認不出來，
  // 而且點一下也不用先等半秒看看是不是點兩下，選取馬上有反應；多選時點兩下也只是加入 / 拿掉
  const tap = Gesture.Tap().onEnd((e, success) => {
    if (!success) return;
    if (fretting.get()) {
      fretting.set(false);
      calmed.set(true);
      cancelAnimation(stompPhase);
      stomp.set(withTiming(0, { duration: 120 }));
      legs.set(withTiming(0, { duration: LEG_DOWN }));
      stand.set(withTiming(0, { duration: LEG_DOWN }));
    }
    const now = clock();
    const last = lastTap.get();
    if (!multi && now - last.at < DOUBLE_TAP_MS && Math.hypot(e.absoluteX - last.x, e.absoluteY - last.y) < DOUBLE_TAP_DIST) {
      lastTap.set({ at: 0, x: 0, y: 0 });
      scheduleOnRN(onOpen, id);
      return;
    }
    lastTap.set({ at: now, x: e.absoluteX, y: e.absoluteY });
    scheduleOnRN(onTap, id);
  });

  const gesture = Gesture.Race(drag, longPress, tap);

  const boxStyle = useAnimatedStyle(() => ({
    left: x.get(),
    top: y.get(),
    width: w.get(),
    height: h.get(),
  }));

  // 腳多長，身體就被撐高多少（腳底剛好踩在原本的底部）；每走一步上下彈一下、左右晃一下；
  // 跺腳時身體跟著抖、每踩一下震一下；拖著跑時往前傾；被撞到時晃一下；
  // 跨過別張時被腳撐高、浮起來一點、每一步左右搖著保持平衡（不太敢往前傾）；被跨的那張縮一下
  const legLength = Math.round(Math.min(34, Math.max(16, spot.h * 0.14)));
  const walkStyle = useAnimatedStyle(() => {
    const k = stand.get();
    const st = stomp.get();
    const sp = stompPhase.get();
    const tp = tiptoe.get();
    const beat = Math.sin(phase.get());
    const jolt = st * Math.abs(Math.cos(sp)) * legLength * 0.12;
    const tilt = beat * 3 * k * (1 - st) + beat * 4 * tp + Math.sin(sp * 2) * 2.5 * st;
    return {
      transform: [
        { translateY: -legLength * (k + TIPTOE_RISE * tp) - Math.abs(beat) * legLength * 0.25 * k * (1 - st) - jolt },
        { rotate: `${tilt + lean.get() * (1 - 0.6 * tp) + wobble.get()}deg` },
        { scale: 1 + 0.03 * tp - 0.05 * duck.get() },
      ],
    };
  });
  // 跨過別張時頭上冒出的「💦」，每一步跟著抖一下
  const sweatStyle = useAnimatedStyle(() => {
    const tp = tiptoe.get();
    return {
      opacity: tp,
      transform: [{ translateY: -Math.abs(Math.sin(phase.get())) * 3 * tp }, { scale: 0.6 + tp * 0.4 }],
    };
  });
  // 跺腳時頭上冒出的「‼️」
  const fretStyle = useAnimatedStyle(() => {
    const st = stomp.get();
    return { opacity: st, transform: [{ scale: 0.6 + st * 0.4 + Math.abs(Math.sin(stompPhase.get())) * 0.15 }] };
  });

  const outlineStyle = useAnimatedStyle(() => ({
    borderWidth: 2 / scale.get(),
    margin: -4 / scale.get(),
  }));

  return (
    <Animated.View
      entering={ZoomIn.springify().damping(11)}
      exiting={ZoomOut.duration(220)}
      style={[s.box, { zIndex: selected ? 1_000_000 + item.z : item.z }, boxStyle]}>
      <Animated.View style={[s.fill, walkStyle]}>
        <View pointerEvents="none" style={[s.legs, { height: legLength }]}>
          {([-1, 1] as const).map((side) => (
            <Leg
              key={side}
              side={side}
              length={legLength}
              legs={legs}
              phase={phase}
              dir={dir}
              stomp={stomp}
              stompPhase={stompPhase}
              tiptoe={tiptoe}
            />
          ))}
        </View>
        {nervous ? (
          <Animated.Text pointerEvents="none" style={[s.fret, fretStyle]}>
            ‼️
          </Animated.Text>
        ) : null}
        {/* 只有選起來的才拖得動，也才會跨過別張 */}
        {selected && !queued ? (
          <Animated.Text pointerEvents="none" style={[s.sweat, sweatStyle]}>
            💦
          </Animated.Text>
        ) : null}

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
            {queued || multi
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
        {multi ? <CheckBadge on={selected} scale={scale} /> : null}
      </Animated.View>
    </Animated.View>
  );
}

/** 多選時左上角的勾選圈：選了是實心打勾，沒選是空心；不論縮放多少，在螢幕上都一樣大 */
function CheckBadge({ on, scale }: { on: boolean; scale: SharedValue<number> }) {
  // 0×0 的錨點放在左上角，縮放時以它為中心，圈圈就一直在角落上
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 / scale.get() }] }));
  return (
    <Animated.View pointerEvents="none" style={[s.checkAnchor, style]}>
      <View style={[s.check, on && s.checkOn]}>
        {on ? <Ionicons name="checkmark" size={17} color="#FFF" /> : null}
      </View>
    </Animated.View>
  );
}

/**
 * 一隻小腳：從項目底部長出來，走路時前後擺動，鞋尖朝著前進方向；跺腳時兩隻輪流抬起來用力踩；
 * 跨過別張時腳伸長、步子變小，往前跨的那隻高高抬起來
 */
function Leg({
  side,
  length,
  legs,
  phase,
  dir,
  stomp,
  stompPhase,
  tiptoe,
}: {
  side: -1 | 1;
  length: number;
  legs: SharedValue<number>;
  phase: SharedValue<number>;
  dir: SharedValue<number>;
  stomp: SharedValue<number>;
  stompPhase: SharedValue<number>;
  tiptoe: SharedValue<number>;
}) {
  const thick = Math.max(6, Math.round(length * 0.3));
  const legStyle = useAnimatedStyle(() => {
    const k = legs.get();
    const st = stomp.get();
    const tp = tiptoe.get();
    const beat = Math.sin(phase.get());
    // 抬腳：慢慢抬起、很快踩下去
    const lift = st * Math.pow(Math.max(0, Math.sin(stompPhase.get()) * side), 0.6);
    // 跨步：往前擺的那隻（往右走時腳往右擺 = 轉負的角度）縮起來，像膝蓋抬高
    const high = tp * Math.pow(Math.max(0, -beat * side * dir.get()), 0.7);
    const len = length * k * (1 + TIPTOE_RISE * tp) * (1 - 0.45 * lift) * (1 - 0.55 * high);
    const swing = beat * 28 * side * (1 - st) * (1 - 0.35 * tp);
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
  // 放左上角，不要跟右上角「等你確認」的紅點疊在一起
  fret: { position: 'absolute', top: -30, left: -8, fontSize: 24 },
  // 右上角往內一點，不要蓋到「等你確認」的紅點
  sweat: { position: 'absolute', top: -28, right: 6, fontSize: 20 },
  handleHit: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  handleDot: { backgroundColor: '#FFF', borderColor: C.primary },
  pulse: { position: 'absolute', backgroundColor: C.primary, borderColor: '#FFF' },
  checkAnchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, zIndex: 11 },
  check: {
    position: 'absolute',
    left: -14,
    top: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: C.primary,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: C.primary, borderColor: '#FFF' },
});
