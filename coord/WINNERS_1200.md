# Winners refresh 12:00 (for operator approval)

Source: `scripts/winners.ts <slug>` (Spiral brand winners + Spiral ads search, YouTube Shorts, one Apify TikTok search per brand). Raw candidates in `data/winners/<slug>.raw.json`, curated top 3 in `data/winners/<slug>.json`. Every number below comes from a provider response. Spiral exposes no Meta Ad Library id, so the Meta links are the Spiral-hosted creative (Spiral ad uuid in the JSON). Nothing in the DB or existing concepts was changed. Spend: Apify $0.19 (3 TikTok searches), Spiral ~10 credits (390 left), YouTube free.

## Hound

OLD: @lunadreamsuk TikTok, 16,400 views on 569 followers (under the 50k bar) and "DeadlyBeats" Meta ads (off-category music page).

| rank | platform | link | advertiser | key numbers | bar rule passed | why it wins | format |
|---|---|---|---|---|---|---|---|
| 1 | Meta ad (EN) | [creative](https://assets.spiral.ad/c/mTF-fYwW2599W8Pn-kX10tafGjYWT-897_TB7mvypzymUctgeAoz-BrIDFmkIhVLenPaQQmPegFTyspDFCV15ObVkgodMZvhqh2YnT2jLNILFGBReDHkIzNgrEm2Yu7NtF_1cDd8anHFA35q5B7B-oZKVk1_ye8.mp4) | Zigzag | active_days 275, duplicate_count 9, active | 45+ days and 3+ variants | "Biting, Chewing and Potty training, we've got you covered": a pain list then a free personalised plan, kept live 275 days in 9 copies. | video |
| 2 | TikTok organic | [video](https://www.tiktok.com/@betternaturedogtraining/video/7581868680695368982) | @betternaturedogtraining | 145,200 views, 8,656 likes, 823 shares, 26,300 followers (5.5x) | 5x+ followers and 50k+ views | A trainer answers Hound's exact problem (dog panics the moment you leave) with one concrete first step: drop the pre-departure cues. | video |
| 3 | Meta ad (EN) | [creative](https://assets.spiral.ad/c/sBZnOBGm3DRChNe38qD-v3h9XDLYECGvUKhwxqkgYwy6QzLQJzgZU_DjuWXzS0bjskhgMcGyjIWgQgV4W32hNnvFtKPg1OO4wF0wIdHwiPQnGAhtzX2KeCIn8lc31DjagURJp5HiQ2cpbFt4Ql8DDrkhwRLkqy8.mp4) | Woofz | duplicate_count 79 (static twin: 92), active_days 10 | 3+ variants | Contrast hook "Big dog growls? Danger. Small dog growls? Cute." being scaled hard right now. | video |

Carousel winners: Zigzag EN carousel, active_days 222, duplicate_count 20 (Spiral uuid f7d0d9ed-e45b-4d52-b9c4-74ecadeef884); Dogo mixed carousel, active_days 716, eu_total_reach 542,729 (adc87168-a788-4c63-bcdd-988a4ec6c10f). Also on-category: Dogo Spanish video, 699 days. Not reached: Pupford and GoodPup are not in Spiral's corpus; YouTube Shorts hits (Mocha Pom 231M views, 54x subs) are general dog tricks, not separation anxiety.

## a.clinic

OLD: @drdietka TikTok, 93k views (good, kept as the organic reference).

| rank | platform | link | advertiser | key numbers | bar rule passed | why it wins | format |
|---|---|---|---|---|---|---|---|
| 1 | Meta ad (EN) | [creative](https://assets.spiral.ad/c/wRXzmmkkJmAjr65-jGPq_LS_hSz2K7SsOoP7JKJgDctjBxEGAKDKX8cTkTA8VZ9zWEKcXL7sS9QH3vUvhMsE_tb67t5mXyLkOtpzKewQJjILltW9vpLwq6r0evh7smoYfz48NKiBnl17F2L1qviNEBf02MOLNdc.mp4) | HealthifyRx (Healthify) | 125 days (2026-05-01 to 2026-09-03) | 45+ days | Doctor-guided support + medical treatment + coaching in one list: the a.clinic promise, run for 125 days. | video |
| 2 | Meta ad (EN) | [creative](https://assets.spiral.ad/c/kaYEDslkufzHGsr_IBIDmD9-AnNpq8XfxiYOHQIB3dAiqZDDgGgwnBFf89c-v8wNDtAubkJ3JThdexe_sgO8CPDBN_3itUi3zKMQ6ggcS-HJfLXc0PDgDpSYD9uryWOXagWkv1ZN_SHDeewZulsmW_xNrATZqp1TZVA_F3dWrBNwVb8XBw.mp4) | MeAgain (GLP-1 tracker) | 51 days | 45+ days | "My GLP-1 telehealth sent the prescription and nothing else": attacks script-only telehealth, the gap doctor-led follow-up fills. | video |
| 3 | Meta ad (EN) | [creative](https://assets.spiral.ad/c/_pxy2UezRyMQfvu3GfWKAy9SzhUwa3Ss4-S-y5ZltNZYxSgI6Bpm5eVxOZPKtZ9UJ9D1YmjClFt1D9frINsPrw5fMwNn4YSVHRcgCbef1KlDM68ZAICGcjSkoiN0OhjnLRJGdwM0DRNoORfl82xGuL34Czy8A0U.mp4) | Hers | 52 days (2026-04-13 to 2026-06-04) | 45+ days | Provider-led GLP-1 "why us" checklist (online, personalised care). Remake structure only: EU rules forbid naming Rx drugs or prices. | video |

Carousel winners: Healthify 3-card carousel to an eligibility quiz, 137 days, still active (uuid 8eeb852e-b2ca-44a0-8d8a-28e831f92690); Science & Humans weight-loss carousel, 297 days. Organic runners-up (pass the organic bar): YouTube "Tirzepatide vs Ozempic" by Доктор Зарифа Романова, 345,953 views on 37,300 subs (9.3x), https://www.youtube.com/shorts/CuhJ9Xs27PM; TikTok @chanelz.way Ozempic transformation, 101,200 views on 17,500 followers (5.8x); Slovak @chudnutie_zdrava_strava 209,700 views on 20,600 (10.2x) but it is a diet recipe, not doctor-led. Not reached: Hims & Hers (only the Hers brand surfaced via ads search), Voy, Juniper, Ro, Found not in Spiral or hit Spiral's 20/hour brand-search limit; Numan's Spiral winners are ED, blood tests and supplements (off-category, rejected). No SK/CZ doctor-led GLP-1 creator beat @drdietka in this pass.

## Dynova

OLD: a Turkish obstetrician's Meta ad (off-category).

| rank | platform | link | advertiser | key numbers | bar rule passed | why it wins | format |
|---|---|---|---|---|---|---|---|
| 1 | Meta ad | [creative](https://assets.spiral.ad/c/C1HshaqeXA8ySeoue3ArFbj8lFvBwLXjmJoKXV7Xvp3tSBqGbhKIUGpbzHFzJaQuH55mJlGB6OmhDb3uF7qLNs8L1MtkX_I6sSXz9_2CeXo3I34Zwhq0YHcYWhR9Q7m7oo3BWkjVeCOtuCrOCs9zw0cdWsGsRWRaTcM.jpeg) | AG1 | active_days 229, duplicate_count 18, winning_score 91.7 (proven_winner), active | 45+ days and 3+ variants | AG1's #1 of 586 active creatives: a 3-card carousel, the strongest supplement-category signal found. | carousel |
| 2 | Meta ad (EN) | [creative](https://assets.spiral.ad/c/60qfgili6-98kmjSJunMieTvfSXHwatXeAXBbz7Uv-0zpzmPCx7Co_CvKbKT9nVDyOMZeoX_0pOsyiLBZm_W-KQuAado6R2o4RcC_gIkjfgrrGDfHHoMxofmlFHFHJ5eEF3AHbtWgIeHWX8cFjJuKvS4SF2Ixt8.mp4) | ZOE | 62 days (2026-07-29 to 2026-09-29) | 45+ days | Closest model to Dynova (test-led personalised nutrition): "fits the meals you already eat" plus a low-price trial. | video |
| 3 | TikTok organic (TR) | [video](https://www.tiktok.com/@mutlusungunes/video/7480153175081618696) | @mutlusungunes | 248,400 views on 471 followers | 5x+ followers and 50k+ views | Turkish "my DNA results came back" reveal; the format travels in Turkish, but the topic is ancestry, not nutrition (partial category). | video |

Carousel winners: AG1 #1 above; AG1 carousels at 153 days/13 variants and 95 days/6 variants (eu_total_reach 445,000); Medichecks blood-test carousels at 229 and 185 days (adjacent category). Runner-up organic TR: @ezgibuseb "DNA testi sonucum geldi", 62,500 views on 1,247 followers (50x). Falls short: 23andMe, Viome, Nebula, Ritual, Care/of are not in Spiral's app corpus (searched by name, no match), and no Turkish DNA-plus-nutrition player surfaced, so there is no fully on-category Turkish winner yet.
