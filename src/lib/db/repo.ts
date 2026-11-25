import { DEFAULT_MOVEMENTS, db, type Movement, type Run, type WorkSet } from './db';
import { normalizeName, todayISO, volumeOf } from '../domain/sets';
import {
	isBackupFile,
	mergeBackup,
	type BackupFile,
	type ImportMode
} from '../domain/backup';

/** Accès aux données : toute la persistance passe par ce module. */

const nowISO = () => new Date().toISOString();

export function uid(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function assertRange(value: number, min: number, max: number, label: string, unit = ''): void {
	if (!Number.isFinite(value) || value < min || value > max) {
		throw new Error(`${label} doit être compris entre ${min} et ${max}${unit}.`);
	}
}

/** Insère les huit mouvements par défaut au premier lancement, jamais ensuite. */
export async function seedIfEmpty(): Promise<void> {
	const total = await db.movements.count();
	if (total > 0) return;
	const stamp = nowISO();
	await db.movements.bulkAdd(
		DEFAULT_MOVEMENTS.map((name) => ({
			id: uid(),
			name,
			nameKey: normalizeName(name),
			createdAt: stamp,
			updatedAt: stamp,
			deletedAt: null
		}))
	);
}

export async function listMovements(): Promise<Movement[]> {
	const rows = await db.movements.toArray();
	return rows
		.filter((movement) => !movement.deletedAt)
		.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function getMovement(id: string): Promise<Movement | undefined> {
	const movement = await db.movements.get(id);
	return movement && !movement.deletedAt ? movement : undefined;
}

export async function createMovement(name: string): Promise<Movement> {
	const clean = name.trim().replace(/\s+/g, ' ');
	if (clean.length < 2 || clean.length > 40) {
		throw new Error('Le nom doit contenir entre 2 et 40 caractères.');
	}
	const key = normalizeName(clean);
	const active = await listMovements();
	if (active.some((movement) => movement.nameKey === key)) {
		throw new Error(`« ${clean} » existe déjà.`);
	}
	const stamp = nowISO();
	const movement: Movement = {
		id: uid(),
		name: clean,
		nameKey: key,
		createdAt: stamp,
		updatedAt: stamp,
		deletedAt: null
	};
	await db.movements.add(movement);
	return movement;
}

export async function renameMovement(id: string, name: string): Promise<Movement> {
	const clean = name.trim().replace(/\s+/g, ' ');
	if (clean.length < 2 || clean.length > 40) {
		throw new Error('Le nom doit contenir entre 2 et 40 caractères.');
	}
	const movement = await db.movements.get(id);
	if (!movement || movement.deletedAt) throw new Error('Mouvement introuvable.');
	const key = normalizeName(clean);
	const active = await listMovements();
	if (active.some((other) => other.id !== id && other.nameKey === key)) {
		throw new Error(`« ${clean} » existe déjà.`);
	}
	const updated: Movement = { ...movement, name: clean, nameKey: key, updatedAt: nowISO() };
	await db.movements.put(updated);
	return updated;
}

export async function countSetsFor(movementId: string): Promise<number> {
	const rows = await db.sets.where('movementId').equals(movementId).toArray();
	return rows.filter((row) => !row.deletedAt).length;
}

/** Suppression logique : la fusion entre appareils doit pouvoir la propager. */
export async function deleteMovement(id: string): Promise<{ removedSets: number }> {
	const movement = await db.movements.get(id);
	if (!movement || movement.deletedAt) throw new Error('Mouvement introuvable.');
	const stamp = nowISO();
	let removedSets = 0;
	await db.transaction('rw', db.movements, db.sets, async () => {
		const rows = await db.sets.where('movementId').equals(id).toArray();
		for (const row of rows) {
			if (row.deletedAt) continue;
			await db.sets.put({ ...row, deletedAt: stamp, updatedAt: stamp });
			removedSets += 1;
		}
		await db.movements.put({
			...movement,
			nameKey: `\u0000deleted\u0000${movement.id}`,
			deletedAt: stamp,
			updatedAt: stamp
		});
	});
	return { removedSets };
}

export interface SetInput {
	movementId: string;
	date: string;
	weight: number;
	reps: number;
	setCount: number;
}

function validateSet(input: SetInput): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Date invalide.');
	assertRange(input.weight, 0, 500, 'Le poids', ' kg');
	assertRange(input.reps, 1, 100, 'Les répétitions');
	assertRange(input.setCount, 1, 50, 'Le nombre de séries');
}

export async function addSet(input: SetInput): Promise<WorkSet> {
	validateSet(input);
	const stamp = nowISO();
	const row: WorkSet = {
		id: uid(),
		movementId: input.movementId,
		date: input.date,
		weight: input.weight,
		reps: input.reps,
		setCount: input.setCount,
		createdAt: stamp,
		updatedAt: stamp,
		deletedAt: null
	};
	await db.sets.add(row);
	await rememberMovement(input.movementId);
	return row;
}

export async function deleteSet(id: string): Promise<void> {
	const row = await db.sets.get(id);
	if (!row || row.deletedAt) throw new Error('Série introuvable.');
	const stamp = nowISO();
	await db.sets.put({ ...row, deletedAt: stamp, updatedAt: stamp });
}

export async function listSets(movementId: string): Promise<WorkSet[]> {
	const rows = await db.sets.where('movementId').equals(movementId).toArray();
	return rows
		.filter((row) => !row.deletedAt)
		.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

export async function lastSetFor(movementId: string): Promise<WorkSet | undefined> {
	const rows = await listSets(movementId);
	return rows[0];
}

export async function allActiveSets(): Promise<WorkSet[]> {
	const rows = await db.sets.toArray();
	return rows.filter((row) => !row.deletedAt);
}

/* ---------- Réglages ---------- */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
	const row = await db.settings.get(key);
	return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
	await db.settings.put({ key, value });
}

export async function rememberMovement(movementId: string): Promise<void> {
	const recent = await getSetting<string[]>('recentMovements', []);
	const next = [movementId, ...recent.filter((id) => id !== movementId)].slice(0, 6);
	await setSetting('recentMovements', next);
}

export async function recentMovements(limit = 4): Promise<Movement[]> {
	const ids = await getSetting<string[]>('recentMovements', []);
	const movements = await listMovements();
	const byId = new Map(movements.map((movement) => [movement.id, movement]));
	return ids
		.map((id) => byId.get(id))
		.filter((movement): movement is Movement => Boolean(movement))
		.slice(0, limit);
}

/* ---------- Synthèse ---------- */

export interface MovementSummary {
	movement: Movement;
	entries: number;
	totalSets: number;
	volume: number;
	maxWeight: number;
	lastDate: string | null;
}

export async function movementSummaries(): Promise<MovementSummary[]> {
	const movements = await listMovements();
	const sets = await allActiveSets();
	return movements.map((movement) => {
		const rows = sets.filter((set) => set.movementId === movement.id);
		return {
			movement,
			entries: rows.length,
			totalSets: rows.reduce((sum, set) => sum + set.setCount, 0),
			volume: rows.reduce((sum, set) => sum + volumeOf(set), 0),
			maxWeight: rows.reduce((max, set) => Math.max(max, set.weight), 0),
			lastDate: rows.reduce<string | null>(
				(last, set) => (!last || set.date > last ? set.date : last),
				null
			)
		};
	});
}

/* ---------- Sauvegarde ---------- */

export async function buildBackup(): Promise<BackupFile> {
	return {
		app: 'appito',
		schemaVersion: 1,
		exportedAt: nowISO(),
		movements: await db.movements.toArray(),
		sets: await db.sets.toArray(),
		runs: await db.runs.toArray()
	};
}

export function backupFilename(): string {
	return `appito-sauvegarde-${todayISO()}.json`;
}

export async function importBackup(file: BackupFile, mode: ImportMode) {
	const current = await buildBackup();
	const merged = mergeBackup(current, file, mode);

	await db.transaction('rw', db.movements, db.sets, db.runs, db.settings, async () => {
		if (mode === 'replace') {
			await db.movements.clear();
			await db.sets.clear();
			await db.runs.clear();
		}
		await db.movements.bulkPut(merged.movements);
		await db.sets.bulkPut(merged.sets);
		await db.runs.bulkPut(merged.runs);
		await db.settings.put({ key: 'lastImportAt', value: nowISO() });
	});

	return merged;
}

export async function readBackupFile(file: File): Promise<BackupFile> {
	const text = await file.text();
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("Ce fichier n'est pas un JSON valide.");
	}
	if (!isBackupFile(parsed)) {
		throw new Error("Ce fichier n'est pas une sauvegarde Appito.");
	}
	return parsed;
}

/* ---------- Export CSV ---------- */

export interface CsvRow {
	date: string;
	movement: string;
	weight: number;
	reps: number;
	setCount: number;
}

export function toCsv(rows: CsvRow[]): string {
	const header = ['date', 'mouvement', 'poids_kg', 'repetitions', 'series', 'volume_kg'];
	const lines = rows.map((row) =>
		[
			row.date,
			`"${row.movement.replace(/"/g, '""')}"`,
			row.weight,
			row.reps,
			row.setCount,
			row.weight * row.reps * row.setCount
		].join(',')
	);
	return '\uFEFF' + [header.join(','), ...lines].join('\r\n');
}

export function downloadText(filename: string, content: string, mime: string): void {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
