import { Header } from "@/components/layout/Header";
import { JsonLdClient } from "./JsonLdClient";

export default function StructuredDataPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-6">
        <JsonLdClient />
      </main>
    </div>
  );
}
