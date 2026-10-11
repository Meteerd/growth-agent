/** v2: no typing effect (motion is functional only); kept so stream rows keep one text component. */
export function TypedText({ text, className }: { text: string; cps?: number; className?: string }) {
  return <span className={className}>{text}</span>;
}
