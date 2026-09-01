"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { hasApi, isMockEnvForced } from "@/lib/api";

export type ApiMode = "api" | "mock";

/** Endpoint keys used for per-endpoint Mock/API choice in Parameters. */
export const API_ENDPOINT_KEYS = [
  "opportunities",
  "keywords",
  "tendances",
  "gap",
  "article_sections",
  "generate_article",
  "revise_section",
  "edit_article_section",
  "infer_metadata",
] as const;

export type ApiEndpointKey = (typeof API_ENDPOINT_KEYS)[number];

export const API_ENDPOINT_LABELS: Record<ApiEndpointKey, string> = {
  opportunities: "Opportunities (competition)",
  keywords: "Topics from keywords",
  tendances: "Trends by theme",
  gap: "Competition gap",
  article_sections: "Article outline",
  generate_article: "Full article generation",
  revise_section: "Section regeneration",
  edit_article_section: "Article section regeneration",
  infer_metadata: "WP metadata (infer-article-metadata)",
};

export type ApiEndpointModes = Partial<Record<ApiEndpointKey, ApiMode>>;

interface ApiModeContextValue {
  /** Per-endpoint mode. When not set for an endpoint, falls back to default. */
  endpointModes: ApiEndpointModes;
  /** Set mode for one endpoint (applies app-wide for that endpoint). */
  setEndpointMode: (key: ApiEndpointKey, mode: ApiMode) => void;
  /** Resolved mode for an endpoint (respects global mock override). */
  getEndpointMode: (key: ApiEndpointKey) => ApiMode;
  isApiAvailable: boolean;
  isMockForced: boolean;
}

const STORAGE_KEY = "aitm:api-endpoint-modes";

const ApiModeContext = createContext<ApiModeContextValue | null>(null);

function loadStoredModes(): ApiEndpointModes {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      const out: ApiEndpointModes = {};
      for (const k of API_ENDPOINT_KEYS) {
        const v = (parsed as Record<string, string>)[k];
        if (v === "api" || v === "mock") out[k] = v;
      }
      return out;
    }
  } catch {
    // ignore
  }
  return {};
}

function getDefaultMode(): ApiMode {
  if (typeof window === "undefined") return "mock";
  if (isMockEnvForced()) return "mock";
  return hasApi() ? "api" : "mock";
}

export const ApiModeProvider = ({ children }: { children: ReactNode }) => {
  const apiAvailable = hasApi();
  const mockForced = isMockEnvForced();
  const defaultMode = mockForced ? "mock" : (apiAvailable ? "api" : "mock");

  const [endpointModes, setEndpointModesState] = useState<ApiEndpointModes>(
    () => loadStoredModes()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(endpointModes));
  }, [endpointModes]);

  const setEndpointMode = useCallback((key: ApiEndpointKey, mode: ApiMode) => {
    if (mockForced && mode === "api") return;
    setEndpointModesState((prev) => ({ ...prev, [key]: mode }));
  }, [mockForced]);

  const getEndpointMode = useCallback(
    (key: ApiEndpointKey): ApiMode => {
      if (mockForced) return "mock";
      const stored = endpointModes[key];
      return stored ?? defaultMode;
    },
    [endpointModes, defaultMode, mockForced]
  );

  return (
    <ApiModeContext.Provider
      value={{
        endpointModes,
        setEndpointMode,
        getEndpointMode,
        isApiAvailable: apiAvailable,
        isMockForced: mockForced,
      }}
    >
      {children}
    </ApiModeContext.Provider>
  );
};

export const useApiMode = () => {
  const ctx = useContext(ApiModeContext);
  if (!ctx) {
    throw new Error("useApiMode must be used within an ApiModeProvider");
  }
  return ctx;
};
