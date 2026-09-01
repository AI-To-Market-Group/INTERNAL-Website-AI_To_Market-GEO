import { ImagePlaceholder } from "@/components/insights/ImagePlaceholder";

type Node =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "img"; alt: string; src: string };

function parse(md: string): Node[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: Node[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const text = buf.join(" ").trim();
    if (text) out.push({ type: "p", text });
    buf.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const t = line.trim();

    // blank
    if (!t) {
      i++;
      continue;
    }

    // headings
    if (t.startsWith("# ")) {
      out.push({ type: "h1", text: t.slice(2).trim() });
      i++;
      continue;
    }
    if (t.startsWith("## ")) {
      out.push({ type: "h2", text: t.slice(3).trim() });
      i++;
      continue;
    }
    if (t.startsWith("### ")) {
      out.push({ type: "h3", text: t.slice(4).trim() });
      i++;
      continue;
    }

    // image markdown ![alt](src)
    const imgMatch = t.match(/^!\[(.*)\]\((.*)\)$/);
    if (imgMatch) {
      out.push({ type: "img", alt: imgMatch[1] || "Image", src: imgMatch[2] || "" });
      i++;
      continue;
    }

    // list
    if (t.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const li = lines[i].trim();
        if (!li.startsWith("- ")) break;
        items.push(li.slice(2).trim());
        i++;
      }
      out.push({ type: "ul", items });
      continue;
    }

    // paragraph: gather until blank
    const buf: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      const lt = l.trim();
      if (!lt) break;
      if (lt.startsWith("#") || lt.startsWith("- ") || lt.match(/^!\[.*\]\(.*\)$/)) break;
      buf.push(lt);
      i++;
    }
    flushParagraph(buf);
  }

  return out;
}

export function SimpleMarkdown({ markdown }: { markdown: string }) {
  const nodes = parse(markdown);
  return (
    <div className="space-y-4">
      {nodes.map((n, idx) => {
        if (n.type === "h1") return <h1 key={idx} className="text-3xl font-bold">{n.text}</h1>;
        if (n.type === "h2") return <h2 key={idx} className="text-2xl font-bold">{n.text}</h2>;
        if (n.type === "h3") return <h3 key={idx} className="text-xl font-bold">{n.text}</h3>;
        if (n.type === "p") return <p key={idx} className="text-slate-700 leading-relaxed">{n.text}</p>;
        if (n.type === "ul")
          return (
            <ul key={idx} className="list-disc pl-6 text-slate-700 space-y-1">
              {n.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          );
        if (n.type === "img") {
          // If we have a src, show it. Otherwise show a placeholder.
          if (n.src) {
            return (
              <figure key={idx} className="space-y-2">
                {/* Use <img> for remote URLs without Next config. */}
                <img
                  src={n.src}
                  alt={n.alt}
                  className="w-full rounded-xl border border-slate-200"
                />
              </figure>
            );
          }
          return (
            <figure key={idx} className="space-y-2">
              <ImagePlaceholder className="aspect-[16/9]" label={n.alt} />
            </figure>
          );
        }
        return null;
      })}
    </div>
  );
}

