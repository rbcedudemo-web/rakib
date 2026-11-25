"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toBanglaDigits, WatchTracker } from "@rupshi/shared";
import { useT } from "@/lib/i18n-client";
import { loadYouTubeApi, YT_PLAYING, type YTPlayer } from "@/lib/youtube";
import { recordProgress } from "../../actions";

const SAVE_EVERY_MS = 15_000;

interface Props {
  lessonId: string;
  youTubeId: string | null;
  fileUrl: string | null;
  durationSeconds: number | null;
  savedSeconds: number;
  completed: boolean;
  unlockPercent: number;
  trackProgress: boolean;
  nextHref: string | null;
}

/** Plays the lesson video, counts the seconds really watched and saves them; opens the next lesson at the threshold. */
export function LessonPlayer(props: Props) {
  const { lessonId, youTubeId, fileUrl, durationSeconds, savedSeconds, unlockPercent, trackProgress, nextHref } = props;
  const { t, locale } = useT();
  const num = (n: number) => (locale === "bn" ? toBanglaDigits(n) : String(n));
  const router = useRouter();

  const tracker = useRef<WatchTracker | null>(null);
  const lastSaved = useRef(savedSeconds);
  const [percent, setPercent] = useState(durationSeconds ? Math.min(100, (savedSeconds * 100) / durationSeconds) : 0);
  const [completed, setCompleted] = useState(props.completed);
  const holder = useRef<HTMLDivElement>(null);
  const videoEl = useRef<HTMLVideoElement>(null);

  if (!tracker.current && durationSeconds) tracker.current = new WatchTracker(durationSeconds, savedSeconds);

  const save = useCallback(async () => {
    const tr = tracker.current;
    if (!trackProgress || !tr || tr.watchedSeconds <= lastSaved.current) return;
    lastSaved.current = tr.watchedSeconds;
    const r = await recordProgress(lessonId, tr.watchedSeconds);
    if (r.ok && r.completed && !completed) {
      setCompleted(true);
      router.refresh(); // the lesson list now shows the next lesson open
    }
  }, [trackProgress, lessonId, completed, router]);

  const onPosition = useCallback((position: number, playing: boolean) => {
    const tr = tracker.current;
    if (!tr) return;
    if (playing) tr.tick(position);
    else tr.pause();
    setPercent(tr.percent);
  }, []);

  // save regularly, and when the tab is hidden or closed
  useEffect(() => {
    if (!trackProgress) return;
    const timer = setInterval(save, SAVE_EVERY_MS);
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      save();
    };
  }, [save, trackProgress]);

  // YouTube: poll the position once a second while playing
  useEffect(() => {
    if (!youTubeId || !holder.current) return;
    let player: YTPlayer | null = null;
    let playing = false;
    let cancelled = false;
    const target = document.createElement("div");
    holder.current.replaceChildren(target);
    const timer = setInterval(() => {
      if (player && playing) onPosition(player.getCurrentTime(), true);
    }, 1000);
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(target, {
          videoId: youTubeId,
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onStateChange: (e) => {
              playing = e.data === YT_PLAYING;
              onPosition(e.target.getCurrentTime(), playing);
              if (!playing) save();
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled && holder.current)
          holder.current.innerHTML = `<iframe src="https://www.youtube.com/embed/${youTubeId}" class="h-full w-full" allowfullscreen title="YouTube"></iframe>`;
      });
    return () => {
      cancelled = true;
      clearInterval(timer);
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [youTubeId, onPosition, save]);

  const goal = Math.min(100, unlockPercent);
  const shown = Math.round(percent);

  return (
    <div className="space-y-3">
      {youTubeId ? (
        <div ref={holder} className="aspect-video w-full overflow-hidden rounded-card bg-neutral-900 [&>*]:h-full [&>*]:w-full" />
      ) : fileUrl ? (
        <video
          ref={videoEl}
          src={fileUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-card bg-neutral-900"
          onTimeUpdate={(e) => onPosition(e.currentTarget.currentTime, !e.currentTarget.paused)}
          onPause={(e) => { onPosition(e.currentTarget.currentTime, false); save(); }}
          onSeeking={() => tracker.current?.pause()}
          onEnded={() => { tracker.current?.pause(); save(); }}
        />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-card bg-neutral-100 text-neutral-500">{t("learn.noVideo")}</div>
      )}

      {trackProgress && durationSeconds ? (
        <div className="rounded-card border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-neutral-800">{t("learn.watched", { p: num(shown) })}</span>
            <span className={completed ? "font-semibold text-primary-700" : "text-neutral-500"}>
              {completed ? t("learn.nextOpened") : t("learn.unlockGoal", { p: num(goal) })}
            </span>
          </div>
          <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown}>
            <div className="h-full rounded-full bg-primary-600 transition-[width]" style={{ width: `${shown}%` }} />
            <div className="absolute top-0 h-full w-0.5 bg-highlight-500" style={{ left: `${goal}%` }} aria-hidden />
          </div>
          {completed && nextHref && (
            <Link href={nextHref} className="mt-3 inline-flex min-h-11 items-center rounded-[10px] bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700">
              {t("learn.next")}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
