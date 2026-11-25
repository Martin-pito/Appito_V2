import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { self } from '$app/service-worker';

/**
 * Service worker : l'application entière est précachée à l'installation.
 * C'est ce qui rend la saisie possible en salle, sans réseau.
 *
 * SvelteKit 3 expose le manifeste via `$app/manifest` : `immutable` (fichiers
 * buildés), `assets` (dossier static) et `prerendered` (pages HTML).
 */

const scope = self.registration.scope;
const absolute = (path: string): string => new URL(path, scope).href;

const CACHE = `appito-${version}`;
const ASSETS = [
	...immutable.map(({ path }) => absolute(path)),
	...assets.map(({ path }) => absolute(path)),
	...prerendered.map(({ path }) => absolute(path))
];
const ROOT = absolute('');

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	// Navigation : réseau d'abord (pour profiter d'une mise à jour), cache
	// ensuite. Une page jamais visitée retombe sur l'accueil précaché.
	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const response = await fetch(request);
					const cache = await caches.open(CACHE);
					cache.put(request, response.clone());
					return response;
				} catch {
					const cached = await caches.match(request);
					if (cached) return cached;
					const fallback = await caches.match(ROOT);
					return fallback ?? Response.error();
				}
			})()
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cached = await caches.match(request);
			if (cached) return cached;
			try {
				const response = await fetch(request);
				if (response.ok) {
					const cache = await caches.open(CACHE);
					cache.put(request, response.clone());
				}
				return response;
			} catch {
				return Response.error();
			}
		})()
	);
});
