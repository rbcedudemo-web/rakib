import { describe, expect, it } from "vitest";
import { WatchTracker } from "./progress";

describe("WatchTracker", () => {
  it("counts normal playback", () => {
    const w = new WatchTracker(100);
    for (let t = 0; t <= 30; t++) w.tick(t);
    expect(w.watchedSeconds).toBe(30);
    expect(w.percent).toBe(30);
  });
  it("does not count a seek forward", () => {
    const w = new WatchTracker(100);
    for (let t = 0; t <= 10; t++) w.tick(t);
    w.tick(80); // jumped
    for (let t = 81; t <= 85; t++) w.tick(t);
    expect(w.watchedSeconds).toBe(15);
  });
  it("counts replayed seconds once", () => {
    const w = new WatchTracker(100);
    for (let t = 0; t <= 20; t++) w.tick(t);
    w.pause();
    for (let t = 10; t <= 20; t++) w.tick(t);
    expect(w.watchedSeconds).toBe(20);
  });
  it("adds to what the server already has, capped at the length", () => {
    const w = new WatchTracker(60, 50);
    for (let t = 0; t <= 30; t++) w.tick(t);
    expect(w.watchedSeconds).toBe(60);
    expect(w.percent).toBe(100);
  });
  it("handles 1.5x speed steps", () => {
    const w = new WatchTracker(100);
    for (let t = 0; t <= 30; t += 1.5) w.tick(t);
    expect(w.watchedSeconds).toBe(30);
  });
});
