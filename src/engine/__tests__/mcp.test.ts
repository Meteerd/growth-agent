import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { seed } from "@/engine/seed";
import { freshDb, req } from "@/engine/test-utils";

const rpc = async (method: string, params?: object, id: number | undefined = 1) =>
  (await POST(req("/api/mcp", { method: "POST", json: { jsonrpc: "2.0", id, method, params } }))).json();

beforeEach(async () => {
  await seed(await freshDb());
});

describe("AS6 MCP endpoint", () => {
  it("initializes and lists the eight brand tools", async () => {
    const init = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "t", version: "1" },
    });
    expect(init.result.serverInfo.name).toBe("nexus-brand-brain");
    const tools = await rpc("tools/list");
    expect(tools.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(
      [
        "get_channel_plan",
        "get_dossier",
        "get_learnings",
        "get_rule_pack",
        "list_brands",
        "log_results",
        "search_evidence",
        "update_dossier",
      ].sort(),
    );
  });

  it("calls tools: plan, evidence search, rule pack, errors", async () => {
    const plan = await rpc("tools/call", { name: "get_channel_plan", arguments: { brand: "aclinic" } });
    expect(plan.result.content[0].text).toContain("RX4");
    const ev = await rpc("tools/call", {
      name: "search_evidence",
      arguments: { brand: "hound", query: "dog", limit: 5 },
    });
    expect(JSON.parse(ev.result.content[0].text).length).toBeGreaterThan(0);
    const rp = await rpc("tools/call", { name: "get_rule_pack", arguments: { brand: "hound" } });
    expect(rp.result.content[0].text).toContain("P1");
    const bad = await rpc("tools/call", { name: "get_dossier", arguments: { brand: "nope" } });
    expect(bad.result.isError).toBe(true);
    const unknown = await rpc("nope/method");
    expect(unknown.error.code).toBe(-32601);
  });

  it("notifications get 202 with no body", async () => {
    const res = await POST(
      req("/api/mcp", { method: "POST", json: { jsonrpc: "2.0", method: "notifications/initialized" } }),
    );
    expect(res.status).toBe(202);
  });
});
