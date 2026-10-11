import { RunFrame } from "@/components/run/RunFrame";

export default async function RunLayout({ children, params }: LayoutProps<"/runs/[id]">) {
  const { id } = await params;
  return <RunFrame runId={id}>{children}</RunFrame>;
}
