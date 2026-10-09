import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { Platform, Text } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { C, Label, themed } from '@/components/ui';

import { InstallCard } from './InstallCard';
import { ThemePicker } from './ThemePicker';

/**
 * 設定（右上角的齒輪）：裝到手機（網頁版才有）、配色、我的帳號、版本。之後新的設定也放這裡。
 * 帳號卡片屬於 setup 功能，由白板組合進來。
 */
export function SettingsSheet({ account, onClose }: { account: ReactNode; onClose: () => void }) {
  const web = Platform.OS === 'web';
  const version = Constants.expoConfig?.version;
  return (
    <Sheet visible title="設定" onClose={onClose}>
      {web ? (
        <>
          <Label style={s.first}>裝到手機</Label>
          <InstallCard />
        </>
      ) : null}
      <ThemePicker first={!web} />
      <Label>我的帳號</Label>
      {account}
      <Text style={s.about}>貼貼公布欄{version ? ` v${version}` : ''}</Text>
    </Sheet>
  );
}

const s = themed(() => ({
  first: { marginTop: 4 },
  about: { fontSize: 12, color: C.sub, textAlign: 'center', marginTop: 24 },
}));
