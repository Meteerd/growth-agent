import { Header } from "@/components/shell/Header";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header />
      <div className="relative">{children}</div>
    </>
  );
}
