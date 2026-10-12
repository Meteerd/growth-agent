import { describe, expect, it } from "vitest";
import { globalWords, layoutVoice, type VoiceSegment } from "../audio/track";
import { wordsFromAlignment } from "../providers/elevenlabs";
import { captionFrameSvg, groupWords, HORMOZI, markEmphasis, popScale } from "../video/captions";
import { audioGraph } from "../video/compose";

const words = (text: string, start = 0.2, per = 0.32) =>
  text.split(" ").map((w, i) => ({ word: w, start: start + i * per, end: start + i * per + per * 0.85 }));

describe("A18 live captions", () => {
  it("character alignment becomes words with times", () => {
    const chars = [..."Ahoj svet."];
    const w = wordsFromAlignment({
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1),
      character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.09),
    });
    expect(w.map((x) => x.word)).toEqual(["Ahoj", "svet."]);
    expect(w[1]!.start).toBeCloseTo(0.5);
    expect(w[1]!.end).toBeCloseTo(0.99);
  });

  it("groups hold 1 to 3 words and never longer than 1.2 s", () => {
    const g = groupWords(words("Lekár ktorý berie tvoju váhu vážne bez sedenia v čakárni."), 3);
    for (const x of g) {
      expect(x.words.length).toBeGreaterThanOrEqual(1);
      expect(x.words.length).toBeLessThanOrEqual(3);
      expect(x.t1 - x.t0).toBeLessThanOrEqual(1.2 + 1e-9);
    }
  });

  it("is alive: sampled at 10 fps during speech the text changes at least every 0.8 s and no state lasts > 1.2 s", () => {
    const ws = markEmphasis(words("Celé to má štyri kroky, ulož si ich a začni dotazníkom na a.clinic dnes 4 kroky"));
    const tr = { style: HORMOZI, words: ws, regions: [] };
    const g = groupWords(ws, 3);
    const end = ws.at(-1)!.end;
    let prevText = "";
    let since = ws[0]!.start;
    let prevSvg = "";
    let maxRun = 0;
    for (let t = ws[0]!.start; t < end; t += 0.1) {
      const svg = captionFrameSvg(tr, g, t);
      expect(svg).not.toBe("");
      // the transform breathes: consecutive frames are never identical
      expect(svg).not.toBe(prevSvg);
      prevSvg = svg;
      const grp = g.find((x) => t >= x.t0 && t < x.t1);
      const visible = (grp?.words ?? [])
        .filter((w) => t >= w.start - 0.03)
        .map((w) => w.word)
        .join(" ");
      if (visible !== prevText) {
        maxRun = Math.max(maxRun, t - since);
        since = t;
        prevText = visible;
      }
    }
    expect(maxRun).toBeLessThanOrEqual(0.8);
  });

  it("words pop 80% -> peak -> 100% within ~180 ms", () => {
    expect(popScale(0, "pop")).toBeCloseTo(0.8);
    expect(popScale(0.08, "pop")).toBeGreaterThan(1.05);
    expect(popScale(0.3, "pop")).toBe(1);
    expect(popScale(-0.1, "pop")).toBe(0);
  });

  it("numbers and capitals are key words", () => {
    const w = markEmphasis(words("only 4 steps FREE today"), ["today"]);
    expect(w.filter((x) => x.emph).map((x) => x.word)).toEqual(["4", "FREE", "today"]);
  });
});

describe("A18 voice layout", () => {
  const seg = (idx: number, dur: number): VoiceSegment => ({
    idx,
    file: `l${idx}.mp3`,
    durationSec: dur,
    words: [
      { word: "a", start: 0, end: dur / 2 },
      { word: "b", start: dur / 2, end: dur },
    ],
  });
  const shots = [
    { idx: 0, durationSec: 4 },
    { idx: 1, durationSec: 5 },
    { idx: 2, durationSec: 3 },
  ];

  it("voice-led: each shot is as long as its line plus breath; silent shots keep their length", () => {
    const lay = layoutVoice(shots, [seg(0, 2.0), seg(2, 3.5)], "voice_led");
    expect(lay.durations).toEqual([2.45, 5, 3.95]);
    expect(lay.starts[0]).toBeCloseTo(0.1);
    expect(lay.starts[2]).toBeCloseTo(2.45 + 5 + 0.15);
  });

  it("picture-locked: lengths stay, a long line is sped up (max 1.2x) and lines never overlap", () => {
    const lay = layoutVoice(shots, [seg(0, 4.2), seg(1, 4.8), seg(2, 2)], "picture_locked");
    expect(lay.durations).toEqual([4, 5, 3]);
    expect(lay.tempo[0]).toBeCloseTo(4.2 / (4 - 0.45), 2);
    const gw = globalWords([seg(0, 4.2), seg(1, 4.8), seg(2, 2)], lay);
    for (let i = 1; i < gw.length; i++) expect(gw[i]!.start).toBeGreaterThanOrEqual(gw[i - 1]!.start);
    const end0 = lay.starts[0]! + 4.2 / lay.tempo[0]!;
    expect(lay.starts[1]!).toBeGreaterThanOrEqual(end0);
  });
});

describe("A18 sound effects in the mix", () => {
  it("each effect is delayed to its time and mixed before loudness normalisation", () => {
    const g = audioGraph(3, true, true, 20, [
      { at: 0, gainDb: -14 },
      { at: 4.5, gainDb: -18 },
    ]);
    expect(g).toContain("[5:a]");
    expect(g).toContain("[6:a]");
    expect(g).toContain("adelay=4500|4500");
    expect(g).toContain("amix=inputs=3");
    expect(g.indexOf("amix=inputs=3")).toBeLessThan(g.indexOf("loudnorm"));
    expect(g.endsWith("[a]")).toBe(true);
  });
});

describe("A18 Gemini calibration against the winner", () => {
  it("matching the winner's raw score maps to 85; the factor is capped and never lowers a score", async () => {
    const { calibrate } = await import("../agent/watcher");
    expect(calibrate(68, 68)).toBe(85);
    expect(calibrate(66, 68)).toBe(83);
    expect(calibrate(50, 40)).toBe(68); // capped at 1.35x
    expect(calibrate(90, 95)).toBe(90); // a winner above the anchor never lowers our score
    expect(calibrate(70)).toBe(70);
    expect(calibrate(59, 6)).toBe(59); // a winner under 40 raw is not a usable anchor
  });
});

describe("A18 premium captions", () => {
  it("words spring 0.85 -> ~1.06 -> 1.0 (real easing) and key words slam down from bigger", async () => {
    const { spring, popScale, premiumStyle, readableAccent } = await import("../video/captions");
    expect(spring(0)).toBeCloseTo(0.85);
    const peak = Math.max(...Array.from({ length: 30 }, (_, i) => spring(i / 100)));
    expect(peak).toBeGreaterThan(1.04);
    expect(peak).toBeLessThan(1.09);
    expect(Math.abs(spring(0.5) - 1)).toBeLessThan(0.01);
    expect(popScale(0.01, "spring", true)).toBeGreaterThan(1.2);
    // no box unless the winner uses one; the active word is readable on video
    expect(premiumStyle(undefined, "#1860F0").background).toBe("none");
    expect(premiumStyle({ background: "box" } as never, "#C07848").background).toBe("box");
    expect(readableAccent("#781818")).not.toBe("#781818");
  });
});
