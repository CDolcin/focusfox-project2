import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp, useCollection } from '../app/AppContext';
import { newTask, setTaskCompleted } from '../app/actions';
import { Priority, SyncRecord, Task } from '../core/models';
import { createId } from '../core/ids';
import { cancelByKey, scheduleTaskReminder } from '../services/notifications';
import DateTimeField from '../ui/DateTimeField';
import { BackableHeader, Choice, DeleteX, Empty, OutlinedField, Panel, PillBadge, PrimaryButton, PriorityPill, Row, Screen, T, TextButton, useColors } from '../ui/kit';
import { flowerEmoji } from '../ui/theme';

type Filter = 'ALL' | 'TODAY' | 'UPCOMING' | 'COMPLETED';
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const cap = (s: string) => s[0] + s.slice(1).toLowerCase();

export function TasksScreen({ onAdd, onEdit, onBack }: { onAdd: () => void; onEdit: (id: string) => void; onBack: () => void }) {
  const { engine } = useApp(); const c = useColors();
  const tasks = useCollection('tasks');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [toast, setToast] = useState<string | null>(null);
  const shown = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0); const s = start.getTime(); const e = s + 86_400_000;
    const list = tasks.filter(t => filter === 'ALL' ? true : filter === 'TODAY' ? t.deadlineMs >= s && t.deadlineMs < e && !t.completed : filter === 'UPCOMING' ? t.deadlineMs >= e && !t.completed : t.completed);
    return list.sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [tasks, filter]);

  const toggle = async (t: SyncRecord<Task>) => {
    if (!engine) return;
    const flower = await setTaskCompleted(engine, t.id, t, !t.completed);
    if (!t.completed) void cancelByKey(`task:${t.id}`); else void scheduleTaskReminder(t.id, t);
    if (flower) { setToast(`${flowerEmoji[flower.species]} A ${flower.species} grew in your garden!`); setTimeout(() => setToast(null), 3000); }
  };
  return (
    <Screen scroll={false}>
      <BackableHeader title="Tasks" subtitle="Stay on top of your academic workload" onBack={onBack} />
      <View style={{ height: 16 }} />
      <Row style={{ gap: 8 }}>
        {(['ALL', 'TODAY', 'UPCOMING', 'COMPLETED'] as Filter[]).map(f => <Choice key={f} label={cap(f)} selected={filter === f} onPress={() => setFilter(f)} size="sm" />)}
      </Row>
      <View style={{ height: 14 }} />
      <T kind="bodyDim">{shown.length} task{shown.length === 1 ? '' : 's'}</T>
      {toast ? <Panel style={{ padding: 12, marginTop: 8, backgroundColor: c.purpleLight }}><T kind="label" style={{ color: c.purple }}>{toast}</T></Panel> : null}
      <View style={{ height: 10 }} />
      {shown.length === 0 ? <Empty text="Nothing here yet." /> : (
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }} style={{ flex: 1 }}>
          {shown.map(t => (
            <Panel key={t.id}>
              <Row style={{ padding: 16 }}>
                <Pressable onPress={() => toggle(t)} accessibilityRole="checkbox" accessibilityState={{ checked: t.completed }} accessibilityLabel={`Complete ${t.title}`} hitSlop={8}
                  style={{ width: 24, height: 24, borderRadius: 12, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.completed ? c.purple : 'transparent', borderWidth: t.completed ? 0 : 2, borderColor: c.purple }}>
                  {t.completed ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
                </Pressable>
                <Pressable onPress={() => onEdit(t.id)} style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', fontSize: 16, color: t.completed ? c.textSecondary : c.text, textDecorationLine: t.completed ? 'line-through' : 'none' }}>{t.title}</Text>
                  <Row><T kind="bodyDim">{fmtTime(t.deadlineMs)} · {cap(t.priority)}</T>{t.imageUris.length ? <Row style={{ marginLeft: 8 }}><MaterialIcons name="image" size={14} color={c.textSecondary} /><T kind="bodyDim"> {t.imageUris.length}</T></Row> : null}</Row>
                </Pressable>
                {!t.completed ? <PriorityPill priority={t.priority} /> : null}
                <DeleteX label="Delete task" onPress={() => Alert.alert('Delete task?', t.title, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await engine?.remove('tasks', t.id); await cancelByKey(`task:${t.id}`); } }])} />
              </Row>
            </Panel>
          ))}
        </ScrollView>
      )}
      <View style={{ height: 12 }} />
      <PrimaryButton title="+  Add New Task" onPress={onAdd} />
    </Screen>
  );
}

export function AddTaskScreen({ taskId, onDone }: { taskId?: string; onDone: () => void }) {
  const { engine } = useApp(); const c = useColors();
  const [task, setTask] = useState<Task | null>(taskId ? null : (() => { const t = newTask(); const d = new Date(); d.setHours(23, 59, 0, 0); return { ...t, deadlineMs: d.getTime() }; })());
  useEffect(() => { if (taskId && engine) engine.get('tasks', taskId).then(t => setTask(t ?? null)); }, [taskId, engine]);
  if (!task) return <Screen><T kind="bodyDim">Loading…</T></Screen>;
  const set = (p: Partial<Task>) => setTask({ ...task, ...p });
  const pick = async () => {
    if (task.imageUris.length >= 5) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photos permission needed', 'Allow photo access to attach images.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5 - task.imageUris.length, quality: 0.7 });
    if (!r.canceled) set({ imageUris: [...task.imageUris, ...r.assets.map(a => a.uri)].slice(0, 5) });
  };
  const saving = useRef(false);
  /** Instant: the write is queued and the screen closes straight away; the reminder (permission prompt, OS call) runs afterwards in the background. */
  const save = () => {
    if (!engine || !task.title.trim() || saving.current) return;
    saving.current = true;
    const id = taskId ?? createId('task');
    const data = { ...task, title: task.title.trim() };
    const written = engine.upsert('tasks', id, data);
    onDone();
    void written.then(() => (data.completed ? null : scheduleTaskReminder(id, data))).catch(() => undefined);
  };
  return (
    <Screen>
      <BackableHeader title={taskId ? 'Edit task' : 'New task'} subtitle="Plan one clear next action" onBack={onDone} />
      <View style={{ height: 20 }} />
      <OutlinedField label="Task title" placeholder="e.g. Study CTE309" value={task.title} onChangeText={v => set({ title: v })} />
      <View style={{ height: 16 }} />
      <OutlinedField label="Description" placeholder="Add details about what you need to accomplish..." multiline value={task.description} onChangeText={v => set({ description: v })} />
      <View style={{ height: 16 }} />
      <Row style={{ justifyContent: 'space-between' }}><T kind="label">Attach images</T><T kind="bodyDim">{task.imageUris.length}/5</T></Row>
      <View style={{ height: 8 }} />
      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
        {task.imageUris.map(u => (
          <View key={u}>
            <Image source={{ uri: u }} style={{ width: 68, height: 68, borderRadius: 10 }} />
            <Pressable onPress={() => set({ imageUris: task.imageUris.filter(x => x !== u) })} accessibilityLabel="Remove image" style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border }}><MaterialIcons name="close" size={14} color={c.purple} /></Pressable>
          </View>
        ))}
        {task.imageUris.length < 5 && <Pressable onPress={pick} accessibilityLabel="Add image" style={{ width: 68, height: 68, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}><MaterialIcons name="add-photo-alternate" size={28} color={c.purple} /></Pressable>}
      </Row>
      <View style={{ height: 16 }} />
      <T kind="label">Priority</T>
      <View style={{ height: 8 }} />
      <Row style={{ gap: 10 }}>{(['LOW', 'MEDIUM', 'HIGH'] as Priority[]).map(p => <Choice key={p} label={p[0] + p.slice(1).toLowerCase()} selected={task.priority === p} variant="soft" onPress={() => set({ priority: p })} />)}</Row>
      <View style={{ height: 16 }} />
      <T kind="label">Deadline</T>
      <T kind="bodyDim" style={{ marginTop: 4, marginBottom: 8 }}>Pick any date — tasks are organized by day automatically, so your list never grows unmanageably. Use the Today/Upcoming/Completed filters to keep things tidy.</T>
      <DateTimeField valueMs={task.deadlineMs} onChange={ms => set({ deadlineMs: ms })} />
      <View style={{ height: 16 }} />
      <T kind="label">Reminder</T>
      <View style={{ height: 8 }} />
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>{([5, 15, 30, 60] as const).map(m => <Choice key={m} label={`${m} min before`} selected={task.reminderMinutesBefore === m} variant="soft" size="sm" onPress={() => set({ reminderMinutesBefore: m })} />)}</Row>
      <View style={{ height: 28 }} />
      <PrimaryButton title={taskId ? 'Save Changes' : 'Create Task'} onPress={save} disabled={!task.title.trim()} />
      <View style={{ height: 10 }} />
      <TextButton title="Cancel" onPress={onDone} />
    </Screen>
  );
}
