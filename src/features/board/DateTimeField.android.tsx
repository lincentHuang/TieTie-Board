import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { View } from 'react-native';

import { Button } from '@/components/ui';
import { timeOfDay } from '@/lib/dates';

/** Android 沒有日期+時間合一的選擇器，分成兩個按鈕 */
export function DateTimeField({ value, onChange }: { value: number; onChange: (t: number) => void }) {
  const open = (mode: 'date' | 'time') =>
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode,
      is24Hour: true,
      onChange: (e, d) => {
        if (e.type === 'set' && d) onChange(d.getTime());
      },
    });

  const d = new Date(value);
  const dateText = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Button kind="soft" icon="calendar-outline" label={dateText} onPress={() => open('date')} />
      <Button kind="soft" icon="time-outline" label={timeOfDay(value)} onPress={() => open('time')} />
    </View>
  );
}
