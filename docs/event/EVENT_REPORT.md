# 10X Your Brand Hackathon: Event Report

Istanbul Ignited by Slush'D, supported by Manus AI
**Mon 12 Oct 2026 · DotsHub, Yıldız, Çırağan Cd. No:44, Beşiktaş, Istanbul**
Luma: https://luma.com/6rsu5afk (Mete is registered, status "You're In")

Compiled 2026-10-11 from: the rendered Luma page, the five organizer emails (Oct 2, Oct 4, Oct 5, Oct 10, Oct 11), the fal.ai/Manus setup doc linked from the Oct 10 email, and the Manus 2.0 launch post. Anything not from those sources is marked **(prior notes)** or **(unverified)**.

---

## 1. The task in one line

Use **Manus** to (a) bring a new idea to life, (b) upgrade an existing brand or business, or (c) automate a repetitive marketing/business workflow. Show **what existed when you walked in vs what exists at 15:00**.

Example outputs they list: campaign, landing page, brand system, content engine, automated workflow, launch-ready concept. Must be a working demo or tangible result.

Audience they target: founders, marketers, designers, operators, early teams. The room skews founder/operator/investor, not engineer.

## 2. Schedule (current, Istanbul time)

| Time | What |
|---|---|
| 08:30 to 09:00 | Check-in, breakfast. **Doors close 09:00 sharp.** |
| 09:00 to 09:10 | Welcome, challenge, judging criteria |
| 09:10 to 09:30 | Manus demo (Kaan Taşkent + Ceren İnce): Manus 2.0, Apify, fal.ai |
| **09:30** | **Build starts** |
| 12:30 | Lunch available, build continues |
| **15:00** | **Build ends, submissions lock** |
| 15:00 to 15:15 | Station + pitch order assigned |
| 15:15 to 16:00 | Preliminary judging: **2 min pitch+demo, 1 min Q&A, to ONE judge** |
| 16:00 to 16:30 | Top 6 on stage: **3 min pitch+demo, 1 min Q&A, all 6 judges** |
| 16:30 to 16:45 | Deliberation |
| 16:45 to 17:00 | Awards |
| 17:00 to 17:30 | Networking |

**Net build time: about 5.5 hours** (09:30 to 15:00). Note: the August application pack assumed ~3 hours and a 10:00 start. That is outdated.

## 3. What they give us

| Provided | Detail | Source |
|---|---|---|
| **Manus credits** | **10,000 per participant** (so 20,000 for the two of us) | Oct 10 email |
| **fal.ai credits** | **$50 per participant**, claim link after check-in | Luma page |
| **Apify credits** | "Plenty", amount not stated | Oct 10 email |
| Claim links + hackathon guide | Shared **after check-in** | Oct 11 email |
| Manus demo | 09:10, includes Manus 2.0 | Agenda |
| Mentors | Judges and mentors circulate during the build | Luma page |
| Food | Breakfast, lunch from 12:30, drinks all day | Emails |

**Higgsfield is out.** It was the original video partner; it dropped on Oct 10. Use only with our own account. fal.ai replaces it and is the supported creative tool.

### fal.ai inside Manus (setup guide from organizers)
1. Manus, chat area, **Connect Apps**
2. **Create**
3. **Add MCP by URL**
4. Paste `https://mcp.fal.ai/mcp-relay`

fal resources they point to: model catalogue, Sandbox (compare models side by side), Workflows + Workflows API, fal MCP, Genmedia CLI, fal Agent + Agent SDK. Video models they highlight as Higgsfield-style: **H3 Max Recast** (replace characters in existing video), **Kling 3.0 Motion Control** (animate from reference footage).

### What Manus 2.0 is (launched 28 Sep 2026)
- **Cascade** architecture: loads capabilities only when needed (their numbers: ~23% fewer tokens, ~32% lower cost on one test).
- **Studio**: docs, sheets, PDFs, slides, websites, code, games, and a **video editor** (timeline + "Alchemy" AI-directed mode).
- **Automations**: event-triggered workflows from email, calendar, Slack, Notion (replaces time-only scheduled tasks).
- **Cloud Computer**, **Remote Control / Computer Use**, and **Cue** (personal agents app, invite only).
- Native connectors **(prior notes, Aug, verify in 2.0)**: Meta Ads Manager, Gmail, Calendar, Drive, Notion, Slack, Stripe, HubSpot, GitHub, Linear, monday.com, Zoom, Supabase. No Google Ads or Shopify connector found then.
- Reliability **(prior notes)**: long agent chains fail far more often than short ones. Pre-run long jobs, keep the live demo short.

## 4. Judging (the part that decides everything)

**Five criteria, equal weight (20% each), scored 1 to 5, total x4 = /100:**

1. **Problem and value**
2. **Execution and quality**
3. **Use of Manus and tools** (Manus + Apify + fal.ai)
4. **Potential and impact**
5. **Pitch quality**

Again different from August: the old rubric was Transformation / Speed / Use of Manus / Real-world utility. Pitch quality is now an explicit 20%, which plays to our strength.

**Mechanics that matter:**
- Prelims: 6 judges, 6 stations, 4 rooms (Feriye Room 1: st. 1-2, Feriye Room 2: st. 3-4, DotsHub Room 3: st. 5, DotsHub Room 4: st. 6). Each judge sees ~7 to 8 teams and **picks exactly 1 finalist + 1 reserve**. So we only have to beat the 6 or 7 teams at our station, in front of one person, in 2 minutes.
- Finals: scores reset, 3 min + 1 min Q&A, judges agree a ranking together.
- Paper score sheets.

**Judges (per the Oct 2 organizer email):** Kaan Taşkent (Slush'D Head of AI Experience, Manus Fellow), Mert Akdere (Clerion), Ahmet Onur (Kolektif House), Özgür Akaoğlu (Hilbert), Eren Ulu (Hilbert), one more TBA. Detail in `judges/JUDGES.md`.

## 5. Prizes

| Place | Prize |
|---|---|
| 1st | 3 months Manus Pro ($600 value) |
| 2nd | 2 months Manus Pro ($400) |
| 3rd | 1 month Manus Pro ($200) |
| 4th to 6th | Merch |

No cash. The real value is stage time in front of the Slush'D organizers and judges the day before the main event (investor goals: HV Capital, e2vc).

## 6. Rules and logistics

- Free for approved participants. ~106 going on this track, ~200 across both tracks (Codex track runs in parallel).
- **Teams of 2 to 4 encouraged**, solo allowed. Team = Mete + Emir.
- Bring: laptop, charger, water bottle. **Create tool accounts before arriving.**
- No published submission format beyond "locks at 15:00, working demo or tangible result". Expect details in the post check-in guide.
- Public transport strongly encouraged; valet only, ~850 TL.
- Perk: 25% off main-event tickets (Oct 13 to 14) with codes `Startup-EB-Extended` or `FutureFounder-EB-Extended`, 50 tickets only.

## 7. What this means for us (read before picking the build)

- **Manus has to be the engine, not a garnish.** 20% is literally "use of Manus and tools", and Kaan (a Manus Fellow) runs the demo and judges. Best shape: Apify pulls live web data, Manus reasons and orchestrates, fal.ai renders, Manus ships the output (site, deck, video, automation).
- **The before/after has to be visible in 2 minutes.** Open on the "before" (nothing, or the weak original), end on a live link.
- **Pre-run the long jobs, demo the short one.** Wide Research style fan-outs eat credits and time; start them in the first 30 minutes.
- **Freeze by ~13:30.** Leave 14:00 to 15:00 for a backup screen recording and two pitch rehearsals. The 2-minute prelim is to one judge at a station, so rehearse the 2-minute version, not just the 3-minute one.
- **Credits:** 20,000 Manus credits between us is a lot more than the 300/day free tier, but a big parallel research run can still burn 1,000+ **(prior notes)**. Watch the meter.

## 8. Open questions (ask at check-in)

- Submission format and where to submit (form? link? video?)
- Exact Apify credit amount; fal credit expiry
- Name of the 6th judge
- Can we use our own accounts/tools alongside (Claude Code, our own Higgsfield, our own domains)?

Sources: [Luma event](https://luma.com/6rsu5afk) · [Manus 2.0 post](https://manus.im/en/blog/introducing-manus-2-0) · organizer emails in Gmail (Oct 2 to Oct 11)
