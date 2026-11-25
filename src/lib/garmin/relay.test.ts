import { afterEach, describe, expect, it, vi } from 'vitest';

const TOKEN_URL = 'personalapitoken-service';
const ACTIVITIES_URL = 'activitylist-service';

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

async function loadRelay() {
	vi.resetModules();
	const module = await import('../../../functions/api/garmin/activities');
	return module.onRequestGet;
}

function context(authorization?: string) {
	return {
		request: new Request('https://appito.pages.dev/api/garmin/activities', {
			headers: authorization ? { Authorization: authorization } : {}
		}),
		env: {
			APPITO_SYNC_TOKEN: 'jeton-app',
			GARMIN_PERSONAL_API_KEY: 'GCDC_fausse'
		}
	};
}

function stubFetch(handler: Handler) {
	const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
		handler(String(input), init)
	);
	vi.stubGlobal('fetch', mock);
	return mock;
}

const activite = { activityId: 1, activityType: { typeKey: 'running' } };

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe('relais Garmin', () => {
	it('refuse de démarrer sans secrets configurés', async () => {
		const relay = await loadRelay();
		const response = await relay({
			request: new Request('https://appito.pages.dev/api/garmin/activities'),
			env: { APPITO_SYNC_TOKEN: 'jeton-app' }
		});

		expect(response.status).toBe(500);
		expect((await response.json()).error).toBe('config_missing');
	});

	it('refuse sans jeton applicatif', async () => {
		const relay = await loadRelay();
		const response = await relay(context());

		expect(response.status).toBe(401);
		expect((await response.json()).error).toBe('unauthorized');
	});

	it('refuse un jeton applicatif erroné', async () => {
		const relay = await loadRelay();
		const response = await relay(context('Bearer mauvais'));

		expect(response.status).toBe(401);
	});

	it('échange la clé puis renvoie les activités', async () => {
		const seen: Array<{ url: string; init?: RequestInit }> = [];
		stubFetch((url, init) => {
			seen.push({ url, init });
			if (url.includes(TOKEN_URL)) return new Response('"JETON-GARMIN"', { status: 200 });
			return new Response(JSON.stringify([activite]), { status: 200 });
		});

		const relay = await loadRelay();
		const response = await relay(context('Bearer jeton-app'));

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.activities).toEqual([activite]);
		expect(typeof body.fetchedAt).toBe('string');
		expect(response.headers.get('cache-control')).toBe('no-store');

		const tokenCall = seen.find((call) => call.url.includes(TOKEN_URL))!;
		expect(new Headers(tokenCall.init?.headers).get('authorization')).toBe('ApiKey GCDC_fausse');
		// L'API Garmin répond 406 si `Accept` accompagne l'échange de clé.
		expect(new Headers(tokenCall.init?.headers).has('accept')).toBe(false);

		const activitiesCall = seen.find((call) => call.url.includes(ACTIVITIES_URL))!;
		expect(new Headers(activitiesCall.init?.headers).get('authorization')).toBe('Bearer JETON-GARMIN');
		expect(activitiesCall.url).toContain('start=0');
		expect(activitiesCall.url).toContain('limit=100');
	});

	it('réutilise le jeton Garmin en mémoire', async () => {
		const fetchMock = stubFetch((url) =>
			url.includes(TOKEN_URL)
				? new Response('JETON', { status: 200 })
				: new Response(JSON.stringify([activite]), { status: 200 })
		);

		const relay = await loadRelay();
		await relay(context('Bearer jeton-app'));
		await relay(context('Bearer jeton-app'));

		const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes(TOKEN_URL));
		expect(tokenCalls).toHaveLength(1);
	});

	it('renouvelle le jeton une fois s’il est refusé avant l’heure', async () => {
		let tokens = 0;
		let activityCalls = 0;
		stubFetch((url) => {
			if (url.includes(TOKEN_URL)) {
				tokens += 1;
				return new Response(tokens === 1 ? 'PERIME' : 'FRAIS', { status: 200 });
			}
			activityCalls += 1;
			if (activityCalls === 1) return new Response('', { status: 401 });
			return new Response(JSON.stringify([activite]), { status: 200 });
		});

		const relay = await loadRelay();
		const response = await relay(context('Bearer jeton-app'));

		expect(response.status).toBe(200);
		expect(tokens).toBe(2);
	});

	it('pagine jusqu’à une page incomplète', async () => {
		const page = (count: number) =>
			Array.from({ length: count }, (_, index) => ({ activityId: index, ...activite }));
		const starts: string[] = [];
		stubFetch((url) => {
			if (url.includes(TOKEN_URL)) return new Response('JETON', { status: 200 });
			const start = new URL(url).searchParams.get('start')!;
			starts.push(start);
			return new Response(JSON.stringify(page(start === '0' ? 100 : 5)), { status: 200 });
		});

		const relay = await loadRelay();
		const body = await (await relay(context('Bearer jeton-app'))).json();

		expect(body.activities).toHaveLength(105);
		expect(starts).toEqual(['0', '100']);
	});

	it('traduit une limitation de débit Garmin', async () => {
		stubFetch((url) =>
			url.includes(TOKEN_URL)
				? new Response('JETON', { status: 200 })
				: new Response('', { status: 429 })
		);

		const relay = await loadRelay();
		const response = await relay(context('Bearer jeton-app'));

		expect(response.status).toBe(502);
		expect((await response.json()).error).toBe('garmin_rate');
	});

	it('signale une clé Garmin refusée', async () => {
		stubFetch(() => new Response('', { status: 401 }));

		const relay = await loadRelay();
		const response = await relay(context('Bearer jeton-app'));

		expect(response.status).toBe(502);
		expect((await response.json()).error).toBe('garmin_auth');
	});
});
