type Row = { name: string; note: string };

/** "Name (https://...): what works for them" lines, as Manus writes its competitor and community lists. */
export function manusRows(text = ""): Row[] {
  return text
    .split("\n")
    .map((l) => l.match(/^(.+?) \(https?:\/\/[^)]*\):\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ name: m[1].trim(), note: firstSentence(m[2]) }));
}

const firstSentence = (s: string) => (s.match(/^.*?[.;](?=\s|$)/)?.[0] ?? s).trim().replace(/[;.]?$/, ".");

/** The first sentence of the landscape summary, without the JSON debris Manus sometimes leaves at the end. */
export function landscapeLead(text = "") {
  const para = text.split("\n")[0].replace(/["}\],\s]+$/, "");
  return (para.match(/[^.]+\.(\s|$)/g) ?? [para]).slice(0, 1).join("").trim();
}
