# Fissiamo 'sta cena

Piccola app in italiano per raccogliere le disponibilità serali di settembre 2026 e mostrare le date con più partecipanti.

## Avvio locale

```bash
npm install
npm run dev
```

Apri `http://localhost:3000`.

## Controlli

```bash
npm run lint
npm run build
```

## Persistenza

La versione attuale salva le risposte in `localStorage`, quindi i dati restano sul dispositivo in uso. Il modulo `lib/availability-store.ts` mantiene la persistenza separata dall'interfaccia e potrà essere sostituito con API server e Vercel Blob.
