import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { showError } from '@/components/dialogs';
import { Button, C, F, Ionicons, type IconName } from '@/components/ui';
import { useSession } from '@/lib/session';

import { APK_URL, canOpenInApp, downloadApk, openInApp, openInBrowser } from './install';
import { loadAutoOpen, saveAutoOpen } from './useAppHandoff';
import { hideInstallHint, useInstall } from './useInstall';

/** 設定裡的「裝到手機」：Android 可以下載 App 或加到主畫面，iPhone 加到主畫面，在 LINE 裡要先換瀏覽器 */
export function InstallCard() {
  const session = useSession();
  const { env, canPrompt, prompt } = useInstall();
  if (!env) return null;

  const install = () => prompt().catch((e) => console.warn('安裝視窗打不開', e));
  const download = () => {
    downloadApk();
    hideInstallHint(30);
  };
  const apk =
    env.platform === 'android' && APK_URL ? (
      <Option
        icon="logo-android"
        color={C.ok}
        title="下載 Android App"
        badge={env.standalone ? undefined : '推薦'}
        desc="家人發通報、新公告時手機會跳通知，還能放桌面小工具">
        <Button color={C.ok} icon="download" label="下載 App" onPress={download} />
        <Text style={s.note}>下載完點開安裝；手機問要不要允許「安裝不明應用程式」時，選允許就可以</Text>
      </Option>
    ) : null;

  if (env.inLine) {
    const app = canOpenInApp(env);
    const browser = (
      <Option
        icon="open-outline"
        color={C.lineGreen}
        title={app ? '還沒裝？先用瀏覽器打開' : '先用瀏覽器打開'}
        desc="LINE 裡面沒辦法安裝。用手機的瀏覽器打開公布欄後，再到這裡安裝">
        <Button kind={app ? 'soft' : 'primary'} color={C.lineGreen} icon="compass" label="用瀏覽器打開" onPress={openInBrowser} />
        <Text style={s.note}>在瀏覽器裡按「用 LINE 登入」，就會回到你的公布欄</Text>
      </Option>
    );
    return app ? (
      <View style={s.list}>
        <OpenInAppOption code={session.groupId} />
        {browser}
      </View>
    ) : (
      browser
    );
  }

  if (env.standalone) {
    return (
      <View style={s.list}>
        <View style={s.done}>
          <Ionicons name="checkmark-circle" size={22} color={C.ok} />
          <Text style={s.doneText}>已經裝在主畫面了</Text>
        </View>
        {apk}
      </View>
    );
  }

  if (env.platform === 'ios') {
    return (
      <Option icon="add-circle" color={C.sky} title="加到主畫面" desc="從桌面一點就打開，跟 App 一樣全螢幕">
        <Steps
          steps={[
            { icon: 'share-outline', text: '點瀏覽器的分享按鈕' },
            { icon: 'add-circle-outline', text: '往下滑，選「加入主畫面」' },
            { icon: 'checkmark', text: '按右上角的「新增」' },
          ]}
        />
        <Text style={s.note}>找不到的話，改用 Safari 打開這個網頁</Text>
        {/* iPhone 主畫面上的網頁跟 Safari 分開存登入資料，第一次打開要再登入 */}
        <Text style={[s.note, s.warn]}>
          {session.account === 'anonymous'
            ? '先在下面「我的帳號」登入；從主畫面打開後再登入一次，才找得回你的公布欄'
            : '從主畫面打開後，用同一個帳號再登入一次，就會回到你的公布欄'}
        </Text>
      </Option>
    );
  }

  if (env.platform === 'android') {
    return (
      <View style={s.list}>
        {apk}
        <Option
          icon="add-circle"
          color={C.sky}
          title="加到主畫面"
          desc={APK_URL ? '不用安裝 App，從桌面一點就打開（收不到通知）' : '從桌面一點就打開，跟 App 一樣全螢幕'}>
          {canPrompt ? (
            <Button kind={APK_URL ? 'soft' : 'primary'} color={C.sky} icon="add" label="加到主畫面" onPress={install} />
          ) : (
            <Steps
              steps={[
                { icon: 'ellipsis-vertical', text: '點瀏覽器右上角的選單' },
                { icon: 'add-circle-outline', text: '選「加到主畫面」或「安裝應用程式」' },
              ]}
            />
          )}
        </Option>
      </View>
    );
  }

  // 電腦：Chrome / Edge 可以裝成視窗程式；手機要用手機打開
  return (
    <View style={s.list}>
      {canPrompt ? (
        <Option icon="desktop-outline" color={C.sky} title="裝到電腦" desc="像一般程式一樣，從桌面或開始選單打開">
          <Button color={C.sky} icon="add" label="安裝" onPress={install} />
        </Option>
      ) : null}
      <Option icon="phone-portrait-outline" color={C.primary} title="用手機打開" desc="在手機的瀏覽器打開這個網址，再到「設定」安裝">
        <Text selectable style={s.url}>
          {window.location.host}
        </Text>
      </Option>
    </View>
  );
}

/** 在 LINE 裡（Android）：已經裝了 App 就改用 App 打開這個公布欄，也可以設定以後點連結都直接用 App 打開 */
function OpenInAppOption({ code }: { code: string | null }) {
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    loadAutoOpen().then(setAuto);
  }, []);
  const toggle = (on: boolean) => {
    setAuto(on);
    saveAutoOpen(on);
  };
  const open = () => openInApp(code).catch((e) => showError('打不開 App', e));

  return (
    <Option icon="phone-portrait-outline" color={C.ok} title="已經裝了 App？" desc="改用貼貼公布欄 App 打開，收得到通知、有桌面小工具">
      <Button color={C.ok} icon="open-outline" label="用 App 打開" onPress={open} />
      <View style={s.switchRow}>
        <Text style={s.switchText}>以後點 LINE 裡的連結，直接用 App 打開</Text>
        <Switch value={auto} onValueChange={toggle} />
      </View>
      <Text style={s.note}>App 裡還沒加入這個公布欄的話，會送出加入申請，等房主同意</Text>
    </Option>
  );
}

function Option({
  icon,
  color,
  title,
  badge,
  desc,
  children,
}: {
  icon: IconName;
  color: string;
  title: string;
  badge?: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <View style={s.option}>
      <View style={s.head}>
        <View style={[s.icon, { backgroundColor: color + '26' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={s.title}>{title}</Text>
            {badge ? (
              <View style={[s.badge, { backgroundColor: color }]}>
                <Text style={s.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={s.desc}>{desc}</Text>
        </View>
      </View>
      <View style={s.body}>{children}</View>
    </View>
  );
}

function Steps({ steps }: { steps: { icon: IconName; text: string }[] }) {
  return (
    <View style={s.steps}>
      {steps.map((step, i) => (
        <View key={step.text} style={s.step}>
          <View style={s.stepNo}>
            <Text style={s.stepNoText}>{i + 1}</Text>
          </View>
          <Text style={s.stepText}>{step.text}</Text>
          <Ionicons name={step.icon} size={20} color={C.sky} />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 10 },
  option: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 2, borderColor: C.line, padding: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: F.display, fontSize: 18, color: C.ink },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: F.display, fontSize: 12, color: '#FFF' },
  desc: { fontSize: 13, color: C.sub, marginTop: 2, lineHeight: 18 },
  body: { marginTop: 12, gap: 8 },
  note: { fontSize: 12, color: C.sub, textAlign: 'center', lineHeight: 17 },
  warn: { color: C.important, fontFamily: F.display },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderRadius: 14, padding: 10 },
  switchText: { flex: 1, fontFamily: F.display, fontSize: 14, color: C.ink, lineHeight: 20 },
  steps: { gap: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderRadius: 14, padding: 10 },
  stepNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.sky, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { fontFamily: F.display, fontSize: 13, color: '#FFF' },
  stepText: { flex: 1, fontFamily: F.display, fontSize: 15, color: C.ink },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  doneText: { fontFamily: F.display, fontSize: 16, color: C.ink },
  url: { fontFamily: F.display, fontSize: 18, color: C.primary, textAlign: 'center', letterSpacing: 0.5 },
});
