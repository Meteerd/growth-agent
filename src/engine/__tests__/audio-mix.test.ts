import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ffmpeg } from "@/engine/media/ffmpeg";
import { composeAd916 } from "@/engine/video/compose";
import { fileToUrl } from "@/engine/video/files";

/** ffmpeg prints its analysis on stderr; returns that text (ffmpeg() rejects only on a non-zero exit). */
async function analyse(file: string, af: string, ss?: number, t?: number): Promise<string> {
  const r = await ffmpeg([
    ...(ss !== undefined ? ["-ss", String(ss)] : []),
    ...(t !== undefined ? ["-t", String(t)] : []),
    "-i",
    file,
    "-af",
    af,
    "-f",
    "null",
    "-",
  ]);
  return r.stderr;
}
const meanDb = (s: string) => Number(/mean_volume: (-?[\d.]+) dB/.exec(s)?.[1] ?? Number.NaN);

describe("A18 audio mix", () => {
  it("stereo 48 kHz, about -14 LUFS, music audible after the voice and ducked under it", async () => {
    const dir = path.join(os.tmpdir(), `nexus-audio-${Date.now()}`);
    process.env.ASSETS_DIR = dir;
    fs.mkdirSync(dir, { recursive: true });
    const vo = path.join(dir, "vo.wav");
    const music = path.join(dir, "music.wav");
    await ffmpeg(["-y", "-f", "lavfi", "-i", "sine=f=440:d=1.5:sample_rate=24000", "-ac", "1", vo]);
    await ffmpeg(["-y", "-f", "lavfi", "-i", "sine=f=220:d=2:sample_rate=44100", "-ac", "2", music]);
    const still = path.join(dir, "still.png");
    await sharp({ create: { width: 1080, height: 1920, channels: 3, background: "#556677" } })
      .png()
      .toFile(still);
    const out = path.join(dir, "out.mp4");
    await composeAd916(
      {
        shots: [
          { src: fileToUrl(still), durationSec: 2, text: "Voice and music" },
          { src: fileToUrl(still), durationSec: 2, text: "Music only" },
        ],
        voiceoverSrc: fileToUrl(vo),
        musicSrc: fileToUrl(music),
        brandName: "Test",
        colors: ["#111111", "#222222", "#333333", "#FFFFFF"],
        cta: "Learn more",
        endCardSec: 1,
      },
      out,
      path.join(dir, "parts"),
    );
    const info = (await ffmpeg(["-i", out, "-f", "null", "-t", "0.1", "-"])).stderr;
    expect(info).toMatch(/Audio: aac[^\n]*48000 Hz, stereo/);
    const summary = (await analyse(out, "ebur128")).split("Integrated loudness:")[1] ?? "";
    const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]);
    console.log(`integrated loudness ${lufs} LUFS`);
    expect(Math.abs(lufs + 14)).toBeLessThan(3);
    // the 220 Hz music band: present after the voice ends, quieter while the voice speaks
    const band = "bandpass=f=220:width_type=h:w=60,volumedetect";
    const under = meanDb(await analyse(out, band, 0.4, 0.9));
    const after = meanDb(await analyse(out, band, 2.2, 1.0));
    expect(after).toBeGreaterThan(-45);
    console.log(`music band: under the voice ${under} dB, after it ${after} dB`);
    expect(after - under).toBeGreaterThan(3);
  }, 120_000);
});
