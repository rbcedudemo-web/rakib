/**
 * Counts how much of a video a student really watched: each second of the
 * video is counted once, so skipping ahead or replaying does not add time.
 * Used by the web player now and the Android app later.
 */
export class WatchTracker {
  private seen = new Set<number>();
  private last: number | null = null;

  /** @param baseSeconds watched seconds already saved on the server */
  constructor(private readonly durationSeconds: number, private readonly baseSeconds = 0) {}

  /**
   * Call regularly (e.g. every second) with the current play position while
   * the video is playing. A jump of more than maxStep seconds is a seek and
   * counts nothing.
   */
  tick(positionSeconds: number, maxStep = 3): void {
    const pos = Math.max(0, Math.min(positionSeconds, this.durationSeconds));
    if (this.last !== null && pos > this.last && pos - this.last <= maxStep) {
      for (let s = Math.floor(this.last); s < Math.floor(pos); s++) this.seen.add(s);
    }
    this.last = pos;
  }

  /** Paused, ended or seeking: the next tick starts a new stretch. */
  pause(): void {
    this.last = null;
  }

  get watchedSeconds(): number {
    return Math.min(this.durationSeconds, this.baseSeconds + this.seen.size);
  }

  get percent(): number {
    return this.durationSeconds > 0 ? Math.min(100, (this.watchedSeconds * 100) / this.durationSeconds) : 0;
  }
}

/** Default unlock threshold (setting unlock_percent). */
export const UNLOCK_PERCENT = 50;
