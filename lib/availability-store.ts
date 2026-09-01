export type Availability = {
  id: string;
  name: string;
  dates: number[];
  alwaysFree: boolean;
  updatedAt: string;
};

const STORAGE_KEY = "fissiamo-sta-cena:settembre-2026";

export function loadAvailabilities(): Availability[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error("Non siamo riusciti a leggere le risposte salvate.");
  }
}

export function saveAvailability(
  current: Availability[],
  answer: Omit<Availability, "id" | "updatedAt">,
): Availability[] {
  const normalizedName = answer.name.trim().toLocaleLowerCase("it");
  const existing = current.find(
    (entry) => entry.name.trim().toLocaleLowerCase("it") === normalizedName,
  );

  const nextEntry: Availability = {
    ...answer,
    id: existing?.id ?? crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
  };

  const next = existing
    ? current.map((entry) => (entry.id === existing.id ? nextEntry : entry))
    : [...current, nextEntry];

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
