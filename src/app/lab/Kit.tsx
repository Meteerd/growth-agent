"use client";

import { useState } from "react";
import { Badge, ComplianceBadge, DemoBadge, MonoLabel, RunStatusBadge, StatusDot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/Chip";
import { CostMeter } from "@/components/ui/CostMeter";
import { EvidenceCard } from "@/components/ui/EvidenceCard";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Dialog, Sheet, Tooltip } from "@/components/ui/Overlay";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PhaseRail } from "@/components/ui/PhaseRail";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { ProviderTile } from "@/components/ui/ProviderTile";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { UrlInput } from "@/components/ui/UrlInput";
import { DEMO_RUNS, PHASES, PROVIDER_INFO } from "@/contracts";

const hound = DEMO_RUNS.hound;
const evidence = hound.evidence.filter((e) => e.deconstruction).slice(0, 3);
const question = hound.questions[0];

export function Kit() {
  const [single, setSingle] = useState(question?.options?.[0]?.id ?? "");
  const [multi, setMulti] = useState<string[]>([]);
  const [tab, setTab] = useState("orbit");
  const [views, setViews] = useState(3214);
  const [spent, setSpent] = useState(0.42);
  const [open, setOpen] = useState<string | null>(evidence[0]?.id ?? null);
  const [phaseIdx, setPhaseIdx] = useState(3);

  return (
    <div className="flex flex-col gap-14">
      <Group title="Button" note="primary is magnetic; hover, focus and press are live">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Start a run</Button>
          <Button variant="primary" loading>
            Start a run
          </Button>
          <Button variant="primary" disabled>
            Start a run
          </Button>
          <Button>Ghost</Button>
          <Button disabled>Ghost disabled</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="danger" size="sm">
            Drop channel
          </Button>
          <Button size="sm">Small</Button>
          <Button size="lg" variant="primary">
            Large primary
          </Button>
        </div>
      </Group>

      <Group title="URL input" note="Enter submits; invalid input explains itself">
        <div className="max-w-xl">
          <UrlInput onSubmit={(u) => toast({ title: "Would start intake", body: u })} />
        </div>
      </Group>

      <Group title="Answer chips" note="Radix toggle group, keyboard roving, magnetic">
        <div className="flex flex-col gap-5">
          <div>
            <MonoLabel>single</MonoLabel>
            <ChipGroup
              className="mt-2"
              type="single"
              options={question?.options ?? []}
              value={single}
              onChange={setSingle}
            />
          </div>
          <div>
            <MonoLabel>multi</MonoLabel>
            <ChipGroup
              className="mt-2"
              type="multi"
              options={[
                { id: "founder", label: "Founder", hint: "on camera" },
                { id: "trainer", label: "A trainer" },
                { id: "voice", label: "Voice only" },
                { id: "none", label: "Nobody" },
              ]}
              value={multi}
              onChange={setMulti}
            />
          </div>
          <div>
            <MonoLabel>disabled</MonoLabel>
            <ChipGroup
              className="mt-2"
              type="single"
              disabled
              options={[{ id: "a", label: "Not available" }]}
              value=""
              onChange={() => {}}
            />
          </div>
        </div>
      </Group>

      <Group title="Badges and status">
        <div className="flex flex-wrap items-center gap-2">
          <DemoBadge />
          <ComplianceBadge status="pass" />
          <ComplianceBadge status="warn" />
          <ComplianceBadge status="fail" />
          <ComplianceBadge status="pending" />
          <RunStatusBadge status="running" />
          <RunStatusBadge status="waiting_input" />
          <RunStatusBadge status="done" />
          <RunStatusBadge status="failed" />
          <Badge tone="signal">14.2x outlier</Badge>
          <Badge tone="pass">Proven 30d+</Badge>
          <Badge tone="violet">Blueprint</Badge>
          <Badge tone="cyan">Remake</Badge>
          <span className="flex items-center gap-3 pl-2">
            <StatusDot status="live" />
            <StatusDot status="warn" />
            <StatusDot status="fail" />
            <StatusDot status="idle" />
            <StatusDot status="off" />
          </span>
        </div>
      </Group>

      <Group title="Tabs, tooltip, dialog, sheet, toast">
        <div className="flex flex-col gap-5">
          <Tabs
            value={tab}
            onValueChange={setTab}
            items={[
              { value: "orbit", label: "Orbit" },
              { value: "list", label: "Ranked list" },
              { value: "notnow", label: "Not now" },
            ]}
          >
            <TabPanel value="orbit" className="mt-3 text-bone-2 text-ui">
              Orbit map view
            </TabPanel>
            <TabPanel value="list" className="mt-3 text-bone-2 text-ui">
              Ranked list view
            </TabPanel>
            <TabPanel value="notnow" className="mt-3 text-bone-2 text-ui">
              Channels we will not use yet
            </TabPanel>
          </Tabs>
          <div className="flex flex-wrap gap-3">
            <Tooltip content="Views / median views of the account's recent posts">
              <Button size="sm">Hover for tooltip</Button>
            </Tooltip>
            <Dialog
              trigger={<Button size="sm">Open dialog</Button>}
              title="Mark as posted"
              description="Paste the post URL so results can follow it."
            >
              <UrlInput
                size="md"
                cta="Save"
                placeholder="tiktok.com/@hound/video/..."
                onSubmit={() => toast({ title: "Saved", tone: "pass" })}
              />
            </Dialog>
            <Sheet trigger={<Button size="sm">Open sheet</Button>} label="Evidence" title="Why TikTok first">
              <p className="text-bone-2 text-ui">Drawer content scrolls on its own, Lenis is paused inside.</p>
              <div className="mt-4 flex flex-col gap-3">
                {evidence.map((e) => (
                  <EvidenceCard key={e.id} evidence={e} />
                ))}
              </div>
            </Sheet>
            <Button
              size="sm"
              onClick={() => toast({ title: "Caption copied", body: "Paste it into TikTok.", tone: "pass" })}
            >
              Fire toast
            </Button>
          </div>
        </div>
      </Group>

      <Group title="Numbers and cost">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel tone="flat" className="p-5">
            <MonoLabel>views</MonoLabel>
            <p className="mt-2 text-title">
              <NumberTicker value={views} />
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => setViews((v) => v + Math.round(400 + Math.random() * 1800))}>
                New snapshot
              </Button>
            </div>
          </Panel>
          <Panel tone="flat" className="flex flex-col gap-4 p-5">
            <CostMeter spentUsd={spent} estimateUsd={0.38} capUsd={5} label="Run spend" />
            <CostMeter spentUsd={4.2} estimateUsd={1.1} capUsd={5} label="Near the cap" />
            <Button size="sm" className="self-start" onClick={() => setSpent((s) => +(s + 0.17).toFixed(3))}>
              Spend $0.17
            </Button>
          </Panel>
        </div>
      </Group>

      <Group title="Phase rail" note="the light travels to the active phase">
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <Panel tone="flat" className="p-5">
            <PhaseRail
              phases={PHASES}
              current={PHASES[phaseIdx]}
              status={phaseIdx === 3 ? "waiting_input" : "running"}
            />
          </Panel>
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {PHASES.map((p, i) => (
                <Button
                  key={p}
                  size="sm"
                  variant={i === phaseIdx ? "primary" : "ghost"}
                  magnetic={false}
                  onClick={() => setPhaseIdx(i)}
                >
                  {i}
                </Button>
              ))}
            </div>
            <PhaseRail orientation="horizontal" phases={PHASES} current={PHASES[phaseIdx]} status="running" />
          </div>
        </div>
      </Group>

      <Group title="Evidence cards" note="source hue, outlier and longevity, deconstruction on expand">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {evidence.map((e) => (
            <EvidenceCard
              key={e.id}
              evidence={e}
              expanded={open === e.id}
              onToggle={() => setOpen(open === e.id ? null : e.id)}
            />
          ))}
        </div>
      </Group>

      <Group title="Provider tiles">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ProviderTile
            kind="engine"
            label={PROVIDER_INFO.anthropic.label}
            usedFor={PROVIDER_INFO.anthropic.usedFor}
            status="live"
            note="key present, verified"
          />
          <ProviderTile
            kind="engine"
            label={PROVIDER_INFO.manus.label}
            usedFor={PROVIDER_INFO.manus.usedFor}
            status="demo"
            note="scarce: one recorded smoke test"
          />
          <ProviderTile
            kind="connector"
            label={PROVIDER_INFO.revenuecat.label}
            usedFor={PROVIDER_INFO.revenuecat.usedFor}
            status="missing"
          />
          <ProviderTile
            kind="tool"
            label={PROVIDER_INFO.higgsfield.label}
            usedFor={PROVIDER_INFO.higgsfield.usedFor}
            status="error"
            note="auth rejected"
          />
        </div>
      </Group>

      <Group title="Phone frame, skeletons, panel">
        <div className="grid gap-6 md:grid-cols-[260px_260px_1fr]">
          <PhoneFrame src="/media/sample.mp4" empty="No render yet" />
          <PhoneFrame empty="Rendering draft" />
          <div className="flex flex-col gap-3">
            <SkeletonCard />
            <Panel>
              <PanelHeader
                label="panel header"
                title="Concept 1: the hidden camera"
                aside={<ComplianceBadge status="pass" />}
              />
              <div className="flex flex-col gap-2 p-5">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </Panel>
          </div>
        </div>
      </Group>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4 border-line border-b pb-2">
        <h3 className="font-medium text-body">{title}</h3>
        {note && <span className="mono-label text-right">{note}</span>}
      </div>
      {children}
    </div>
  );
}
