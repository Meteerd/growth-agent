import { BrandHome } from "@/components/brand/BrandHome";

export default async function BrandPage({ params }: PageProps<"/brands/[slug]">) {
  const { slug } = await params;
  return <BrandHome slug={slug} />;
}
