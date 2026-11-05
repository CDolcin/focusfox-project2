import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/app/AppContext';
import Navigation from './src/app/Navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Navigation />
        <StatusBar style="auto" />
      </AppProvider>
    </SafeAreaProvider>
  );
}
