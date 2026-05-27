export function formatData(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDataOra(timestamp: number): string {
  return new Date(timestamp).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}