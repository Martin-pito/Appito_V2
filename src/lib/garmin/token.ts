/**
 * Jeton applicatif du relais, saisi une fois par appareil.
 *
 * Il vit dans `localStorage`, jamais dans le bundle : un jeton compilé dans le
 * JavaScript serait lisible par n'importe qui. `localStorage` survit aux mises
 * à jour de l'application et reste propre à l'appareil.
 */

const KEY = 'appito-sync-token';

function storage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export function getSyncToken(): string {
	return storage()?.getItem(KEY)?.trim() ?? '';
}

export function hasSyncToken(): boolean {
	return getSyncToken().length > 0;
}

export function setSyncToken(value: string): void {
	const clean = value.trim();
	if (!clean) return;
	storage()?.setItem(KEY, clean);
}

export function clearSyncToken(): void {
	storage()?.removeItem(KEY);
}
