import { byQueueOrder, isTaskDone, MAX_TASK_TEXT, MAX_TASKS, type BoardItem, type Member, type Task } from '@/lib/types';

/** 新的一項待辦：id 只用小寫英數字（打勾時拿來當 Firestore 欄位名稱） */
export const newTask = (text = ''): Task => ({ id: Math.random().toString(36).slice(2, 10).padEnd(8, '0'), text });

/** 存檔前整理：去掉空白的項目、太長的截掉、最多 MAX_TASKS 項 */
export const cleanTasks = (tasks: Task[]) =>
  tasks
    .map((t) => ({ id: t.id, text: t.text.trim().slice(0, MAX_TASK_TEXT) }))
    .filter((t) => t.text)
    .slice(0, MAX_TASKS);

/** 內容一樣（項目、文字、順序都一樣） */
export const sameTasks = (a: Task[], b: Task[]) =>
  a.length === b.length && a.every((t, i) => t.id === b[i].id && t.text === b[i].text);

/** 清單裡還沒勾的先列，勾好的排後面（各自維持原本的順序），像 Google Keep */
export const orderedTasks = (item: Pick<BoardItem, 'tasks' | 'checked'>) => [
  ...item.tasks.filter((t) => !isTaskDone(item, t.id)),
  ...item.tasks.filter((t) => isTaskDone(item, t.id)),
];

/** 誰勾的：自己就寫「我」；找不到人（已經離開公布欄）就不寫 */
export const checkerName = (item: Pick<BoardItem, 'checked'>, taskId: string, uid: string, members: Member[]) => {
  const who = item.checked[taskId];
  return who === uid ? '我' : members.find((m) => m.uid === who)?.name;
};

/** 一件還沒做完的待辦：待辦清單裡的一項（task），或整張狀態是「待辦 / 進行中」的項目（task = null） */
export interface TodoEntry {
  key: string;
  item: BoardItem;
  task: Task | null;
}

/** 這張有沒有還沒做完的待辦 */
export const hasOpenTodo = (item: BoardItem) =>
  item.status !== 'done' &&
  (item.tasks.length ? item.tasks.some((t) => !isTaskDone(item, t.id)) : item.status === 'todo' || item.status === 'doing');

/**
 * 白板上所有還沒做完的待辦，照排隊的順序（緊急 > 重要 > 快到的活動 > 越新越前面），
 * 同一張清單裡照作者排的順序。狀態標成完成的整張不算
 */
export function openTodos(items: BoardItem[], now: number): TodoEntry[] {
  return items
    .filter(hasOpenTodo)
    .sort(byQueueOrder(now))
    .flatMap((item): TodoEntry[] =>
      item.tasks.length
        ? item.tasks.filter((t) => !isTaskDone(item, t.id)).map((task) => ({ key: `${item.id}/${task.id}`, item, task }))
        : [{ key: item.id, item, task: null }],
    );
}
