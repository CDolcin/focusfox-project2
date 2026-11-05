import React from 'react';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: () => () => undefined, fetch: async () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock('expo-notifications', () => { throw new Error('native module missing'); });   // simulates Expo Go without the module
jest.mock('expo-audio', () => ({ createAudioPlayer: () => ({ play: () => undefined, seekTo: async () => undefined, remove: () => undefined }), setAudioModeAsync: async () => undefined, useAudioRecorder: () => ({ prepareToRecordAsync: async () => undefined, record: () => undefined, stop: async () => undefined, uri: null }), RecordingPresets: { HIGH_QUALITY: {} }, requestRecordingPermissionsAsync: async () => ({ granted: false }) }));
jest.mock('expo-camera', () => ({ CameraView: 'CameraView', useCameraPermissions: () => [{ granted: false, canAskAgain: false }, async () => undefined] }));
jest.mock('react-native-svg', () => { const R = require('react'); const mk = (n: string) => (p: object) => R.createElement(n, p); return { __esModule: true, default: mk('Svg'), Circle: mk('Circle'), Line: mk('Line'), Rect: mk('Rect'), Ellipse: mk('Ellipse'), G: mk('G'), Path: mk('Path'), Polygon: mk('Polygon') }; });
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));

const text = (r: ReactTestRenderer) => JSON.stringify(r.toJSON());
const flush = async () => { await act(async () => { await Promise.resolve(); await new Promise(res => setImmediate(res)); }); };

describe('UI smoke test (Project I layout)', () => {
  it('shows the splash, then Login; Guest Mode opens the Home dashboard with the 5 Project I tabs', async () => {
    const { AppProvider } = require('../src/app/AppContext'); const Navigation = require('../src/app/Navigation').default;
    let r!: ReactTestRenderer;
    await act(async () => { r = create(<AppProvider><Navigation /></AppProvider>); });
    expect(text(r)).toContain('Study smarter. Stay focused.');
    await act(async () => { await new Promise(res => setTimeout(res, 1800)); }); await flush();
    expect(text(r)).toContain('Welcome back');
    expect(text(r)).toContain('Guest Mode');
    const guest = r.root.findAll((n: ReactTestInstance) => n.props.title === 'Guest Mode' && typeof n.props.onPress === 'function')[0];
    await act(async () => { await guest.props.onPress(); }); await flush(); await flush();
    const t = text(r);
    expect(t).toContain('Today at a glance');
    expect(t).toContain('Priority tasks');
    expect(t).toContain('Quick actions');
    for (const tab of ['Home', 'Tasks', 'Focus', 'Music', 'Profile']) expect(t).toContain(tab);
    await act(async () => { r.unmount(); });
  }, 30000);

  it('every screen renders without throwing', async () => {
    const { AppProvider, useApp } = require('../src/app/AppContext');
    const S = { ...require('../src/screens/TasksScreens'), ...require('../src/screens/FlashcardsScreens'), ...require('../src/screens/FocusScreens'), ...require('../src/screens/ProgressGarden'), ...require('../src/screens/MusicScreens'), ...require('../src/screens/ProfileScreens'), Notes: require('../src/screens/NotesScreen').default };
    const noop = () => undefined;
    const screens: Array<[string, React.ReactElement]> = [
      ['Tasks', <S.TasksScreen onAdd={noop} onEdit={noop} onBack={noop} />], ['AddTask', <S.AddTaskScreen onDone={noop} />], ['Notes', <S.Notes onBack={noop} />],
      ['Flashcards', <S.FlashcardsScreen onBack={noop} onManage={noop} />], ['Manage', <S.FlashcardManagerScreen onBack={noop} onStudy={noop} />],
      ['Focus', <S.FocusScreen onBack={noop} onHistory={noop} onGarden={noop} />], ['History', <S.FocusHistoryScreen onBack={noop} />],
      ['Progress', <S.ProgressScreen onBack={noop} onGarden={noop} />], ['Garden', <S.GardenScreen onBack={noop} />],
      ['Instruments', <S.InstrumentsScreen onSelect={noop} onSaved={noop} />], ['Guitar', <S.GesturesScreen instrument="Guitar" onCamera={noop} onPractice={noop} onBack={noop} />],
      ['Ukulele', <S.GesturesScreen instrument="Ukulele" onCamera={noop} onPractice={noop} onBack={noop} />], ['Piano', <S.GesturesScreen instrument="Piano" onCamera={noop} onPractice={noop} onBack={noop} />],
      ['Camera', <S.PerformanceCameraScreen instrument="Guitar" onFinished={noop} onBack={noop} />], ['Playback', <S.PlaybackScreen onBack={noop} />], ['Practice', <S.PracticeScreen instrument="Guitar" onBack={noop} />],
      ['Profile', <S.ProfileScreen go={noop} onSignedOut={noop} />], ['EditProfile', <S.EditProfileScreen onBack={noop} />], ['Study', <S.StudyPreferencesScreen onBack={noop} />],
      ['Notifications', <S.NotificationsScreen onBack={noop} />], ['Settings', <S.AppSettingsScreen onBack={noop} />], ['Sync', <S.SyncAccountScreen onBack={noop} />],
    ];
    const Gate = ({ children }: { children: React.ReactNode }) => { const { user, auth } = useApp(); React.useEffect(() => { if (!user) void auth.continueAsGuest(); }, [user, auth]); return user ? <>{children}</> : null; };
    for (const [name, el] of screens) {
      let r!: ReactTestRenderer;
      await act(async () => { r = create(<AppProvider><Gate>{el}</Gate></AppProvider>); });
      await flush(); await flush();
      expect({ name, rendered: text(r).length > 20 }).toEqual({ name, rendered: true });
      await act(async () => { r.unmount(); });
    }
  }, 60000);
});
