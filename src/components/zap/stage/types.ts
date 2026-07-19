import type { RefCallback } from "react";
import type { ConnectionState, Preset, PromptState } from "@/lib/zap/types";
import type { TemplateKey } from "@/lib/zap/prompt-templates";

export type LiveGesture = { label: string | null; score: number; hold: number };

export interface StageViewProps {
  // connection / status
  connState: ConnectionState;
  transport: "webrtc" | null;
  error: string | null;
  perfMode: boolean;
  facePresent: boolean;
  reactiveOn: boolean;
  pendingUpload: number;
  remainingMs: number | null;
  recording: boolean;
  hudVisible: boolean;
  setHudVisible: (fn: (v: boolean) => boolean) => void;

  // media
  attachInputVideo: RefCallback<HTMLVideoElement>;
  attachOutputVideo: RefCallback<HTMLVideoElement>;
  overlayRef: RefCallback<HTMLCanvasElement> | React.RefObject<HTMLCanvasElement | null>;
  qrDataUrl: string | null;

  // prompt state
  prompt: string;
  setPrompt: (v: string) => void;
  enhance: boolean;
  setEnhance: (v: boolean) => void;
  applied: PromptState | null;
  prevApplied: PromptState | null;
  refImage: { dataUri: string; path?: string } | null;
  liveGesture: LiveGesture;

  // actions
  applyPrompt: (text: string, source: "text") => void;
  undo: () => void;
  clearPrompt: () => void;
  toggleRecord: () => void;
  stopSession: (reason?: "manual" | "timeout") => void;
  onRefUpload: (file: File) => void;
  clearRefImage: () => void;
  savePreset: () => void;
  flipCamera: () => void;
  flipping: boolean;
  facingMode: "user" | "environment";


  // presets
  presets: Preset[];
  applyPreset: (p: Preset) => void;
  openTemplate: (key: TemplateKey, name: string) => void;

  // download
  download: { url: string; filename: string } | null;

  // depth (webgpu)
  depthOn: boolean;
  depthLoading: boolean;
  depthAvailable: boolean;
  depthProgress: number;
  toggleDepth: () => void;
  depthStream: MediaStream | null;

  // which stream is currently being sent to Lucy — for on-screen confirmation
  activeSource: "raw" | "composite" | "depth";

  // baked-landmark compositor toggle (character_swap / gesture_fx only)
  bakeLandmarks: boolean;
  toggleBakeLandmarks: () => void;
  landmarksAvailable: boolean;

}
