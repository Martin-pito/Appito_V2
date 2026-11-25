/**
 * Domaine musculation — fonctions pures, testées sans navigateur.
 * Toute la logique de calcul (volume, filtres, progression) vit ici :
 * les composants Svelte ne font qu'afficher.
 */

export interface SetLike {
	date: string;
	weight: number;
	reps: number;
	setCount: number;
}

export interface Kpis {
	entries: number;
	totalSets: number;
	maxWeight: number;
	volume: number;
	progressionPct: number | null;
}

/** Clé de comparaison d'un mouvement : minuscules, accents repliés, espaces normalisés. */
export function normalizeName(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

export function volumeOf(set: SetLike): number {
	return set.weight * set.reps * set.setCount;
}

/** Date locale au format ISO `YYYY-MM-DD` (jamais UTC : pas de décalage d'un jour). */
export function todayISO(now: Date = new Date()): string {
	const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 10);
}

export function shiftDaysISO(days: number, from: string = todayISO()): string {
	const d = new Date(from + 'T12:00:00');
	d.setDate(d.getDate() + days);
	return todayISO(d);
}

/** Filtre par période : `days = 0` signifie « tout ». */
export function filterByPeriod<T extends { date: string }>(rows: T[], days: number): T[] {
	if (!days) return [...rows];
	const cutoff = shiftDaysISO(-days);
	return rows.filter((row) => row.date >= cutoff);
}

export function filterByReps<T extends { reps: number }>(rows: T[], reps: number | 'all'): T[] {
	if (reps === 'all') return [...rows];
	return rows.filter((row) => row.reps === reps);
}

/**
 * KPI d'une période.
 * `previous` contient les séries de la période précédente de même durée :
 * la progression compare le poids max des deux périodes.
 */
export function computeKpis(sets: SetLike[], previous: SetLike[] = []): Kpis {
	const entries = sets.length;
	const totalSets = sets.reduce((sum, s) => sum + s.setCount, 0);
	const maxWeight = sets.reduce((max, s) => Math.max(max, s.weight), 0);
	const volume = sets.reduce((sum, s) => sum + volumeOf(s), 0);

	const previousMax = previous.reduce((max, s) => Math.max(max, s.weight), 0);
	const progressionPct =
		previousMax > 0 && maxWeight > 0 ? ((maxWeight - previousMax) / previousMax) * 100 : null;

	return { entries, totalSets, maxWeight, volume, progressionPct };
}

/** Séries de la période précédente, de même durée, pour la progression. */
export function previousWindow<T extends { date: string }>(rows: T[], days: number): T[] {
	if (!days) return [];
	const end = shiftDaysISO(-days);
	const start = shiftDaysISO(-days * 2);
	return rows.filter((row) => row.date >= start && row.date < end);
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
	return new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value);
}

export function formatWeight(kg: number): string {
	return `${formatNumber(kg, 1)} kg`;
}

export function formatVolume(kg: number): string {
	if (kg >= 10_000) return `${formatNumber(kg / 1000, 1)} t`;
	return `${formatNumber(kg, 0)} kg`;
}

export function formatPercent(value: number | null): string {
	if (value === null) return '—';
	const sign = value > 0 ? '+' : '';
	return `${sign}${formatNumber(value, 0)} %`;
}

export function formatDateFr(iso: string): string {
	const date = new Date(iso.length > 10 ? iso : iso + 'T12:00:00');
	return new Intl.DateTimeFormat('fr-FR', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(date);
}

export function formatRelativeDate(iso: string): string {
	const today = todayISO();
	if (iso.slice(0, 10) === today) return "Aujourd'hui";
	if (iso.slice(0, 10) === shiftDaysISO(-1)) return 'Hier';
	return formatDateFr(iso);
}

/** « 4 × 3 @ 110 kg » */
export function formatPrescription(set: SetLike): string {
	return `${set.setCount} × ${set.reps} @ ${formatWeight(set.weight)}`;
}
