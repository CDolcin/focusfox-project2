import React, { createContext, useContext } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, StyleProp, TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Palette, colors as light } from './theme';

/** Shared components mirroring Project I's CommonComponents.kt and the Material 3 styles used on each screen. */
export const PaletteContext = createContext<Palette>(light);
export const useColors = () => useContext(PaletteContext);
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
export const Icon = ({ name, size = 24, color }: { name: IconName; size?: number; color?: string }) => <MaterialIcons name={name} size={size} color={color ?? useColors().textSecondary} />;

// ---- text styles (Typography in Theme.kt) ----
export function T({ children, style, kind = 'body', numberOfLines }: { children?: React.ReactNode; style?: StyleProp<TextStyle>; kind?: 'headlineLarge' | 'headlineMedium' | 'titleLarge' | 'titleMedium' | 'body' | 'bodyDim' | 'label' | 'labelDim'; numberOfLines?: number }) {
  const c = useColors();
  const base: Record<string, TextStyle> = {
    headlineLarge: { fontWeight: '800', fontSize: 30, color: c.text },
    headlineMedium: { fontWeight: '700', fontSize: 24, color: c.text },
    titleLarge: { fontWeight: '700', fontSize: 20, color: c.text },
    titleMedium: { fontWeight: '600', fontSize: 17, color: c.text },
    body: { fontSize: 16, color: c.text },
    bodyDim: { fontSize: 14, color: c.textSecondary },
    label: { fontWeight: '600', fontSize: 14, color: c.text },
    labelDim: { fontWeight: '500', fontSize: 12, color: c.textSecondary },
  };
  return <Text numberOfLines={numberOfLines} style={[base[kind], style]}>{children}</Text>;
}

/** Page container: Project I background, 20dp horizontal / 12dp vertical padding. */
export function Screen({ children, scroll = true, bg, footer }: { children: React.ReactNode; scroll?: boolean; bg?: string; footer?: React.ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: bg ?? c.background }}>
      {scroll
        ? <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        : <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 12 }}>{children}</View>}
      {footer}
    </SafeAreaView>
  );
}
export const Gap = ({ h = 16 }: { h?: number }) => <View style={{ height: h }} />;
export const Row = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;

export function ScreenHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <View><T kind="headlineMedium">{title}</T><T kind="bodyDim" style={{ marginTop: 2 }}>{subtitle}</T></View>;
}
export function BackableHeader({ title, subtitle, onBack, style }: { title: string; subtitle: string; onBack?: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Row style={style}>
      {onBack && (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.purpleLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <MaterialIcons name="chevron-left" size={28} color={c.purple} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}><T kind="headlineMedium">{title}</T>{subtitle ? <T kind="bodyDim" style={{ marginTop: 2 }}>{subtitle}</T> : null}</View>
    </Row>
  );
}

export function PillBadge({ text, bg, color, onPress, style }: { text: string; bg: string; color: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const body = <View style={[{ backgroundColor: bg, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' }, style]}><Text style={{ color, fontSize: 12, fontWeight: '600' }}>{text}</Text></View>;
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}
export function OnlineBadge({ state = 'online' }: { state?: 'online' | 'offline' | 'syncing' | 'local' }) {
  const c = useColors();
  const m = { online: ['● ONLINE', c.onlineBg, c.onlineText], offline: ['● OFFLINE', c.border, c.textSecondary], syncing: ['● SYNCING', c.purpleLight, c.purple], local: ['● OFFLINE MODE', c.onlineBg, c.onlineText] }[state];
  return <PillBadge text={m[0]} bg={m[1]} color={m[2]} />;
}
export function PriorityPill({ priority }: { priority: string }) {
  const p = priority.toUpperCase();
  const bg = p === 'HIGH' ? '#E0607A' : p === 'MEDIUM' ? '#E8A33D' : '#4CAF7D';
  return <PillBadge text={p === 'HIGH' || p === 'MEDIUM' ? p : 'LOW'} bg={bg} color="#fff" />;
}

/** White rounded card (Material Card with white container). */
export function Panel({ children, style, onPress, radius = 14 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; radius?: number }) {
  const c = useColors();
  const s: StyleProp<ViewStyle> = [{ backgroundColor: c.surface, borderRadius: radius }, style];
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={s}>{children}</Pressable> : <View style={s}>{children}</View>;
}
/** White row with a 4dp coloured stripe on the left (notes, priority tasks, history rows). */
export function StripeRow({ stripe, children, onPress, minHeight = 60 }: { stripe: string; children: React.ReactNode; onPress?: () => void; minHeight?: number }) {
  const c = useColors();
  const body = (
    <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', minHeight }}>
      <View style={{ width: 4, backgroundColor: stripe }} />
      <View style={{ flex: 1, padding: 16 }}>{children}</View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body;
}

// ---- buttons ----
export function PrimaryButton({ title, onPress, disabled, loading, style, icon }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; icon?: IconName }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" style={[{ height: 52, borderRadius: 50, backgroundColor: c.purple, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: disabled ? 0.45 : 1 }, style]}>
      {icon ? <MaterialIcons name={icon} size={22} color="#fff" style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{loading ? '…' : title}</Text>
    </Pressable>
  );
}
export function OutlinedPill({ title, onPress, style, disabled }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[{ borderRadius: 50, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }, style]}>
      <Text style={{ color: c.purple, fontSize: 14, fontWeight: '500' }}>{title}</Text>
    </Pressable>
  );
}
export function TextButton({ title, onPress, color, style }: { title: string; onPress: () => void; color?: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <Pressable onPress={onPress} accessibilityRole="button" style={[{ paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }, style]}><Text style={{ color: color ?? c.text, fontSize: 14, fontWeight: '500' }}>{title}</Text></Pressable>;
}
/** Selectable pill: used for task filters, priority choice, deck chips, reminder choices. `variant` picks the selected colours. */
export function Choice({ label, selected, onPress, variant = 'solid', size = 'md' }: { label: string; selected: boolean; onPress: () => void; variant?: 'solid' | 'soft'; size?: 'sm' | 'md' }) {
  const c = useColors();
  const bg = selected ? (variant === 'solid' ? c.purple : c.purpleLight) : c.surface;
  const fg = selected ? (variant === 'solid' ? '#fff' : c.purple) : c.text;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ backgroundColor: bg, borderRadius: 50, paddingHorizontal: size === 'sm' ? 14 : 18, paddingVertical: size === 'sm' ? 9 : 10 }}>
      <Text style={{ color: fg, fontWeight: '600', fontSize: size === 'sm' ? 13 : 14 }}>{label}</Text>
    </Pressable>
  );
}
export function Fab({ onPress, label = 'Add' }: { onPress: () => void; label?: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 16, backgroundColor: c.purple, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
      <MaterialIcons name="add" size={28} color="#fff" />
    </Pressable>
  );
}

// ---- inputs ----
export function OutlinedField({ label, style, inputStyle, ...rest }: TextInputProps & { label?: string; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle> }) {
  const c = useColors();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={style}>
      {label ? <T kind="label" style={{ marginBottom: 6 }}>{label}</T> : null}
      <TextInput
        placeholderTextColor={c.textSecondary}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        {...rest}
        style={[{ backgroundColor: c.surface, borderWidth: focused ? 2 : 1, borderColor: focused ? c.purple : c.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: c.text, fontSize: 16 }, rest.multiline ? { minHeight: 110, textAlignVertical: 'top' } : null, inputStyle]}
      />
    </View>
  );
}

/** Material AlertDialog look: centred white sheet, title, content, text buttons bottom-right. */
export function Dialog({ visible, title, onDismiss, children, confirmLabel, onConfirm, dismissLabel = 'Cancel', hideDismiss }: { visible: boolean; title: string; onDismiss: () => void; children: React.ReactNode; confirmLabel?: string; onConfirm?: () => void; dismissLabel?: string; hideDismiss?: boolean }) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable onPress={onDismiss} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: c.surface, borderRadius: 28, padding: 24, maxHeight: '85%' }}>
          <Text style={{ fontSize: 24, color: c.text, marginBottom: 16 }}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>{children}</ScrollView>
          <Row style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            {!hideDismiss && <TextButton title={dismissLabel} onPress={onDismiss} />}
            {confirmLabel && onConfirm ? <TextButton title={confirmLabel} onPress={onConfirm} /> : null}
          </Row>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function InitialsAvatar({ name, size = 56 }: { name: string; size?: number }) {
  const c = useColors();
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.purple + '26', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.purple, fontWeight: '700', fontSize: size / 2.2 }}>{(name.trim()[0] ?? '?').toUpperCase()}</Text></View>;
}
export function SettingsRow({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Panel onPress={onPress} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Row style={{ flex: 1 }}>
        <MaterialIcons name={icon} size={24} color={c.purple} />
        <View style={{ marginLeft: 14, flex: 1 }}><T kind="label" style={{ fontSize: 16 }}>{title}</T><T kind="bodyDim">{subtitle}</T></View>
      </Row>
      <MaterialIcons name="chevron-right" size={24} color={c.textSecondary} />
    </Panel>
  );
}
export const Empty = ({ text }: { text: string }) => <View style={{ alignItems: 'center', paddingTop: 36 }}><T kind="bodyDim" style={{ textAlign: 'center' }}>{text}</T></View>;
export const DeleteX = ({ onPress, label = 'Delete' }: { onPress: () => void; label?: string }) => <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={{ padding: 6 }}><MaterialIcons name="close" size={22} color="#E0607A" /></Pressable>;
export const styles = StyleSheet.create({ flex: { flex: 1 } });
