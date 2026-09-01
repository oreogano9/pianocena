import { createHash } from "node:crypto";
import { del, list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PREFIX = "availability/september-2026/";
const DEMO_NAMES = [
  "Alessandro",
  "Mario",
  "Nico",
  "Raul",
  "Luca",
  "Giulia",
  "Francesca Romagnoli",
  "Martina",
  "Davide",
  "Andrea",
  "Chiara",
  "Marco",
  "Simone",
  "Valentina De Angelis",
  "Matteo",
  "Elena",
  "Federica",
  "Lorenzo",
  "Sara",
  "Gabriele De Santis",
] as const;

function entryPath(name: string) {
  const normalized = name.trim().normalize("NFKC").toLocaleLowerCase("it-IT");
  const id = createHash("sha256").update(normalized).digest("hex");
  return `${PREFIX}${id}.json`;
}

export async function DELETE() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Archivio non configurato." }, { status: 503 });
  }

  const demoPaths = new Set(DEMO_NAMES.map(entryPath));
  const page = await list({ prefix: PREFIX, limit: 100 });
  const pathsToDelete = page.blobs
    .map((blob) => blob.pathname)
    .filter((pathname) => demoPaths.has(pathname));

  if (pathsToDelete.length > 0) {
    await del(pathsToDelete);
  }

  return NextResponse.json({ removed: pathsToDelete.length });
}
