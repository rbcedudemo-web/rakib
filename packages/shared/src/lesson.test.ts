import { describe, expect, it } from "vitest";
import {
  formatDuration, lessonFilePath, parseDuration, parseYouTubeId, subtitleToText, validateLesson, type LessonInput,
} from "./lesson";

describe("parseYouTubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["youtube.com/watch?v=dQw4w9WgXcQ&t=30s", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ?feature=share", "dQw4w9WgXcQ"],
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("reads %s", (url, id) => expect(parseYouTubeId(url)).toBe(id));

  it.each(["", "https://vimeo.com/123", "https://youtube.com/watch?v=short", "https://evil.com/watch?v=dQw4w9WgXcQ", "not a url"])(
    "rejects %s",
    (url) => expect(parseYouTubeId(url)).toBeNull(),
  );
});

describe("durations", () => {
  it("formats", () => {
    expect(formatDuration(754)).toBe("12:34");
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(5)).toBe("0:05");
  });
  it("parses", () => {
    expect(parseDuration("12:34")).toBe(754);
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("15")).toBe(900);
    expect(parseDuration("১২:৩৪")).toBe(754);
    expect(parseDuration("12:75")).toBeNull();
    expect(parseDuration("0:00")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
  });
});

describe("subtitleToText", () => {
  it("cleans srt", () => {
    const srt = "1\n00:00:01,000 --> 00:00:03,000\nআজ আমরা ভগ্নাংশ শিখব।\n\n2\n00:00:03,500 --> 00:00:05,000\n<i>প্রথমে</i> লব ও হর।\n";
    expect(subtitleToText(srt)).toBe("আজ আমরা ভগ্নাংশ শিখব।\nপ্রথমে লব ও হর।");
  });
  it("cleans vtt with notes and repeated lines", () => {
    const vtt = "WEBVTT\n\nNOTE made by tool\nignored line\n\n00:01.000 --> 00:02.000\nHello\n\n00:02.000 --> 00:03.000\nHello\n\n00:03.000 --> 00:04.000 align:start\nWorld";
    expect(subtitleToText(vtt)).toBe("Hello\nWorld");
  });
});

const base: LessonInput = {
  subjectId: "11111111-1111-4111-8111-111111111111",
  chapterId: "",
  chapterTitle: "",
  title: "ভগ্নাংশ পরিচিতি",
  description: "",
  videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  hasVideoFile: false,
  duration: "12:34",
  mcqCount: 10,
  writtenCount: 2,
  minutes: 15,
  mcqMarks: 1,
  writtenMarks: 5,
  publish: true,
};

describe("validateLesson", () => {
  it("accepts a complete lesson", () => {
    const r = validateLesson(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.youTubeId).toBe("dQw4w9WgXcQ");
      expect(r.value.durationSeconds).toBe(754);
      expect(r.value.chapter).toBeNull();
    }
  });
  it("creates a new chapter when asked", () => {
    const r = validateLesson({ ...base, chapterId: "new", chapterTitle: " অধ্যায় ১ " });
    expect(r.ok && r.value.chapter).toEqual({ newTitle: "অধ্যায় ১" });
  });
  it("reports each problem", () => {
    const r = validateLesson({
      ...base, subjectId: "x", title: " ", videoUrl: "https://vimeo.com/1", duration: "9:99",
      mcqCount: 60, writtenCount: -1, minutes: 0, chapterId: "new", chapterTitle: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toMatchObject({
        subject: "required", title: "required", video: "badYouTube", duration: "badDuration",
        mcqCount: "range", writtenCount: "range", minutes: "range", chapter: "required",
      });
    }
  });
  it("needs at least one question", () => {
    const r = validateLesson({ ...base, mcqCount: 0, writtenCount: 0 });
    expect(!r.ok && r.errors.mcqCount).toBe("noQuestions");
  });
  it("allows a draft without video, but not publishing it", () => {
    expect(validateLesson({ ...base, videoUrl: "", duration: "", publish: false }).ok).toBe(true);
    const r = validateLesson({ ...base, videoUrl: "", publish: true });
    expect(!r.ok && r.errors.publish).toBe("publishNeedsVideo");
    const r2 = validateLesson({ ...base, duration: "", publish: true });
    expect(!r2.ok && r2.errors.publish).toBe("publishNeedsDuration");
    expect(validateLesson({ ...base, videoUrl: "", hasVideoFile: true }).ok).toBe(true);
  });
  it("names storage files by lesson folder", () => {
    expect(lessonFilePath("abc", "note")).toBe("abc/note.pdf");
    expect(lessonFilePath("abc", "transcript")).toBe("abc/transcript.txt");
  });
});
