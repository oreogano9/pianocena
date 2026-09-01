# Fissiamo 'sta cena

Piccola app in italiano per raccogliere le disponibilità serali, mese per mese, nel 2026 e 2027 e mostrare le sovrapposizioni su una mappa mensile interattiva.

Ogni mese usa un archivio separato. Ogni nome corrisponde a una sola risposta nel mese selezionato; se il nome esiste già, l'interfaccia chiede di aprire esplicitamente la risposta prima di modificarla.

## Anteprima organizzazione

Il piano automatico propone due cene e aggiunge una terza data solo quando migliora la copertura del gruppo. È visibile solo quando viene scritto `Konrad` nel campo del nome. Per renderlo visibile a tutti, imposta `SHOW_MEETING_PLAN_TO_EVERYONE` su `true` in `components/cena-planner.tsx`.

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

Le risposte vengono salvate in uno store privato Vercel Blob tramite la route server
`/api/availability`, con un percorso distinto per ogni mese. Il token di accesso resta sul server. Una cache locale permette
all'interfaccia di continuare a funzionare durante lo sviluppo senza credenziali Blob.

## Dati fittizi

Per caricare o ripristinare i 20 profili usati per controllare l'interfaccia:

```bash
npm run seed:dummy -- https://cenabhs.vercel.app
```

Lo script usa nomi stabili: eseguirlo di nuovo aggiorna gli stessi profili senza
creare duplicati.
