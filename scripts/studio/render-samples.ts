/** tsx scripts/studio/render-samples.ts <outDir>: every template with sample copy (no API calls). */
import path from "node:path";
import { contactSheet, renderSlide } from "@/engine/studio/render/templates";
import type { Slide, StudioBrandConfig } from "@/engine/studio/types";

const out = process.argv[2] ?? "data/studio-samples";
const cfg: StudioBrandConfig = {
  countries: ["GB"], languages: ["en"], defaultLanguage: "en", competitors: [], searchTerms: [], placement: "paid",
  imageModel: "openai:gpt-image-2", aspects: ["4:5"], logo: "/api/assets/brands/hound/logo-icon.png", brandImages: [],
  colors: { primary: "#F2B33D", accent: "#F2B33D", ink: "#1B1A17", paper: "#FBF6EC" },
  fonts: { head: "jakarta", body: "inter" }, notes: [], testimonials: [], disclaimers: [], ctaUrl: "houndapp.xyz",
};
const img = path.resolve("assets/brands/hound/hero-not-alone.webp");
const img2 = path.resolve("assets/brands/hound/problem-barking.webp");
const S: [Slide, string | undefined][] = [
  [{ template: "photo_headline", image: { source: "brand" }, slots: { eyebrow: "Separation anxiety", headline: "Your dog isn't bad. He's scared to be alone.", accentWord: "scared", body: "10 minutes a day, a plan built for your dog.", cta: "Get the plan" } }, img],
  [{ template: "split_panel", image: { source: "brand" }, slots: { eyebrow: "New", headline: "A daily plan for barking that actually fits your day", accentWord: "barking", body: "One short exercise a day. Track progress and streaks.", cta: "Start free" } }, img2],
  [{ template: "checklist", image: { source: "brand" }, slots: { headline: "Why owners switch to Hound", accentWord: "Hound", bullets: ["A plan built for your dog's age and problem", "10 minutes a day, no trainer visits", "Calm methods: no punishment, ever", "Progress you can see week by week"], cta: "Take the quiz" } }, img],
  [{ template: "comparison", image: { source: "none" }, slots: { headline: "Hound vs a group class", accentWord: "Hound", leftLabel: "Hound", rightLabel: "Group class", rows: [{ label: "Plan for your dog", us: "Yes", them: "No" }, { label: "Train at home", us: "Yes", them: "No" }, { label: "Price per month", us: "From 5 EUR", them: "80+ EUR" }, { label: "Daily guidance", us: "Yes", them: "No" }], cta: "Try Hound", footnote: "Group class price: typical UK range." } }, undefined],
  [{ template: "notes_app", image: { source: "none" }, slots: { eyebrow: "Today at 21:14", headline: "Things I wish I knew before getting a puppy", bullets: ["Crying at night is normal for the first week", "Short sessions beat long ones", "Leaving the house is a skill you can train", "Calm in, calm out"], footnote: "houndapp.xyz" } }, undefined],
  [{ template: "post_card", image: { source: "brand" }, slots: { body: "Hot take: most \"stubborn\" dogs are just bored. Ten minutes of the right exercise beats an hour of walking." } }, img2],
  [{ template: "myth_fact", image: { source: "none" }, slots: { headline: "Leaving the TV on fixes separation anxiety", myth: "Leaving the TV on fixes separation anxiety.", fact: "Dogs learn to be alone in small, calm steps. Start with 30 seconds.", cta: "Get the plan" } }, undefined],
  [{ template: "offer_card", image: { source: "product" }, slots: { headline: "Your dog's plan, ready in 2 minutes", accentWord: "plan", body: "Answer 6 questions about your dog.", price: "First week free", cta: "Take the quiz" } }, path.resolve("assets/brands/hound/age-puppy.webp")],
  [{ template: "text_slide", image: { source: "none" }, slots: { eyebrow: "01", headline: "Practise leaving, not just coming back", accentWord: "leaving", body: "Pick up your keys, walk to the door, sit back down. Do it until your dog stops caring." } }, undefined],
  [{ template: "stat", image: { source: "brand" }, slots: { stat: "10 min", statLabel: "a day is all the plan asks", body: "One exercise, every day, built around your dog." } }, img],
  [{ template: "quote_card", image: { source: "brand" }, slots: { quote: "I could finally go to the shop without coming home to a chewed sofa.", attribution: "Sample quote, not a real review" } }, img],
  [{ template: "ugc_caption", image: { source: "brand" }, slots: { headline: "POV: you finally left the house without the crying", body: "Day 9 of a 10 minute plan" } }, img],
  [{ template: "letter", image: { source: "brand" }, slots: { eyebrow: "A note from our trainer", headline: "Your dog is not stubborn", body: "Most dogs I meet are not stubborn. They are under-practised.", bullets: ["Ten calm minutes a day beats a long weekend session.", "Start smaller than you think. Then stop while it is still easy."], attribution: "Sample Name, sample credential" } }, img2],
  [{ template: "quiz", image: { source: "none" }, slots: { eyebrow: "1 minute quiz", headline: "What does your dog do when you leave?", bullets: ["Barks or howls", "Chews things", "Waits at the door", "Nothing, he's fine"], cta: "Get the plan" } }, undefined],
  [{ template: "sticky", image: { source: "brand" }, slots: { headline: "Sit. Wait. Treat. 5 min x 2", body: "The whole plan for today" } }, img2],
  [{ template: "steps", image: { source: "none" }, slots: { headline: "How Hound works", bullets: ["Tell us about your dog: age, breed and the problem", "Get a daily plan: one 10 minute exercise", "Track progress: streaks and weekly check-ins"], cta: "Take the quiz" } }, undefined],
  [{ template: "cta_end", image: { source: "brand" }, slots: { headline: "Start your dog's plan today", accentWord: "today", cta: "houndapp.xyz" } }, img2],
];
const files: string[] = [];
for (const [i, [slide, f]] of S.entries()) {
  const r = await renderSlide({ slide, aspect: "4:5", brand: { name: "Hound", config: cfg }, imageFile: f, index: slide.template === "text_slide" ? { i: 1, n: 6 } : undefined, out: path.join(out, `${String(i).padStart(2, "0")}_${slide.template}.png`) });
  console.log(slide.template, "contrast", r.minContrast);
  files.push(r.file);
}
const sq = await renderSlide({ slide: S[2]![0], aspect: "1:1", brand: { name: "Hound", config: cfg }, imageFile: img, out: path.join(out, "sq_checklist.png") });
const tall = await renderSlide({ slide: S[0]![0], aspect: "9:16", brand: { name: "Hound", config: cfg }, imageFile: img, out: path.join(out, "story_photo.png") });
await contactSheet(files.slice(0, 6), path.join(out, "sheet1.jpg"));
await contactSheet(files.slice(6, 12), path.join(out, "sheet2.jpg"));
await contactSheet([...files.slice(12), sq.file, tall.file], path.join(out, "sheet3.jpg"));
