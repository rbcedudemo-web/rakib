"use client";

import { useEffect, useRef } from "react";

/* Minimal typing for the YouTube IFrame Player API (loaded on demand, no key needed). */
interface YTPlayer { getDuration(): number; destroy(): void }
interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    videoId: string;
    width?: string | number;
    height?: string | number;
    playerVars?: Record<string, string | number>;
    events?: { onReady?: (e: { target: YTPlayer }) => void; onStateChange?: (e: { target: YTPlayer }) => void };
  }) => YTPlayer;
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
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

/** Shows the chosen video and reports its length so the admin does not have to type it. */
export function VideoPreview({
  youTubeId, fileUrl, onDuration,
}: { youTubeId?: string | null; fileUrl?: string | null; onDuration: (seconds: number) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const report = useRef(onDuration);
  report.current = onDuration;

  useEffect(() => {
    if (!youTubeId || !holder.current) return;
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const target = document.createElement("div");
    holder.current.replaceChildren(target);
    const tryDuration = (p: YTPlayer) => {
      let tries = 0;
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        const d = p.getDuration?.() ?? 0;
        if (d > 0 || ++tries > 20) {
          if (timer) clearInterval(timer);
          if (d > 0) report.current(Math.round(d));
        }
      }, 500);
    };
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(target, {
          videoId: youTubeId,
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, modestbranding: 1 },
          events: { onReady: (e) => tryDuration(e.target), onStateChange: (e) => tryDuration(e.target) },
        });
      })
      .catch(() => {
        // offline or blocked: fall back to a plain embed (length must then be typed)
        if (!cancelled && holder.current)
          holder.current.innerHTML = `<iframe src="https://www.youtube.com/embed/${youTubeId}" class="h-full w-full" allowfullscreen title="YouTube"></iframe>`;
      });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [youTubeId]);

  if (youTubeId) {
    return <div ref={holder} className="aspect-video w-full overflow-hidden rounded-card bg-neutral-900 [&>*]:h-full [&>*]:w-full" />;
  }
  if (fileUrl) {
    return (
      <video
        src={fileUrl}
        controls
        preload="metadata"
        className="aspect-video w-full rounded-card bg-neutral-900"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) report.current(Math.round(d));
        }}
      />
    );
  }
  return null;
}
