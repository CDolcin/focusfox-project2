jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
import { parseHandMessage, HAND_PAGE } from '../src/services/HandCamera';
import { FrameProcessor } from '../src/services/gestureSource';

describe('hand camera bridge', () => {
  it('parses status and frame messages, ignores junk', () => {
    expect(parseHandMessage('{"type":"status","status":"ready"}')).toMatchObject({ status: 'ready' });
    expect(parseHandMessage('{"type":"frame","label":"Victory","score":0.9}')).toEqual({ type: 'frame', label: 'Victory', score: 0.9 });
    expect(parseHandMessage('{"type":"frame","label":null,"score":0}')).toEqual({ type: 'frame', label: null, score: 0 });
    expect(parseHandMessage('nope')).toBeNull();
    expect(parseHandMessage('{"type":"status","status":"weird"}')).toBeNull();
  });
  it('page loads the same model as Project I', () => {
    expect(HAND_PAGE).toContain('gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task');
  });
  it('frames from the page become a chord press after the debounce', () => {
    const ev: Array<{ type: string; chord?: string }> = [];
    const fp = new FrameProcessor(e => ev.push(e));
    for (let t = 0; t <= 300; t += 50) fp.frame('Victory', 0.9, t);
    expect(ev.find(e => e.type === 'press')?.chord).toBe('G');
  });
});
