import { CommandPalette } from "@/components/shell/CommandPalette";
import { Header } from "@/components/shell/Header";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header />
      <CommandPalette />
      <div className="relative">{children}</div>
    </>
  );
}
