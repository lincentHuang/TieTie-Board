import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { C, F, Ionicons, Squishy } from '@/components/ui';
import { photosTooBig, pickPhotos } from '@/lib/images';
import { MAX_PHOTOS } from '@/lib/types';

import { PhotoViewer } from './PhotoViewer';

/** 便利貼附的照片：一排縮圖，第一張是封面；點照片放大看，按 ☆ 換封面、按 ✕ 拿掉，最後一格可以再加 */
export function PhotoPicker({ value, onChange }: { value: string[]; onChange: (photos: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const add = async () => {
    setBusy(true);
    try {
      const picked = await pickPhotos(MAX_PHOTOS - value.length);
      // 一張一張放，超過文件大小上限就停，前面放得下的照樣留著
      const next = [...value];
      for (const p of picked) {
        if (photosTooBig([...next, p])) break;
        next.push(p);
      }
      if (next.length > value.length) onChange(next);
      if (next.length < value.length + picked.length) {
        showError('有照片放不下', new Error('照片加起來太大了，請少選幾張或換別張'));
      }
    } catch (e) {
      showError('無法讀取照片', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.row}>
      {value.map((uri, i) => (
        <View key={i} style={s.tile}>
          <Pressable onPress={() => setViewing(i)} accessibilityLabel={`放大看第 ${i + 1} 張照片`}>
            <Image source={{ uri }} style={s.photo} contentFit="cover" />
          </Pressable>
          {i === 0 ? (
            <View pointerEvents="none" style={s.cover}>
              <Text style={s.coverText}>封面</Text>
            </View>
          ) : (
            // 封面就是第一張：換封面 = 把這張移到最前面
            <Pressable
              onPress={() => onChange([uri, ...value.filter((_, j) => j !== i)])}
              hitSlop={6}
              style={s.star}
              accessibilityLabel={`把第 ${i + 1} 張設成封面`}>
              <Ionicons name="star-outline" size={13} color={C.important} />
            </Pressable>
          )}
          <Pressable
            onPress={() => onChange(value.filter((_, j) => j !== i))}
            hitSlop={8}
            style={s.remove}
            accessibilityLabel={`拿掉第 ${i + 1} 張照片`}>
            <Ionicons name="close" size={14} color="#FFF" />
          </Pressable>
        </View>
      ))}
      {value.length < MAX_PHOTOS ? (
        <Squishy onPress={add} disabled={busy} style={[s.tile, s.add]} accessibilityLabel="加照片">
          {busy ? (
            <ActivityIndicator color={C.sky} />
          ) : (
            <>
              <Ionicons name="images" size={24} color={C.sky} />
              <Text style={s.addText}>加照片</Text>
            </>
          )}
        </Squishy>
      ) : null}
      {viewing !== null ? <PhotoViewer photos={value} start={viewing} onClose={() => setViewing(null)} /> : null}
    </View>
  );
}

const TILE = 76;

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: TILE, height: TILE, borderRadius: 16 },
  photo: { width: TILE, height: TILE, borderRadius: 16, backgroundColor: C.canvas },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.ink,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 2,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: C.important,
    alignItems: 'center',
  },
  coverText: { fontSize: 11, fontFamily: F.display, color: '#FFF' },
  star: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.sky,
    backgroundColor: C.sky + '14',
  },
  addText: { fontSize: 12, fontFamily: F.display, color: C.sky },
});
