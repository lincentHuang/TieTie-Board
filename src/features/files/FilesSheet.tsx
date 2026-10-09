import { Text, View } from 'react-native';

import { RichText } from '@/components/RichText';
import { Sheet } from '@/components/Sheet';
import { Button, C, F, Label, themed } from '@/components/ui';
import { itemTitle, type BoardItem } from '@/lib/types';

import { FileRow } from './FileRow';

/** 看別人貼的附件：上面是便利貼的內容，下面是檔案（PDF 點了直接看） */
export function FilesSheet({
  gid,
  item,
  onViewPhotos,
  onClose,
}: {
  gid: string;
  item: BoardItem;
  /** 便利貼也有照片時才給 */
  onViewPhotos?: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible title="附件" onClose={onClose}>
      {item.text ? (
        <RichText linkable text={item.text} fontSize={17} lineHeight={24} style={s.text} />
      ) : (
        <Text style={s.text}>{itemTitle(item)}</Text>
      )}
      <Text style={s.author}>{item.authorName} 貼的</Text>
      <Label>檔案（{item.files.length}）</Label>
      <View style={s.list}>
        {item.files.map((f) => (
          <FileRow key={f.id} gid={gid} file={f} />
        ))}
      </View>
      {onViewPhotos && item.photos.length ? (
        <Button
          kind="soft"
          color={C.sky}
          icon="images"
          label={`看照片（${item.photos.length} 張）`}
          onPress={onViewPhotos}
          style={s.photos}
        />
      ) : null}
    </Sheet>
  );
}

const s = themed(() => ({
  text: { fontSize: 17, fontFamily: F.display, color: C.ink, backgroundColor: C.bg, borderRadius: 14, padding: 12, lineHeight: 24 },
  author: { fontSize: 12, fontFamily: F.display, color: C.sub, marginTop: 6, textAlign: 'right' },
  list: { gap: 8 },
  photos: { marginTop: 14 },
}));
