import type { Metadata } from "next";
import { Direction } from "@/components/direction/Direction";

export const metadata: Metadata = { title: "Direction" };

export default function DirectionPage() {
  return <Direction />;
}
