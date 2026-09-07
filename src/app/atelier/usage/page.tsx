import { UsageClient } from "./UsageClient";
import { Header } from "@/components/layout/Header";

export default function UsagePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-6">
        <UsageClient />
      </main>
    </div>
  );
}
