import type { Metadata } from "next";
import { Consult } from "@/components/run/Consult";

export const metadata: Metadata = { title: "Consultation" };

export default function ConsultPage() {
  return <Consult />;
}
