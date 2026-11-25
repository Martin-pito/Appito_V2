import { describe, expect, it } from 'vitest';
import { formatDuration, formatPace, paceSecondsPerKm, summarizeRuns } from './runs';
import type { RunLike } from './runs';

function run(overrides: Partial<RunLike> = {}): RunLike {
	return {
		distanceM: 10_000,
		durationS: 3000,
		avgHr: 160,
		elevationGainM: 50,
		hrZone1: 100,
		hrZone2: 400,
		hrZone3: 900,
		hrZone4: 1200,
		hrZone5: 400,
		...overrides
	};
}

describe('allure', () => {
	it('calcule les secondes par kilomètre', () => {
		expect(paceSecondsPerKm(run())).toBe(300);
	});

	it('ignore les efforts trop courts', () => {
		expect(paceSecondsPerKm(run({ distanceM: 20 }))).toBeNull();
		expect(paceSecondsPerKm(run({ durationS: null }))).toBeNull();
	});

	it('formate minutes:secondes', () => {
		expect(formatPace(308)).toBe('5:08 /km');
		expect(formatPace(null)).toBe('—');
	});
});

describe('durée', () => {
	it('ajoute les heures au-delà de 60 minutes', () => {
		expect(formatDuration(3725)).toBe('1 h 02');
		expect(formatDuration(320)).toBe('5:20');
		expect(formatDuration(null)).toBe('—');
	});
});

describe('summarizeRuns', () => {
	it('agrège distance, temps et dénivelé', () => {
		const summary = summarizeRuns([run(), run({ distanceM: 5000, durationS: 1500, elevationGainM: 10 })]);
		expect(summary.count).toBe(2);
		expect(summary.distanceKm).toBe(15);
		expect(summary.durationS).toBe(4500);
		expect(summary.elevationGainM).toBe(60);
	});

	it('pondère l’allure par la distance et la FC par la durée', () => {
		const summary = summarizeRuns([
			run({ distanceM: 10_000, durationS: 3000, avgHr: 150 }),
			run({ distanceM: 5000, durationS: 1500, avgHr: 180 })
		]);
		expect(summary.avgPace).toBeCloseTo(300);
		expect(summary.avgHr).toBeCloseTo(160);
	});

	it('calcule la part de temps en Z4–Z5', () => {
		const summary = summarizeRuns([run()]);
		expect(summary.highIntensityShare).toBeCloseTo(53.33, 1);
	});

	it('renvoie null quand les zones sont absentes', () => {
		const summary = summarizeRuns([
			run({ hrZone1: null, hrZone2: null, hrZone3: null, hrZone4: null, hrZone5: null })
		]);
		expect(summary.highIntensityShare).toBeNull();
	});
});
