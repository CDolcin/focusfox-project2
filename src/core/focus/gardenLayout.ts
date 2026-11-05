import { Flower, SyncRecord } from '../models';
import { layout } from './garden';

/** Garden grid: N x N tiles, grows with the number of flowers (never random, never paid for). */
export const MIN_GRID = 5;
export const MAX_GRID = 9;

export interface Tile { r: number; c: number }
export interface Placed<T> { flower: T; r: number; c: number; slot: number; hue: number }

/** Tiles reserved for scenery (well and pond); flowers never take them. */
export function reservedTiles(n: number): Tile[] { return [{ r: 1, c: 1 }, { r: n - 1, c: n - 1 }]; }
const isReserved = (n: number, r: number, c: number) => reservedTiles(n).some(t => t.r === r && t.c === c);

export function capacity(n: number): number { return n * n - reservedTiles(n).length; }
export function gridSizeFor(flowerCount: number): number {
  for (let n = MIN_GRID; n < MAX_GRID; n++) if (flowerCount <= capacity(n)) return n;
  return MAX_GRID;
}

/** Planting order: from the middle of the lawn outwards, ties broken by row then column. */
export function plantingOrder(n: number): Tile[] {
  const mid = (n - 1) / 2;
  const tiles: Tile[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!isReserved(n, r, c)) tiles.push({ r, c });
  return tiles.sort((a, b) => Math.hypot(a.r - mid, a.c - mid) - Math.hypot(b.r - mid, b.c - mid) || a.r - b.r || a.c - b.c);
}

const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/**
 * Deterministic placement: flower k (oldest first) goes on tile k of the planting order; once every tile is used
 * the garden stays at its largest size and tiles get a second/third plant (`slot`). `hue` is a per-flower 0..1 value from
 * the flower id, used only for small visual variety, so every phone draws the same garden.
 */
export function placeFlowers<T extends SyncRecord<Flower>>(flowers: T[]): { size: number; placed: Array<Placed<T>> } {
  const sorted = layout(flowers);
  const size = gridSizeFor(sorted.length);
  const order = plantingOrder(size);
  return { size, placed: sorted.map((flower, i) => ({ flower, r: order[i % order.length].r, c: order[i % order.length].c, slot: Math.floor(i / order.length), hue: (hashStr(flower.id) % 1000) / 1000 })) };
}
