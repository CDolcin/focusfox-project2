import React, { useCallback, useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { useApp } from './AppContext';
import { Instrument } from '../core/models';
import { useColors } from '../ui/kit';

import SplashScreen from '../screens/SplashScreen';
import { LoginScreen, RegisterScreen } from '../screens/AuthScreens';
import DashboardScreen from '../screens/DashboardScreen';
import { AddTaskScreen, TasksScreen } from '../screens/TasksScreens';
import NotesScreen from '../screens/NotesScreen';
import {
  FlashcardManagerScreen,
  FlashcardsScreen,
} from '../screens/FlashcardsScreens';
import {
  FocusHistoryScreen,
  FocusScreen,
} from '../screens/FocusScreens';
import {
  GardenScreen,
  ProgressScreen,
} from '../screens/ProgressGarden';
import {
  GesturesScreen,
  InstrumentsScreen,
  PerformanceCameraScreen,
  PlaybackScreen,
  PracticeScreen,
} from '../screens/MusicScreens';
import {
  AppSettingsScreen,
  EditProfileScreen,
  NotificationsScreen,
  ProfileScreen,
  StudyPreferencesScreen,
  SyncAccountScreen,
} from '../screens/ProfileScreens';
import { FriendsScreen } from '../screens/FriendsScreen';

type Routes = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;

  Dashboard: undefined;
  Tasks: undefined;
  AddTask: { taskId?: string } | undefined;
  Focus: undefined;
  FocusHistory: undefined;

  Music: undefined;
  Gestures: { instrument: Instrument };
  Camera: { instrument: Instrument };
  Practice: { instrument: Instrument };
  Playback: { instrument?: Instrument } | undefined;

  Profile: undefined;
  StudyPrefs: undefined;
  SyncAccount: undefined;
  NotificationsSettings: undefined;
  AppSettings: undefined;
  EditProfile: undefined;

  Notes: undefined;
  Progress: undefined;
  Flashcards: undefined;
  FlashcardsManage: undefined;
  Garden: undefined;

  // Friends leaderboard route
  Friends: undefined;
};

const Stack = createNativeStackNavigator<Routes>();
const navRef = createNavigationContainerRef<Routes>();

const TABS: Array<{
  route: keyof Routes;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}> = [
  { route: 'Dashboard', label: 'Home', icon: 'home' },
  { route: 'Tasks', label: 'Tasks', icon: 'check-circle' },
  { route: 'Focus', label: 'Focus', icon: 'schedule' },
  { route: 'Music', label: 'Music', icon: 'music-note' },
  { route: 'Profile', label: 'Profile', icon: 'person' },
];

const NO_BAR = new Set<string>([
  'Splash',
  'Login',
  'Register',
  'Camera',
]);

function BottomBar({ current }: { current: string }) {
  const c = useColors();

  return (
    <SafeAreaView
      edges={['bottom']}
      style={{
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.border,
      }}
    >
      <View style={{ flexDirection: 'row', height: 64 }}>
        {TABS.map(t => {
          const selected = current === t.route;

          return (
            <Pressable
              key={t.route}
              onPress={() =>
                navRef.isReady() &&
                navRef.reset({
                  index: 0,
                  routes: [{ name: t.route } as never],
                })
              }
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 3,
                  borderRadius: 16,
                  backgroundColor: selected
                    ? c.background
                    : 'transparent',
                }}
              >
                <MaterialIcons
                  name={t.icon}
                  size={24}
                  color={selected ? c.purple : c.textSecondary}
                />
              </View>

              <Text
                style={{
                  fontSize: 12,
                  color: selected ? c.purple : c.textSecondary,
                  marginTop: 2,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function Navigation() {
  const { user, ready, settings } = useApp();
  const c = useColors();

  const [current, setCurrent] = useState('Splash');
  const [splashDone, setSplashDone] = useState(false);

  const finishSplash = useCallback(() => {
    setSplashDone(true);
  }, []);

  const go = (route: keyof Routes, params?: object) =>
    navRef.isReady() &&
    (
      navRef.navigate as (
        route: string,
        params?: object
      ) => void
    )(route, params);

  const back = () => {
    if (navRef.isReady() && navRef.canGoBack()) {
      navRef.goBack();
    } else {
      go('Dashboard');
    }
  };

  if (!splashDone || !ready) {
    return <SplashScreen onFinished={finishSplash} />;
  }

  const signedIn = !!user;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.background,
      }}
    >
      <NavigationContainer
        ref={navRef}
        theme={
          settings.darkModeOverride === 2
            ? DarkTheme
            : DefaultTheme
        }
        onReady={() =>
          setCurrent(navRef.getCurrentRoute()?.name ?? '')
        }
        onStateChange={() =>
          setCurrent(navRef.getCurrentRoute()?.name ?? '')
        }
      >
        <Stack.Navigator
          key={signedIn ? 'in' : 'out'}
          screenOptions={{
            headerShown: false,
            animation: 'fade_from_bottom',
            contentStyle: {
              backgroundColor: c.background,
            },
          }}
        >
          {!signedIn ? (
            <>
              <Stack.Screen name="Login">
                {() => (
                  <LoginScreen
                    onRegister={() => go('Register')}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Register">
                {() => <RegisterScreen onLogin={back} />}
              </Stack.Screen>
            </>
          ) : (
            <>
              <Stack.Screen name="Dashboard">
                {() => (
                  <DashboardScreen
                    go={route => go(route as keyof Routes)}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Tasks">
                {() => (
                  <TasksScreen
                    onAdd={() => go('AddTask')}
                    onEdit={id =>
                      go('AddTask', { taskId: id })
                    }
                    onBack={back}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="AddTask">
                {({ route }) => (
                  <AddTaskScreen
                    taskId={route.params?.taskId}
                    onDone={back}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Focus">
                {() => (
                  <FocusScreen
                    onBack={back}
                    onHistory={() => go('FocusHistory')}
                    onGarden={() => go('Garden')}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="FocusHistory">
                {() => (
                  <FocusHistoryScreen onBack={back} />
                )}
              </Stack.Screen>

              <Stack.Screen name="Music">
                {() => (
                  <InstrumentsScreen
                    onSelect={instrument =>
                      go('Gestures', { instrument })
                    }
                    onSaved={() => go('Playback')}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Gestures">
                {({ route }) => (
                  <GesturesScreen
                    instrument={route.params.instrument}
                    onCamera={() =>
                      go('Camera', {
                        instrument: route.params.instrument,
                      })
                    }
                    onPractice={() =>
                      go('Practice', {
                        instrument: route.params.instrument,
                      })
                    }
                    onBack={back}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Camera">
                {({ route }) => (
                  <PerformanceCameraScreen
                    instrument={route.params.instrument}
                    onBack={back}
                    onFinished={() =>
                      navRef.reset({
                        index: 1,
                        routes: [
                          { name: 'Music' },
                          { name: 'Playback' },
                        ],
                      })
                    }
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Practice">
                {({ route }) => (
                  <PracticeScreen
                    instrument={route.params.instrument}
                    onBack={back}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Playback">
                {({ route }) => (
                  <PlaybackScreen
                    initialInstrument={
                      route.params?.instrument
                    }
                    onBack={back}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Profile">
                {() => (
                  <ProfileScreen
                    go={route => go(route as keyof Routes)}
                    onSignedOut={() => undefined}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="StudyPrefs">
                {() => (
                  <StudyPreferencesScreen onBack={back} />
                )}
              </Stack.Screen>

              <Stack.Screen name="SyncAccount">
                {() => (
                  <SyncAccountScreen onBack={back} />
                )}
              </Stack.Screen>

              <Stack.Screen name="NotificationsSettings">
                {() => (
                  <NotificationsScreen onBack={back} />
                )}
              </Stack.Screen>

              <Stack.Screen name="AppSettings">
                {() => (
                  <AppSettingsScreen onBack={back} />
                )}
              </Stack.Screen>

              <Stack.Screen name="EditProfile">
                {() => (
                  <EditProfileScreen onBack={back} />
                )}
              </Stack.Screen>

              <Stack.Screen name="Notes">
                {() => <NotesScreen onBack={back} />}
              </Stack.Screen>

              <Stack.Screen name="Progress">
                {() => (
                  <ProgressScreen
                    onBack={back}
                    onGarden={() => go('Garden')}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Flashcards">
                {() => (
                  <FlashcardsScreen
                    onBack={back}
                    onManage={() =>
                      go('FlashcardsManage')
                    }
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="FlashcardsManage">
                {() => (
                  <FlashcardManagerScreen
                    onBack={back}
                    onStudy={() => go('Flashcards')}
                  />
                )}
              </Stack.Screen>

              {/* Friends leaderboard screen */}
              <Stack.Screen name="Friends">
                {() => (
                  <FriendsScreen onBack={back} />
                )}
              </Stack.Screen>

              <Stack.Screen name="Garden">
                {() => <GardenScreen onBack={back} />}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {signedIn && !NO_BAR.has(current) ? (
        <BottomBar current={current} />
      ) : null}
    </View>
  );
}