import fr from "@/locales/fr.json";

export const t = (key: string): string => {
  const keys = key.split(".");
  let value: unknown = fr;
  for (const k of keys) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[k];
    } else {
      value = undefined;
      break;
    }
  }
  return typeof value === "string" ? value : key;
};
