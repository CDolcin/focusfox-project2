import { capacity, gridSizeFor, placeFlowers, plantingOrder, reservedTiles, MAX_GRID, MIN_GRID } from '../src/core/focus/gardenLayout';
import { Flower, SyncRecord } from '../src/core/models';

const fl = (id: string, plantedAtMs: number): SyncRecord<Flower> => ({ id, species: 'daisy', source: 'focus', sourceId: id, plantedAtMs, dayKey: '2026-01-01', hlc: 'x', deleted: false, updatedBy: 'd' });

describe('garden layout', () => {
  it('starts small and grows with the number of flowers', () => {
    expect(gridSizeFor(0)).toBe(MIN_GRID);
    expect(gridSizeFor(capacity(MIN_GRID))).toBe(MIN_GRID);
    expect(gridSizeFor(capacity(MIN_GRID) + 1)).toBe(MIN_GRID + 1);
    expect(gridSizeFor(10_000)).toBe(MAX_GRID);
  });
  it('never plants on scenery tiles and never reuses a tile before the lawn is full', () => {
    const flowers = Array.from({ length: 20 }, (_, i) => fl(`f${i}`, i));
    const { size, placed } = placeFlowers(flowers);
    const res = reservedTiles(size);
    expect(placed.some(p => res.some(t => t.r === p.r && t.c === p.c))).toBe(false);
    expect(new Set(placed.map(p => `${p.r},${p.c}`)).size).toBe(20);
    expect(plantingOrder(size)).toHaveLength(capacity(size));
  });
  it('is identical on every device: same flowers in any input order give the same garden', () => {
    const a = [fl('b', 2), fl('a', 1), fl('c', 3)]; const b = [fl('c', 3), fl('b', 2), fl('a', 1)];
    expect(placeFlowers(a).placed.map(p => [p.flower.id, p.r, p.c, p.hue])).toEqual(placeFlowers(b).placed.map(p => [p.flower.id, p.r, p.c, p.hue]));
  });
  it('stacks a second plant on a tile only after the largest garden is full', () => {
    const n = capacity(MAX_GRID);
    const { placed } = placeFlowers(Array.from({ length: n + 2 }, (_, i) => fl(`f${i}`, i)));
    expect(placed.filter(p => p.slot === 1)).toHaveLength(2);
    expect(placed.slice(0, n).every(p => p.slot === 0)).toBe(true);
  });
});
