import type { Run } from '../db/db';

/** Domaine course — mêmes définitions que la v1, transposées telles quelles. */

export interface RunLike {
	distanceM: number | null;
	durationS: number | null;
	avgHr: number | null;
	elevationGainM: number | null;
	hrZone1: number | null;
	hrZone2: number | null;
	hrZone3: number | null;
	hrZone4: number | null;
	hrZone5: number | null;
}

export function runKm(run: RunLike): number {
	return (run.distanceM ?? 0) / 1000;
}

/** Allure en secondes par kilomètre, calculée à la lecture (jamais stockée). */
export function paceSecondsPerKm(run: RunLike): number | null {
	if (!run.distanceM || !run.durationS || run.distanceM < 50) return null;
	return run.durationS / (run.distanceM / 1000);
}

export function formatDuration(seconds: number | null): string {
	if (!seconds || seconds <= 0) return '—';
	const total = Math.round(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatPace(secondsPerKm: number | null): string {
	if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return '—';
	const total = Math.round(secondsPerKm);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${String(s).padStart(2, '0')} /km`;
}

export function totalZoneSeconds(run: RunLike): number {
	return [run.hrZone1, run.hrZone2, run.hrZone3, run.hrZone4, run.hrZone5].reduce<number>(
		(sum, value) => sum + (value ?? 0),
		0
	);
}

export interface RunSummary {
	count: number;
	distanceKm: number;
	durationS: number;
	elevationGainM: number;
	avgPace: number | null;
	avgHr: number | null;
	highIntensityShare: number | null;
}

/** Moyennes pondérées : allure par la distance, FC par la durée. */
export function summarizeRuns(runs: RunLike[]): RunSummary {
	const distanceKm = runs.reduce((sum, run) => sum + runKm(run), 0);
	const durationS = runs.reduce((sum, run) => sum + (run.durationS ?? 0), 0);
	const elevationGainM = runs.reduce((sum, run) => sum + (run.elevationGainM ?? 0), 0);

	let hrWeighted = 0;
	let hrWeight = 0;
	let highZone = 0;
	let zoneTotal = 0;

	for (const run of runs) {
		if (run.avgHr && run.durationS) {
			hrWeighted += run.avgHr * run.durationS;
			hrWeight += run.durationS;
		}
		highZone += (run.hrZone4 ?? 0) + (run.hrZone5 ?? 0);
		zoneTotal += totalZoneSeconds(run);
	}

	return {
		count: runs.length,
		distanceKm,
		durationS,
		elevationGainM,
		avgPace: distanceKm > 0 && durationS > 0 ? durationS / distanceKm : null,
		avgHr: hrWeight > 0 ? hrWeighted / hrWeight : null,
		highIntensityShare: zoneTotal > 0 ? (highZone / zoneTotal) * 100 : null
	};
}

/** Import Garmin : upsert par `garminId`, jamais de doublon. */
export function runFromGarmin(raw: Partial<Run> & { garminId: number }): Run {
	const stamp = new Date().toISOString();
	return {
		garminId: raw.garminId,
		name: raw.name ?? 'Course',
		date: raw.date ?? stamp.slice(0, 19).replace('T', ' '),
		type: raw.type ?? 'running',
		distanceM: raw.distanceM ?? null,
		durationS: raw.durationS ?? null,
		elapsedS: raw.elapsedS ?? null,
		elevationGainM: raw.elevationGainM ?? null,
		elevationLossM: raw.elevationLossM ?? null,
		avgHr: raw.avgHr ?? null,
		maxHr: raw.maxHr ?? null,
		hrZone1: raw.hrZone1 ?? null,
		hrZone2: raw.hrZone2 ?? null,
		hrZone3: raw.hrZone3 ?? null,
		hrZone4: raw.hrZone4 ?? null,
		hrZone5: raw.hrZone5 ?? null,
		calories: raw.calories ?? null,
		avgSpeed: raw.avgSpeed ?? null,
		maxSpeed: raw.maxSpeed ?? null,
		avgCadence: raw.avgCadence ?? null,
		maxCadence: raw.maxCadence ?? null,
		strideCm: raw.strideCm ?? null,
		bodyBattery: raw.bodyBattery ?? null,
		moderateIntensityMin: raw.moderateIntensityMin ?? null,
		vigorousIntensityMin: raw.vigorousIntensityMin ?? null,
		steps: raw.steps ?? null,
		best1kS: raw.best1kS ?? null,
		source: raw.source ?? 'garmin',
		importedAt: raw.importedAt ?? stamp,
		updatedAt: stamp,
		deletedAt: null
	};
}
