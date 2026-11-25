import { describe, expect, it } from 'vitest';
import { COURSE_TYPES, isCourseType, mapGarminActivity } from './map';

/** Recopie fidèle d'une activité Garmin (champs utiles seulement). */
const activite = {
	activityId: 2_147_483_001,
	activityName: 'Footing matinal',
	startTimeLocal: '2026-11-22 07:12:03',
	startTimeGMT: '2026-11-22 06:12:03',
	activityType: { typeId: 1, typeKey: 'running' },
	distance: 10_240.5,
	duration: 3010,
	movingDuration: 2880,
	elevationGain: 87,
	elevationLoss: 85,
	averageHR: 152,
	maxHR: 171,
	hrTimeInZone_1: 120,
	hrTimeInZone_2: 540,
	hrTimeInZone_3: 1080,
	hrTimeInZone_4: 1140,
	hrTimeInZone_5: 180,
	calories: 712,
	averageSpeed: 3.41,
	maxSpeed: 4.62,
	averageRunningCadenceInStepsPerMinute: 168,
	maxRunningCadenceInStepsPerMinute: 182,
	avgStrideLength: 121.4,
	differenceBodyBattery: -9,
	moderateIntensityMinutes: 34,
	vigorousIntensityMinutes: 12,
	steps: 10_180,
	fastestSplit_1000: 268
};

describe('COURSE_TYPES', () => {
	it('reprend les neuf types de la v1', () => {
		expect([...COURSE_TYPES]).toEqual([
			'running',
			'street_running',
			'trail_running',
			'track_running',
			'treadmill_running',
			'indoor_running',
			'virtual_run',
			'ultra_run',
			'obstacle_run'
		]);
	});

	it('ignore la casse', () => {
		expect(isCourseType('TRAIL_RUNNING')).toBe(true);
		expect(isCourseType('cycling')).toBe(false);
		expect(isCourseType(undefined)).toBe(false);
	});
});

describe('mapGarminActivity', () => {
	it('convertit une activité complète', () => {
		const run = mapGarminActivity(activite);

		expect(run).not.toBeNull();
		expect(run!.garminId).toBe(2_147_483_001);
		expect(run!.name).toBe('Footing matinal');
		expect(run!.date).toBe('2026-11-22 07:12:03');
		expect(run!.type).toBe('running');
		expect(run!.distanceM).toBe(10_240.5);
		expect(run!.durationS).toBe(2880); // movingDuration, pas duration
		expect(run!.elapsedS).toBe(3010);
		expect(run!.hrZone4).toBe(1140);
		expect(run!.strideCm).toBe(121.4);
		expect(run!.best1kS).toBe(268);
		expect(run!.source).toBe('garmin');
		expect(run!.deletedAt).toBeNull();
		expect(run!.importedAt).toBe(run!.updatedAt);
	});

	it('retombe sur duration quand movingDuration manque', () => {
		const run = mapGarminActivity({ ...activite, movingDuration: null });
		expect(run!.durationS).toBe(3010);
	});

	it('préfère startTimeLocal et retombe sur startTimeGMT', () => {
		expect(mapGarminActivity({ ...activite, startTimeLocal: '' })!.date).toBe(
			'2026-11-22 06:12:03'
		);
	});

	it('met null quand une valeur manque, jamais 0', () => {
		const run = mapGarminActivity({ ...activite, averageHR: undefined, hrTimeInZone_4: null });

		expect(run!.avgHr).toBeNull();
		expect(run!.hrZone4).toBeNull();
		expect(run!.distanceM).toBe(10_240.5);
	});

	it('remplace une distance absente par 0, comme la v1', () => {
		const run = mapGarminActivity({ ...activite, distance: undefined, elevationGain: undefined });
		expect(run!.distanceM).toBe(0);
		expect(run!.elevationGainM).toBe(0);
	});

	it('accepte activityType sous forme de chaîne', () => {
		const run = mapGarminActivity({ ...activite, activityType: 'trail_running' });
		expect(run!.type).toBe('trail_running');
	});

	it('donne un nom par défaut', () => {
		expect(mapGarminActivity({ ...activite, activityName: '   ' })!.name).toBe('Course');
	});

	it('refuse une activité qui n’est pas de la course', () => {
		expect(
			mapGarminActivity({ ...activite, activityType: { typeKey: 'cycling' } })
		).toBeNull();
	});

	it('refuse une activité sans identifiant exploitable', () => {
		expect(mapGarminActivity({ ...activite, activityId: undefined })).toBeNull();
		expect(mapGarminActivity({ ...activite, activityId: 'abc' })).toBeNull();
		expect(mapGarminActivity(null)).toBeNull();
		expect(mapGarminActivity('nope')).toBeNull();
	});

	it('accepte un identifiant fourni en texte numérique', () => {
		expect(mapGarminActivity({ ...activite, activityId: '2147483002' })!.garminId).toBe(
			2_147_483_002
		);
	});
});
