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
