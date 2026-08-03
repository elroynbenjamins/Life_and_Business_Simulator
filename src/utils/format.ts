export function formatCurrency(amount: number | undefined | null, decimals = 0): string {
  const val = amount ?? 0;
  const formatted = Math.abs(val)
    .toFixed(decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return val < 0 ? `-€${formatted}` : `€${formatted}`;
}

export function formatPercent(value: number | undefined | null, decimals = 1): string {
  const val = value ?? 0;
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(decimals)}%`;
}
