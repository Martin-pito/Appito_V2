import type { Run } from '../db/db';

/**
 * Conversion des activités brutes Garmin vers `Run`.
 *
 * Portée de `course_activity_vers_ligne` (R/course_utils.R) : mêmes champs,
 * mêmes replis, mêmes valeurs par défaut. Les valeurs absentes deviennent
 * `null` — jamais `0` — sauf distance et dénivelé, que la v1 ramenait à 0.
 */

export const COURSE_TYPES = [
	'running',
	'street_running',
	'trail_running',
	'track_running',
	'treadmill_running',
	'indoor_running',
	'virtual_run',
	'ultra_run',
	'obstacle_run'
] as const;

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Json)
		: null;
}

/** Nombre exploitable, ou `null`. Accepte les chaînes numériques de Garmin. */
function num(value: unknown, fallback: number | null = null): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : fallback;
	}
	return fallback;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function typeKey(activity: Json): string {
	const type = activity.activityType;
	if (typeof type === 'string') return type.trim().toLowerCase();
	const object = asObject(type);
	return object ? text(object.typeKey).toLowerCase() : '';
}

export function isCourseType(value: unknown): boolean {
	return typeof value === 'string' && (COURSE_TYPES as readonly string[]).includes(value.toLowerCase());
}

export function mapGarminActivity(activity: unknown): Run | null {
	const source = asObject(activity);
	if (!source) return null;

	const garminId = num(source.activityId);
	if (garminId === null || !Number.isInteger(garminId)) return null;

	const type = typeKey(source);
	if (!isCourseType(type)) return null;

	const stamp = new Date().toISOString();
	const date = text(source.startTimeLocal) || text(source.startTimeGMT) || stamp.slice(0, 19);

	return {
		garminId,
		name: text(source.activityName) || 'Course',
		date,
		type,
		distanceM: num(source.distance, 0),
		durationS: num(source.movingDuration) ?? num(source.duration),
		elapsedS: num(source.duration),
		elevationGainM: num(source.elevationGain, 0),
		elevationLossM: num(source.elevationLoss, 0),
		avgHr: num(source.averageHR),
		maxHr: num(source.maxHR),
		hrZone1: num(source.hrTimeInZone_1),
		hrZone2: num(source.hrTimeInZone_2),
		hrZone3: num(source.hrTimeInZone_3),
		hrZone4: num(source.hrTimeInZone_4),
		hrZone5: num(source.hrTimeInZone_5),
		calories: num(source.calories),
		avgSpeed: num(source.averageSpeed),
		maxSpeed: num(source.maxSpeed),
		avgCadence: num(source.averageRunningCadenceInStepsPerMinute),
		maxCadence: num(source.maxRunningCadenceInStepsPerMinute),
		strideCm: num(source.avgStrideLength),
		bodyBattery: num(source.differenceBodyBattery),
		moderateIntensityMin: num(source.moderateIntensityMinutes),
		vigorousIntensityMin: num(source.vigorousIntensityMinutes),
		steps: num(source.steps),
		best1kS: num(source.fastestSplit_1000),
		source: 'garmin',
		importedAt: stamp,
		updatedAt: stamp,
		deletedAt: null
	};
}
