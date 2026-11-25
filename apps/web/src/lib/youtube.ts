"use client";

/* Minimal typing for the YouTube IFrame Player API (loaded on demand, no key needed). */
export interface YTPlayer { getDuration(): number; getCurrentTime(): number; destroy(): void }
/** YT.PlayerState.PLAYING */
export const YT_PLAYING = 1;
export interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    videoId: string;
    width?: string | number;
    height?: string | number;
    playerVars?: Record<string, string | number>;
    events?: { onReady?: (e: { target: YTPlayer }) => void; onStateChange?: (e: { target: YTPlayer; data: number }) => void };
  }) => YTPlayer;
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YTNamespace> | null = null;
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error("YouTube API failed to load"));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}
