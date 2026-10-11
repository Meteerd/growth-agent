import type { Metadata } from "next";
import { Results } from "@/components/results/Results";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage({ params }: PageProps<"/brands/[slug]/results">) {
  const { slug } = await params;
  return <Results slug={slug} />;
}
