export function formatAmount(n: number): string {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
}

export function formatDateInput(d: string): string {
  // Normalize date for input[type=date] — return YYYY-MM-DD
  return d ? d.split('T')[0] : '';
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export function yearStartStr(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function weekStartStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}
