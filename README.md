# Fissiamo 'sta cena

Piccola app in italiano per raccogliere le disponibilità serali di settembre 2026 e mostrare le sovrapposizioni su una mappa mensile interattiva.

Ogni nome corrisponde a una sola risposta. Scrivendo di nuovo un nome già presente, le date precedenti vengono caricate e il salvataggio le aggiorna senza creare duplicati.

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
`/api/availability`. Il token di accesso resta sul server. Una cache locale permette
all'interfaccia di continuare a funzionare durante lo sviluppo senza credenziali Blob.

## Dati fittizi

Per caricare o ripristinare i 20 profili usati per controllare l'interfaccia:

```bash
npm run seed:dummy -- https://cenabhs.vercel.app
```

Lo script usa nomi stabili: eseguirlo di nuovo aggiorna gli stessi profili senza
creare duplicati.
