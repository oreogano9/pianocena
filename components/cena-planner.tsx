"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Availability,
  loadAvailabilities,
  saveAvailability,
} from "@/lib/availability-store";

const YEAR = 2026;
const MONTH_INDEX = 8;
const DAYS_IN_MONTH = 30;
const ALL_DAYS = Array.from({ length: DAYS_IN_MONTH }, (_, index) => index + 1);
const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];
const FIRST_DAY_OFFSET = 1;

const fullDateFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function formatDate(day: number, short = false) {
  const date = new Date(YEAR, MONTH_INDEX, day);
  return (short ? shortDateFormatter : fullDateFormatter).format(date);
}

function dayLabel(day: number) {
  return formatDate(day).replace(/^./, (letter) => letter.toUpperCase());
}

function normalName(name: string) {
  return name.trim().toLocaleLowerCase("it");
}

export function CenaPlanner() {
  const [answers, setAnswers] = useState<Availability[]>([]);
  const [name, setName] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [alwaysFree, setAlwaysFree] = useState(false);
  const [selectedResultDay, setSelectedResultDay] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setAnswers(loadAvailabilities());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Qualcosa è andato storto.");
      } finally {
        setReady(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const existingAnswer = useMemo(
    () => answers.find((answer) => normalName(answer.name) === normalName(name)),
    [answers, name],
  );

  const rankedDays = useMemo(() => {
    return ALL_DAYS.map((day) => {
      const available = answers.filter(
        (answer) => answer.alwaysFree || answer.dates.includes(day),
      );

      return { day, available };
    })
      .filter((result) => result.available.length > 0)
      .sort((a, b) => b.available.length - a.available.length || a.day - b.day);
  }, [answers]);

  const bestDays = rankedDays.slice(0, 5);
  const activeResultDay = selectedResultDay ?? bestDays[0]?.day ?? null;
  const activeResult = rankedDays.find((result) => result.day === activeResultDay);
  const unavailable = activeResult
    ? answers.filter((answer) => !activeResult.available.some((person) => person.id === answer.id))
    : [];

  function toggleDay(day: number) {
    setNotice(null);
    setError(null);
    setAlwaysFree(false);
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((selectedDay) => selectedDay !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }

  function toggleAlwaysFree() {
    setNotice(null);
    setError(null);
    setAlwaysFree((current) => {
      const next = !current;
      setSelectedDays(next ? ALL_DAYS : []);
      return next;
    });
  }

  function loadExistingAnswer() {
    if (!existingAnswer) return;
    setSelectedDays(existingAnswer.alwaysFree ? ALL_DAYS : existingAnswer.dates);
    setAlwaysFree(existingAnswer.alwaysFree);
    setNotice("Ho caricato la tua risposta precedente.");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError("Scrivi il tuo nome.");
      return;
    }

    if (!alwaysFree && selectedDays.length === 0) {
      setError("Scegli almeno una sera, oppure seleziona Sempre libero.");
      return;
    }

    try {
      const next = saveAvailability(answers, {
        name: cleanName,
        dates: alwaysFree ? ALL_DAYS : selectedDays,
        alwaysFree,
      });
      setAnswers(next);
      setNotice(existingAnswer ? "Disponibilità aggiornata." : "Disponibilità salvata.");
    } catch {
      setError("Non siamo riusciti a salvare. Riprova.");
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#inizio" aria-label="Torna all'inizio">
          Fissiamo &apos;sta cena
        </a>
        <a className="responses-link" href="#risultati">
          Risposte <span>{answers.length}</span>
        </a>
      </header>

      <section className="intro" id="inizio">
        <div className="intro-copy">
          <p className="eyebrow">Cena di settembre</p>
          <h1>Quando ci siete?</h1>
          <p className="intro-text">
            Segna le sere libere. Noi contiamo, voi smettete di intasare il gruppo.
          </p>
        </div>

        <div className="form-shell">
          <form onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label htmlFor="name">Come ti chiami?</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Scrivi il tuo nome"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNotice(null);
                  setError(null);
                }}
              />
              {existingAnswer && (
                <button className="restore-button" type="button" onClick={loadExistingAnswer}>
                  Hai già risposto. Carica le tue date
                </button>
              )}
            </div>

            <fieldset className="calendar-fieldset">
              <legend>Quando sei libero?</legend>
              <div className="month-heading">
                <span>Settembre 2026</span>
                <span>{selectedDays.length} sere</span>
              </div>

              <div className="calendar" role="group" aria-label="Sere disponibili a settembre 2026">
                {WEEKDAYS.map((weekday, index) => (
                  <span className="weekday" key={`${weekday}-${index}`} aria-hidden="true">
                    {weekday}
                  </span>
                ))}
                {Array.from({ length: FIRST_DAY_OFFSET }, (_, index) => (
                  <span className="calendar-spacer" key={`spacer-${index}`} aria-hidden="true" />
                ))}
                {ALL_DAYS.map((day) => {
                  const selected = selectedDays.includes(day);
                  const date = new Date(YEAR, MONTH_INDEX, day);
                  const weekend = date.getDay() === 0 || date.getDay() === 6;

                  return (
                    <button
                      className={`day-button${selected ? " is-selected" : ""}${weekend ? " is-weekend" : ""}`}
                      type="button"
                      key={day}
                      aria-label={dayLabel(day)}
                      aria-pressed={selected}
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button
              className={`always-button${alwaysFree ? " is-selected" : ""}`}
              type="button"
              aria-pressed={alwaysFree}
              onClick={toggleAlwaysFree}
            >
              <span className="always-mark" aria-hidden="true">{alwaysFree ? "✓" : ""}</span>
              <span>
                <strong>Sempre libero</strong>
                <small>Per me va bene qualsiasi sera</small>
              </span>
            </button>

            <div className="form-footer">
              <button className="submit-button" type="submit">
                {existingAnswer ? "Aggiorna" : "Salva disponibilità"}
              </button>
              <p className="storage-note">Per ora, i dati restano su questo dispositivo.</p>
            </div>

            <div className="message-slot" aria-live="polite">
              {error && <p className="form-message error-message">{error}</p>}
              {!error && notice && <p className="form-message success-message">{notice}</p>}
            </div>
          </form>
        </div>
      </section>

      <section className="results" id="risultati">
        <div className="results-heading">
          <div>
            <h2>Le date migliori</h2>
            <p>{answers.length === 1 ? "1 persona ha risposto" : `${answers.length} persone hanno risposto`}</p>
          </div>
          <p className="results-note">Più persone ci sono, più la data sale.</p>
        </div>

        {!ready ? (
          <div className="results-loading" aria-label="Caricamento risultati">
            <span />
            <span />
            <span />
          </div>
        ) : bestDays.length === 0 ? (
          <div className="empty-state">
            <p>Nessuna risposta, per ora.</p>
            <span>Compila il modulo e rompi il ghiaccio.</span>
          </div>
        ) : (
          <div className="results-grid">
            <div className="ranking">
              {bestDays.map((result, index) => (
                <button
                  type="button"
                  key={result.day}
                  className={`ranking-row${activeResultDay === result.day ? " is-active" : ""}`}
                  onClick={() => setSelectedResultDay(result.day)}
                  aria-pressed={activeResultDay === result.day}
                >
                  <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="rank-date">{formatDate(result.day, true)}</span>
                  <span className="rank-count">{result.available.length}</span>
                </button>
              ))}
            </div>

            {activeResult && (
              <aside className="day-detail" aria-live="polite">
                <p className="detail-date">{dayLabel(activeResult.day)}</p>
                <div className="people-group">
                  <h3>Ci sono</h3>
                  <p>{activeResult.available.map((person) => person.name).join(", ")}</p>
                </div>
                <div className="people-group is-muted">
                  <h3>Non ci sono</h3>
                  <p>{unavailable.length > 0 ? unavailable.map((person) => person.name).join(", ") : "Nessuno"}</p>
                </div>
              </aside>
            )}
          </div>
        )}
      </section>

      <footer>
        <span>Organizzazione scientifica della cena.</span>
        <a href="#inizio">Aggiungi le tue date</a>
      </footer>
    </main>
  );
}
