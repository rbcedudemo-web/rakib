"use client";

import { useEffect, useRef } from "react";
import { loadYouTubeApi, type YTPlayer } from "@/lib/youtube";

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
