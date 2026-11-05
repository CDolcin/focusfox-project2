import React, { useMemo } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { Flower, FlowerSpecies, SyncRecord } from '../core/models';
import { placeFlowers, reservedTiles } from '../core/focus/gardenLayout';

/**
 * The garden as an illustrated isometric scene (original vector art drawn with react-native-svg, no images needed):
 * grass tiles with soil flower beds, a stone wall with a red flag and bunting, a stone well and a lily pond.
 * One flower = one plant. Positions come from `placeFlowers` so the garden looks identical on every phone.
 */

const STEM = '#3E8E41';
const LEAF = '#58B05A';

/** A single plant in a 10-wide, ~14-tall unit box with its base at (0,0). Drawn in unit space and scaled by the caller. */
export function Plant({ species }: { species: FlowerSpecies }) {
  if (species === 'lotus') {
    return (
      <G>
        <Ellipse cx={0} cy={0.2} rx={5.4} ry={2.2} fill="#5BBF6A" stroke="#3F9A52" strokeWidth={0.3} />
        <Path d="M0 0.2 L 4.2 -1.4" stroke="#E8F6FF" strokeWidth={0.5} />
        {[-52, -26, 26, 52, 0].map((a, i) => (
          <G key={i} transform={`translate(0 -0.4) rotate(${a})`}>
            <Path d="M0 0 C -1.7 -2 -1.5 -4.8 0 -6.4 C 1.5 -4.8 1.7 -2 0 0 Z" fill={a === 0 ? '#F48FB1' : '#F8BBD0'} stroke="#E57AA0" strokeWidth={0.3} />
          </G>
        ))}
        <Circle cx={0} cy={-1} r={0.8} fill="#FFD54F" />
      </G>
    );
  }
  const sun = species === 'sunflower';
  return (
    <G>
      <Path d="M0 0 C 0.5 -4 -0.5 -8 0 -10.2" stroke={STEM} strokeWidth={sun ? 1.2 : 0.9} fill="none" strokeLinecap="round" />
      <Path d="M0 -2.6 C -3.4 -3 -5 -5.4 -5 -5.4 C -2.2 -6 0 -4.4 0 -2.6 Z" fill={LEAF} />
      <Path d="M0 -4.4 C 3.4 -4.8 5 -7.2 5 -7.2 C 2.2 -7.8 0 -6.2 0 -4.4 Z" fill={LEAF} />
      <G transform="translate(0 -10.2)">
        {species === 'daisy' && (
          <G>
            {Array.from({ length: 10 }, (_, k) => <Ellipse key={k} cx={0} cy={-2.6} rx={0.95} ry={2.6} fill="#FFFFFF" stroke="#D6D9E6" strokeWidth={0.18} transform={`rotate(${k * 36})`} />)}
            <Circle r={1.6} fill="#FFC52E" /><Circle r={0.7} fill="#EF9A0B" />
          </G>
        )}
        {species === 'sunflower' && (
          <G transform="scale(1.1)">
            {Array.from({ length: 14 }, (_, k) => <Ellipse key={k} cx={0} cy={-3.7} rx={1} ry={2.6} fill={k % 2 ? '#FFB300' : '#FFCA28'} transform={`rotate(${k * 25.7})`} />)}
            <Circle r={2.7} fill="#7A4A25" /><Circle r={1.8} fill="#4E2E1A" />
            {[[-0.8, -0.6], [0.7, -0.4], [0, 0.8], [-0.4, 0.1], [0.5, 0.5]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={0.22} fill="#8D5B2F" />)}
          </G>
        )}
        {species === 'tulip' && (
          <G>
            <Path d="M-3 1 C -3.9 -2.6 -2.7 -5 -1.4 -5.8 L 0 -1 Z" fill="#C62828" />
            <Path d="M3 1 C 3.9 -2.6 2.7 -5 1.4 -5.8 L 0 -1 Z" fill="#C62828" />
            <Path d="M-2.7 1 C -3.1 -2.2 -1.9 -5.2 0 -6.2 C 1.9 -5.2 3.1 -2.2 2.7 1 C 1.3 2 -1.3 2 -2.7 1 Z" fill="#EF5350" />
            <Path d="M0 -5.4 C -0.6 -3 -0.6 -1 0 0.6" stroke="#FF8A80" strokeWidth={0.35} fill="none" />
          </G>
        )}
        {species === 'poppy' && (
          <G>
            {[0, 90, 180, 270].map(a => <Ellipse key={a} cx={0} cy={-2.3} rx={2.5} ry={2.5} fill="#E53935" stroke="#C62828" strokeWidth={0.2} transform={`rotate(${a + 45})`} />)}
            <Circle r={1.1} fill="#3E2723" />
            {Array.from({ length: 8 }, (_, k) => <Circle key={k} cx={Math.cos((k * Math.PI) / 4) * 1.6} cy={Math.sin((k * Math.PI) / 4) * 1.6} r={0.2} fill="#3E2723" />)}
          </G>
        )}
        {species === 'rose' && (
          <G>
            <Path d="M-2.2 3 L 0 0.5 L 2.2 3 Z" fill={LEAF} />
            <Circle r={3.5} fill="#C2185B" /><Circle r={2.7} fill="#E91E63" /><Circle r={1.9} fill="#F06292" />
            <Path d="M0 0 C 1 -1 2 0 1 1 C 0 2 -2 1 -2 -0.5 C -2 -2 0 -2.7 1.8 -1.6" stroke="#AD1457" strokeWidth={0.35} fill="none" />
          </G>
        )}
      </G>
    </G>
  );
}

const hash2 = (a: number, b: number) => { let h = (a * 73856093) ^ (b * 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

function Bunting({ x1, y1, x2, y2, sag, seed }: { x1: number; y1: number; x2: number; y2: number; sag: number; seed: number }) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag * 2;
  const pal = ['#E53935', '#FFB300', '#3F8EE8', '#43A047', '#EC407A'];
  const flags = [];
  for (let i = 1; i < 11; i++) {
    const t = i / 11, u = 1 - t;
    const x = u * u * x1 + 2 * u * t * mx + t * t * x2, y = u * u * y1 + 2 * u * t * my + t * t * y2;
    flags.push(<Polygon key={i} points={`${x - 4},${y} ${x + 4},${y} ${x},${y + 9}`} fill={pal[(i + seed) % pal.length]} />);
  }
  return <G><Path d={`M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} stroke="#6D4C2F" strokeWidth={1.2} fill="none" />{flags}</G>;
}

export function GardenScene({ flowers, width }: { flowers: Array<SyncRecord<Flower>>; width: number }) {
  const { size: N, placed } = useMemo(() => placeFlowers(flowers), [flowers]);
  const tw = width / N, th = tw * 0.52, wallH = tw * 0.46, depth = th * 0.4;
  const ox = width / 2, oy = wallH + 44;
  const height = oy + N * th + depth + 8;
  const center = (r: number, c: number) => ({ x: ox + ((c - r) * tw) / 2, y: oy + ((c + r) * th) / 2 + th / 2 });
  const byTile = new Map<string, Array<(typeof placed)[number]>>();
  placed.forEach(p => { const k = `${p.r},${p.c}`; byTile.set(k, [...(byTile.get(k) ?? []), p]); });
  const [well, pond] = reservedTiles(N);

  const tiles: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) tiles.push({ r, c });
  tiles.sort((a, b) => a.r + a.c - (b.r + b.c) || a.r - b.r);

  const diamond = (x: number, y: number, k = 1) => `${x},${y - (th / 2) * k} ${x + (tw / 2) * k},${y} ${x},${y + (th / 2) * k} ${x - (tw / 2) * k},${y}`;

  // ---- walls on the two back edges
  const walls: React.ReactNode[] = [];
  for (let c = 0; c < N; c++) {
    const { x, y } = center(0, c); const ax = x, ay = y - th / 2, bx = x + tw / 2, by = y;
    walls.push(<G key={`wr${c}`}><Polygon points={`${ax},${ay} ${bx},${by} ${bx},${by - wallH} ${ax},${ay - wallH}`} fill={c % 2 ? '#C7C1B5' : '#CFC9BD'} stroke="#9E978B" strokeWidth={0.8} />
      <Line x1={ax} y1={ay - wallH * 0.5} x2={bx} y2={by - wallH * 0.5} stroke="#9E978B" strokeWidth={0.8} />
      <Line x1={(ax + bx) / 2} y1={(ay + by) / 2 - wallH} x2={(ax + bx) / 2} y2={(ay + by) / 2 - wallH * 0.5} stroke="#9E978B" strokeWidth={0.8} />
      <Line x1={ax + (bx - ax) * 0.25} y1={ay + (by - ay) * 0.25 - wallH * 0.5} x2={ax + (bx - ax) * 0.25} y2={ay + (by - ay) * 0.25} stroke="#9E978B" strokeWidth={0.8} />
      <Polygon points={`${ax},${ay - wallH} ${bx},${by - wallH} ${bx},${by - wallH - 4} ${ax},${ay - wallH - 4}`} fill="#E3DED3" stroke="#9E978B" strokeWidth={0.6} /></G>);
  }
  for (let r = 0; r < N; r++) {
    const { x, y } = center(r, 0); const ax = x, ay = y - th / 2, bx = x - tw / 2, by = y;
    walls.push(<G key={`wl${r}`}><Polygon points={`${ax},${ay} ${bx},${by} ${bx},${by - wallH} ${ax},${ay - wallH}`} fill={r % 2 ? '#B9B3A7' : '#C1BBAF'} stroke="#9E978B" strokeWidth={0.8} />
      <Line x1={ax} y1={ay - wallH * 0.5} x2={bx} y2={by - wallH * 0.5} stroke="#9E978B" strokeWidth={0.8} />
      <Line x1={(ax + bx) / 2} y1={(ay + by) / 2 - wallH} x2={(ax + bx) / 2} y2={(ay + by) / 2 - wallH * 0.5} stroke="#9E978B" strokeWidth={0.8} />
      <Polygon points={`${ax},${ay - wallH} ${bx},${by - wallH} ${bx},${by - wallH - 4} ${ax},${ay - wallH - 4}`} fill="#DAD5CA" stroke="#9E978B" strokeWidth={0.6} /></G>);
  }
  const corner = center(0, 0); const poleTop = { x: corner.x, y: corner.y - th / 2 - wallH - 34 };
  const rEnd = center(0, N - 1), lEnd = center(N - 1, 0);
  const rPost = { x: rEnd.x + tw / 2, y: rEnd.y - wallH }, lPost = { x: lEnd.x - tw / 2, y: lEnd.y - wallH };

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} accessibilityLabel={`Garden with ${placed.length} flowers`}>
      <Rect x={0} y={0} width={width} height={height} fill="#DFF2FB" />
      <Ellipse cx={width * 0.2} cy={height * 0.12} rx={width * 0.1} ry={height * 0.03} fill="#FFFFFF" opacity={0.8} />
      <Ellipse cx={width * 0.8} cy={height * 0.2} rx={width * 0.12} ry={height * 0.035} fill="#FFFFFF" opacity={0.7} />
      {walls}
      <Rect x={rPost.x - 2} y={rPost.y - 14} width={4} height={14 + wallH * 0.2} fill="#7B5836" />
      <Rect x={lPost.x - 2} y={lPost.y - 14} width={4} height={14 + wallH * 0.2} fill="#7B5836" />
      <Rect x={poleTop.x - 1.2} y={poleTop.y} width={2.4} height={34} fill="#6D4C2F" />
      <Polygon points={`${poleTop.x + 1},${poleTop.y + 1} ${poleTop.x + 24},${poleTop.y + 7} ${poleTop.x + 1},${poleTop.y + 14}`} fill="#E53935" stroke="#B71C1C" strokeWidth={0.6} />
      <Bunting x1={poleTop.x} y1={poleTop.y + 4} x2={rPost.x} y2={rPost.y - 14} sag={10} seed={0} />
      <Bunting x1={poleTop.x} y1={poleTop.y + 4} x2={lPost.x} y2={lPost.y - 14} sag={10} seed={2} />

      {tiles.map(({ r, c }) => {
        const { x, y } = center(r, c); const here = byTile.get(`${r},${c}`) ?? [];
        const shade = (r + c) % 2 ? '#7DC76C' : '#72BE62';
        const isPond = r === pond.r && c === pond.c, isWell = r === well.r && c === well.c;
        const tufts = !here.length && !isPond && !isWell && hash2(r, c) > 0.55;
        return (
          <G key={`${r},${c}`}>
            {r === N - 1 && <Polygon points={`${x - tw / 2},${y} ${x},${y + th / 2} ${x},${y + th / 2 + depth} ${x - tw / 2},${y + depth}`} fill="#8D6B46" />}
            {c === N - 1 && <Polygon points={`${x},${y + th / 2} ${x + tw / 2},${y} ${x + tw / 2},${y + depth} ${x},${y + th / 2 + depth}`} fill="#775935" />}
            <Polygon points={diamond(x, y)} fill={shade} stroke="#5FA853" strokeWidth={0.6} />
            {tufts && [0, 1, 2].map(i => { const tx = x + (hash2(r + i, c) - 0.5) * tw * 0.5, ty = y + (hash2(r, c + i) - 0.5) * th * 0.4; return <Path key={i} d={`M${tx} ${ty} l-1.5 -4 M${tx} ${ty} l0 -5 M${tx} ${ty} l1.5 -4`} stroke="#4C9A46" strokeWidth={0.9} strokeLinecap="round" />; })}
            {here.length > 0 && (
              <G>
                <Polygon points={diamond(x, y + 1, 0.8)} fill="#7A5A3B" stroke="#5B4029" strokeWidth={1} />
                <Polygon points={diamond(x, y, 0.8)} fill="#8C6A47" stroke="#B08A5E" strokeWidth={1} />
              </G>
            )}
            {isPond && (
              <G>
                <Polygon points={diamond(x, y, 0.92)} fill="#B9B3A7" stroke="#8F887C" strokeWidth={1} />
                <Ellipse cx={x} cy={y} rx={tw * 0.34} ry={th * 0.34} fill="#58B4E6" stroke="#3E97CC" strokeWidth={1} />
                <Ellipse cx={x - tw * 0.1} cy={y - th * 0.08} rx={tw * 0.1} ry={th * 0.06} fill="#9BD7F5" opacity={0.8} />
                {[[-0.12, 0.05, 0.09], [0.12, -0.07, 0.07]].map(([dx, dy, rr], i) => <G key={i}><Ellipse cx={x + dx * tw} cy={y + dy * th * 2} rx={rr * tw} ry={rr * tw * 0.5} fill="#5BBF6A" stroke="#3F9A52" strokeWidth={0.5} /></G>)}
                <G transform={`translate(${x + tw * 0.12} ${y - th * 0.14}) scale(${tw / 26})`}><Plant species="lotus" /></G>
              </G>
            )}
          </G>
        );
      })}

      {tiles.map(({ r, c }) => {
        const { x, y } = center(r, c);
        if (r === well.r && c === well.c) {
          const w = tw * 0.46;
          return (
            <G key={`well`}>
              <Ellipse cx={x} cy={y + th * 0.12} rx={w * 0.62} ry={w * 0.3} fill="#9E978B" />
              <Rect x={x - w * 0.6} y={y - w * 0.35} width={w * 1.2} height={w * 0.5} fill="#C9C3B8" />
              <Ellipse cx={x} cy={y + w * 0.15} rx={w * 0.6} ry={w * 0.3} fill="#C9C3B8" />
              <Ellipse cx={x} cy={y - w * 0.35} rx={w * 0.6} ry={w * 0.3} fill="#DAD5CA" stroke="#9E978B" strokeWidth={0.8} />
              <Ellipse cx={x} cy={y - w * 0.35} rx={w * 0.42} ry={w * 0.2} fill="#2E6E9E" />
              <Rect x={x - w * 0.62} y={y - w * 1.25} width={3} height={w * 0.95} fill="#7B5836" />
              <Rect x={x + w * 0.62 - 3} y={y - w * 1.25} width={3} height={w * 0.95} fill="#7B5836" />
              <Polygon points={`${x - w * 0.85},${y - w * 1.2} ${x},${y - w * 1.85} ${x + w * 0.85},${y - w * 1.2}`} fill="#3F6FB5" stroke="#2C4F86" strokeWidth={0.8} />
              <Polygon points={`${x},${y - w * 1.85} ${x + w * 0.85},${y - w * 1.2} ${x},${y - w * 1.05}`} fill="#315C9B" />
            </G>
          );
        }
        const here = byTile.get(`${r},${c}`); if (!here) return null;
        return (
          <G key={`p${r},${c}`}>
            {here.map(p => {
              const dx = p.slot === 0 ? 0 : (p.slot % 2 ? -1 : 1) * tw * 0.2, dy = p.slot === 0 ? 0 : th * 0.1 * p.slot;
              const s = (tw / 21) * (0.9 + p.hue * 0.16) * (p.slot ? 0.8 : 1);
              return <G key={p.flower.id} transform={`translate(${x + dx} ${y + th * 0.12 + dy}) scale(${p.hue > 0.5 ? s : -s} ${s})`}><Plant species={p.flower.species} /></G>;
            })}
          </G>
        );
      })}
    </Svg>
  );
}

/** Small drawing of one flower species (legend, toasts). */
export function PlantIcon({ species, size = 36 }: { species: FlowerSpecies; size?: number }) {
  return <Svg width={size} height={size * 1.2} viewBox="-8 -18 16 21"><Plant species={species} /></Svg>;
}
