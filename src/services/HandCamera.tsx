import React, { useEffect, useMemo, useRef } from 'react';
import {
  WebView,
  WebViewMessageEvent,
} from 'react-native-webview';

export type HandStatus = 'loading' | 'ready' | 'error';

export interface HandMessage {
  type: 'status';
  status: HandStatus;
  detail?: string;
}

export interface HandFrame {
  type: 'frame';
  label: string | null;
  score: number;
}

const MP_VERSION = '0.10.14';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

export const HAND_PAGE = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1,maximum-scale=1"
  >

  <style>
    html, body {
      margin: 0;
      height: 100%;
      background: #241f3d;
      overflow: hidden;
    }

    video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }

    #msg {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 12px;
      background: rgba(0, 0, 0, 0.65);
      text-align: center;
      color: white;
      font: 14px sans-serif;
      white-space: pre-line;
    }
  </style>
</head>

<body>
  <video id="v" autoplay playsinline muted></video>
  <div id="msg">Opening camera…</div>

  <script type="module">
    const video = document.getElementById('v');
    const msg = document.getElementById('msg');

    let stream = null;
    let recognizer = null;
    let stopped = false;
    let animationId = 0;
    let cameraReady = false;

    const assets = {
      runtime: 'loading',
      model: 'loading'
    };

    const post = (message) => {
      window.ReactNativeWebView?.postMessage(
        JSON.stringify(message)
      );
    };

    const loading = (detail) => {
      if (stopped) return;

      msg.style.display = 'block';
      msg.textContent = detail;

      post({
        type: 'status',
        status: 'loading',
        detail
      });
    };

    const assetProgress = () => {
      loading(
        'Step 1/3: Loading files' +
        ' · Runtime: ' + assets.runtime +
        ' · Model: ' + assets.model
      );
    };

    const cleanup = () => {
      stopped = true;
      cancelAnimationFrame(animationId);

      if (stream) {
        stream.getTracks().forEach(
          track => track.stop()
        );
        stream = null;
      }

      if (recognizer) {
        try {
          recognizer.close();
        } catch {}

        recognizer = null;
      }
    };

    window.addEventListener('pagehide', cleanup);

    async function withTimeout(
      promise,
      milliseconds,
      description
    ) {
      let timer;

      try {
        return await Promise.race([
          promise,
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error(description));
            }, milliseconds);
          })
        ]);
      } finally {
        clearTimeout(timer);
      }
    }

    async function loadModelBuffer() {
      let cache = null;

      try {
        if ('caches' in window) {
          cache = await caches.open(
            'focusfox-gesture-model-v1'
          );

          const saved = await cache.match('${MODEL_URL}');

          if (saved) {
            return new Uint8Array(
              await saved.arrayBuffer()
            );
          }
        }
      } catch {
        cache = null;
      }

      const controller = new AbortController();

      const timer = setTimeout(
        () => controller.abort(),
        45000
      );

      try {
        const response = await fetch('${MODEL_URL}', {
          cache: 'force-cache',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(
            'Model download failed: HTTP ' +
            response.status
          );
        }

        if (cache) {
          void cache.put(
            '${MODEL_URL}',
            response.clone()
          ).catch(() => undefined);
        }

        return new Uint8Array(
          await response.arrayBuffer()
        );
      } finally {
        clearTimeout(timer);
      }
    }

    async function openCamera() {
      const cameraStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });

      if (stopped) {
        cameraStream.getTracks().forEach(
          track => track.stop()
        );
        return;
      }

      stream = cameraStream;
      video.srcObject = stream;

      await video.play();
      cameraReady = true;

      // Do not overwrite the recogniser's progress message.
    }

    async function loadRecognizer() {
      assetProgress();

      const runtimePromise = withTimeout(
        import(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs'
        ),
        45000,
        'Runtime download timed out. Check your internet connection.'
      ).then(vision => {
        assets.runtime = 'ready';
        assetProgress();
        return vision;
      });

      const modelPromise = loadModelBuffer().then(buffer => {
        assets.model = 'ready';
        assetProgress();
        return buffer;
      });

      const [vision, modelBuffer] = await Promise.all([
        runtimePromise,
        modelPromise
      ]);

      if (stopped) return;

      loading('Step 2/3: Preparing runtime paths…');

      const fileset =
        await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm'
        );

      if (stopped) return;

      const create = (delegate) =>
        vision.GestureRecognizer.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetBuffer: modelBuffer.slice(),
              delegate
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.4,
            minHandPresenceConfidence: 0.4,
            minTrackingConfidence: 0.4
          }
        );

      loading(
        'Step 3/3: Loading WASM and starting recogniser (GPU)…'
      );

      let instance;

      try {
        instance = await create('GPU');
      } catch {
        if (stopped) return;

        loading(
          'Step 3/3: GPU unavailable — starting recogniser (CPU)…'
        );

        instance = await create('CPU');
      }

      if (stopped) {
        instance.close();
        return;
      }

      recognizer = instance;

      if (!cameraReady) {
        loading(
          'Recognition ready — waiting for camera permission or preview…'
        );
      }
    }

    async function start() {
      try {
        await Promise.all([
          openCamera(),
          loadRecognizer()
        ]);

        if (stopped || !recognizer) return;

        msg.style.display = 'none';

        post({
          type: 'status',
          status: 'ready',
          detail: 'Camera and hand recognition ready'
        });

        let lastVideoTime = -1;
        let lastProcessed = -Infinity;
        let lastSent = 0;
        let lastLabel = '__init__';

        const loop = () => {
          if (stopped) return;

          const now = performance.now();

          if (
            video.readyState >= 2 &&
            video.currentTime !== lastVideoTime &&
            now - lastProcessed >= 66
          ) {
            lastVideoTime = video.currentTime;
            lastProcessed = now;

            try {
              const result =
                recognizer.recognizeForVideo(video, now);

              const gesture = result.gestures?.[0]?.[0];

              const label = gesture
                ? gesture.categoryName
                : null;

              const score = gesture
                ? gesture.score
                : 0;

              if (
                label !== lastLabel ||
                now - lastSent >= 120
              ) {
                lastLabel = label;
                lastSent = now;

                post({
                  type: 'frame',
                  label,
                  score
                });
              }
            } catch {
              // Skip an individual failed frame.
            }
          }

          animationId = requestAnimationFrame(loop);
        };

        animationId = requestAnimationFrame(loop);
      } catch (error) {
        if (stopped) return;

        const detail =
          error?.name === 'NotAllowedError'
            ? 'Camera permission was denied.'
            : error?.name === 'AbortError'
              ? 'Model download timed out. Check your internet connection.'
              : 'Hand tracking could not start: ' +
                (error?.message || String(error));

        cleanup();

        msg.style.display = 'block';
        msg.textContent = detail;

        post({
          type: 'status',
          status: 'error',
          detail
        });
      }
    }

    void start();
  </script>
</body>
</html>
`;

export function parseHandMessage(
  data: string
): HandMessage | HandFrame | null {
  try {
    const message = JSON.parse(data);

    if (
      message?.type === 'status' &&
      ['loading', 'ready', 'error'].includes(
        message.status
      )
    ) {
      return {
        type: 'status',
        status: message.status,
        detail:
          typeof message.detail === 'string'
            ? message.detail
            : undefined,
      };
    }

    if (message?.type === 'frame') {
      const score = Number(message.score);

      return {
        type: 'frame',
        label:
          typeof message.label === 'string'
            ? message.label
            : null,
        score: Number.isFinite(score)
          ? Math.min(1, Math.max(0, score))
          : 0,
      };
    }
  } catch {
    // Ignore invalid messages.
  }

  return null;
}

export function HandCamera({
  onFrame,
  onStatus,
}: {
  onFrame: (
    label: string | null,
    score: number
  ) => void;
  onStatus: (
    status: HandStatus,
    detail?: string
  ) => void;
}) {
  const source = useMemo(
    () => ({
      html: HAND_PAGE,
      baseUrl: 'https://focusfox.app/',
    }),
    []
  );

  const callbacks = useRef({ onFrame, onStatus });

  useEffect(() => {
    callbacks.current = { onFrame, onStatus };
  }, [onFrame, onStatus]);

  const onMessage = (event: WebViewMessageEvent) => {
    const message = parseHandMessage(
      event.nativeEvent.data
    );

    if (!message) return;

    if (message.type === 'frame') {
      callbacks.current.onFrame(
        message.label,
        message.score
      );
    } else {
      callbacks.current.onStatus(
        message.status,
        message.detail
      );
    }
  };

  return (
    <WebView
      source={source}
      originWhitelist={['*']}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      cacheEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      onError={() =>
        callbacks.current.onStatus(
          'error',
          'The camera view could not load.'
        )
      }
      onHttpError={() =>
        callbacks.current.onStatus(
          'error',
          'A camera resource could not load.'
        )
      }
      style={{
        flex: 1,
        backgroundColor: 'transparent',
      }}
      androidLayerType="hardware"
      scrollEnabled={false}
      bounces={false}
    />
  );
}