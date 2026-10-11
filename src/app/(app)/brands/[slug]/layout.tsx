import { BrandFrame } from "@/components/brand/BrandFrame";

export default async function BrandLayout({ children, params }: LayoutProps<"/brands/[slug]">) {
  const { slug } = await params;
  return <BrandFrame slug={slug}>{children}</BrandFrame>;
}
