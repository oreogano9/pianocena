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

const LEGACY_STORAGE_KEY = "fissiamo-sta-cena:settembre-2026";
const STORAGE_KEY = "fissiamo-sta-cena:settembre-2026:v2";

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

function loadLocalAvailabilities(): Availability[] {
  if (typeof window === "undefined") return [];

  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (!value) return [];

  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return [];

  const unique = dedupeAvailabilities(parsed as Availability[]);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  return unique;
}

function cacheAvailabilities(entries: Availability[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

async function postAvailability(answer: AvailabilityInput): Promise<Availability[]> {
  const response = await fetch("/api/availability", {
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

export async function loadAvailabilities(): Promise<AvailabilityResult> {
  let local: Availability[] = [];

  try {
    local = loadLocalAvailabilities();
    const response = await fetch("/api/availability", { cache: "no-store" });
    if (!response.ok) throw new Error("Archivio condiviso non disponibile.");

    const data = (await response.json()) as { answers: Availability[] };
    const answers = dedupeAvailabilities(data.answers);

    cacheAvailabilities(answers);
    return { answers, shared: true };
  } catch {
    return { answers: local, shared: false };
  }
}

export async function saveAvailability(
  current: Availability[],
  answer: AvailabilityInput,
): Promise<AvailabilityResult> {
  try {
    const answers = await postAvailability(answer);
    cacheAvailabilities(answers);
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

    cacheAvailabilities(answers);
    return { answers, shared: false };
  }
}
