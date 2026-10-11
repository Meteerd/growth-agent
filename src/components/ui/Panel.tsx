import { cn } from "@/lib/client/cn";

type Tone = "glass" | "flat" | "hairline";
const TONES: Record<Tone, string> = { glass: "glass", flat: "glass-flat", hairline: "rounded-panel hairline" };

/** Glass panel: the third layer. Use "glass" for 2-3 hero surfaces per screen, "flat" for dense lists. */
export function Panel({
  tone = "glass",
  as: Tag = "div",
  className,
  ...rest
}: { tone?: Tone; as?: "div" | "section" | "article" | "aside" | "li" } & React.HTMLAttributes<HTMLElement>) {
  return <Tag className={cn(TONES[tone], "relative", className)} {...rest} />;
}

export function PanelHeader({
  label,
  title,
  aside,
}: {
  label?: string;
  title?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-line border-b px-5 py-4">
      <div className="min-w-0">
        {label && <p className="mono-label">{label}</p>}
        {title && <h3 className="mt-1 truncate font-medium text-bone text-body">{title}</h3>}
      </div>
      {aside}
    </header>
  );
}
