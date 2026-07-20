import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer,
  type GestureRecognizerResult,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const GESTURE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

let visionPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
function vision() {
  if (!visionPromise) visionPromise = FilesetResolver.forVisionTasks(WASM_URL);
  return visionPromise;
}

export async function loadGestureRecognizer(): Promise<GestureRecognizer> {
  const v = await vision();
  return GestureRecognizer.createFromOptions(v, {
    baseOptions: { modelAssetPath: GESTURE_MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numHands: 2,
  });
}

export async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  const v = await vision();
  return FaceLandmarker.createFromOptions(v, {
    baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
  });
}

/**
 * Warm-start MediaPipe on landing so that when the user taps Enter we're
 * not serializing WASM fetch + two ~10MB model downloads with the camera
 * getUserMedia + Lucy signaling round-trip.
 *
 * Kicks off both loaders in parallel (they share FilesetResolver). Result
 * is memoized; startSession() awaits the same promise and gets an
 * already-resolved value on 2nd call.
 *
 * TODO (follow-up): self-host the .task models + wasm under /public/mediapipe
 * with `Cache-Control: immutable` — removes two third-party DNS/TLS handshakes.
 */
let warmPromise: Promise<{
  gesture: GestureRecognizer;
  face: FaceLandmarker;
}> | null = null;
export function warmVision() {
  if (warmPromise) return warmPromise;
  warmPromise = Promise.all([loadGestureRecognizer(), loadFaceLandmarker()])
    .then(([gesture, face]) => ({ gesture, face }))
    .catch((e) => {
      warmPromise = null; // allow retry
      throw e;
    });
  return warmPromise;
}

/** Consume the warm-start result exactly once — either returns the pre-loaded
 *  instance or triggers a fresh load. Safe to call even if warmVision() was
 *  never invoked. */
export function takeWarmedVision() {
  const p = warmPromise;
  warmPromise = null; // instances belong to caller now; don't reuse
  return p;
}

// MediaPipe hand connections (21 landmarks per hand).
export const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export type { GestureRecognizerResult, FaceLandmarkerResult };
