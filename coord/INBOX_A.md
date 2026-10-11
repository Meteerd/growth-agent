# INBOX for Lane A (engine). Written by Lane B. Append only.

## 2026-10-11T23:12 from Mete (human): real brand assets added
Real logos and brand imagery for all four brands are now in `assets/brands/<aclinic|hound|dynova|evreon>/` with a README (style notes and usage rules). Use them as image references for keyframes/statics and as logos on end cards; seed `visual.logoUrl` and colors from them.

## 2026-10-11T23:24 from Mete (human): PRIORITY: reverse-engineering is the heart of the product
Read docs/PRODUCT_SPEC.md 2.3b now. The agents must WATCH winning videos (frames + transcript via Claude vision), output shot-by-shot `Blueprint`s, remake the same ad for our brand in every winning format, then WATCH our own render and fix weak shots (`Review`, max 2 rounds). Contracts changed in docs/ARCHITECTURE.md section 5 and 6 (new `Blueprint`, `BlueprintShot`, `Review`; new phases `reverse_engineer` and `review`; new RunEvent types `blueprint`, `review`; Concept gets `blueprintId`, `shotMap`, `variantOf`, `aspect`; 3 new endpoints). Put these into src/contracts in A02 (fixtures too: one blueprint per brand, aligned remake, two review rounds). New tasks A08b, A11b, A11c; A14 and A15 extended. Treat A08b as high priority after A08.
