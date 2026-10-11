# Flagship renders (A17)

Our own output only (never third-party ad media). For each brand:
- `<slug>-flagship.jpg`: contact sheet, one frame per shot, left to right in cut order.
- `<slug>-flagship.mp4`: the flagship remake at 720p (the 1080x1920 original lives in `data/assets` on the machine that rendered it). `pnpm seed` copies it under `data/assets/showcase/` so the cockpit can play it on any machine.

How a flagship is made (`pnpm flagship <conceptId>`): Claude picks, per shot of the winner's blueprint, either one of the brand's real images (`assets/brands/<slug>/`) or a new frame in the winner's look (photoreal phone footage for real-footage winners, with the brand's art on screens via an image-edit reference); OpenAI renders the frames (gpt-image-2, high), fal animates every shot with the blueprint's camera move (Kling 2.1 standard image-to-video), ffmpeg composes captions in safe zones, voiceover and the end card, and Claude reviews the cut against the blueprint and an AI-tells rubric; shots under 80 are regenerated (max 2 rounds).
