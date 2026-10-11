import type { Metadata } from "next";
import { Portfolio } from "@/components/brand/Portfolio";

export const metadata: Metadata = { title: "Portfolio" };

export default function BrandsPage() {
  return <Portfolio />;
}
