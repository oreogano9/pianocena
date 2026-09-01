const targetUrl = process.argv[2];

if (!targetUrl) {
  console.error("Uso: npm run seed:dummy -- https://example.vercel.app");
  process.exit(1);
}

const people = [
  { name: "Alessandro", dates: [1, 6, 7, 8, 18] },
  { name: "Mario", dates: [3, 4, 5, 6, 7, 8, 18, 24] },
  { name: "Nico", dates: [1, 6, 8, 12, 18, 20, 27] },
  { name: "Raul", dates: [4, 6, 7, 8, 11, 18, 25] },
  { name: "Luca", dates: [2, 5, 6, 8, 13, 18, 26] },
  { name: "Giulia", dates: [3, 6, 8, 10, 17, 18, 24] },
  { name: "Francesca Romagnoli", dates: [1, 6, 7, 8, 15, 18, 22, 29] },
  { name: "Martina", dates: [5, 6, 8, 12, 18, 19, 26] },
  { name: "Davide", dates: [2, 6, 8, 9, 16, 18, 23, 30] },
  { name: "Andrea", dates: [4, 6, 7, 8, 14, 18, 21, 28] },
  { name: "Chiara", dates: [1, 3, 6, 8, 10, 18, 20, 27] },
  { name: "Marco", dates: [5, 6, 7, 8, 11, 18, 25] },
  { name: "Simone", dates: [2, 6, 8, 12, 16, 18, 26] },
  { name: "Valentina De Angelis", dates: [3, 6, 7, 8, 13, 18, 24, 30] },
  { name: "Matteo", dates: [1, 5, 6, 8, 15, 18, 22, 29] },
  { name: "Elena", dates: [4, 6, 7, 8, 17, 18, 23, 28] },
  { name: "Federica", dates: [2, 6, 8, 9, 18, 19, 25] },
  { name: "Lorenzo", dates: [5, 6, 7, 8, 14, 18, 21, 27] },
  { name: "Sara", dates: [], alwaysFree: true },
  { name: "Gabriele De Santis", dates: [], alwaysFree: true },
];

const endpoint = new URL("/api/availability", targetUrl);

for (const [index, person] of people.entries()) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...person,
      alwaysFree: person.alwaysFree ?? false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Salvataggio fallito per ${person.name}: HTTP ${response.status}`);
  }

  console.log(`[${index + 1}/${people.length}] ${person.name}`);
}

const verificationResponse = await fetch(endpoint, { cache: "no-store" });
if (!verificationResponse.ok) {
  throw new Error(`Verifica fallita: HTTP ${verificationResponse.status}`);
}

const { answers } = await verificationResponse.json();
const loadedNames = new Set(answers.map((answer) => answer.name));
const missingNames = people
  .map((person) => person.name)
  .filter((name) => !loadedNames.has(name));

if (missingNames.length > 0) {
  throw new Error(`Profili mancanti: ${missingNames.join(", ")}`);
}

console.log(`Seed completato: ${people.length} profili fittizi presenti su ${targetUrl}`);
