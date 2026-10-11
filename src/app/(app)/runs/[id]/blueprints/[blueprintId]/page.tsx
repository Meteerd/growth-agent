import type { Metadata } from "next";
import { BlueprintView } from "@/components/blueprint/BlueprintView";

export const metadata: Metadata = { title: "Reverse-engineer" };

export default async function BlueprintPage({ params }: PageProps<"/runs/[id]/blueprints/[blueprintId]">) {
  const { blueprintId } = await params;
  return <BlueprintView blueprintId={blueprintId} />;
}
