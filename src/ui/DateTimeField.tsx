import React, { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { OutlinedPill, Panel, TextButton, T, useColors } from './kit';

const label = (ms: number) => {
  const d = new Date(ms);
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

/** Project I's deadline field: tap -> date dialog, then time dialog (Android); a sheet with the native picker on iOS. */
export default function DateTimeField({ valueMs, onChange }: { valueMs: number; onChange: (ms: number) => void }) {
  const c = useColors();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(new Date(valueMs));
  const open = () => {
    if (Platform.OS === 'android') {
      const cur = new Date(valueMs);
      DateTimePickerAndroid.open({ value: cur, mode: 'date', onChange: (e, date) => {
        if (e.type !== 'set' || !date) return;
        const withDate = new Date(cur); withDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        DateTimePickerAndroid.open({ value: withDate, mode: 'time', is24Hour: false, onChange: (e2, time) => {
          if (e2.type !== 'set' || !time) return;
          withDate.setHours(time.getHours(), time.getMinutes(), 0, 0); onChange(withDate.getTime());
        } });
      } });
    } else { setDraft(new Date(valueMs)); setIosOpen(true); }
  };
  return (
    <>
      <Panel onPress={open} style={{ padding: 16 }}><Text style={{ color: c.text, fontSize: 16 }}>{label(valueMs)}</Text></Panel>
      <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: c.surface, padding: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <DateTimePicker value={draft} mode="datetime" display="spinner" onChange={(_, d) => d && setDraft(d)} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TextButton title="Cancel" onPress={() => setIosOpen(false)} />
              <TextButton title="Done" onPress={() => { onChange(draft.getTime()); setIosOpen(false); }} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
