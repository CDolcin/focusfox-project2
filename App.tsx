import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/app/AppContext';
import Navigation from './src/app/Navigation';
import { FriendSync } from './src/app/FriendSync';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <FriendSync />
        <Navigation />
        <StatusBar style="auto" />
      </AppProvider>
    </SafeAreaProvider>
  );
}