import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchParams } from "@/lib/api";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AlertsSubscribe({ params }: { params: SearchParams | null }) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const isValidEmail = useMemo(() => emailRegex.test(email.trim()), [email]);
  const showError = touched && email.length > 0 && !isValidEmail;
  const route = params ? `${params.from} — ${params.to}` : "выбранным рейсам";

  const handleSubscribe = () => {
    const clean = email.trim();
    if (!emailRegex.test(clean)) return;
    toast.success("Успешно подписались", {
      description: `Если расписание по направлению ${route} изменится, напишем вам на ${clean}.`,
    });
    setEmail("");
    setTouched(false);
  };

  return (
    <div className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-card sm:p-6">
      <h3 className="text-xl font-extrabold">Следить за изменениями расписания?</h3>
      <p className="mt-2 text-sm text-primary-foreground/75">
        Введите email — мы пришлём уведомление, если рейс сдвинут или сняли с расписания.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Введите ваш email"
          aria-label="Email для подписки"
          aria-invalid={showError}
          className="h-13 rounded-2xl border-transparent bg-card text-base text-foreground placeholder:text-muted-foreground"
        />
        <Button
          disabled={!isValidEmail}
          onClick={handleSubscribe}
          className="h-13 rounded-2xl bg-sky text-base font-bold hover:bg-sky/90 disabled:opacity-60"
        >
          Подписаться
        </Button>
      </div>
      {showError && (
        <p className="mt-2 text-sm font-semibold text-danger">
          Введите корректный email, например name@example.com
        </p>
      )}
      <div className="mt-4 rounded-2xl bg-card/10 p-4 text-sm">
        <p className="font-semibold text-primary-foreground">Telegram-бот</p>
        <p className="mt-1 text-primary-foreground/75">
          Удобнее в Telegram — бот пришлёт алерт, если вылет начнёт сдвигаться.
        </p>
        <a
          href="https://t.me/riskbotair"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-bold text-sky hover:underline"
        >
          @riskbotair →
        </a>
      </div>
    </div>
  );
}
