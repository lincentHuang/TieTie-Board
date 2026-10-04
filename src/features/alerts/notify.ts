import { sendPush, type PushMessage } from '@/lib/push-send';
import { addAlert, fetchPushRecipients, type NewAlert, type PushRecipient } from '@/lib/repo';
import { itemTitle, type BoardItem } from '@/lib/types';

/** 推播帶的資料：點通知時打開 gid 這個公布欄；收到時背景任務會順便更新小工具 */
type PushData = { kind: 'alert' | 'board'; gid: string };

type Visible = { title: string; body: string; channelId: 'alerts' | 'board'; urgent: boolean };

/**
 * 每個人最多兩則：
 * - 看得到的通知（有標題、會響）
 * - 只帶資料的背景推播：叫醒 App 更新桌面小工具。iOS 只有這種保證會叫醒；
 *   Android 收到任何推播都會跑背景任務，有看得到的通知就不用再送。
 */
function buildMessages(recipients: PushRecipient[], visible: Visible | null, data: PushData): PushMessage[] {
  return recipients.flatMap((r) => {
    const out: PushMessage[] = [];
    if (visible) {
      out.push({
        to: r.token,
        title: visible.title,
        body: visible.body,
        data,
        sound: 'default',
        priority: 'high',
        channelId: visible.channelId,
        interruptionLevel: visible.urgent ? 'time-sensitive' : 'active',
      });
    }
    if (!visible || r.os !== 'android') out.push({ to: r.token, data, contentAvailable: true, priority: 'normal' });
    return out;
  });
}

/**
 * 發出快速通報：先存進資料庫（開著 App 的人、小工具馬上會變），再推播給沒開 App 的人。
 * 推播失敗不算通報失敗，只記錄下來。
 */
export async function sendQuickAlert(gid: string, boardName: string, alert: NewAlert) {
  await addAlert(gid, alert);
  try {
    const recipients = await fetchPushRecipients(gid, alert.authorId);
    const urgent = alert.level === 'urgent';
    await sendPush(
      buildMessages(
        recipients,
        {
          title: `${urgent ? '🚨' : '📣'} ${alert.authorName}・${boardName}`,
          body: `${alert.emoji} ${alert.text}`,
          channelId: 'alerts',
          urgent,
        },
        { kind: 'alert', gid },
      ),
    );
  } catch (e) {
    console.warn('通報推播失敗', e);
  }
}

/** 小工具上看得到的欄位 */
export type WidgetFields = Pick<BoardItem, 'type' | 'text' | 'sticker' | 'photos' | 'files' | 'priority' | 'dueAt'>;

const onWidget = (i: WidgetFields | null): i is WidgetFields => i !== null && (i.priority !== 'none' || i.dueAt !== null);
const sameOnWidget = (a: WidgetFields, b: WidgetFields) =>
  itemTitle(a) === itemTitle(b) && a.priority === b.priority && a.dueAt === b.dueAt;

/**
 * 公告或活動新增、修改、刪除後，讓其他人的小工具跟著更新（App 沒開也會）：
 * 新公告會跳通知（大家本來就要按「我知道了」），其他變化只送背景推播，悄悄更新。
 * 一般便利貼、移動位置不影響小工具，不送。背景執行，失敗只記錄。
 */
export function notifyBoardChange(
  ctx: { gid: string; uid: string; boardName: string; authorName: string },
  before: WidgetFields | null,
  after: WidgetFields | null,
) {
  if (!onWidget(before) && !onWidget(after)) return;
  if (before && after && sameOnWidget(before, after)) return;
  const announced = !before && after && after.priority !== 'none' ? after : null;
  const visible: Visible | null = announced
    ? {
        title: `📢 ${ctx.boardName}・${announced.priority === 'urgent' ? '緊急' : '重要'}公告`,
        body: `${itemTitle(announced)}（${ctx.authorName}）`,
        channelId: 'board',
        urgent: announced.priority === 'urgent',
      }
    : null;
  fetchPushRecipients(ctx.gid, ctx.uid)
    .then((recipients) => sendPush(buildMessages(recipients, visible, { kind: 'board', gid: ctx.gid })))
    .catch((e) => console.warn('通知小工具更新失敗', e));
}
