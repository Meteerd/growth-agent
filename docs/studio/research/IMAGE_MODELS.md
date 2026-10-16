# Image generation APIs for static ads and carousels: decision memo

Date: 2026-10-16. Scope: server-side Node/TypeScript on an AWS Lightsail box (no GPU), static image ads and carousels for (a) a.clinic (doctor-led weight-care telehealth, SK/CZ, health-restricted) and (b) Hound (dog-training app, ES/GB/US).

Legend: **[V]** = verified on an official vendor page (fal, OpenAI, Google, Higgsfield docs) during this research. **[3P]** = third-party source only (aggregator, blog, review). **[INF]** = my inference, not stated by any source. Prices are list prices as shown on the day; fal says "settings such as resolution, duration, and quality may affect the final cost."

---

## 1. Recommendation (TL;DR)

1. **Architecture: do not let the model own the ad copy.** Generate the *scene* (people, dog, product, phone mockup, clinic setting) with the model, leaving clean negative space, then render headline, sub-copy, CTA, logo and disclaimers on the server with a deterministic template (Satori + resvg, or sharp + SVG). Reasons: a.clinic copy must be exactly the compliance-approved wording; Slovak/Czech diacritics (č, ř, ž, ě, ů, ľ, ĺ) have **no published test** on any model I could find; templates let you A/B headlines without re-generating images and keep brand fonts exact. Use model-rendered text only for "diegetic" text inside the scene (a phone screen in the Hound app, a sign, a notebook), and OCR-check it.
2. **Primary generator: OpenAI GPT Image 2.5 Flare via fal**, `openai/gpt-image-2.5/flare/text-to-image` (hero slide) and `openai/gpt-image-2.5/flare/edit` (follow-on slides with up to 16 reference images). Best documented text rendering family, custom sizes cover 1:1 / 4:5 / 9:16, transparent background support, and fal lists it at about $0.04 to $0.06 per image at high quality around 1 MP [V, fal launch page]. Caveat: it launched 2026-09-08; independent text tests so far are on GPT Image 2, its predecessor.
3. **Carousel consistency editor: Google Nano Banana Pro edit via fal**, `fal-ai/nano-banana-pro/edit`. Native 4:5 and 9:16 enums, 1K/2K/4K, multi-reference (fal's own guide says up to 14 references [V, fal article]), and it is the model practitioners most often cite for keeping the same character/product across a series. $0.15 per image on fal (4K is 2x) [V]. Run a 1-hour bake-off against Flare edit (Section 7) and keep whichever holds identity better for each brand.
4. **Fallback (different vendor, cheaper):** Nano Banana 2.1 (`fal-ai/nano-banana-2.1` and `/edit`, GA 2026-10-06; endpoint page exists on fal [V], fal price not shown; Google direct $0.0336 at 1K, $0.0504 at 2K [V]) or, if you want a non-Google/non-OpenAI fallback, **Seedream 5.0 Lite** at $0.035 [V, fal article] with 10-reference edit. The fallback exists for moderation refusals (health/body prompts) and outages, not as the quality default.
5. **Do not use Higgsfield as the backbone.** Its API is real and server-usable, but its ad products (Ads Studio, Marketing Studio Image) are wrappers on GPT Image 2.5 Flare with preset-based prompt enhancement and auto-written concepts. Same underlying model, less control, 7-day output retention. See Section 5.
6. **Skip:** Imagen 4 (Google lists earliest shutdown 2026-08-17 [V]), GPT Image 1 / 1.5 / 2 (superseded by 2.5 at the same token rates; fal lists 2.5 Flare far cheaper than GPT Image 2 per image), Hunyuan Image 3, FLUX.2 for text slides (blurred small text in fal's own test).
7. **Upscaling is mostly unnecessary.** Generate at about 1 MP or 2K and resize to 1080x1350 / 1080x1920 with sharp. Keep SeedVR2 (`fal-ai/seedvr/upscale/image`, about $0.001 to $0.0025 per MP [V/3P conflict]) only for 4K hero assets.

Expected cost per 10-slide carousel (4:5, ~1.3 MP, high quality, including about 1.5x rerolls): **about $0.85 on GPT Image 2.5 Flare, about $2.25 on Nano Banana Pro 2K, about $0.55 on Seedream 5 Lite.** Details in Section 4.

---

## 2. fal.ai model comparison (as of 2026-10-16)

Notes on columns: "Refs" = max reference images on the edit endpoint. "Text" = text-rendering quality from the cited tests (one-shot tests, small samples, mostly not ad-specific). "4:5 / 9:16" = whether the ratio is native (enum) or via custom width/height.

| Model | fal endpoint id(s) | Price on fal | Max res | 1:1 / 4:5 / 9:16 | Text | Refs / editing | Status |
|---|---|---|---|---|---|---|---|
| **GPT Image 2.5 Flare** | `openai/gpt-image-2.5/flare/text-to-image`, `openai/gpt-image-2.5/flare/edit` | T2I high: $0.0528 (1024x1024), $0.0413 (1024x1536), $0.1002 (3840x2160). Edit high: $0.0610 (1024x1024), $0.0495 (1024x1536), assumes one 1024 ref (+~$0.008 per ref). Low: ~$0.004 to $0.006 [V, fal.ai/gpt-image-2.5] | 3840 px edge, 8.29 MP | Custom WxH, multiples of 16, ratio up to 3:1 (all three OK) [V] | Strongest family in tests (tests were on GPT Image 2) [3P]; OpenAI itself says it "can still struggle with precise text placement and clarity" [V] | 16 refs, optional `mask_url`, `background: transparent` [V] | Launched 2026-09-08 [V] |
| GPT Image 2.5 Sunburst | `openai/gpt-image-2.5/sunburst/text-to-image`, `.../sunburst/edit` | Same price table as Flare [V] | same | same | "Heavier", for precision editing [V OpenAI guide] | 16 refs | Slower; use only for hard edits |
| GPT Image 2 | `openai/gpt-image-2`, `openai/gpt-image-2/edit` (code sample on fal also shows `fal-ai/gpt-image-2`; inconsistent [V]) | High: $0.211 (1024x1024), $0.165 (1024x1536) [V] | 3840 px | Custom WxH | Best in fal's and aireiter's tests [3P] | 16 refs, `mask_url` [V] | Superseded by 2.5 |
| **Nano Banana Pro** (Gemini 3 Pro Image) | `fal-ai/nano-banana-pro`, `fal-ai/nano-banana-pro/edit` | $0.15 per image, 4K = 2x ($0.30) [V] | 4K | Enum: 1:1, 4:5, 9:16 (+ 21:9...2:3) [V] | Good multilingual, but in one packaging test 3 of 4 regions had errors; "treats text as a design element" [3P] | Up to 14 refs per fal guide [V fal article]; schema shows no explicit cap [V] | GA |
| **Nano Banana 2.1** | `fal-ai/nano-banana-2.1`, `fal-ai/nano-banana-2.1/edit` (page exists, schema readable) [V] | fal price not shown [unverified]; Google direct $0.0336 (1K), $0.0504 (2K), $0.113 (4K) [V] | 4K | Enum incl. 1:1, 4:5, 9:16, also 4:1, 1:8 [V schema] | "Enhanced text rendering" (Google claim only) [3P]; no independent test yet | `image_urls` no stated cap; Google says 14 refs [3P] | GA 2026-10-06; Google lists it as replacement for Nano Banana 2 [V] |
| Nano Banana 2 (Gemini 3.1 Flash Image) | `fal-ai/nano-banana-2`, `fal-ai/nano-banana-2/edit` | $0.08 at 1K; 2K = 1.5x, 4K = 2x, 0.5K = 0.75x [V] | 4K | Enum incl. 4:5, 9:16 [V] | Good on short headlines, drifts on small/long text [3P] | Multi-ref, `thinking_level` [V] | Google names 2.1 as its replacement [V]; one source claims shutdown 2026-10-29 [3P, unverified] |
| Nano Banana (2.5 Flash Image) | `fal-ai/nano-banana`, `/edit` | $0.0398 [V] | ~1 MP | Enum | Weaker | Multi-ref | Deprecated; Google pages disagree on shutdown date (2026-10-02 vs 2027-03-15) [V conflict] |
| Seedream 5.0 Pro | `bytedance/seedream/v5/pro/text-to-image`, `bytedance/seedream/v5/pro/edit` (no `fal-ai/` prefix) [V fal article] | $0.0675 up to 1536x1536; $0.135 up to 2048x2048; extra refs $0.0045 each (first free) [V, marked "tentative at launch"] | 2048x2048 | Custom WxH, ratios 1:16 to 16 [V] | 14 languages claimed; one misspelling in packaging test, 3.5/6 on UI test [3P] | 10 refs [V] | Launched July 2026 |
| **Seedream 5.0 Lite** | `fal-ai/bytedance/seedream/v5/lite/text-to-image`, `fal-ai/bytedance/seedream/v5/lite/edit` [V] | $0.035 [V fal article] | Up to 4096x4096 total (`auto_4K`) [V] | Custom WxH | Hangul correct, small menu text blurred [V fal article] | 10 refs, multi-image output via `max_images` [V] | GA |
| Seedream 4.5 | `fal-ai/bytedance/seedream/v4.5/text-to-image`, `.../v4.5/edit` | $0.04 [V] | 4096x4096 | Custom WxH | Fair | 10 refs [V] | Older |
| FLUX.2 [pro] / [flex] / [max] / [dev] | `fal-ai/flux-2-pro` (+`/edit`), `fal-ai/flux-2-flex`, `fal-ai/flux-2-max` (+`/edit`), `fal-ai/flux-2` (+`/edit`) | pro $0.03/MP, flex $0.05/MP, max $0.07 first MP + $0.03 each extra, dev $0.012/MP [V] | 4 MP | Custom WxH + presets | Blurred menu text, small Hangul errors in fal test [V fal article] | 10 refs [V] | "Best-in-class character realism" per fal test |
| FLUX.3 | fal pricing page lists `blackforestlabs/flux-3/edit-image` at $0.048/MP [V]; T2I id not confirmed | $0.048/MP (edit) | 4K tiers [3P] | Selectable ratio [3P] | No tests found | 10 refs [3P] | Released 2026-10-01 [3P]; too new to rely on |
| Ideogram V4 | `ideogram/v4`, `ideogram/v4/image-to-image`, `ideogram/v4/tiling` [V fal article] | Per output MP: Turbo $0.0075, Balanced $0.015, Quality $0.025 (about $0.03 / $0.06 / $0.10 at 2048x2048); prompt expansion +$0.03 unless `expansion_model` is None [V fal article] | Native 2K | `image_size` presets or custom | Ideogram reports ~0.97 OCR accuracy (vendor claim) [3P] | Image-to-image with `strength`; no multi-ref character input documented [V] | Launched 2026-06-03 |
| Ideogram V3 (+ Character) | `fal-ai/ideogram/v3`, `fal-ai/ideogram/v3/character` [V] | $0.03 / $0.06 / $0.09 (Turbo / Balanced / Quality) [V fal article] | ~1 MP | Presets | Sign OK, menu errors in fal test; one review scores it top for headlines [3P] | Character ref endpoint exists [V] | Older |
| Recraft V4 Pro | `fal-ai/recraft/v4/pro/text-to-image` [V fal article] | $0.04 [V fal article] | 2K | Presets | Blurred menu, one price error [V fal article] | Style/palette controls | Better for vector/design, not photo |
| Qwen Image 2 Pro | `fal-ai/qwen-image-2/pro/text-to-image`, `fal-ai/qwen-image-2/pro/edit` | $0.075 [V fal article; edit price 3P] | 2048x2048 | Presets | Largely correct, small price errors [V fal article] | 1 to 3 refs (order matters) [3P] | Mid |
| Qwen Image Edit 2511 | `fal-ai/qwen-image-edit-2511` [3P] | ~$0.03 to $0.037 [3P] | ~1 MP | | | Instruction edits | Cheap editor option |
| Imagen 4 (Fast/Std/Ultra) | `fal-ai/imagen4/preview/...` [3P] | Ultra ~$0.04 [3P] | 2K | | Good | No refs | **Avoid**: Google lists earliest shutdown 2026-08-17 [V] |
| Hunyuan Image 3.0 Instruct | on fal [3P] | ~$0.09/MP [3P] | | | | | Not competitive here |
| Grok Imagine (quality) | `xai/grok-imagine-image/quality/text-to-image` [V fal article] | $0.05 (1K), $0.07 (2K) [V fal article] | 2K | | Sign/menu OK, book text failed | | Not needed |
| Z-Image Turbo | `fal-ai/z-image/turbo` [V] | $0.005/MP [V] | | | Weak | | Cheap draft backgrounds only |

### Upscalers on fal
- SeedVR2 `fal-ai/seedvr/upscale/image`: $0.001/MP on model page vs $0.0025/MP in fal's upscaler guide [V conflict].
- Recraft Crisp Upscale: $0.004 flat [V fal guide]. Topaz: conflicting prices [3P].
- For Meta/TikTok statics you rarely need them: a 1024x1280 render resized to 1080x1350 is a 5% upscale that sharp (Lanczos) handles fine [INF].

---

## 3. fal platform features relevant to this build

All [V] from fal docs unless marked.

- **Client:** `@fal-ai/client` v1.10.1 on npm, Node >= 18. Server-side only; key in `FAL_KEY` env var (never ship it to a browser).
- **`fal.subscribe(endpoint, { input, logs, onQueueUpdate })`**: submits to the queue and waits; simplest for a worker process.
- **Queue API:** `fal.queue.submit(endpoint, { input, webhookUrl })` returns `request_id` plus `status_url`, `response_url`, `cancel_url`; then `fal.queue.status(...)`, `fal.queue.result(...)`, cancel. Statuses `IN_QUEUE` (with position) / `IN_PROGRESS` / `COMPLETED`. Priority header `X-Fal-Queue-Priority: normal|low`. `start_timeout` (`X-Fal-Request-Start-Timeout`) bounds queue wait. Queue-based requests auto-retry on 429; direct synchronous requests do not.
- **Webhooks:** POST with `request_id`, `gateway_request_id`, `status` (`OK`/`ERROR`), `payload`. ED25519 signature in `X-Fal-Webhook-Signature` (hex) with `X-Fal-Webhook-Request-Id`, `-User-Id`, `-Timestamp`; keys at `https://rest.fal.ai/.well-known/jwks.json` (cache max 24 h); reject timestamps more than 300 s off. Up to 31 retries with backoff; 15 s first-attempt timeout; private/loopback IPs are dropped (Lightsail public IP or domain is fine). Make the handler idempotent on `request_id`.
- **Concurrency / rate limits:** new accounts start at **2 concurrent requests**, rising automatically with credit purchases up to 40; over-limit requests wait in the queue rather than being rejected; some hot models may have per-endpoint limits. **Buy credits early** so a 10-slide carousel can fan out.
- **Storage:** `fal.storage.upload(file)` for reference images (or pass public URLs / data URIs). Generated media sits on fal CDN; lifetime is configurable per request with header `X-Fal-Object-Lifecycle-Preference: {"expiration_duration_seconds": N}` (JS: `headers` option, `JSON.stringify`), account default via fal support. Default duration is not stated publicly, so **always copy outputs to your own S3/Lightsail bucket immediately.** Request payloads are kept 30 days by default; `X-Fal-Store-IO: 0` disables that. A custom-S3 output option (`x-app-fal-upload-policy`) exists [V docs snippet, not tested].
- **`sync_mode: true`** returns a data URI and keeps output out of request history (useful for privacy; larger responses).
- **Workflows:** you can define multi-step graphs (`POST https://api.fal.ai/v1/workflows`) and run them via `workflows/execute` with streamed per-node events. For this project, orchestrating in your own TypeScript is simpler and more debuggable [INF].
- **Sandbox:** a browser tool to run one prompt across several models side by side with cost estimates and shareable results. It is not an API; use it for the bake-off in Section 7.
- **BYOK:** the GPT Image 2 page on fal exposes an optional `openai_api_key` input to route usage through your own OpenAI account [V for GPT Image 2; not confirmed for 2.5].

---

## 4. Cost per 10-slide carousel

Assumptions [INF]: 4:5 at about 1.3 MP (GPT Image: 1024x1280; Nano Banana: `4:5` at 2K; Seedream: 1088x1360), slide 1 is text-to-image, slides 2 to 10 are edits with 1 to 2 references (the hero and/or a product/character sheet), text overlay is done locally (CPU, ~$0), 1.5x reroll factor. GPT Image prices interpolated between fal's 1024x1024 and 1024x1536 rows.

| Option | Per-image (approx) | 10 slides, no rerolls | With 1.5x rerolls |
|---|---|---|---|
| GPT Image 2.5 Flare high (fal) | T2I ~$0.045, edit ~$0.055 to $0.065 | ~$0.57 | **~$0.85** |
| GPT Image 2.5 Flare medium (fal) | T2I ~$0.012, edit ~$0.02 to $0.028 | ~$0.23 | ~$0.35 |
| Nano Banana Pro 2K (fal) | $0.15 | $1.50 | **~$2.25** |
| Nano Banana Pro 4K (fal) | $0.30 | $3.00 | ~$4.50 |
| Nano Banana Pro direct Google, Batch/Flex | $0.067 | $0.67 | ~$1.00 (async, not interactive) |
| Nano Banana 2.1 direct Google 2K | $0.0504 | $0.50 | ~$0.76 |
| Seedream 5.0 Lite (fal) | $0.035 (+ref fees not documented for Lite) | $0.35 | **~$0.55** |
| Seedream 5.0 Pro <=1536x1536 (fal) | $0.0675 (+$0.0045 per extra ref) | ~$0.70 | ~$1.05 |
| GPT Image 2 high (fal) | ~$0.165 to $0.21 | ~$1.85 | ~$2.80 |
| Higgsfield Ads Studio (illustrative) | ~$0.084 (Higgsfield's own estimate) | ~$0.84 | ~$1.26, but you do not control copy |

Rule of thumb: drafts at Flare `low`/`medium` (sub-cent to 2 cents), finals at `high`. Optional 4K upscale with SeedVR2 adds well under $0.05 per carousel.

---

## 5. Higgsfield: use or not

**Verdict: Not as the primary or fallback engine. Optional, low-priority experiment for Hound only.**

What its API is in 2026 [V, Higgsfield help center and docs]:
- Separate product from the website plans: prepaid USD balance ($5 minimum top-up, funds expire after 1 year), pay per successful generation, failed requests refunded, cost-estimate endpoint, 20 concurrent requests per key (rises with top-ups).
- REST at `api.higgsfield.ai`, auth header `Authorization: Key {KEY_ID}:{KEY_SECRET}`, `Idempotency-Key` header supported, async with `request_id` + `status_url` polling or webhooks. Official Python and TypeScript SDKs. Fully usable server-side.
- Image catalog (14 model cards): SOUL, SOUL V2, SOUL Cinema, Soul ID (character training), **Marketing Studio Image** (2.0 Alpha, 2.5 Flare, 2.5 Sunburst), **Ads Studio**, Grok Image 2.0, Recraft V4.1 family, Qwen Image 3, Ideogram 4.0, Z-Image Turbo. **No Nano Banana, no Seedream, no FLUX in the API image catalog** (the website lineup differs).
- **Ads Studio** (`POST /higgsfield/ads-studio/v1.0`): you send `prompt`, `niche`, `target_audience`, `language`, `batch_size` 1 to 8, `aspect_ratio` (incl. 4:5, 9:16), up to 10 `image_urls`; it auto-generates the ad concepts and renders them. Docs say rendering uses **GPT Image 2.5 Flare** at fixed 2K/high, quality and renderer are not inputs, exact product/label/text preservation is "not guaranteed", and the illustrative cost is ~$0.084 per image at OpenAI's token rates.
- **Marketing Studio Image** (`/marketing-studio/image`, `/flare`, `/sunburst`): prompt + up to 16 `image_urls`, `quality` low..max, `resolution` 1k/2k/4k, ratios incl. 9:16 (4:5 not in its enum), optional `preset_id` from `GET /marketing-studio/image/presets` with `enhance_prompt` (product image first, optional person reference second). Starting price $0.0059/image per Higgsfield's blog [V blog, starting rate; actual config price not checked]. The 2.5 Flare/Sunburst naming matches OpenAI's model names; that it is OpenAI underneath is [INF] for Marketing Studio, [V] for Ads Studio.
- Soul 2 / Soul Cinema from $0.0032/image [V blog, starting rate]: fashion/editorial portraits.
- "Higgsfield Popcorn": not found in the API docs or catalog. Marketing Studio's web UI (templates, Shopify URL import, UGC avatars) is web/MCP-first; the API exposes presets, not the full template library [3P + V].

Why not:
1. **Same engine, less control.** Its ad features sit on GPT Image 2.5 Flare, which you can call directly on fal (or OpenAI) with your own prompts, sizes and quality.
2. **Compliance.** Ads Studio writes its own concepts and copy from a brief. For a.clinic (no prescription drug names, no before/after, regulated health claims in SK/CZ) you need every word and visual claim to be authored and approved by you. Auto-concepting is the opposite of that.
3. **No 4:5 in Marketing Studio Image** (Meta feed/carousel default); Ads Studio has it but no quality control.
4. **Narrower catalog** for statics than fal (no Nano Banana Pro for consistency, no Seedream).
5. **Ops:** outputs kept "at least 7 days", balance expiry, second vendor, second webhook format.

Where it could help: Hound lifestyle shots with people (Soul 2 is very cheap) or Marketing Studio product presets if a bake-off shows the preset prompt-enhancement beats your own prompts. Treat as an experiment, not a dependency.

---

## 6. Direct providers vs via fal

| | Via fal | Direct |
|---|---|---|
| **OpenAI GPT Image 2.5** (`gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`) | Per-image table published by fal; same API shape as every other fal model; webhooks, CDN, one bill | Same token rates as GPT Image 2: image output $30/M, image input $8/M, text input $5/M [V]. **Batch API = 50% off** [V]. Cached input only via Responses API [V]. Quality `low..max`, custom sizes up to 3840, `background: transparent` [V]. Historically OpenAI required org verification for GPT Image models [unverified for 2026]. Returns base64, you store it. |
| **Google Nano Banana Pro / 2.1** (`gemini-3-pro-image`, `gemini-nano-banana-2.1`) | NBP $0.15 (fal) | NBP $0.134 at 1K/2K, $0.24 at 4K; **Batch/Flex $0.067** [V]. NB 2.1 $0.0336 / $0.0504 / $0.113 (1K/2K/4K), Batch half [V]. Multi-turn chat edits in the Gemini API. |

Decision: **start on fal for everything** (one key, one client, swap models by changing an endpoint string, webhooks + queue already built). fal's markup over Google is about 12% on NBP (0.15 vs 0.134). Move a model direct only when (a) monthly spend on it is large enough that Batch's 50% matters and the job can wait (overnight variant generation), or (b) you need Gemini multi-turn chat editing or OpenAI Responses-API cached inputs.

---

## 7. What practitioners report (2025-2026)

Source quality caveat: almost everything findable is vendor or affiliate blogs; Reddit was not reachable from this environment and I found **no public CTR/ROAS comparison** of model-rendered text vs template overlays. Treat this as craft advice, not evidence.

- **Hybrid wins in practice.** An ad-focused comparison (soku.ai, 2026-04) recommends Nano Banana for the product/character layer and GPT Image for typography, composited in post; keep a library of 10 to 20 scene frames per campaign; log model id, prompt, refs and seed for reproducibility [3P]. Another review notes models need explicit negative space where the headline goes, which fits a template overlay [3P].
- **Text:** GPT Image 2 was the only model with clean first-run text on both packaging and UI tests (aireiter, 2026-08); Nano Banana 2 was fine on titles and drifted on small text; Nano Banana Pro made more errors on small text [3P]. Segwise (2026-06): default to no text unless the headline is central; when you need it, give the exact short string in quotes; fix headlines with an edit, not a re-roll [3P]. One ad-tech team found diffusion edits blur on-screen text and switched to detecting text regions and replacing text programmatically [3P].
- **Consistency across a series:** reference-image lock (one identity anchor image reused in every call) plus an "ingredients" set (outfit, background, prop) is the standard technique; name the palette explicitly in every prompt to stop color drift; two-character stories drift over many generations [3P]. One early test found GPT Image 2.5 held a character across four angles better than Nano Banana Pro/2 (MindStudio, 2026-09) [3P, single test].
- **Typical failure modes:** misspelled/garbled text, product changing appearance between variants, off-brand color drift, implied claims the brand cannot back, overloaded prompts dropping instructions (split into passes), positional instructions ignored, text too small to read on mobile, cropping that collides with Meta/TikTok UI [3P].
- **QA gate** (Segwise): score brand accuracy, text legibility and **claim safety** at 4/5 or higher before shipping; claim safety is critical for health brands [3P].
- **Volume:** fatigue cited at roughly 7 days on TikTok and 14 on Meta, so the pipeline must produce a steady stream of variants [3P].

### Specific to a.clinic (health-restricted)
- In Dec 2025 a coalition of 35 US state attorneys general pressed Meta over **AI-generated before/after weight-loss ads**; Meta's existing rules already bar promoting a "perfect" body and require adult targeting [V, state AG press releases]. Expect strict review of anything body-focused. Generate doctors, consultations, food, movement, phone/telehealth UI, abstract/illustrative scenes; never body transformations; keep drug names out of prompts *and* overlays.
- EU AI Act Article 50 transparency obligations applied from 2026-08-02; the machine-readable marking duty for existing systems reportedly moves to 2026-12-02 under the Digital Omnibus [3P, check EUR-Lex]. Photoreal AI people in a medical ad are the highest-risk case; consider an "illustrative / AI-generated image" label and confirm with counsel.
- Model safety filters may refuse body/weight prompts; that is a reason to keep a second-vendor fallback. fal's Nano Banana endpoints expose `safety_tolerance` 1 to 6 (API only) [V].

### Bake-off before locking (1 to 2 hours, about $5)
In fal Sandbox, run 5 prompts per brand (a.clinic: doctor video-call scene, healthy-meal flat lay, phone with app screen showing a Slovak headline with diacritics; Hound: dog + owner park scene, phone with Hound UI in Spanish) across Flare high, Nano Banana Pro 2K, Nano Banana 2.1 2K, Seedream 5 Lite. Then build one 5-slide carousel per brand with each editor. Score identity hold, product/UI fidelity, diacritic accuracy, realism. Lock models per brand from the results.

---

## 8. Request shapes for the recommended endpoints (TypeScript, `@fal-ai/client`)

Parameter names below are from fal's published schemas [V]. Not executed in this research.

```ts
import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_KEY }); // server only

const KEEP_1D = {
  "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 86400 }),
};

// Upload a local reference (character sheet, product, app screenshot)
const refUrl = await fal.storage.upload(new Blob([pngBuffer], { type: "image/png" }));

// 1) Hero slide: GPT Image 2.5 Flare, 4:5, no text (overlay added later)
const hero = await fal.subscribe("openai/gpt-image-2.5/flare/text-to-image", {
  input: {
    prompt: "Photoreal, warm natural light. A woman in her 40s on a video call with a friendly doctor on a laptop at a kitchen table. Leave the top 30% of the frame as clean, uncluttered wall for a headline. No text, no logos.",
    image_size: { width: 1024, height: 1280 }, // 4:5, multiples of 16
    quality: "high",            // low | medium | high | xhigh | max | auto
    num_images: 2,
    output_format: "png",       // png | jpeg | webp
    // background: "transparent" // for cut-out product/UI layers
  },
  headers: KEEP_1D,
});
const heroUrl = hero.data.images[0].url;

// 2) Follow-on slides: Flare edit with the hero + references (up to 16)
const slide = await fal.subscribe("openai/gpt-image-2.5/flare/edit", {
  input: {
    prompt: "Same woman, same clothes and hair as image 1. She is now preparing a colorful vegetable bowl in the same kitchen. Keep the top 30% empty. No text.",
    image_urls: [heroUrl, refUrl],
    image_size: { width: 1024, height: 1280 },
    quality: "high",
    // mask_url: "...", // optional region edit
  },
  headers: KEEP_1D,
});

// 3) Consistency editor alternative: Nano Banana Pro edit, native 4:5
const nbp = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
  input: {
    prompt: "Use the dog in image 1 and the owner in image 2. Same dog breed, coat pattern and collar. Scene: rainy city sidewalk, dog sitting calmly at heel. No text.",
    image_urls: [dogRefUrl, ownerRefUrl],
    aspect_ratio: "4:5",        // also "1:1", "9:16", "auto"
    resolution: "2K",           // "1K" | "2K" | "4K" (4K costs 2x)
    num_images: 1,
    output_format: "png",
    // safety_tolerance: "4",   // "1".."6", API only
  },
});

// Fallback text-to-image: Nano Banana 2.1 (or Seedream 5 Lite)
await fal.subscribe("fal-ai/nano-banana-2.1", {
  input: { prompt, aspect_ratio: "9:16", resolution: "2K", output_format: "png" },
});
await fal.subscribe("fal-ai/bytedance/seedream/v5/lite/text-to-image", {
  input: { prompt, image_size: { width: 1088, height: 1360 }, num_images: 1 },
});

// Fan-out for a carousel with webhooks instead of holding connections open
const { request_id } = await fal.queue.submit("openai/gpt-image-2.5/flare/edit", {
  input: { prompt, image_urls: [heroUrl], image_size: { width: 1024, height: 1280 }, quality: "high" },
  webhookUrl: "https://your-domain.example/fal/webhook", // verify ED25519 signature, dedupe on request_id
});
// later: await fal.queue.status(endpoint, { requestId: request_id }); await fal.queue.result(endpoint, { requestId: request_id });
```

Sizes to use (multiples of 16 for GPT Image; resize to delivery size with sharp):
- 1:1 -> 1024x1024, deliver 1080x1080
- 4:5 -> 1024x1280, deliver 1080x1350
- 9:16 -> 1152x2048, deliver 1080x1920

Post-processing on the Lightsail box (CPU only): download output to your bucket, `sharp` resize/crop, render the text layer with Satori + `@resvg/resvg-js` using embedded brand fonts (handles diacritics deterministically if the font has the glyphs), composite, export JPEG/PNG. Optional: run an LLM vision/OCR check on any model-rendered diegetic text before publishing.

---

## 9. Open items / unverified

- fal price for Nano Banana 2.1 (page exists, price not rendered). Check `fal.ai/pricing` or the model playground.
- Whether GPT Image 2.5 / Nano Banana render Slovak and Czech diacritics reliably: no published test found. Covered by the bake-off and by overlaying copy in templates.
- GPT Image 2.5 `num_images` cap (fal launch page says 4, llms.txt says 10).
- GPT Image 2 endpoint prefix on fal (`openai/` vs `fal-ai/`) is inconsistent on fal's own page; 2.5 consistently uses `openai/...`.
- Default fal CDN retention not documented publicly.
- Higgsfield per-config prices for Marketing Studio Image / Soul 2 beyond "starting at"; "Popcorn" not in API.
- FLUX.3 availability and text-to-image id on fal.
- EU AI Act Article 50 dates: verify on EUR-Lex.

## Sources

- fal pricing: https://fal.ai/pricing
- fal GPT Image 2.5 launch page: https://fal.ai/gpt-image-2.5 ; edit schema: https://fal.ai/models/openai/gpt-image-2.5/flare/edit/api
- fal GPT Image 2: https://fal.ai/models/openai/gpt-image-2 ; edit: https://fal.ai/models/openai/gpt-image-2/edit/api
- fal Nano Banana Pro: https://fal.ai/models/fal-ai/nano-banana-pro/api ; edit: https://fal.ai/models/fal-ai/nano-banana-pro/edit/api
- fal Nano Banana 2 edit: https://fal.ai/models/fal-ai/nano-banana-2/edit/api ; 2.1 edit: https://fal.ai/models/fal-ai/nano-banana-2.1/edit
- fal "10 Best Text-to-Image APIs in 2026" (2026-06-25): https://fal.ai/learn/tools/best-text-to-image-apis-2026
- fal Seedream 5.0 Pro guide (2026-07-14): https://fal.ai/learn/tools/how-to-use-seedream-5-0-pro-v2 ; Seedream 5 Lite edit: https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/edit/api ; Seedream 4.5 edit: https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/edit/api
- fal FLUX.2: https://fal.ai/flux-2 ; FLUX.2 pro edit: https://fal.ai/models/fal-ai/flux-2-pro/edit/api
- fal Ideogram V4 guide (2026-07-14): https://fal.ai/learn/tools/how-to-use-ideogram-v4
- fal docs: queue https://fal.ai/docs/model-apis/model-endpoints/queue ; webhooks https://fal.ai/docs/model-apis/webhooks ; concurrency https://fal.ai/docs/documentation/model-apis/concurrency-limits ; media expiration https://fal.ai/docs/documentation/model-apis/media-expiration ; workflows https://fal.ai/docs/documentation/model-apis/workflows ; playground/sandbox https://fal.ai/docs/documentation/model-apis/playground ; upscalers guide https://fal.ai/learn/tools/image-to-image-upscalers
- npm @fal-ai/client: https://registry.npmjs.org/@fal-ai/client/latest
- OpenAI pricing: https://developers.openai.com/api/docs/pricing ; image guide: https://developers.openai.com/api/docs/guides/image-generation
- Google Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing ; deprecations: https://ai.google.dev/gemini-api/docs/deprecations
- Higgsfield API help: https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api ; blog (2026-09-16): https://higgsfield.ai/blog/higgsfield-api ; docs: https://docs.higgsfield.ai/docs ; image models: https://docs.higgsfield.ai/docs/models/image-generation ; Marketing Studio Image: https://docs.higgsfield.ai/docs/models/marketing-studio-image/generate-and-edit and /flare ; Ads Studio: https://docs.higgsfield.ai/docs/models/ads-studio/generate
- Practitioner/3P: https://soku.ai/blog/gpt-image-2-vs-nano-banana-2-ad-creative ; https://segwise.ai/blog/claude-nano-banana-static-meta-ads ; https://aireiter.com/blog/best-ai-image-model-text-rendering-2026 ; https://www.mindstudio.ai/blog/gpt-image-25-review ; https://artlist.io/blog/nano-banana-2-1-what-changed/ ; https://the-decoder.com/ideogram-4-0-drops-as-an-open-weight-model-with-native-2k-resolution-and-improved-text-rendering/
- Regulatory context: https://www.attorneygeneral.gov/?p=32582 ; https://compliancehub.wiki/eu-ai-act-article-50-transparency-digital-omnibus-2026/
