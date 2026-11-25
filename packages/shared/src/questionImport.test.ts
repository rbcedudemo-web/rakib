import { describe, expect, it } from "vitest";
import { parseQuestionText } from "./questionImport";

const sample = `
১. 'পদ্ম' শব্দের উচ্চারণ কোনটি?
ক) পদ্‌মো
খ) পদ্দোঁ
গ) পোদ্‌মো
ঘ) পদমো
উত্তর: খ
ব্যাখ্যা: শব্দের মাঝে ম-ফলা আগের বর্ণকে দ্বিত্ব করে।

২. শব্দের প্রথমে ম-ফলা থাকলে কী হয়?
ক. ম উচ্চারিত হয়   খ. নাসিক্য হয়   গ. দ্বিত্ব হয়   ঘ. লোপ পায়
সঠিক উত্তর: (খ)
ব্যাখ্যা: যেমন স্মরণ।
এটি দ্বিতীয় লাইন।

৩. উত্তরবঙ্গের কোন শব্দে ম-ফলা আছে?
ক) আত্মা
খ) বাংলা
গ) ঢাকা
ঘ) রংপুর
উঃ আত্মা
`;

describe("parseQuestionText", () => {
  it("reads the fixed Bangla format, inline options, letters and answer text", () => {
    const r = parseQuestionText(sample);
    expect(r).toHaveLength(3);
    expect(r.every((b) => b.error === null)).toBe(true);
    expect(r[0]!.question).toMatchObject({ prompt: "'পদ্ম' শব্দের উচ্চারণ কোনটি?", correctIndex: 1, explanation: "শব্দের মাঝে ম-ফলা আগের বর্ণকে দ্বিত্ব করে।" });
    expect(r[1]!.question?.options).toEqual(["ম উচ্চারিত হয়", "নাসিক্য হয়", "দ্বিত্ব হয়", "লোপ পায়"]);
    expect(r[1]!.question?.explanation).toBe("যেমন স্মরণ।\nএটি দ্বিতীয় লাইন।");
    expect(r[2]!.question).toMatchObject({ prompt: "উত্তরবঙ্গের কোন শব্দে ম-ফলা আছে?", correctIndex: 0 });
  });

  it("reads English with A-D and numbers as answers", () => {
    const r = parseQuestionText("1) What is 2+2?\nA. 3\nB. 4\nC. 5\nD. 6\nAnswer: B\nExplanation: basic.\n2. Pick one\na) x\nb) y\nc) z\nd) w\nAns: 4");
    expect(r.map((b) => b.question?.correctIndex)).toEqual([1, 3]);
  });

  it("handles Word lists whose numbers and letters were lost", () => {
    const r = parseQuestionText("প্রথম প্রশ্ন?\nএক\nদুই\nতিন\nচার\nউত্তর: গ\nব্যাখ্যা: কারণ\nদ্বিতীয় প্রশ্ন?\nক) ১\nখ) ২\nগ) ৩\nঘ) ৪\nউত্তর: ক");
    expect(r).toHaveLength(2);
    expect(r[0]!.question).toMatchObject({ prompt: "প্রথম প্রশ্ন?", options: ["এক", "দুই", "তিন", "চার"], correctIndex: 2 });
    expect(r[1]!.question?.correctIndex).toBe(0);
  });

  it("does not swallow the next question when an answer line is missing", () => {
    const r = parseQuestionText("১. প্রশ্ন এক?\nক) ১\nখ) ২\nগ) ৩\nঘ) ৪\nপরের প্রশ্ন?\nএক\nদুই\nতিন\nচার\nউত্তর: ক");
    expect(r.map((b) => b.error)).toEqual(["noAnswer", null]);
    expect(r[0]!.options[3]).toBe("৪");
  });

  it("marks problems without dropping the question", () => {
    const r = parseQuestionText("১. তিন বিকল্প?\nক) ১\nখ) ২\nগ) ৩\nউত্তর: ক\n২. উত্তর নেই?\nক) ১\nখ) ২\nগ) ৩\nঘ) ৪\n৩. ভুল উত্তর?\nক) ১\nখ) ২\nগ) ৩\nঘ) ৪\nউত্তর: চ\n৪. একই?\nক) ১\nখ) ১\nগ) ৩\nঘ) ৪\nউত্তর: ক");
    expect(r.map((b) => b.error)).toEqual(["optionCount", "noAnswer", "badAnswer", "sameOptions"]);
  });
});
