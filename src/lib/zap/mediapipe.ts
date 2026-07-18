import {
  FilesetResolver,
  GestureRecognizer,
  type GestureRecognizerResult,
} from "@mediapipe/tasks-vision";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const GESTURE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task";

export async function loadGestureRecognizer(): Promise<GestureRecognizer> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  return GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath: GESTURE_MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numHands: 2,
  });
}

export type { GestureRecognizerResult };
