export function formatINR(n: number): string {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

export function initials(name: string): string {
  return name.trim().split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}