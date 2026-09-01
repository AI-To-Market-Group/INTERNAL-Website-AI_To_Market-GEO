import { GeoAnalyticsClient } from "./GeoAnalyticsClient";
import { Header } from "@/components/layout/Header";

export default function GeoAnalyticsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-6">
        <GeoAnalyticsClient />
      </main>
    </div>
  );
}
