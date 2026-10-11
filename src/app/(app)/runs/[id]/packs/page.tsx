import type { Metadata } from "next";
import { PacksScreen } from "@/components/packs/PacksScreen";

export const metadata: Metadata = { title: "Packs" };

export default async function PacksPage({ params }: PageProps<"/runs/[id]/packs">) {
  const { id } = await params;
  return <PacksScreen runId={id} />;
}
