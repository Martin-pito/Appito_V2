import type { Run } from '../db/db';
import { mapGarminActivity } from './map';

/**
 * Synchronisation Garmin.
 *
 * Le navigateur ne peut pas appeler l'API Garmin directement (aucun en-tête
 * CORS) : `syncRuns` parle au relais `/api/garmin/activities`, qui garde la
 * clé et pagine les activités. Ici on ne fait que mapper et fusionner.
 *
 * Règle structurante : `updatedAt` ne bouge que si un champ métier a changé.
 * La fusion de sauvegarde arbitre par `updatedAt` ; réestampiller toutes les
 * courses à chaque synchro les rendrait « plus récentes » que les corrections
 * faites sur l'autre appareil.
 */

export type SyncErrorKind = 'offline' | 'unauthorized' | 'server' | 'payload' | 'config';

export class SyncError extends Error {
	readonly kind: SyncErrorKind;
	readonly status?: number;

	constructor(kind: SyncErrorKind, message: string, status?: number) {
		super(message);
		this.name = 'SyncError';
		this.kind = kind;
		this.status = status;
	}
}

export interface RunStore {
	all(): Promise<Run[]>;
	put(rows: Run[]): Promise<void>;
}

export interface SyncResult {
	added: number;
	updated: number;
	unchanged: number;
	total: number;
}

export interface SyncOptions {
	token: string;
	fetchImpl?: typeof fetch;
	store?: RunStore;
}

export interface SyncPlan {
	added: Run[];
	updated: Run[];
	unchanged: number;
}

/** Champs qui comptent pour décider si une course a changé. */
const BUSINESS_FIELDS = [
	'name',
	'date',
	'type',
	'distanceM',
	'durationS',
	'elapsedS',
	'elevationGainM',
	'elevationLossM',
	'avgHr',
	'maxHr',
	'hrZone1',
	'hrZone2',
	'hrZone3',
	'hrZone4',
	'hrZone5',
	'calories',
	'avgSpeed',
	'maxSpeed',
	'avgCadence',
	'maxCadence',
	'strideCm',
	'bodyBattery',
	'moderateIntensityMin',
	'vigorousIntensityMin',
	'steps',
	'best1kS',
	'source'
] as const satisfies readonly (keyof Run)[];

/** Égalité métier : les horodatages `importedAt`/`updatedAt` sont ignorés. */
export function sameRun(a: Run, b: Run): boolean {
	return BUSINESS_FIELDS.every((field) => a[field] === b[field]);
}

/**
 * Décide ce qu'il faut écrire.
 *
 * - inconnue            → ajout
 * - connue et identique → inchangée, aucune écriture
 * - connue et modifiée  → mise à jour, `importedAt` d'origine préservé
 * - supprimée sur cet appareil (`deletedAt`) → laissée tranquille : une
 *   synchro ne ressuscite pas une suppression volontaire
 */
export function planSync(existing: Run[], incoming: Run[]): SyncPlan {
	const byId = new Map(existing.map((row) => [row.garminId, row]));
	const seen = new Set<number>();
	const plan: SyncPlan = { added: [], updated: [], unchanged: 0 };

	for (const row of incoming) {
		if (seen.has(row.garminId)) continue;
		seen.add(row.garminId);

		const current = byId.get(row.garminId);
		if (!current) {
			plan.added.push(row);
			continue;
		}
		if (current.deletedAt !== null || sameRun(current, row)) {
			plan.unchanged += 1;
			continue;
		}
		plan.updated.push({
			...row,
			importedAt: current.importedAt,
			deletedAt: current.deletedAt
		});
	}

	return plan;
}

/** Accès Dexie chargé à la demande : les tests du domaine tournent sans IndexedDB. */
const dexieStore: RunStore = {
	async all() {
		const { db } = await import('../db/db');
		return db.runs.toArray();
	},
	async put(rows) {
		const { db } = await import('../db/db');
		await db.runs.bulkPut(rows);
	}
};

function endpoint(): string {
	const base = import.meta.env.BASE_URL ?? '/';
	return `${base.endsWith('/') ? base : `${base}/`}api/garmin/activities`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

export async function syncRuns(options: SyncOptions): Promise<SyncResult> {
	const { token, fetchImpl = fetch, store = dexieStore } = options;

	if (!token.trim()) {
		throw new SyncError('config', 'Jeton de synchronisation absent.');
	}

	let response: Response;
	try {
		response = await fetchImpl(endpoint(), {
			headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/json' }
		});
	} catch {
		throw new SyncError('offline', 'Pas de réseau.');
	}

	if (response.status === 401 || response.status === 403) {
		throw new SyncError('unauthorized', 'Jeton de synchronisation refusé.', response.status);
	}
	if (!response.ok) {
		throw new SyncError('server', 'Le relais Garmin a échoué.', response.status);
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new SyncError('payload', 'Réponse du relais illisible.');
	}

	const activities = asRecord(body)?.activities;
	if (!Array.isArray(activities)) {
		throw new SyncError('payload', 'Réponse du relais sans liste d’activités.');
	}

	const incoming = activities
		.map(mapGarminActivity)
		.filter((row): row is Run => row !== null);

	const plan = planSync(await store.all(), incoming);
	const writes = [...plan.added, ...plan.updated];
	if (writes.length > 0) {
		await store.put(writes);
	}

	return {
		added: plan.added.length,
		updated: plan.updated.length,
		unchanged: plan.unchanged,
		total: plan.added.length + plan.updated.length + plan.unchanged
	};
}
