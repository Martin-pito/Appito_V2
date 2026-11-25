import Dexie, { type Table } from 'dexie';

/**
 * Modèle de données local (IndexedDB).
 *
 * Deux règles structurantes, décidées pour la fusion entre appareils :
 *  - `updatedAt` existe sur chaque ligne : la version la plus récente gagne ;
 *  - les suppressions sont logiques (`deletedAt`) : sans elles, une série
 *    supprimée sur le téléphone réapparaîtrait à la fusion suivante.
 * L'unicité de `nameKey` est applicative (pas d'index unique) pour qu'un nom
 * puisse être recréé après suppression.
 */

export interface Movement {
	id: string;
	name: string;
	nameKey: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface WorkSet {
	id: string;
	movementId: string;
	/** Date locale ISO `YYYY-MM-DD`. */
	date: string;
	weight: number;
	reps: number;
	setCount: number;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface Run {
	/** Clé primaire : identifiant Garmin, stable et unique. */
	garminId: number;
	name: string;
	date: string;
	type: string;
	distanceM: number | null;
	durationS: number | null;
	elapsedS: number | null;
	elevationGainM: number | null;
	elevationLossM: number | null;
	avgHr: number | null;
	maxHr: number | null;
	hrZone1: number | null;
	hrZone2: number | null;
	hrZone3: number | null;
	hrZone4: number | null;
	hrZone5: number | null;
	calories: number | null;
	avgSpeed: number | null;
	maxSpeed: number | null;
	avgCadence: number | null;
	maxCadence: number | null;
	strideCm: number | null;
	bodyBattery: number | null;
	moderateIntensityMin: number | null;
	vigorousIntensityMin: number | null;
	steps: number | null;
	best1kS: number | null;
	source: string;
	importedAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface Setting {
	key: string;
	value: unknown;
}

export class AppitoDB extends Dexie {
	movements!: Table<Movement, string>;
	sets!: Table<WorkSet, string>;
	runs!: Table<Run, number>;
	settings!: Table<Setting, string>;

	constructor() {
		super('appito');
		this.version(1).stores({
			movements: 'id, nameKey, updatedAt',
			sets: 'id, movementId, date, [movementId+date], updatedAt',
			runs: 'garminId, date, updatedAt',
			settings: 'key'
		});
	}
}

export const db = new AppitoDB();

export const DEFAULT_MOVEMENTS = [
	'Développé couché',
	'Squat',
	'Épaulé',
	'Soulevé de terre',
	'Développé militaire',
	'Rowing',
	'Tractions',
	'Fentes'
];
