import { describe, expect, it } from "vitest";
import { localizeMedia, localMedia } from "./media";

describe("localMedia", () => {
  it("routes third-party covers through the local cache and leaves local media alone", () => {
    expect(localMedia("https://i.ytimg.com/vi/x/hq.jpg")).toBe("/thumb?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fx%2Fhq.jpg");
    expect(localMedia("/api/assets/showcase/hound-flagship.mp4")).toBe("/api/assets/showcase/hound-flagship.mp4");
    expect(localMedia(undefined)).toBeUndefined();
  });

  it("rewrites thumbnailUrl and coverUrl anywhere in a response, nothing else", () => {
    const out = localizeMedia({
      url: "https://www.tiktok.com/@a/video/1",
      evidence: [{ thumbnailUrl: "https://p16.tiktokcdn-us.com/a.jpg", n: 3 }],
      bp: { evidence: { coverUrl: "http://x.cdninstagram.com/b.jpg" }, frames: [{ url: "/api/assets/frames/0.jpg" }] },
    });
    expect(out.url).toBe("https://www.tiktok.com/@a/video/1");
    expect(out.evidence[0].thumbnailUrl).toMatch(/^\/thumb\?u=https%3A/);
    expect(out.evidence[0].n).toBe(3);
    expect(out.bp.evidence.coverUrl).toMatch(/^\/thumb\?u=http%3A/);
    expect(out.bp.frames[0].url).toBe("/frames/0.jpg");
    expect(localizeMedia(null)).toBeNull();
  });
});
