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
      style={{ alignSelf: 'flex-start' }}
    />
  );
}
