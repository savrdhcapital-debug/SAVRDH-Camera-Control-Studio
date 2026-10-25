// Laptop webcam driver (getUserMedia). Lets you test live view, photo, video and library
// with real hardware before using the Canon R50. Media lives in memory for this session only.
import type { MediaItem } from "./camera";

type Entry = { item: MediaItem; url: string; thumb: string };

let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let recThumb = "";
let recMime = "";
let counter = 0;
const entries: Entry[] = [];

async function start() {
  if (stream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is unavailable. Open the app on localhost or HTTPS.");
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    throw new Error(
      e instanceof DOMException && e.name === "NotAllowedError"
        ? "Camera permission denied. Allow camera access in the browser address bar."
        : "Could not open the webcam. Another application may be using it.",
    );
  }
  video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
}

function stop() {
  if (recorder && recorder.state !== "inactive") recorder.stop();
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video = null;
}

function frame(): Promise<Blob> {
  if (!video || !video.videoWidth) return Promise.reject(new Error("no frame yet"));
  canvas ??= document.createElement("canvas");
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  const c = canvas;
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.8));
}

const nextName = (prefix: string, ext: string) => `${prefix}_${String(++counter).padStart(4, "0")}.${ext}`;

async function shutter() {
  const b = await frame();
  const name = nextName("WEBCAM", "JPG");
  const url = URL.createObjectURL(b);
  entries.push({ item: { id: name, path: name, name, kind: "photo", raw: false }, url, thumb: url });
}

async function recStart() {
  if (!stream) throw new Error("Live view is not active");
  if (typeof MediaRecorder === "undefined") throw new Error("Recording is not supported in this browser");
  recMime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  recorder = new MediaRecorder(stream, recMime ? { mimeType: recMime } : undefined);
  chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recThumb = URL.createObjectURL(await frame());
  recorder.start(1000);
}

function recStop(): Promise<void> {
  const r = recorder;
  if (!r || r.state === "inactive") return Promise.resolve();
  return new Promise((resolve) => {
    r.onstop = () => {
      const type = r.mimeType || recMime || "video/webm";
      const blob = new Blob(chunks, { type });
      const name = nextName("WEBCAM", type.includes("mp4") ? "MP4" : "WEBM");
      entries.push({ item: { id: name, path: name, name, kind: "video", raw: false }, url: URL.createObjectURL(blob), thumb: recThumb });
      recorder = null;
      resolve();
    };
    r.stop();
  });
}

export const webcam = {
  info: async () => ({ productname: "Laptop Webcam", serialnumber: "WEBCAM", firmwareversion: "browser" }),
  start,
  stop,
  frame,
  shutter,
  recStart,
  recStop,
  list: (): MediaItem[] => entries.map((e) => e.item).reverse(),
  url: (m: MediaItem, kind: "thumb" | "main") => {
    const e = entries.find((x) => x.item.id === m.id);
    return e ? (kind === "thumb" ? e.thumb : e.url) : "";
  },
  remove: (m: MediaItem) => {
    const i = entries.findIndex((x) => x.item.id === m.id);
    if (i >= 0) {
      URL.revokeObjectURL(entries[i].url);
      entries.splice(i, 1);
    }
  },
};
