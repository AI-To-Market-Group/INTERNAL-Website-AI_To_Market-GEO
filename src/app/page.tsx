import Link from "next/link";
import { BarChart3, FileText, Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-background to-slate-50">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(148 163 184 / 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(148 163 184 / 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <main className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-20 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          Generative Engine Optimization
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          AI To Market
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Discover content opportunities, optimize for GEO, and create data-driven
          articles that rank. Your content intelligence hub.
        </p>
        <Link
          href="/atelier"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
        >
          Open Content Atelier
          <ArrowRight className="h-5 w-5" />
        </Link>

        {/* Value props */}
        <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            {
              icon: BarChart3,
              title: "Opportunity Radar",
              desc: "SEO gaps, trends & seasonal events",
            },
            {
              icon: FileText,
              title: "AI Article Builder",
              desc: "Draft and refine with AI assistance",
            },
            {
              icon: Sparkles,
              title: "Content Forge",
              desc: "Blog, LinkedIn & insights hub",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-primary/20 hover:shadow-md"
            >
              <Icon className="mb-3 h-6 w-6 text-primary" aria-hidden />
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
