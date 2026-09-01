import { createHash } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import type { Availability, AvailabilityInput } from "@/lib/availability-store";

export const dynamic = "force-dynamic";

const PREFIX = "availability/september-2026/";
const ALL_DAYS = Array.from({ length: 30 }, (_, index) => index + 1);
const MAX_ANSWERS = 100;

function normalizedName(name: string) {
  return name.trim().normalize("NFKC").toLocaleLowerCase("it-IT");
}

function entryId(name: string) {
  return createHash("sha256").update(normalizedName(name)).digest("hex");
}

function isAvailability(value: unknown): value is Availability {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<Availability>;

  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.alwaysFree === "boolean" &&
    typeof entry.updatedAt === "string" &&
    Array.isArray(entry.dates) &&
    entry.dates.every((day) => Number.isInteger(day) && day >= 1 && day <= 30)
  );
}

function parseInput(value: unknown): AvailabilityInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<AvailabilityInput>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const alwaysFree = input.alwaysFree === true;
  const dates = Array.isArray(input.dates)
    ? [...new Set(input.dates.filter((day) => Number.isInteger(day) && day >= 1 && day <= 30))]
        .sort((a, b) => a - b)
    : [];

  if (name.length < 2 || name.length > 80 || (!alwaysFree && dates.length === 0)) {
    return null;
  }

  return { name, alwaysFree, dates: alwaysFree ? ALL_DAYS : dates };
}

async function readAnswers() {
  const answers: Availability[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 100 });
    const pageAnswers = await Promise.all(
      page.blobs.map(async (blob) => {
        try {
          const result = await get(blob.pathname, { access: "private", useCache: false });
          if (!result || result.statusCode !== 200) return null;
          const parsed: unknown = JSON.parse(await new Response(result.stream).text());
          return isAvailability(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }),
    );

    answers.push(...pageAnswers.filter((entry): entry is Availability => entry !== null));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return answers.sort((a, b) => a.name.localeCompare(b.name, "it-IT"));
}

function unavailableResponse() {
  return NextResponse.json(
    { error: "Archivio condiviso non configurato." },
    { status: 503 },
  );
}

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return unavailableResponse();

  try {
    const answers = await readAnswers();
    return NextResponse.json({ answers }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Impossibile leggere le risposte." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return unavailableResponse();

  try {
    const input = parseInput(await request.json());
    if (!input) {
      return NextResponse.json({ error: "Risposta non valida." }, { status: 400 });
    }

    const id = entryId(input.name);
    const current = await readAnswers();
    if (current.length >= MAX_ANSWERS && !current.some((entry) => entry.id === id)) {
      return NextResponse.json({ error: "Numero massimo di risposte raggiunto." }, { status: 429 });
    }

    const entry: Availability = {
      ...input,
      id,
      updatedAt: new Date().toISOString(),
    };

    await put(`${PREFIX}${id}.json`, JSON.stringify(entry), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });

    const answers = await readAnswers();
    return NextResponse.json({ answers }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Impossibile salvare la risposta." }, { status: 500 });
  }
}
