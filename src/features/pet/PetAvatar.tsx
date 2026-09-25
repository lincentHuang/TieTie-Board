import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Text as SvgText } from 'react-native-svg';

import { shade, type Accessory, type Mood, type PetConfig, type Species } from './pet-types';

const INK = '#4B3F6B';
const PINK = '#FF9BB8';
const VIEW_BOX = '0 -24 120 144';
const RATIO = 144 / 120;

/** 不同心情的動作幅度 */
const MOTION: Record<Mood, { bob: number; bobMs: number; wag: number; wagMs: number }> = {
  excited: { bob: 6, bobMs: 260, wag: 26, wagMs: 110 },
  happy: { bob: 3, bobMs: 650, wag: 18, wagMs: 200 },
  idle: { bob: 2, bobMs: 1100, wag: 10, wagMs: 380 },
  worried: { bob: 1, bobMs: 1500, wag: 3, wagMs: 700 },
  sleepy: { bob: 1.5, bobMs: 1900, wag: 0, wagMs: 1000 },
};

/**
 * 公告小幫手的外觀。尾巴獨立一層才能搖；眨眼用狀態切換。
 * jumpKey 改變時會跳一下（例如按了「我知道了」）。
 */
export function PetAvatar({
  pet,
  mood = 'idle',
  size = 96,
  animated = true,
  jumpKey = 0,
}: {
  pet: PetConfig;
  mood?: Mood;
  size?: number;
  animated?: boolean;
  jumpKey?: number;
}) {
  const reduced = useReducedMotion();
  const live = animated && !reduced;
  const [blink, setBlink] = useState(false);
  const bob = useSharedValue(0);
  const wag = useSharedValue(0);
  const jump = useSharedValue(0);
  const m = MOTION[mood];

  useEffect(() => {
    if (!live) return;
    bob.set(withRepeat(withTiming(1, { duration: m.bobMs, easing: Easing.inOut(Easing.sin) }), -1, true));
    wag.set(
      withRepeat(
        withSequence(withTiming(1, { duration: m.wagMs }), withTiming(-1, { duration: m.wagMs * 2 }), withTiming(0, { duration: m.wagMs })),
        -1,
      ),
    );
    return () => {
      cancelAnimation(bob);
      cancelAnimation(wag);
    };
  }, [live, m.bobMs, m.wagMs, bob, wag]);

  useEffect(() => {
    if (!live || mood === 'sleepy') return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        setBlink(true);
        timer = setTimeout(() => {
          setBlink(false);
          loop();
        }, 130);
      }, 2200 + Math.random() * 2600);
    };
    loop();
    return () => clearTimeout(timer);
  }, [live, mood]);

  useEffect(() => {
    if (!jumpKey || !live) return;
    jump.set(
      withSequence(
        withTiming(-1, { duration: 170, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 7, stiffness: 180 }),
      ),
    );
  }, [jumpKey, live, jump]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -bob.get() * m.bob + jump.get() * size * 0.28 },
      { scaleY: 1 - bob.get() * 0.015 + Math.max(0, -jump.get()) * 0.04 },
    ],
  }));
  const tailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wag.get() * m.wag}deg` }] }));

  const eyes = mood === 'sleepy' || blink ? 'closed' : mood === 'happy' || mood === 'excited' ? 'smile' : 'open';
  const h = size * RATIO;

  return (
    <View style={{ width: size, height: h }}>
      <Animated.View style={[{ width: size, height: h }, bodyStyle]}>
        <Animated.View style={[{ position: 'absolute', width: size, height: h, transformOrigin: '71.7% 84.7%' }, tailStyle]}>
          <Svg width={size} height={h} viewBox={VIEW_BOX}>
            <Tail species={pet.species} color={pet.color} />
          </Svg>
        </Animated.View>
        <Svg width={size} height={h} viewBox={VIEW_BOX} style={{ position: 'absolute' }}>
          <Body pet={pet} mood={mood} eyes={eyes} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Tail({ species, color }: { species: Species; color: string }) {
  const stroke = { stroke: INK, strokeWidth: 3 };
  if (species === 'dog' || species === 'cat') {
    const d = species === 'dog' ? 'M84 98 Q106 94 104 72' : 'M84 102 Q116 106 108 76';
    return (
      <G fill="none" strokeLinecap="round">
        <Path d={d} stroke={INK} strokeWidth={13} />
        <Path d={d} stroke={shade(color, -0.08)} strokeWidth={7} />
      </G>
    );
  }
  const r = species === 'bunny' ? 9 : species === 'bear' ? 7 : 5;
  return <Circle cx={88} cy={104} r={r} fill={species === 'bunny' ? '#FFFFFF' : color} {...stroke} />;
}

function Body({ pet, mood, eyes }: { pet: PetConfig; mood: Mood; eyes: 'open' | 'closed' | 'smile' }) {
  const { species, color, accessory } = pet;
  const dark = shade(color, -0.2);
  const line = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  const hamster = species === 'hamster';

  return (
    <G>
      {/* 耳朵（在頭後面的） */}
      {species === 'cat' ? (
        <>
          <Path d="M30 40 L36 12 L56 26 Z" fill={color} {...line} />
          <Path d="M90 40 L84 12 L64 26 Z" fill={color} {...line} />
          <Path d="M37 33 L39.5 20 L48.5 27 Z" fill={PINK} />
          <Path d="M83 33 L80.5 20 L71.5 27 Z" fill={PINK} />
        </>
      ) : null}
      {species === 'bunny' ? (
        <>
          <G transform="rotate(-10 46 22)">
            <Ellipse cx={46} cy={6} rx={9} ry={24} fill={color} {...line} />
            <Ellipse cx={46} cy={9} rx={4.5} ry={16} fill={PINK} />
          </G>
          <G transform="rotate(10 74 22)">
            <Ellipse cx={74} cy={6} rx={9} ry={24} fill={color} {...line} />
            <Ellipse cx={74} cy={9} rx={4.5} ry={16} fill={PINK} />
          </G>
        </>
      ) : null}
      {species === 'bear' || hamster ? (
        <>
          <Circle cx={hamster ? 37 : 34} cy={26} r={hamster ? 9 : 12} fill={color} {...line} />
          <Circle cx={hamster ? 83 : 86} cy={26} r={hamster ? 9 : 12} fill={color} {...line} />
          <Circle cx={hamster ? 37 : 34} cy={27} r={hamster ? 4.5 : 6} fill={hamster ? PINK : dark} />
          <Circle cx={hamster ? 83 : 86} cy={27} r={hamster ? 4.5 : 6} fill={hamster ? PINK : dark} />
        </>
      ) : null}

      {/* 身體 */}
      <Ellipse cx={60} cy={92} rx={30} ry={23} fill={color} {...line} />
      <Ellipse cx={60} cy={97} rx={17} ry={13} fill="#FFFFFF" opacity={0.55} />
      <Ellipse cx={47} cy={112} rx={9} ry={6} fill={color} {...line} />
      <Ellipse cx={73} cy={112} rx={9} ry={6} fill={color} {...line} />

      {/* 頭 */}
      {hamster ? (
        <Ellipse cx={60} cy={54} rx={36} ry={31} fill={color} {...line} />
      ) : (
        <Circle cx={60} cy={52} r={32} fill={color} {...line} />
      )}

      {/* 狗狗的垂耳（在頭前面） */}
      {species === 'dog' ? (
        <>
          <Path d="M34 28 C21 31 17 52 23 64 C27 71 36 67 38 56 C40 45 43 32 34 28 Z" fill={dark} {...line} />
          <Path d="M86 28 C99 31 103 52 97 64 C93 71 84 67 82 56 C80 45 77 32 86 28 Z" fill={dark} {...line} />
        </>
      ) : null}

      {/* 口鼻 / 倉鼠的大臉頰 */}
      {species === 'dog' || species === 'bear' ? <Ellipse cx={60} cy={64} rx={13} ry={10} fill="#FFFFFF" opacity={0.8} /> : null}
      {hamster ? (
        <>
          <Path d="M28 62 Q30 84 60 85 Q90 84 92 62 Q76 56 60 60 Q44 56 28 62 Z" fill="#FFFFFF" opacity={0.9} />
          <Ellipse cx={37} cy={65} rx={11} ry={9} fill="#FFFFFF" />
          <Ellipse cx={83} cy={65} rx={11} ry={9} fill="#FFFFFF" />
        </>
      ) : null}

      {/* 眼睛 */}
      {eyes === 'open' ? (
        <>
          <Circle cx={47} cy={52} r={4.6} fill={INK} />
          <Circle cx={73} cy={52} r={4.6} fill={INK} />
          <Circle cx={48.6} cy={50.2} r={1.7} fill="#FFFFFF" />
          <Circle cx={74.6} cy={50.2} r={1.7} fill="#FFFFFF" />
        </>
      ) : (
        <G fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round">
          <Path d={eyes === 'smile' ? 'M42 55 Q47 48 52 55' : 'M42 52 Q47 57 52 52'} />
          <Path d={eyes === 'smile' ? 'M68 55 Q73 48 78 55' : 'M68 52 Q73 57 78 52'} />
        </G>
      )}
      {mood === 'worried' ? (
        <G stroke={INK} strokeWidth={2.5} strokeLinecap="round">
          <Path d="M41 44 L51 41" />
          <Path d="M79 44 L69 41" />
        </G>
      ) : null}

      {/* 腮紅 */}
      <Ellipse cx={37} cy={62} rx={6} ry={3.5} fill="#FF7FA3" opacity={0.5} />
      <Ellipse cx={83} cy={62} rx={6} ry={3.5} fill="#FF7FA3" opacity={0.5} />

      {/* 鼻子 */}
      {species === 'dog' || species === 'bear' ? (
        <Path d="M55 59 Q60 56 65 59 Q63 63.5 60 63.5 Q57 63.5 55 59 Z" fill={INK} />
      ) : (
        <Path d="M57 60 L63 60 L60 63.5 Z" fill="#FF7FA3" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      )}

      {/* 嘴巴（兔兔、倉鼠有兩顆小門牙） */}
      {(species === 'bunny' || hamster) && mood !== 'excited' ? (
        <Path d="M57 67.5 L63 67.5 L63 72.5 L57 72.5 Z M60 67.5 L60 72.5" fill="#FFFFFF" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      ) : null}
      <Mouth mood={mood} />

      <AccessoryShape accessory={accessory} />

      {mood === 'sleepy' ? (
        <SvgText x={92} y={18} fontSize={16} fontWeight="bold" fill="#8C84A8">
          z
        </SvgText>
      ) : null}
    </G>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  if (mood === 'excited') {
    return <Path d="M53 66 Q60 79 67 66 Z" fill="#FF6F91" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />;
  }
  if (mood === 'worried') {
    return <Path d="M54 70 Q60 65.5 66 70" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />;
  }
  if (mood === 'sleepy') return <Ellipse cx={60} cy={69} rx={2.5} ry={3} fill={INK} />;
  return (
    <Path d="M53 66 Q56.5 70.5 60 66 Q63.5 70.5 67 66" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
  );
}

function AccessoryShape({ accessory }: { accessory: Accessory }) {
  const line = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' as const };
  switch (accessory) {
    case 'bow':
      return (
        <G>
          <Path d="M84 24 L71 15 Q68 24 71 33 Z" fill="#FF6FA3" {...line} />
          <Path d="M84 24 L97 15 Q100 24 97 33 Z" fill="#FF6FA3" {...line} />
          <Circle cx={84} cy={24} r={4.5} fill="#FF8FB8" {...line} />
        </G>
      );
    case 'crown':
      return (
        <G>
          <Path d="M45 23 L46 7 L53 15 L60 3 L67 15 L74 7 L75 23 Z" fill="#FFD66B" {...line} />
          <Circle cx={60} cy={16} r={2.5} fill="#FF6FA3" />
        </G>
      );
    case 'glasses':
      return (
        <G fill="none" stroke={INK} strokeWidth={2.5}>
          <Circle cx={47} cy={52} r={9.5} fill="#FFFFFF" fillOpacity={0.25} />
          <Circle cx={73} cy={52} r={9.5} fill="#FFFFFF" fillOpacity={0.25} />
          <Path d="M56.5 51 Q60 48 63.5 51" />
        </G>
      );
    case 'scarf':
      return (
        <G>
          <Path d="M36 77 Q60 89 84 77 L85 85 Q60 98 35 85 Z" fill="#FF5A6E" {...line} />
          <Path d="M68 88 L77 104 L64 102 Z" fill="#FF5A6E" {...line} />
        </G>
      );
    case 'flower': {
      const petals = [0, 72, 144, 216, 288].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return { x: 34 + Math.cos(rad) * 6, y: 22 + Math.sin(rad) * 6 };
      });
      return (
        <G>
          {petals.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={5} fill="#FFB3C7" stroke={INK} strokeWidth={1.5} />
          ))}
          <Circle cx={34} cy={22} r={4} fill="#FFD66B" stroke={INK} strokeWidth={1.5} />
        </G>
      );
    }
    default:
      return null;
  }
}
