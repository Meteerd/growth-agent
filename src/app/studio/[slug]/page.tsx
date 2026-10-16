import { BrandWorkspace } from "@/components/studio/Brand";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BrandWorkspace slug={slug} />;
}
