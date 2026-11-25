/** Paginaci├│n acotada: evita `LIMIT NaN`, valores negativos y volcados masivos. */
export function pagination(page: unknown, limit: unknown, defaultLimit = 20, maxLimit = 100) {
  const parsedPage = Number.parseInt(String(page ?? '1'), 10);
  const parsedLimit = Number.parseInt(String(limit ?? defaultLimit), 10);
  const p = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const l = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, maxLimit) : defaultLimit;
  return { page: p, limit: l, offset: (p - 1) * l };
}
