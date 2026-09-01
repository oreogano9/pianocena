export type Availability = {
  id: string;
  name: string;
  dates: number[];
  alwaysFree: boolean;
  updatedAt: string;
};

const STORAGE_KEY = "fissiamo-sta-cena:settembre-2026";

function normalizedName(name: string) {
  return name.trim().toLocaleLowerCase("it");
}

function dedupeAvailabilities(entries: Availability[]): Availability[] {
  const unique = new Map<string, Availability>();

  [...entries]
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .forEach((entry) => {
      const key = normalizedName(entry.name);
      if (key) unique.set(key, entry);
    });

  return Array.from(unique.values());
}

export function loadAvailabilities(): Availability[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    const unique = dedupeAvailabilities(parsed);
    if (unique.length !== parsed.length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
    }

    return unique;
  } catch {
    throw new Error("Non siamo riusciti a leggere le risposte salvate.");
  }
}

export function saveAvailability(
  current: Availability[],
  answer: Omit<Availability, "id" | "updatedAt">,
): Availability[] {
  const answerKey = normalizedName(answer.name);
  const uniqueCurrent = dedupeAvailabilities(current);
  const existing = uniqueCurrent.find((entry) => normalizedName(entry.name) === answerKey);

  const nextEntry: Availability = {
    ...answer,
    id: existing?.id ?? crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
  };

  const next = [
    ...uniqueCurrent.filter((entry) => normalizedName(entry.name) !== answerKey),
    nextEntry,
  ];

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
