import { describe, expect, it } from "vitest";
import { businessEvidence, readOnlySql } from "@/engine/providers/business";

describe("business connectors (read-only, one brand)", () => {
  it("the SQL guard allows one read statement and refuses writes, also hidden behind WITH", () => {
    expect(readOnlySql("select * from sales.orders limit 10")).toBe(true);
    expect(readOnlySql("SHOW TABLES IN main.default")).toBe(true);
    expect(readOnlySql("with t as (select 1 as x) select * from t;")).toBe(true);
    expect(readOnlySql("select 'insert into x' as label")).toBe(true);
    expect(readOnlySql("with t as (select 1) insert into x select * from t")).toBe(false);
    expect(readOnlySql("with s as (select 1) merge into x using s on true when matched then delete")).toBe(false);
    expect(readOnlySql("select 1; drop table x")).toBe(false);
    expect(readOnlySql("delete from x")).toBe(false);
    expect(readOnlySql("select 1 -- ; drop table x")).toBe(true);
  });

  it("keys without CONNECTOR_BRAND warn instead of silently returning nothing; other brands never get the numbers", async () => {
    const warnings: string[] = [];
    const prev = { b: process.env.CONNECTOR_BRAND, k: process.env.REVENUECAT_API_KEY };
    process.env.REVENUECAT_API_KEY = "sk_test";
    delete process.env.CONNECTOR_BRAND;
    const brand = { slug: "hound", id: "brand_hound" } as never;
    expect(await businessEvidence({} as never, brand, "run_x", async (t) => warnings.push(t))).toEqual([]);
    expect(warnings[0]).toMatch(/CONNECTOR_BRAND/);
    process.env.CONNECTOR_BRAND = "privatebrand";
    expect(await businessEvidence({} as never, brand, "run_x")).toEqual([]);
    process.env.CONNECTOR_BRAND = prev.b;
    process.env.REVENUECAT_API_KEY = prev.k;
    if (prev.b === undefined) delete process.env.CONNECTOR_BRAND;
    if (prev.k === undefined) delete process.env.REVENUECAT_API_KEY;
  });
});
