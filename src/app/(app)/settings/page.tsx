import type { Metadata } from "next";
import { Settings } from "@/components/settings/Settings";

export const metadata: Metadata = { title: "Providers" };

export default function SettingsPage() {
  return <Settings />;
}
