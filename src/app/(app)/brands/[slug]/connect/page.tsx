import type { Metadata } from "next";
import { Connect } from "@/components/brand/Connect";

export const metadata: Metadata = { title: "Connect" };

export default async function ConnectPage({ params }: PageProps<"/brands/[slug]/connect">) {
  const { slug } = await params;
  return <Connect slug={slug} />;
}
