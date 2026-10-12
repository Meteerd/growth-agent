import type { Metadata } from "next";
import { Showcase } from "@/components/landing/Showcase";

export const metadata: Metadata = { title: "Results" };

export default function ResultsPage() {
  return <Showcase />;
}
