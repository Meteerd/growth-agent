"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Brand } from "@/contracts";
import type { Ad, AdRef, Job, Playbook, StudioBrandConfig } from "@/engine/studio/types";

export type { Ad, AdRef, Job, Playbook, StudioBrandConfig };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/studio${path}`, {
    ...init,
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "content-type": "application/json", ...init.headers }
        : init?.headers,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
  return j as T;
}
export const api = {
  get: <T>(p: string) => call<T>(p),
  post: <T>(p: string, body?: unknown) =>
    call<T>(p, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: <T>(p: string, body: unknown) => call<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(p: string, body?: unknown) =>
    call<T>(p, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
};

export interface BrandCard {
  id: string;
  slug: string;
  name: string;
  url: string;
  oneLiner: string;
  countries: string[];
  logo?: string;
  colors: StudioBrandConfig["colors"];
  counts: { ads: number; approved: number; refs: number };
  cover: string | null;
}

export interface BrandDetail {
  brand: Brand;
  config: StudioBrandConfig;
  playbook: Playbook | null;
  counts: { ads: number; ready: number; approved: number; refs: number; analysed: number };
  jobs: Job[];
  imageModels: { id: string; label: string; usd: number; note: string }[];
  formats: { id: string; name: string; stage: string }[];
}

const live = (jobs?: Job[]) => !!jobs?.some((j) => j.status === "running" || j.status === "queued");

export function useBrands() {
  return useQuery({ queryKey: ["studio", "brands"], queryFn: () => api.get<BrandCard[]>("/brands") });
}

export function useJobs(brand?: string) {
  return useQuery({
    queryKey: ["studio", "jobs", brand ?? "all"],
    queryFn: () => api.get<Job[]>(`/jobs${brand ? `?brand=${brand}` : ""}`),
    refetchInterval: (q) => (live(q.state.data) ? 2500 : 15000),
  });
}

export function useBrand(slug: string) {
  return useQuery({
    queryKey: ["studio", "brand", slug],
    queryFn: () => api.get<BrandDetail>(`/brands/${slug}`),
    refetchInterval: (q) => (live(q.state.data?.jobs) ? 4000 : false),
  });
}

export function useAds(slug: string, running: boolean) {
  return useQuery({
    queryKey: ["studio", "ads", slug],
    queryFn: () => api.get<Ad[]>(`/brands/${slug}/ads`),
    refetchInterval: running ? 3000 : false,
  });
}

export function useRefs(slug: string) {
  return useQuery({ queryKey: ["studio", "refs", slug], queryFn: () => api.get<AdRef[]>(`/brands/${slug}/refs`) });
}

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["studio"] });
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const usd = (x: number) => (x < 0.01 && x > 0 ? "<$0.01" : `$${x.toFixed(2)}`);
export const ago = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
