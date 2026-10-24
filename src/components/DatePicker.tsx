import { useState } from "react";
import { CalendarDays, ChevronsUpDown } from "lucide-react";
import { ru } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toLocalDate } from "@/lib/api";
import type { LocalDate } from "@/lib/graphql-types";

type Props = {
  value: LocalDate;
  onChange: (date: LocalDate) => void;
  /** Первый день, который можно выбрать. */
  min: LocalDate;
  /**
   * Есть ли в этот день рейсы по выбранному маршруту: true — есть (день с точкой),
   * false — нет (день не выбрать), undefined — неизвестно, данных за него ещё нет:
   * день открыт, потому что «данных нет» не значит «рейсов нет».
   */
  flightsOn: (date: LocalDate) => boolean | undefined;
  /** Пояснение к точкам и серым дням — только когда по дням есть данные. */
  legend?: boolean;
  /** Строка под календарём, например про границу расписания. */
  note?: string | undefined;
  label: string;
};

const fromLocal = (date: LocalDate) => new Date(`${date}T00:00:00`);

const triggerFormat = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "long",
});

/**
 * Поле даты вылета. Вместо нативного `<input type="date">`, который не умеет гасить
 * отдельные дни: здесь дни без рейсов по маршруту недоступны, а с рейсами отмечены
 * точкой, так что в день без рейсов попасть нельзя. Дальше горизонта расписания дни
 * открыты — выбрать дату на месяц вперёд по-прежнему можно.
 */
export function DatePicker({ value, onChange, min, flightsOn, legend, note, label }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? fromLocal(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex h-14 w-full items-center gap-2 rounded-2xl border border-border bg-secondary/60 px-3 text-left text-base"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            {selected ? triggerFormat.format(selected) : "Дата вылета"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto rounded-2xl p-0">
        <Calendar
          mode="single"
          locale={ru}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected ?? fromLocal(min)}
          startMonth={fromLocal(min)}
          onSelect={(day) => {
            if (!day) return;
            onChange(toLocalDate(day));
            setOpen(false);
          }}
          disabled={(day) => {
            const date = toLocalDate(day);
            return date < min || flightsOn(date) === false;
          }}
          modifiers={{ flights: (day) => flightsOn(toLocalDate(day)) === true }}
          modifiersClassNames={{
            flights:
              "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-[''] has-[[data-selected-single=true]]:after:bg-primary-foreground",
          }}
          className="[--cell-size:2.75rem] sm:[--cell-size:2.5rem]"
        />
        {(legend || note) && (
          // w-0 min-w-full: пояснение не растягивает попап, а переносится по ширине календаря.
          <div className="w-0 min-w-full space-y-1 border-t px-4 py-3 text-xs text-muted-foreground">
            {legend && (
              <p className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" />
                есть рейсы · серые дни — рейсов нет
              </p>
            )}
            {note && <p>{note}</p>}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
