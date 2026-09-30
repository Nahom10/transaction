export function formatBirr(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' Br';
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-ET', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}
