import React, { useMemo, useRef } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

/**
 * Real hand-gesture recognition that works in Expo Go and in development builds.
 *
 * Expo Go cannot load native MediaPipe/TFLite modules, so the same MediaPipe GestureRecognizer model that Project I used
 * runs inside a WebView (MediaPipe Tasks Vision, WASM, on-device; no video leaves the phone). The page shows the front camera
 * and posts the recognised gesture label for each frame back to React Native, where `FrameProcessor` debounces it into chord
 * press events (same mapping as Project I: Pointing_Up C, Victory G, ILoveYou Am, Open_Palm F, Thumb_Up D, Closed_Fist Em).
 * Like Project I, the ~8 MB model (and the MediaPipe runtime) is downloaded the first time and then cached by the WebView.
 */
export type HandStatus = 'loading' | 'ready' | 'error';
export interface HandMessage { type: 'status'; status: HandStatus; detail?: string }
export interface HandFrame { type: 'frame'; label: string | null; score: number }

const MP_VERSION = '0.10.14';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

export const HAND_PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#241f3d;overflow:hidden}video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
#msg{position:absolute;left:0;right:0;top:40%;text-align:center;color:#fff;font:15px sans-serif;padding:0 24px}</style></head>
<body><video id="v" autoplay playsinline muted></video><div id="msg">Loading hand tracking…</div>
<script type="module">
const post = (o) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(o));
const msg = document.getElementById('msg');
const fail = (d) => { msg.textContent = d; post({ type: 'status', status: 'error', detail: d }); };
(async () => {
  try {
    post({ type: 'status', status: 'loading' });
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs');
    const fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm');
    const make = (delegate) => vision.GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '${MODEL_URL}', delegate }, runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.4, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4 });
    let rec; try { rec = await make('GPU'); } catch (e) { rec = await make('CPU'); }
    const video = document.getElementById('v');
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    await video.play();
    msg.style.display = 'none';
    post({ type: 'status', status: 'ready' });
    let lastT = -1, lastSent = 0, lastLabel = '__init__';
    const loop = () => {
      if (video.readyState >= 2 && video.currentTime !== lastT) {
        lastT = video.currentTime;
        const now = performance.now();
        try {
          const r = rec.recognizeForVideo(video, now);
          const g = r.gestures && r.gestures[0] && r.gestures[0][0];
          const label = g ? g.categoryName : null, score = g ? g.score : 0;
          if (label !== lastLabel || now - lastSent > 120) { lastLabel = label; lastSent = now; post({ type: 'frame', label, score }); }
        } catch (e) { /* skip a bad frame */ }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } catch (e) {
    fail((e && e.name === 'NotAllowedError') ? 'Camera permission was denied.' : 'Hand tracking could not start (' + (e && e.message ? e.message : e) + '). Check your internet connection for the first load.');
  }
})();
</script></body></html>`;

export function parseHandMessage(data: string): HandMessage | HandFrame | null {
  try {
    const m = JSON.parse(data);
    if (m?.type === 'status' && ['loading', 'ready', 'error'].includes(m.status)) return m;
    if (m?.type === 'frame') return { type: 'frame', label: typeof m.label === 'string' ? m.label : null, score: Number(m.score) || 0 };
  } catch { /* ignore */ }
  return null;
}

export function HandCamera({ onFrame, onStatus }: { onFrame: (label: string | null, score: number) => void; onStatus: (s: HandStatus, detail?: string) => void }) {
  const source = useMemo(() => ({ html: HAND_PAGE, baseUrl: 'https://focusfox.app/' }), []);
  const cb = useRef({ onFrame, onStatus }); cb.current = { onFrame, onStatus };
  const onMessage = (e: WebViewMessageEvent) => {
    const m = parseHandMessage(e.nativeEvent.data); if (!m) return;
    if (m.type === 'frame') cb.current.onFrame(m.label, m.score); else cb.current.onStatus(m.status, m.detail);
  };
  return (
    <WebView
      source={source} originWhitelist={['*']} onMessage={onMessage} javaScriptEnabled domStorageEnabled
      allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} mediaCapturePermissionGrantType="grant"
      onError={() => cb.current.onStatus('error', 'The camera view could not load.')}
      onHttpError={() => cb.current.onStatus('error', 'Could not download the hand-tracking model.')}
      style={{ flex: 1, backgroundColor: 'transparent' }} androidLayerType="hardware" scrollEnabled={false} bounces={false}
    />
  );
}
