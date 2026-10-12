# Private brand split (Lane A + Lane B render in parallel)

All brand data, footage, voices, scripts and outputs stay in `data/camplan/` (gitignored). Mete sends `data/camplan/` (with `drive/`, `voices.json`, `personas.json`, `examples.json`, `scene-kinds.json`, `scene-motion.json`, `make.ts`, `batch.ts`, `examples.ts`) to Emir's PC together with Viktor's zip. Nothing of it goes into git.

Pipeline (data/camplan/make.ts): copies the exact timeline of one of Viktor's winners (`--template`, from examples.json), the persona talking-head hook (ElevenLabs voice + Aurora lip sync from that line's audio), then real Scenes footage cut every ~1.6 s on each clip's most moving window (never the scan setup screens, never slowed, camera footage first for scan beats, full frame), the persona voice locked to the template timing, an ElevenLabs music bed matched to the template, Viktor's caption style, outro4.mp4, motion gate + Gemini gate, Viktor's 8-segment file names, data/camplan/out/g2/<concept>/{Input,Output} + manifest.json/.csv.

| templates | owner |
|---|---|
| 1 FirstEstimate, 2 concept16, 3 fastEstimate, 4 jobSite | Lane A |
| 5 lidarScan, 6 smallLidar, 7 show3D, 8 projectPlan | Lane B |

2-3 variants per template, each with a different persona, hook line, talking head (person + setting), language (about 1/3 spanish) and first 3 s.

One variant (Lane B example):
```bash
CONNECTOR_BRAND=camplan CAMPLAN_DRIVE=data/camplan/drive/ai-creative-agent \
  npx tsx --tsconfig tsconfig.json data/camplan/make.ts --generation g2 --concept t05_lidarScan_v1 \
  --template lidarScan --format story --persona architect --language english --hook secret --emotion curiosity \
  --title hiddenScanner --setting "in a bright empty loft, holding an iPhone"
```
Keys needed on that PC: ELEVENLABS_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY (presenter image). Outputs merge by folder; manifest entries are keyed by file name.
