import { describe, expect, it, vi } from 'vitest';
import { SyncError, planSync, sameRun, syncRuns, type RunStore } from './client';
import type { Run } from '../db/db';

function run(overrides: Partial<Run> = {}): Run {
	return {
		garminId: 1,
		name: 'Footing',
		date: '2026-11-22 07:12:03',
		type: 'running',
		distanceM: 10_000,
		durationS: 3000,
		elapsedS: 3100,
		elevationGainM: 40,
		elevationLossM: 40,
		avgHr: 150,
		maxHr: 170,
		hrZone1: 100,
		hrZone2: 400,
		hrZone3: 900,
		hrZone4: 1100,
		hrZone5: 300,
		calories: 700,
		avgSpeed: 3.3,
		maxSpeed: 4.5,
		avgCadence: 168,
		maxCadence: 180,
		strideCm: 120,
		bodyBattery: -8,
		moderateIntensityMin: 30,
		vigorousIntensityMin: 10,
		steps: 10_000,
		best1kS: 270,
		source: 'garmin',
		importedAt: '2026-11-22T08:00:00.000Z',
		updatedAt: '2026-11-22T08:00:00.000Z',
		deletedAt: null,
		...overrides
	};
}

function storeOf(rows: Run[]): RunStore & { rows: Run[] } {
	const state = {
		rows: [...rows],
		all: async () => [...state.rows],
		put: async (incoming: Run[]) => {
			for (const row of incoming) {
				const index = state.rows.findIndex((existing) => existing.garminId === row.garminId);
				if (index >= 0) state.rows[index] = row;
				else state.rows.push(row);
			}
		}
	};
	return state;
}

function garminResponse(activities: unknown[]): typeof fetch {
	return (async () =>
		new Response(JSON.stringify({ fetchedAt: '2026-11-25T09:00:00.000Z', activities }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		})) as unknown as typeof fetch;
}

const activite = {
	activityId: 1,
	activityName: 'Footing',
	startTimeLocal: '2026-11-22 07:12:03',
	activityType: { typeKey: 'running' },
	distance: 10_000,
	duration: 3100,
	movingDuration: 3000,
	elevationGain: 40,
	elevationLoss: 40,
	averageHR: 150,
	maxHR: 170,
	hrTimeInZone_1: 100,
	hrTimeInZone_2: 400,
	hrTimeInZone_3: 900,
	hrTimeInZone_4: 1100,
	hrTimeInZone_5: 300,
	calories: 700,
	averageSpeed: 3.3,
	maxSpeed: 4.5,
	averageRunningCadenceInStepsPerMinute: 168,
	maxRunningCadenceInStepsPerMinute: 180,
	avgStrideLength: 120,
	differenceBodyBattery: -8,
	moderateIntensityMinutes: 30,
	vigorousIntensityMinutes: 10,
	steps: 10_000,
	fastestSplit_1000: 270
};

describe('sameRun', () => {
	it('ignore les horodatages', () => {
		expect(sameRun(run(), run({ importedAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' }))).toBe(true);
	});

	it('détecte un changement métier', () => {
		expect(sameRun(run(), run({ distanceM: 10_001 }))).toBe(false);
		expect(sameRun(run(), run({ avgHr: null }))).toBe(false);
	});
});

describe('planSync', () => {
	it('classe ajout, mise à jour et inchangé', () => {
		const existing = [run({ garminId: 1 }), run({ garminId: 2 })];
		const incoming = [
			run({ garminId: 2, distanceM: 11_000 }),
			run({ garminId: 3 }),
			run({ garminId: 1 })
		];

		const plan = planSync(existing, incoming);

		expect(plan.added.map((row) => row.garminId)).toEqual([3]);
		expect(plan.updated.map((row) => row.garminId)).toEqual([2]);
		expect(plan.unchanged).toBe(1);
	});

	it('préserve importedAt et deletedAt des lignes existantes', () => {
		const existing = [
			run({ garminId: 2, importedAt: '2026-01-01T00:00:00.000Z', deletedAt: null })
		];
		const plan = planSync(existing, [run({ garminId: 2, distanceM: 12_000 })]);

		expect(plan.updated[0].importedAt).toBe('2026-01-01T00:00:00.000Z');
	});

	it('ne ressuscite pas une course supprimée localement', () => {
		const existing = [
			run({ garminId: 2, deletedAt: '2026-11-20T10:00:00.000Z', distanceM: 1 })
		];
		const plan = planSync(existing, [run({ garminId: 2, distanceM: 12_000 })]);

		expect(plan.updated).toHaveLength(0);
		expect(plan.unchanged).toBe(1);
	});

	it('ignore les doublons dans la réponse', () => {
		const plan = planSync([], [run({ garminId: 5 }), run({ garminId: 5, distanceM: 9_000 })]);
		expect(plan.added).toHaveLength(1);
	});
});

describe('syncRuns', () => {
	it('écrit les ajouts et les mises à jour, pas les inchangés', async () => {
		const store = storeOf([run({ garminId: 1 })]);
		const put = vi.spyOn(store, 'put');

		const result = await syncRuns({
			fetchImpl: garminResponse([activite, { ...activite, activityId: 2 }]),
			store,
			token: 'jeton'
		});

		expect(result).toEqual({ added: 1, updated: 0, unchanged: 1, total: 2 });
		expect(put).toHaveBeenCalledTimes(1);
		expect(put.mock.calls[0][0].map((row) => row.garminId)).toEqual([2]);
	});

	it('n’écrit rien quand tout est inchangé', async () => {
		const store = storeOf([run({ garminId: 1 })]);
		const put = vi.spyOn(store, 'put');

		const result = await syncRuns({ fetchImpl: garminResponse([activite]), store, token: 'jeton' });

		expect(result).toEqual({ added: 0, updated: 0, unchanged: 1, total: 1 });
		expect(put).not.toHaveBeenCalled();
	});

	it('envoie le jeton applicatif', async () => {
		const fetchImpl = vi.fn(async () =>
			new Response(JSON.stringify({ activities: [] }), { status: 200 })
		) as unknown as typeof fetch;

		await syncRuns({ fetchImpl, store: storeOf([]), token: 'abc' });

		const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(init.headers.Authorization).toBe('Bearer abc');
	});

	it('signale offline quand le réseau échoue', async () => {
		const failing = (async () => {
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;

		await expect(syncRuns({ fetchImpl: failing, store: storeOf([]), token: 'jeton' })).rejects.toMatchObject({
			kind: 'offline'
		});
	});

	it('signale unauthorized sur 401', async () => {
		const denied = (async () => new Response('', { status: 401 })) as unknown as typeof fetch;
		const error = await syncRuns({ fetchImpl: denied, store: storeOf([]), token: 'jeton' }).catch(
			(raised) => raised
		);

		expect(error).toBeInstanceOf(SyncError);
		expect(error.kind).toBe('unauthorized');
	});

	it('signale payload quand la réponse est inexploitable', async () => {
		const broken = (async () =>
			new Response(JSON.stringify({ foo: 'bar' }), { status: 200 })) as unknown as typeof fetch;

		await expect(syncRuns({ fetchImpl: broken, store: storeOf([]), token: 'jeton' })).rejects.toMatchObject({
			kind: 'payload'
		});
	});
});
