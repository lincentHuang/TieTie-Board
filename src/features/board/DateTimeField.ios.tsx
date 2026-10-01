import DateTimePicker from '@react-native-community/datetimepicker';

export function DateTimeField({ value, onChange }: { value: number; onChange: (t: number) => void }) {
  return (
    <DateTimePicker
      value={new Date(value)}
      mode="datetime"
      display="compact"
      locale="zh-TW"
      minuteInterval={5}
      onChange={(_, d) => d && onChange(d.getTime())}
      // 原生元件量出來的寬度比按鈕寬，按鈕又固定靠右，所以整個靠右才對得齊（跟上面的開關切齊）
      style={{ alignSelf: 'flex-end' }}
    />
  );
}
