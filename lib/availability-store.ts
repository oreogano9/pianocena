export type Availability = {
  id: string;
  name: string;
  dates: number[];
  alwaysFree: boolean;
  updatedAt: string;
};

export type AvailabilityInput = Pick<Availability, "name" | "dates" | "alwaysFree">;

export type AvailabilityResult = {
  answers: Availability[];
  shared: boolean;
};

const LEGACY_STORAGE_KEYS = [
  "fissiamo-sta-cena:settembre-2026",
  "fissiamo-sta-cena:settembre-2026:v2",
] as const;

function storageKey(monthKey: string) {
  return `fissiamo-sta-cena:${monthKey}:v1`;
}

function normalizedName(name: string) {
  return name.trim().normalize("NFKC").toLocaleLowerCase("it-IT");
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

function loadLocalAvailabilities(monthKey: string): Availability[] {
  if (typeof window === "undefined") return [];

  LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  const key = storageKey(monthKey);
  const value = window.localStorage.getItem(key);
  if (!value) return [];

  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return [];

  const unique = dedupeAvailabilities(parsed as Availability[]);
  window.localStorage.setItem(key, JSON.stringify(unique));
  return unique;
}

function cacheAvailabilities(monthKey: string, entries: Availability[]) {
  window.localStorage.setItem(storageKey(monthKey), JSON.stringify(entries));
}

async function postAvailability(
  monthKey: string,
  answer: AvailabilityInput,
): Promise<Availability[]> {
  const response = await fetch(`/api/availability?month=${encodeURIComponent(monthKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answer),
  });

  if (!response.ok) {
    const error = new Error("Non siamo riusciti a salvare la risposta.");
    Object.assign(error, { status: response.status });
    throw error;
  }

  const data = (await response.json()) as { answers: Availability[] };
  return dedupeAvailabilities(data.answers);
}

export async function loadAvailabilities(monthKey: string): Promise<AvailabilityResult> {
  let local: Availability[] = [];

  try {
    local = loadLocalAvailabilities(monthKey);
    const response = await fetch(
      `/api/availability?month=${encodeURIComponent(monthKey)}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("Archivio condiviso non disponibile.");

    const data = (await response.json()) as { answers: Availability[] };
    const answers = dedupeAvailabilities(data.answers);

    cacheAvailabilities(monthKey, answers);
    return { answers, shared: true };
  } catch {
    return { answers: local, shared: false };
  }
}

export async function saveAvailability(
  current: Availability[],
  answer: AvailabilityInput,
  monthKey: string,
): Promise<AvailabilityResult> {
  try {
    const answers = await postAvailability(monthKey, answer);
    cacheAvailabilities(monthKey, answers);
    return { answers, shared: true };
  } catch (saveError) {
    if (!(saveError instanceof Error && "status" in saveError && saveError.status === 503)) {
      throw saveError;
    }

    const answerKey = normalizedName(answer.name);
    const uniqueCurrent = dedupeAvailabilities(current);
    const existing = uniqueCurrent.find(
      (entry) => normalizedName(entry.name) === answerKey,
    );
    const nextEntry: Availability = {
      ...answer,
      id: existing?.id ?? crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    const answers = [
      ...uniqueCurrent.filter((entry) => normalizedName(entry.name) !== answerKey),
      nextEntry,
    ];

    cacheAvailabilities(monthKey, answers);
    return { answers, shared: false };
  }
}
