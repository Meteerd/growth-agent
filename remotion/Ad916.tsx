import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type Ad916Props, type AdShot, FPS } from "./types";

const SAFE_TOP = 220;
const SAFE_BOTTOM = 420;

function Caption({ text, accent }: { text: string; accent: string }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 6], [24, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        bottom: SAFE_BOTTOM,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.62)",
          color: "white",
          fontFamily: "Helvetica, Arial, sans-serif",
          fontWeight: 800,
          fontSize: 58,
          lineHeight: 1.15,
          padding: "22px 34px",
          borderRadius: 22,
          textAlign: "center",
          borderBottom: `8px solid ${accent}`,
          maxWidth: 900,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function Shot({ shot, index, accent }: { shot: AdShot; index: number; accent: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const len = Math.round(shot.durationSec * FPS);
  const zoomIn = index % 2 === 0;
  const scale = interpolate(frame, [0, len], zoomIn ? [1.0, 1.12] : [1.12, 1.0], { extrapolateRight: "clamp" });
  const x = interpolate(frame, [0, len], index % 3 === 0 ? [0, -30] : [-20, 10], { extrapolateRight: "clamp" });
  const fade = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: "clamp" });
  void durationInFrames;
  return (
    <AbsoluteFill style={{ backgroundColor: "#111", opacity: fade }}>
      {shot.clipSrc ? (
        <OffthreadVideo src={shot.clipSrc} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Img
          src={shot.src}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${x}px)` }}
        />
      )}
      {shot.text ? <Caption text={shot.text} accent={accent} /> : null}
    </AbsoluteFill>
  );
}

function EndCard({ brandName, cta, colors, logoSrc }: Pick<Ad916Props, "brandName" | "cta" | "colors" | "logoSrc">) {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 8], [0.9, 1], { extrapolateRight: "clamp" });
  const bg = colors[3] ?? colors[0] ?? "#111";
  const fg = colors[0] ?? "#fff";
  return (
    <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center", gap: 48 }}>
      {logoSrc ? (
        <Img
          src={logoSrc}
          style={{ width: 260, height: 260, objectFit: "contain", transform: `scale(${pop})`, borderRadius: 48 }}
        />
      ) : null}
      <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: 84, fontWeight: 800, color: "#1b1b1b" }}>
        {brandName}
      </div>
      <div
        style={{
          fontFamily: "Helvetica, Arial, sans-serif",
          fontSize: 54,
          fontWeight: 700,
          color: "white",
          background: fg,
          padding: "26px 48px",
          borderRadius: 999,
          transform: `scale(${pop})`,
          maxWidth: 880,
          textAlign: "center",
        }}
      >
        {cta}
      </div>
    </AbsoluteFill>
  );
}

export function Ad916(p: Ad916Props) {
  let from = 0;
  const accent = p.colors[0] ?? "#ffffff";
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {p.shots.map((s, i) => {
        const len = Math.max(1, Math.round(s.durationSec * FPS));
        const seq = (
          <Sequence key={i} from={from} durationInFrames={len}>
            <Shot shot={s} index={i} accent={accent} />
          </Sequence>
        );
        from += len;
        return seq;
      })}
      <Sequence from={from} durationInFrames={Math.max(1, Math.round(p.endCardSec * FPS))}>
        <EndCard brandName={p.brandName} cta={p.cta} colors={p.colors} logoSrc={p.logoSrc} />
      </Sequence>
      {p.voiceoverSrc ? <Audio src={p.voiceoverSrc} /> : null}
      {p.badge ? (
        <div
          style={{
            position: "absolute",
            top: SAFE_TOP - 140,
            right: 40,
            fontFamily: "Helvetica, Arial, sans-serif",
            fontSize: 26,
            color: "white",
            background: "rgba(0,0,0,0.5)",
            padding: "8px 16px",
            borderRadius: 12,
          }}
        >
          {p.badge}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
