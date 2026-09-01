export const formatNumber = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

export const formatDate = (date: string): string => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const CONFIDENCE_LABELS: Record<string, string> = {
  strong: "Very good",
  good: "Good",
  medium: "Medium",
  low: "Low",
};

export const confidenceLabelFr = (value: string | null | undefined): string => {
  if (!value) return "—";
  return CONFIDENCE_LABELS[value.toLowerCase()] ?? value;
};
