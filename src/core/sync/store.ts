/** Minimal async key-value contract. AsyncStorage implements it in the app; MemoryKV in tests. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keysWithPrefix(prefix: string): Promise<string[]>;
  /** Optional batch read; falls back to repeated get(). */
  multiGet?(keys: string[]): Promise<Array<string | null>>;
}

export class MemoryKV implements KeyValueStore {
  readonly data = new Map<string, string>();
  async get(key: string) { return this.data.get(key) ?? null; }
  async set(key: string, value: string) { this.data.set(key, value); }
  async remove(key: string) { this.data.delete(key); }
  async keysWithPrefix(prefix: string) { return [...this.data.keys()].filter(k => k.startsWith(prefix)).sort(); }
}
