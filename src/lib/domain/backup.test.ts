import { describe, expect, it } from 'vitest';
import { isBackupFile, mergeBackup, mergeRows, resolveNameCollisions } from './backup';
import type { Movement, WorkSet } from '../db/db';

const stamp = (day: number) => `2026-01-${String(day).padStart(2, '0')}T10:00:00.000Z`;

function movement(id: string, name: string, day = 1): Movement {
	return {
		id,
		name,
		nameKey: name.toLowerCase(),
		createdAt: stamp(day),
		updatedAt: stamp(day),
		deletedAt: null
	};
}

function set(id: string, movementId: string, day = 1, weight = 100): WorkSet {
	return {
		id,
		movementId,
		date: `2026-01-${String(day).padStart(2, '0')}`,
		weight,
		reps: 5,
		setCount: 3,
		createdAt: stamp(day),
		updatedAt: stamp(day),
		deletedAt: null
	};
}

describe('mergeRows', () => {
	it('ajoute les lignes inconnues', () => {
		const result = mergeRows([set('a', 'm')], [set('b', 'm')]);
		expect(result.rows).toHaveLength(2);
		expect(result.added).toBe(1);
	});

	it('garde la version la plus récente', () => {
		const result = mergeRows([set('a', 'm', 1, 100)], [set('a', 'm', 2, 120)]);
		expect(result.rows[0].weight).toBe(120);
		expect(result.updated).toBe(1);
	});

	it('ignore une version plus ancienne', () => {
		const result = mergeRows([set('a', 'm', 2, 120)], [set('a', 'm', 1, 100)]);
		expect(result.rows[0].weight).toBe(120);
		expect(result.kept).toBe(1);
	});

	it('propage une suppression logique plus récente', () => {
		const deleted = { ...set('a', 'm', 3), deletedAt: stamp(3) };
		const result = mergeRows([set('a', 'm', 1)], [deleted]);
		expect(result.rows[0].deletedAt).toBe(stamp(3));
	});
});

describe('resolveNameCollisions', () => {
	it('garde le plus ancien et réaffecte les séries', () => {
		const movements = [movement('vieux', 'Squat', 1), movement('recent', 'Squat', 2)];
		const sets = [set('s1', 'vieux'), set('s2', 'recent')];
		const result = resolveNameCollisions(movements, sets);

		const deleted = result.movements.find((row) => row.id === 'recent');
		expect(deleted?.deletedAt).toBeTruthy();
		expect(result.sets.every((row) => row.movementId === 'vieux')).toBe(true);
	});

	it('ne touche pas à des noms différents', () => {
		const movements = [movement('a', 'Squat', 1), movement('b', 'Fentes', 2)];
		const result = resolveNameCollisions(movements, [set('s1', 'a')]);
		expect(result.movements.every((row) => row.deletedAt === null)).toBe(true);
		expect(result.sets[0].movementId).toBe('a');
	});
});

describe('mergeBackup', () => {
	it('additionne les deux jeux et arbitre les conflits', () => {
		const current = { movements: [movement('a', 'Squat')], sets: [set('s1', 'a')], runs: [] };
		const incoming = {
			movements: [movement('b', 'Fentes')],
			sets: [set('s2', 'b'), set('s1', 'a', 2, 120)],
			runs: []
		};
		const result = mergeBackup(current, incoming);
		expect(result.movements).toHaveLength(2);
		expect(result.sets).toHaveLength(2);
		expect(result.sets.find((row) => row.id === 's1')?.weight).toBe(120);
	});

	it('remplace intégralement en mode replace', () => {
		const current = { movements: [movement('a', 'Squat')], sets: [set('s1', 'a')], runs: [] };
		const incoming = { movements: [movement('b', 'Fentes')], sets: [], runs: [] };
		const result = mergeBackup(current, incoming, 'replace');
		expect(result.movements.map((row) => row.id)).toEqual(['b']);
		expect(result.sets).toHaveLength(0);
	});
});

describe('isBackupFile', () => {
	it('reconnaît une sauvegarde Appito', () => {
		expect(
			isBackupFile({ app: 'appito', schemaVersion: 1, exportedAt: stamp(1), movements: [], sets: [], runs: [] })
		).toBe(true);
	});

	it('refuse un JSON quelconque', () => {
		expect(isBackupFile({ foo: 'bar' })).toBe(false);
		expect(isBackupFile(null)).toBe(false);
	});
});
