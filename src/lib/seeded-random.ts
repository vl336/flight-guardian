/**
 * Deterministic stand-ins for randomness. Everything here is a pure function of
 * its arguments, so the same flight renders the same numbers on the server, on
 * the client after hydration, and after a reload — `Math.random()` would give a
 * different card every render and a hydration mismatch on top of it.
 */

/**
 * FNV-1a, 32 bits. Chosen because it is a dozen lines with no lookup tables and
 * avalanches well: one changed character changes the whole result.
 */
export function hash32(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      // `h * 16777619` in 32 bits — plain `*` would lose the low bits to floats.
      h = Math.imul(h, 0x01000193);
    }
    // A separator between parts, or hash32("SVO", "KZN") would collide with
    // hash32("SVOK", "ZN") and unrelated tracks would share values.
    h ^= 0x2f;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Seed -> uniform [0, 1). The hash goes through mulberry32's mixing step first:
 * its own low bits are not evenly spread, so dividing it directly would bias
 * everything built on top.
 */
export function unit(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Seed -> standard normal, via Box-Muller on two derived seeds. Clipped to ±3σ:
 * without it one flight in a few thousand draws a tail value and the card ends
 * up claiming a 140-minute average delay.
 */
export function normal(seed: number): number {
  const u1 = Math.max(unit(seed), 1e-9); // ln(0) is -Infinity
  const u2 = unit((seed ^ 0x9e3779b9) >>> 0);
  return clamp(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2), -3, 3);
}

/**
 * Value noise along a continuous axis, in [0, 1).
 *
 * Hashes land on whole steps only and the value between them is interpolated,
 * so `t` and `t + 0.1` stay close while `t` and `t + 5` are unrelated — which
 * is what makes the weather drift smoothly as departure time moves instead of
 * jumping on every hour boundary. The smoothstep curve `3f² - 2f³` has zero
 * slope at both ends of a step, so the track has no kinks at the nodes either;
 * a linear blend would give a sawtooth.
 */
export function noise(track: string, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = unit(hash32(track, i));
  const b = unit(hash32(track, i + 1));
  return a + (b - a) * f * f * (3 - 2 * f);
}

/** Deterministic choice. Empty lists are a programming error, not a runtime case. */
export function pick<T>(seed: number, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(unit(seed) * items.length))]!;
}

export const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

export const clampInt = (value: number, min: number, max: number) =>
  Math.round(clamp(value, min, max));

/** Forecasts to the minute read as false precision, so spans snap to five. */
export const round5 = (value: number) => Math.round(value / 5) * 5;
