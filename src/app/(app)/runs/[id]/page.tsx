import type { Metadata } from "next";
import { Cockpit } from "@/components/run/Cockpit";

export const metadata: Metadata = { title: "Run" };

export default function RunPage() {
  return <Cockpit />;
}
