# Contract changes (append only)
| Time | Lane | Change | Breaking? | Both sides updated? |
|---|---|---|---|---|
| 11 Oct 23:29 | A | v1.0.0 initial contracts per ARCHITECTURE §5/§6. Additive extras (all optional): `RunEventType` adds `status`; `Run.dataset/capturedAt/manusTaskUrl`; `BrandDossier.provenance/operatorNotes`, `visual.referenceImages/styleNotes`; `Question.fills/scale`; `ChannelRec.answerIds`; `ChannelPlan.considered`; `Concept.remakeNote/videoAssetId/body/revisions`; `Asset.shotIdx`; `ComplianceCheck.attempt`; `PublishPack.runId/landingUrl`; `ProviderStatus.label/usedFor`; `SpendResponse.totalUsd`; `BrandSummary` (= Brand + counts + lastRun) for GET /api/brands | no | n/a (first version) |
