import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CityOption = { value: string; hint?: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: CityOption[];
  label: string;
  placeholder: string;
  emptyText: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  loading?: boolean;
};

export function CityCombobox({
  value,
  onChange,
  options,
  label,
  placeholder,
  emptyText,
  icon: Icon,
  disabled = false,
  loading = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          disabled={disabled || loading}
          className="flex h-14 w-full items-center gap-2 rounded-2xl border border-border bg-secondary/60 px-3 text-left text-base disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] rounded-2xl p-0"
      >
        <Command>
          <CommandInput placeholder="Поиск города" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{option.value}</span>
                  {option.hint && (
                    <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
