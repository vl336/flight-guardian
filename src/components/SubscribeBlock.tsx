import { useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TELEGRAM_BOT_URL } from "@/lib/telegram-bot";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Бота в Максе на деле нет — ссылка стоит, чтобы мерить спрос на канал. */
const MAX_BOT_URL = "https://max.ru/riskbotair";

export type SubscribeChannel = "email" | "telegram" | "max";

type Props = {
  title: string;
  text: string;
  /** Для aria-label поля: «Email для подписки на …». */
  subject: string;
  /** Текст уведомления после подписки по почте. */
  successText: (email: string) => string;
  telegramHref?: string;
  /**
   * Срабатывает на каждый канал: почту — после проверки адреса, мессенджеры —
   * по клику. Цели у рейса и города разные, поэтому их шлёт вызывающий.
   */
  onSubscribe: (channel: SubscribeChannel) => void;
  /** Фон блока (background-image). Без него — фирменный градиент страницы. */
  background?: string | undefined;
};

/** Подписка на рейс или город: почта, Telegram и Макс в одном виде. */
export function SubscribeBlock({
  title,
  text,
  subject,
  successText,
  telegramHref = TELEGRAM_BOT_URL,
  onSubscribe,
  background,
}: Props) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const isValidEmail = emailRegex.test(email.trim());
  const showError = touched && email.length > 0 && !isValidEmail;

  const handleSubscribe = () => {
    const clean = email.trim();
    if (!emailRegex.test(clean)) return;
    onSubscribe("email");
    toast.success("Успешно подписались", { description: successText(clean) });
    setEmail("");
    setTouched(false);
  };

  return (
    <section
      className={`rounded-3xl p-5 text-primary-foreground shadow-card sm:p-6 ${background ? "" : "bg-hero"}`}
      style={background ? { backgroundImage: background } : undefined}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg leading-tight font-extrabold">{title}</h3>
          <p className="mt-1 text-sm text-primary-foreground/75">{text}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubscribe();
          }}
          placeholder="Введите ваш email"
          aria-label={`Email для подписки на ${subject}`}
          aria-invalid={showError}
          className="h-12 rounded-2xl border-transparent bg-card text-base text-foreground placeholder:text-muted-foreground"
        />
        <Button
          disabled={!isValidEmail}
          onClick={handleSubscribe}
          className="h-12 rounded-2xl bg-card text-base font-bold text-foreground hover:bg-card/90 disabled:opacity-60"
        >
          Подписаться
        </Button>
      </div>
      {showError && (
        <p className="mt-2 text-sm font-semibold text-primary-foreground">
          Введите корректный email, например name@example.com
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
        <a
          href={telegramHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onSubscribe("telegram")}
          className="rounded-2xl bg-primary-foreground/15 px-3 py-2.5 text-center transition-colors hover:bg-primary-foreground/25"
        >
          В Telegram →
        </a>
        <a
          href={MAX_BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onSubscribe("max")}
          className="rounded-2xl bg-primary-foreground/15 px-3 py-2.5 text-center transition-colors hover:bg-primary-foreground/25"
        >
          В Макс →
        </a>
      </div>
    </section>
  );
}
