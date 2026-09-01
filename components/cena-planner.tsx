"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { loadAvailabilities, saveAvailability } from "@/lib/availability-store";
import type { Availability } from "@/lib/availability-store";
import {
  daysInMonth,
  firstDayOffset,
  parseMonthKey,
  SUPPORTED_MONTHS,
  SUPPORTED_YEARS,
} from "@/lib/months";

const MIN_ANSWERS_FOR_RANKING = 3;
// Change this to true when the meeting-plan preview is ready for the whole group.
const SHOW_MEETING_PLAN_TO_EVERYONE = false;
const MEETING_PLAN_PREVIEW_NAME = "Konrad";
const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];

type MeetingGroup = {
  day: number;
  members: Availability[];
};

type MeetingPlan = {
  groups: MeetingGroup[];
  flexible: Availability[];
  coveredCount: number;
  uncovered: Availability[];
};

const fullDateFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortWeekdayFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
});
const monthNameFormatter = new Intl.DateTimeFormat("it-IT", {
  month: "long",
});
const monthLabelFormatter = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
});

function capitalize(value: string) {
  return value.replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(year: number, monthIndex: number, day: number) {
  const date = new Date(year, monthIndex, day);
  return fullDateFormatter.format(date);
}

function dayLabel(year: number, monthIndex: number, day: number) {
  return capitalize(formatDate(year, monthIndex, day));
}

function shortDayLabel(year: number, monthIndex: number, day: number) {
  const weekday = shortWeekdayFormatter
    .format(new Date(year, monthIndex, day))
    .replace(".", "")
    .replace(/^./, (letter) => letter.toUpperCase());

  return `${weekday} ${day}`;
}

function normalName(name: string) {
  return name.trim().toLocaleLowerCase("it");
}

function isAvailableOn(answer: Availability, day: number) {
  return answer.alwaysFree || answer.dates.includes(day);
}

function assignPair(answers: Availability[], firstDay: number, secondDay: number) {
  const firstMembers = answers.filter(
    (answer) => isAvailableOn(answer, firstDay) && !isAvailableOn(answer, secondDay),
  );
  const secondMembers = answers.filter(
    (answer) => isAvailableOn(answer, secondDay) && !isAvailableOn(answer, firstDay),
  );
  const flexible = answers.filter(
    (answer) => isAvailableOn(answer, firstDay) && isAvailableOn(answer, secondDay),
  );

  flexible.forEach((answer) => {
    if (firstMembers.length <= secondMembers.length) {
      firstMembers.push(answer);
    } else {
      secondMembers.push(answer);
    }
  });

  const coveredIds = new Set([
    ...firstMembers.map((answer) => answer.id),
    ...secondMembers.map((answer) => answer.id),
  ]);

  return {
    groups: [
      { day: firstDay, members: firstMembers },
      { day: secondDay, members: secondMembers },
    ],
    flexible,
    coveredCount: coveredIds.size,
    uncovered: answers.filter((answer) => !coveredIds.has(answer.id)),
  } satisfies MeetingPlan;
}

function findBestMeetingPlan(
  answers: Availability[],
  monthDays: { day: number; available: Availability[] }[],
): MeetingPlan | null {
  const candidates = monthDays.filter((result) => result.available.length > 0);
  if (candidates.length === 0) return null;

  const bestSingle = [...candidates].sort(
    (first, second) =>
      second.available.length - first.available.length || first.day - second.day,
  )[0];
  const singleIds = new Set(bestSingle.available.map((answer) => answer.id));
  const singlePlan: MeetingPlan = {
    groups: [{ day: bestSingle.day, members: bestSingle.available }],
    flexible: [],
    coveredCount: singleIds.size,
    uncovered: answers.filter((answer) => !singleIds.has(answer.id)),
  };

  let bestPair: MeetingPlan | null = null;
  let bestPairBalance = -1;
  let bestPairAttendance = -1;

  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
      const first = candidates[firstIndex];
      const second = candidates[secondIndex];
      const pair = assignPair(answers, first.day, second.day);
      const balance = Math.min(...pair.groups.map((group) => group.members.length));
      const attendance = first.available.length + second.available.length;
      const beatsCurrent =
        !bestPair ||
        pair.coveredCount > bestPair.coveredCount ||
        (pair.coveredCount === bestPair.coveredCount && balance > bestPairBalance) ||
        (pair.coveredCount === bestPair.coveredCount &&
          balance === bestPairBalance &&
          attendance > bestPairAttendance);

      if (beatsCurrent) {
        bestPair = pair;
        bestPairBalance = balance;
        bestPairAttendance = attendance;
      }
    }
  }

  const minimumUsefulGain = Math.max(2, Math.ceil(answers.length * 0.1));
  return bestPair && bestPair.coveredCount - singlePlan.coveredCount >= minimumUsefulGain
    ? bestPair
    : singlePlan;
}

export function CenaPlanner({ initialMonth }: { initialMonth: string }) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [monthKey, setMonthKey] = useState(initialMonth);
  const [answers, setAnswers] = useState<Availability[]>([]);
  const [name, setName] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [alwaysFree, setAlwaysFree] = useState(false);
  const [selectedResultDay, setSelectedResultDay] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shared, setShared] = useState(true);
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);

  const { year, monthIndex } = parseMonthKey(monthKey);
  const maximumDay = daysInMonth(monthKey);
  const allDays = useMemo(
    () => Array.from({ length: maximumDay }, (_, index) => index + 1),
    [maximumDay],
  );
  const calendarOffset = firstDayOffset(monthKey);
  const monthDate = new Date(year, monthIndex, 1);
  const monthName = monthNameFormatter.format(monthDate);
  const monthLabel = capitalize(monthLabelFormatter.format(monthDate));
  const today = new Date();
  const currentDay =
    today.getFullYear() === year && today.getMonth() === monthIndex
      ? today.getDate()
      : null;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await loadAvailabilities(monthKey);
        if (cancelled) return;
        setAnswers(result.answers);
        setShared(result.shared);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Qualcosa è andato storto.");
      } finally {
        if (!cancelled) setReady(true);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [monthKey]);

  const existingAnswer = useMemo(
    () => answers.find((answer) => normalName(answer.name) === normalName(name)),
    [answers, name],
  );
  const isEditingExisting = Boolean(
    existingAnswer && existingAnswer.id === editingAnswerId,
  );
  const hasNameConflict = Boolean(existingAnswer && !isEditingExisting);

  const monthDays = useMemo(() => {
    return allDays.map((day) => {
      const available = answers.filter(
        (answer) => answer.alwaysFree || answer.dates.includes(day),
      );

      return { day, available };
    });
  }, [allDays, answers]);

  const rankingReady = answers.length >= MIN_ANSWERS_FOR_RANKING;
  const overlapTiers = useMemo(() => {
    if (!rankingReady) return [];

    const topCounts = [...new Set(monthDays.map((result) => result.available.length))]
      .filter((count) => count > 0)
      .sort((a, b) => b - a)
      .slice(0, 3);

    return topCounts.map((count, index) => ({
      rank: index + 1,
      count,
      days: monthDays
        .filter((result) => result.available.length === count)
        .map((result) => result.day),
    }));
  }, [monthDays, rankingReady]);

  const bestOverlap = overlapTiers[0]?.count ?? 0;
  const meetingPlan = useMemo(
    () => (rankingReady ? findBestMeetingPlan(answers, monthDays) : null),
    [answers, monthDays, rankingReady],
  );
  const meetingPlanVisible =
    SHOW_MEETING_PLAN_TO_EVERYONE ||
    normalName(name) === normalName(MEETING_PLAN_PREVIEW_NAME);
  const recommendedDayIndexes = new Map(
    meetingPlan?.groups.map((group, index) => [group.day, index + 1]) ?? [],
  );
  const bestOverlapDays = monthDays.filter(
    (result) => bestOverlap > 0 && result.available.length === bestOverlap,
  );
  const activeResultDay = selectedResultDay ?? bestOverlapDays[0]?.day ?? 1;
  const activeResult = monthDays.find((result) => result.day === activeResultDay);
  const unavailable = activeResult
    ? answers.filter((answer) => !activeResult.available.some((person) => person.id === answer.id))
    : [];

  function handleNameChange(nextName: string) {
    const matchingAnswer = answers.find(
      (answer) => normalName(answer.name) === normalName(nextName),
    );
    const keepsEditing = matchingAnswer?.id === editingAnswerId;

    setName(nextName);
    setError(null);
    setNotice(null);

    if (keepsEditing) {
      return;
    }

    if (matchingAnswer || editingAnswerId) {
      setSelectedDays([]);
      setAlwaysFree(false);
    }

    setEditingAnswerId(null);
  }

  function handleMonthChange(nextMonth: string) {
    setMonthKey(nextMonth);
    setAnswers([]);
    setName("");
    setSelectedDays([]);
    setAlwaysFree(false);
    setSelectedResultDay(null);
    setNotice(null);
    setError(null);
    setEditingAnswerId(null);
    setShared(true);
    setReady(false);
  }

  function editExistingAnswer() {
    if (!existingAnswer) return;

    setEditingAnswerId(existingAnswer.id);
    setSelectedDays(existingAnswer.alwaysFree ? allDays : existingAnswer.dates);
    setAlwaysFree(existingAnswer.alwaysFree);
    setError(null);
    setNotice("Risposta aperta. Ora puoi modificare le date.");
  }

  function useDifferentName() {
    setName("");
    setEditingAnswerId(null);
    setSelectedDays([]);
    setAlwaysFree(false);
    setError(null);
    setNotice(null);
    window.requestAnimationFrame(() => nameInputRef.current?.focus());
  }

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
      setSelectedDays(next ? allDays : []);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError("Scrivi il tuo nome.");
      return;
    }

    if (hasNameConflict) {
      setError("Questo nome esiste già. Scegli se modificare la risposta o usare un altro nome.");
      return;
    }

    if (!alwaysFree && selectedDays.length === 0) {
      setError("Scegli almeno una sera, oppure seleziona Sempre libero.");
      return;
    }

    try {
      const wasEditing = isEditingExisting;
      setSaving(true);
      const result = await saveAvailability(
        answers,
        {
          name: cleanName,
          dates: alwaysFree ? allDays : selectedDays,
          alwaysFree,
        },
        monthKey,
      );
      setAnswers(result.answers);
      setShared(result.shared);
      const savedAnswer = result.answers.find(
        (answer) => normalName(answer.name) === normalName(cleanName),
      );
      setEditingAnswerId(savedAnswer?.id ?? null);
      setNotice(wasEditing ? "Disponibilità aggiornata." : "Disponibilità salvata.");
    } catch {
      setError("Non siamo riusciti a salvare. Riprova.");
    } finally {
      setSaving(false);
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
          <p className="eyebrow">Cena di {monthName}</p>
          <h1>Quando ci sei?</h1>
          <p className="intro-text">
            *potrai modificare le date dopo averle fissate
          </p>
        </div>

        <div className="form-shell">
          <form onSubmit={handleSubmit} noValidate>
            <div className="month-picker">
              <label htmlFor="month">Mese della cena</label>
              <select
                id="month"
                name="month"
                value={monthKey}
                disabled={saving}
                onChange={(event) => handleMonthChange(event.target.value)}
              >
                {SUPPORTED_YEARS.map((supportedYear) => (
                  <optgroup label={String(supportedYear)} key={supportedYear}>
                    {SUPPORTED_MONTHS.filter(
                      (month) => month.year === supportedYear,
                    ).map((month) => (
                      <option value={month.key} key={month.key}>
                        {capitalize(monthLabelFormatter.format(
                          new Date(month.year, month.monthIndex, 1),
                        ))}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="name">Come ti chiami?</label>
              <input
                id="name"
                ref={nameInputRef}
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Scrivi il tuo nome"
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
              />
              {hasNameConflict && existingAnswer && (
                <div className="name-conflict" role="alert">
                  <strong>Questo nome esiste già.</strong>
                  <p>Scegli un altro nome oppure apri la risposta esistente per modificarla.</p>
                  <div className="name-conflict-actions">
                    <button type="button" onClick={editExistingAnswer}>
                      Modifica la risposta
                    </button>
                    <button type="button" onClick={useDifferentName}>
                      Usa un altro nome
                    </button>
                  </div>
                </div>
              )}
              {isEditingExisting && existingAnswer && (
                <p className="editing-note">
                  Stai modificando la risposta di <strong>{existingAnswer.name}</strong>. Il salvataggio sostituirà quella esistente.
                </p>
              )}
            </div>

            <fieldset
              className={`calendar-fieldset${hasNameConflict ? " is-locked" : ""}`}
              disabled={hasNameConflict}
            >
              <legend>Quando sei libero?</legend>
              <div className="month-heading">
                <span>{monthLabel}</span>
                <span>{selectedDays.length} sere</span>
              </div>

              <div className="calendar" role="group" aria-label={`Sere disponibili a ${monthName} ${year}`}>
                {WEEKDAYS.map((weekday, index) => (
                  <span className="weekday" key={`${weekday}-${index}`} aria-hidden="true">
                    {weekday}
                  </span>
                ))}
                {Array.from({ length: calendarOffset }, (_, index) => (
                  <span className="calendar-spacer" key={`spacer-${index}`} aria-hidden="true" />
                ))}
                {allDays.map((day) => {
                  const selected = selectedDays.includes(day);
                  const date = new Date(year, monthIndex, day);
                  const weekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = day === currentDay;

                  return (
                    <button
                      className={`day-button${selected ? " is-selected" : ""}${weekend ? " is-weekend" : ""}`}
                      type="button"
                      key={day}
                      aria-label={`${dayLabel(year, monthIndex, day)}${isToday ? ", oggi" : ""}`}
                      aria-pressed={selected}
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                      {isToday && <span className="current-day-dot" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button
              className={`always-button${alwaysFree ? " is-selected" : ""}`}
              type="button"
              disabled={hasNameConflict}
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
              <button
                className="submit-button"
                type="submit"
                disabled={saving || hasNameConflict}
              >
                {saving
                  ? "Salvataggio…"
                  : hasNameConflict
                    ? "Nome già usato"
                    : isEditingExisting
                      ? "Aggiorna"
                      : "Salva disponibilità"}
              </button>
              {!shared && (
                <p className="storage-note">
                  Archivio condiviso non disponibile: salvataggio solo su questo dispositivo.
                </p>
              )}
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
            <h2>Mappa del mese</h2>
            <p>{answers.length === 1 ? "1 persona ha risposto" : `${answers.length} persone hanno risposto`}</p>
          </div>
          <p className="results-note">
            {!rankingReady
              ? `La classifica apparirà dopo ${MIN_ANSWERS_FOR_RANKING} risposte.`
              : bestOverlap > 0
              ? `Migliore sovrapposizione: ${bestOverlap} su ${answers.length}`
              : "Le sovrapposizioni appariranno qui."}
          </p>
        </div>

        {!ready ? (
          <div className="results-loading" aria-label="Caricamento risultati">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <>
            {meetingPlanVisible && meetingPlan && (
              <section className="meeting-plan" aria-labelledby="meeting-plan-title">
                <div className="meeting-plan-heading">
                  <div>
                    <p>Miglior organizzazione</p>
                    <h3 id="meeting-plan-title">
                      {meetingPlan.groups.length === 1
                        ? "Una cena consigliata"
                        : `${meetingPlan.groups.length} cene consigliate`}
                    </h3>
                  </div>
                  <strong>{meetingPlan.coveredCount}/{answers.length}</strong>
                </div>

                <div className={`meeting-plan-groups is-${meetingPlan.groups.length}`}>
                  {meetingPlan.groups.map((group, index) => (
                    <button
                      type="button"
                      className="meeting-plan-group"
                      key={group.day}
                      aria-label={`Mostra la cena ${index + 1}, ${dayLabel(year, monthIndex, group.day)}, ${group.members.length} persone`}
                      onClick={() => setSelectedResultDay(group.day)}
                    >
                      <span className="meeting-plan-group-number">Cena {index + 1}</span>
                      <span className="meeting-plan-group-date">
                        {shortDayLabel(year, monthIndex, group.day)}
                        <strong>{group.members.length} persone</strong>
                      </span>
                      <span className="meeting-plan-group-names">
                        {group.members.map((person) => person.name).join(", ")}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="meeting-plan-summary">
                  <p>
                    <strong>{meetingPlan.coveredCount}/{answers.length}</strong> persone hanno almeno una cena
                  </p>
                  {meetingPlan.flexible.length > 0 && (
                    <p>
                      <span>Disponibili entrambe le date</span>
                      {meetingPlan.flexible.map((person) => person.name).join(", ")}
                    </p>
                  )}
                  {meetingPlan.uncovered.length > 0 && (
                    <p>
                      <span>Restano fuori</span>
                      {meetingPlan.uncovered.map((person) => person.name).join(", ")}
                    </p>
                  )}
                </div>
              </section>
            )}

            {overlapTiers.length > 0 && (
              <ol className="overlap-tiers" aria-label="Classifica delle date con più disponibilità">
                {overlapTiers.map((tier) => (
                  <li className={`overlap-tier is-tier-${tier.rank}`} key={tier.count}>
                    <div className="overlap-tier-heading">
                      <span>{tier.rank}° posto</span>
                      <strong>{tier.count}/{answers.length}</strong>
                    </div>
                    <div className="overlap-tier-dates">
                      {tier.days.map((day, index) => (
                        <button
                          type="button"
                          key={day}
                          className={activeResultDay === day ? "is-active" : undefined}
                          aria-label={`Mostra ${dayLabel(year, monthIndex, day)}, ${tier.count} persone disponibili`}
                          aria-pressed={activeResultDay === day}
                          onClick={() => setSelectedResultDay(day)}
                        >
                          {shortDayLabel(year, monthIndex, day)}{index < tier.days.length - 1 ? "," : ""}
                        </button>
                      ))}
                      <span>{monthName}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className="month-results-grid">
              <div className="month-map" role="group" aria-label={`Disponibilità del gruppo a ${monthName} ${year}`}>
              {WEEKDAYS.map((weekday, index) => (
                <span className="month-map-weekday" key={`map-${weekday}-${index}`} aria-hidden="true">
                  {weekday}
                </span>
              ))}
              {Array.from({ length: calendarOffset }, (_, index) => (
                <span className="month-map-spacer" key={`map-spacer-${index}`} aria-hidden="true" />
              ))}
              {monthDays.map((result) => {
                const names = result.available.map((person) => person.name);
                const tierRank = overlapTiers.find(
                  (tier) => tier.count === result.available.length,
                )?.rank;
                const isActive = activeResultDay === result.day;
                const isToday = result.day === currentDay;
                const recommendedIndex = meetingPlanVisible
                  ? recommendedDayIndexes.get(result.day)
                  : undefined;

                return (
                  <button
                    type="button"
                    key={result.day}
                    className={`month-map-day${tierRank ? ` is-tier-${tierRank}` : ""}${recommendedIndex ? ` is-plan-${recommendedIndex}` : ""}${isActive ? " is-active" : ""}`}
                    aria-label={`${dayLabel(year, monthIndex, result.day)}${isToday ? ", oggi" : ""}. ${result.available.length} su ${answers.length} disponibili${names.length > 0 ? `: ${names.join(", ")}` : ". Nessuno"}`}
                    aria-pressed={isActive}
                    onClick={() => setSelectedResultDay(result.day)}
                  >
                    <span className="month-map-day-top">
                      <strong>{result.day}</strong>
                      <span>{result.available.length}/{answers.length}</span>
                    </span>
                    <span className="month-map-names">
                      {names.length > 0 ? names.join(", ") : "Nessuno"}
                    </span>
                    {recommendedIndex && (
                      <span className="month-map-plan-label" aria-hidden="true">
                        Cena {recommendedIndex}
                      </span>
                    )}
                    {isToday && <span className="current-day-dot" aria-hidden="true" />}
                  </button>
                );
              })}
              </div>

              {activeResult && (
                <aside className="day-detail" aria-live="polite">
                  {bestOverlap > 0 && activeResult.available.length === bestOverlap && (
                    <p className="best-overlap-label">Migliore sovrapposizione</p>
                  )}
                  <p className="detail-date">{dayLabel(year, monthIndex, activeResult.day)}</p>
                  <div className="people-group">
                    <h3>Ci sono</h3>
                    <p>{activeResult.available.length > 0 ? activeResult.available.map((person) => person.name).join(", ") : "Nessuno"}</p>
                  </div>
                  <div className="people-group is-muted">
                    <h3>Non ci sono</h3>
                    <p>{unavailable.length > 0 ? unavailable.map((person) => person.name).join(", ") : "Nessuno"}</p>
                  </div>
                </aside>
              )}
            </div>
          </>
        )}
      </section>

      <footer>
        <a href="#inizio">Aggiungi le tue date</a>
      </footer>
    </main>
  );
}
