import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { T, useColors } from '../ui/kit';
import { MaterialIcons } from '@expo/vector-icons';

export default function SplashScreen({ onFinished }: { onFinished: () => void }) {
  const c = useColors();
  useEffect(() => { const t = setTimeout(onFinished, 1600); return () => clearTimeout(t); }, [onFinished]);
  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 24, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ backgroundColor: c.purpleLight, borderRadius: 32, paddingVertical: 40, paddingHorizontal: 24, alignSelf: 'stretch', alignItems: 'center' }}>
          <View style={{ width: 84, height: 84, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 40 }}>🦊</Text></View>
          <Text style={{ color: c.purple, fontWeight: '800', fontSize: 34, marginTop: 16 }}>FocusFox</Text>
          <Text style={{ color: c.text, fontSize: 16, marginTop: 8 }}>Study smarter. Stay focused.</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 50, paddingHorizontal: 20, paddingVertical: 10, marginTop: 20, flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="bolt" size={16} color={c.purple} />
            <Text style={{ color: c.purple, fontWeight: '600', fontSize: 13, marginLeft: 6 }}>SMART STUDY COMPANION</Text>
          </View>
        </View>
        <Text style={{ color: c.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 40, marginHorizontal: 16 }}>Your tasks, notes, focus sessions and productive breaks — all in one place.</Text>
      </View>
      <T kind="bodyDim" style={{ position: 'absolute', bottom: 24, alignSelf: 'center', fontSize: 13 }}>© 2026 FocusFox</T>
    </View>
  );
}
