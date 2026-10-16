import { Suspense } from "react";
import { StudioHome } from "@/components/studio/Home";

export default function Page() {
  return (
    <Suspense>
      <StudioHome />
    </Suspense>
  );
}
