import { describe, expect, it } from 'vitest';
import {
	computeKpis,
	filterByPeriod,
	filterByReps,
	formatPercent,
	formatPrescription,
	formatVolume,
	normalizeName,
	previousWindow,
	shiftDaysISO,
	todayISO,
	volumeOf
} from './sets';

describe('normalizeName', () => {
	it('replie les accents, la casse et les espaces', () => {
		expect(normalizeName('Développé  Couché')).toBe('developpe couche');
		expect(normalizeName('SQUAT')).toBe('squat');
		expect(normalizeName('  Épaulé-jeté ')).toBe('epaule-jete');
	});
});

describe('volume', () => {
	it('multiplie poids, répétitions et séries', () => {
		expect(volumeOf({ date: '2026-01-01', weight: 110, reps: 3, setCount: 4 })).toBe(1320);
	});

	it('accepte les décimaux', () => {
		expect(volumeOf({ date: '2026-01-01', weight: 82.5, reps: 5, setCount: 3 })).toBeCloseTo(1237.5);
	});
});

describe('computeKpis', () => {
	const sets = [
		{ date: '2026-01-01', weight: 100, reps: 5, setCount: 3 },
		{ date: '2026-01-08', weight: 105, reps: 5, setCount: 4 }
	];

	it('agrège les séries, le maximum et le volume', () => {
		const kpis = computeKpis(sets);
		expect(kpis.entries).toBe(2);
		expect(kpis.totalSets).toBe(7);
		expect(kpis.maxWeight).toBe(105);
		expect(kpis.volume).toBe(100 * 5 * 3 + 105 * 5 * 4);
	});

	it('compare le poids max à la période précédente', () => {
		expect(computeKpis(sets, [{ date: '2025-12-01', weight: 95, reps: 5, setCount: 3 }]).progressionPct).toBeCloseTo(10.53, 1);
	});

	it('renvoie null sans période de comparaison', () => {
		expect(computeKpis(sets).progressionPct).toBeNull();
		expect(computeKpis([]).progressionPct).toBeNull();
	});
});

describe('filtres', () => {
	const rows = [
		{ date: todayISO(), reps: 5 },
		{ date: shiftDaysISO(-40), reps: 8 },
		{ date: shiftDaysISO(-400), reps: 5 }
	];

	it('garde la fenêtre de 30 jours', () => {
		expect(filterByPeriod(rows, 30)).toHaveLength(1);
	});

	it('conserve tout quand days vaut 0', () => {
		expect(filterByPeriod(rows, 0)).toHaveLength(3);
	});

	it('filtre sur les répétitions', () => {
		expect(filterByReps(rows, 5)).toHaveLength(2);
		expect(filterByReps(rows, 'all')).toHaveLength(3);
	});

	it('isole la période précédente de même durée', () => {
		const previous = previousWindow(rows, 30);
		expect(previous.map((row) => row.reps)).toEqual([8]);
	});

	it('ne renvoie rien pour la période complète', () => {
		expect(previousWindow(rows, 0)).toHaveLength(0);
	});
});

describe('formatage', () => {
	it('affiche les tonnes au-delà de 10 000 kg', () => {
		expect(formatVolume(12_480)).toBe('12,5 t');
		expect(formatVolume(2400).endsWith('kg')).toBe(true);
	});

	it('affiche une progression signée', () => {
		expect(formatPercent(12.4)).toBe('+12 %');
		expect(formatPercent(-5)).toBe('-5 %');
		expect(formatPercent(null)).toBe('—');
	});

	it('résume une prescription', () => {
		expect(formatPrescription({ date: '2026-01-01', weight: 110, reps: 3, setCount: 4 })).toBe(
			'4 × 3 @ 110 kg'
		);
	});
});
