import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyValueStore } from '../core/sync';

/** AsyncStorage implementation of the storage contract used by LocalDb / OfflineQueue. */
export const asyncStorageKV: KeyValueStore = {
  get: k => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  remove: k => AsyncStorage.removeItem(k),
  async keysWithPrefix(prefix) { return (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(prefix)).sort(); },
  async multiGet(keys) { return (await AsyncStorage.multiGet(keys)).map(([, v]) => v); },
};
