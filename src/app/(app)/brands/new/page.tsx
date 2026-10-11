import type { Metadata } from "next";
import { Suspense } from "react";
import { EnterBrand } from "@/components/brand/EnterBrand";

export const metadata: Metadata = { title: "Add a brand" };

export default function NewBrandPage() {
  return (
    <Suspense>
      <EnterBrand />
    </Suspense>
  );
}
