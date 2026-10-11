import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ffmpeg } from "./ffmpeg";

export interface SyntheticScene {
  durationSec: number;
  color: string;
  text: string;
}

export interface SyntheticVideo {
  file: string;
  scenes: SyntheticScene[];
  cuts: number[];
  voiceover: string;
}

/** The test video for the reverse-engineering demo: colored text-card scenes + a tone. Never third-party media. */
export const DEFAULT_SCENES: SyntheticScene[] = [
  { durationSec: 2.5, color: "#C07848", text: "I filmed my dog when I left" },
  { durationSec: 3, color: "#2A3558", text: "Day 1: crying at the door" },
  { durationSec: 3.5, color: "#A8C048", text: "10 minutes a day" },
  { durationSec: 3, color: "#781818", text: "Day 14: calm" },
  { durationSec: 2, color: "#FFF0E0", text: "Take the quiz" },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function card(scene: SyntheticScene, out: string) {
  const dark = scene.color.toUpperCase() !== "#FFF0E0";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="100%" height="100%" fill="${scene.color}"/><text x="270" y="480" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="700" fill="${dark ? "#FFFFFF" : "#222222"}" text-anchor="middle">${esc(scene.text)}</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out);
}

export async function makeSyntheticVideo(
  dir: string,
  scenes: SyntheticScene[] = DEFAULT_SCENES,
): Promise<SyntheticVideo> {
  fs.mkdirSync(dir, { recursive: true });
  const pngs: string[] = [];
  for (const [i, s] of scenes.entries()) {
    const p = path.join(dir, `scene_${i}.png`);
    await card(s, p);
    pngs.push(p);
  }
  const total = scenes.reduce((a, s) => a + s.durationSec, 0);
  const file = path.join(dir, "synthetic.mp4");
  const inputs = scenes.flatMap((s, i) => ["-loop", "1", "-t", String(s.durationSec), "-i", pngs[i]]);
  const filter = `${scenes.map((_, i) => `[${i}:v]fps=30,format=yuv420p,setsar=1[v${i}]`).join(";")};${scenes.map((_, i) => `[v${i}]`).join("")}concat=n=${scenes.length}:v=1:a=0[v]`;
  await ffmpeg([
    "-y",
    ...inputs,
    "-f",
    "lavfi",
    "-t",
    String(total),
    "-i",
    "sine=frequency=330:sample_rate=16000",
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    `${scenes.length}:a`,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
    "-shortest",
    file,
  ]);
  const cuts: number[] = [];
  let t = 0;
  for (const s of scenes.slice(0, -1)) {
    t += s.durationSec;
    cuts.push(Math.round(t * 100) / 100);
  }
  return { file, scenes, cuts, voiceover: scenes.map((s) => s.text).join(". ") };
}
