import { createElement } from 'react';

import { C } from '../ui';

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 網頁版：使用瀏覽器內建的日期時間選擇器 */
export function DateTimeField({ value, onChange }: { value: number; onChange: (t: number) => void }) {
  return createElement('input', {
    type: 'datetime-local',
    value: toLocalInput(value),
    onChange: (e: { target: { value: string } }) => {
      const t = new Date(e.target.value).getTime();
      if (!Number.isNaN(t)) onChange(t);
    },
    style: {
      fontSize: 17,
      padding: '10px 12px',
      borderRadius: 12,
      border: `1px solid ${C.line}`,
      color: C.ink,
      fontFamily: 'inherit',
    },
  });
}
