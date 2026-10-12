# Flagship renders (A17)

Our own output only (never third-party ad media). For each brand:
- `<slug>-flagship.jpg`: contact sheet, one frame per shot, left to right in cut order.
- `<slug>-flagship.mp4`: the flagship remake at 720p (the 1080x1920 original lives in `data/assets` on the machine that rendered it). `pnpm seed` copies it under `data/assets/showcase/` so the cockpit can play it on any machine.

How a flagship is made (`pnpm flagship <conceptId>`): Claude picks, per shot of the winner's blueprint, either one of the brand's real images (`assets/brands/<slug>/`) or a new frame in the winner's look (photoreal phone footage for real-footage winners, with the brand's art on screens via an image-edit reference); OpenAI renders the frames (gpt-image-2, high), fal animates every shot with the blueprint's camera move (Kling 2.1 standard image-to-video; Higgsfield Kling when fal is unavailable), ffmpeg composes captions in safe zones, voiceover and the end card, and Claude reviews the cut against the blueprint and an AI-tells rubric; shots under 80 are regenerated (max 2 rounds).

## Current flagships
- Hound `concept_1d68be0a_1`: 83/100, every shot >= 80 (fal clips).
- a.clinic `concept_1e6575ad_1`: 82/100, every shot >= 80 (fal clips).
- Dynova `concept_91d09027_1`: 81/100, every shot >= 80 (Higgsfield clips; fal balance ran out). Turkish "is a gene test needed?" explainer remake: kit box, lab, report, routine, dynova.health on a phone.
- Evreon AI `concept_f352d515_1`: 81/100, every shot >= 80. Claims (50+ languages, EU data residency, never diagnoses, 20-minute demo) are in the dossier from the site. English LinkedIn product-demo remake for UK practices: unread referral stack, waiting patient, a scanned foreign-language letter, Evreon reading and linking it, "never diagnoses", book a demo. Clips by Higgsfield until its cap, the later fixes are stills with camera moves.
