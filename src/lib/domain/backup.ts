import type { Movement, Run, WorkSet } from '../db/db';

/**
 * Sauvegarde et fusion.
 *
 * La fusion est volontairement conservatrice : rien n'est perdu, la version la
 * plus récente (`updatedAt`) gagne, et une suppression logique plus récente
 * qu'une modification reste une suppression.
 */

export interface BackupFile {
	app: 'appito';
	schemaVersion: 1;
	exportedAt: string;
	movements: Movement[];
	sets: WorkSet[];
	runs: Run[];
}

export type ImportMode = 'merge' | 'replace';

export interface MergeResult {
	movements: Movement[];
	sets: WorkSet[];
	runs: Run[];
	added: number;
	updated: number;
	kept: number;
}

type Versioned = { updatedAt: string };

function newer(a: Versioned, b: Versioned): boolean {
	return a.updatedAt > b.updatedAt;
}

/**
 * Fusionne deux jeux de lignes identifiées par `id`.
 * Renvoie aussi le décompte pour le message affiché à l'utilisateur.
 */
export function mergeRows<T extends Versioned & { id: string }>(
	current: T[],
	incoming: T[]
): { rows: T[]; added: number; updated: number; kept: number } {
	const byId = new Map<string, T>();
	for (const row of current) byId.set(row.id, row);

	let added = 0;
	let updated = 0;
	let kept = 0;

	for (const row of incoming) {
		const existing = byId.get(row.id);
		if (!existing) {
			byId.set(row.id, row);
			added += 1;
			continue;
		}
		if (newer(row, existing)) {
			byId.set(row.id, row);
			updated += 1;
			continue;
		}
		kept += 1;
	}

	return { rows: [...byId.values()], added, updated, kept };
}

/**
 * Résout les doublons de nom : deux mouvements actifs de même `nameKey` ne
 * doivent pas coexister après une fusion. On garde le plus ancien (le plus
 * probablement celui déjà utilisé), on marque l'autre supprimé et on réaffecte
 * ses séries.
 */
export function resolveNameCollisions(
	movements: Movement[],
	sets: WorkSet[],
	now = new Date().toISOString()
): { movements: Movement[]; sets: WorkSet[] } {
	const keepByKey = new Map<string, Movement>();
	const remap = new Map<string, string>();

	for (const movement of [...movements].sort((a, b) =>
		a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt < b.createdAt ? -1 : 1
	)) {
		if (movement.deletedAt) continue;
		const kept = keepByKey.get(movement.nameKey);
		if (!kept) {
			keepByKey.set(movement.nameKey, movement);
			continue;
		}
		remap.set(movement.id, kept.id);
		movement.deletedAt = now;
		movement.updatedAt = now;
	}

	if (remap.size === 0) return { movements, sets };

	const remapped = sets.map((set) => {
		const target = remap.get(set.movementId);
		return target ? { ...set, movementId: target } : set;
	});

	return { movements, sets: remapped };
}

export function mergeBackup(
	current: { movements: Movement[]; sets: WorkSet[]; runs: Run[] },
	incoming: { movements: Movement[]; sets: WorkSet[]; runs: Run[] },
	mode: ImportMode = 'merge'
): MergeResult {
	if (mode === 'replace') {
		return {
			movements: incoming.movements,
			sets: incoming.sets,
			runs: incoming.runs,
			added: incoming.movements.length + incoming.sets.length + incoming.runs.length,
			updated: 0,
			kept: 0
		};
	}

	const movements = mergeRows(current.movements, incoming.movements);
	const sets = mergeRows(current.sets, incoming.sets);

	// Les courses sont identifiées par `garminId` : on aligne sur le même
	// principe qu'`id` en projetant la clé.
	const runsById = new Map(current.runs.map((run) => [String(run.garminId), run]));
	let runsAdded = 0;
	let runsUpdated = 0;
	let runsKept = 0;
	for (const run of incoming.runs) {
		const existing = runsById.get(String(run.garminId));
		if (!existing) {
			runsById.set(String(run.garminId), run);
			runsAdded += 1;
		} else if (newer(run, existing)) {
			runsById.set(String(run.garminId), run);
			runsUpdated += 1;
		} else {
			runsKept += 1;
		}
	}

	const resolved = resolveNameCollisions(movements.rows, sets.rows);

	return {
		movements: resolved.movements,
		sets: resolved.sets,
		runs: [...runsById.values()],
		added: movements.added + sets.added + runsAdded,
		updated: movements.updated + sets.updated + runsUpdated,
		kept: movements.kept + sets.kept + runsKept
	};
}

/** Valide la forme minimale d'un fichier de sauvegarde. */
export function isBackupFile(value: unknown): value is BackupFile {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<BackupFile>;
	return (
		candidate.app === 'appito' &&
		Array.isArray(candidate.movements) &&
		Array.isArray(candidate.sets) &&
		Array.isArray(candidate.runs)
	);
}
