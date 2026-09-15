import { useState } from "react";

/**
 * Airline emblems come from the logo CDN Google Flights uses, keyed by IATA
 * code. It is not a documented API, so every path here degrades to a monogram
 * rather than assuming an image will arrive.
 */
const logoUrl = (code: string) => `https://www.gstatic.com/flights/airline_logos/70px/${code}.png`;

/**
 * These codes resolve, but to a generic grey tail rather than the airline's
 * own mark — mostly Russian regional carriers. A 404 is caught by onError;
 * this placeholder is not, so skip straight to the monogram for them.
 */
const CARRIERS_WITHOUT_LOGO = new Set(["2S", "4G", "A4", "IO", "SZ", "UJ", "YC", "ZF"]);

/** Falls back to the carrier's initials when there is no usable IATA code. */
function monogram(code: string | null, name: string) {
  if (code) return code;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("");
  return initials.toUpperCase() || "—";
}

type Props = { code: string | null; name: string };

export function AirlineLogo({ code, name }: Props) {
  // Tracking which code failed, rather than a plain boolean, keeps the fallback
  // correct when React reuses this component for a different row.
  const [failedCode, setFailedCode] = useState<string | null>(null);

  const showImage = code !== null && !CARRIERS_WITHOUT_LOGO.has(code) && failedCode !== code;

  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary">
      {showImage ? (
        <img
          src={logoUrl(code)}
          // The carrier's name sits next to this in the row, so the logo is
          // decorative and should not be read out twice.
          alt=""
          aria-hidden
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-7 w-7 object-contain"
          onError={() => setFailedCode(code)}
        />
      ) : (
        <span className="text-[11px] leading-none font-bold tracking-tight text-muted-foreground">
          {monogram(code, name)}
        </span>
      )}
    </span>
  );
}
