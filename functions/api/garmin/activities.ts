/**
 * Relais Garmin — seule pièce qui connaît la clé personnelle.
 *
 * Le navigateur ne peut pas appeler `personal.connectapi.garmin.com` : l'API
 * ne renvoie aucun en-tête CORS, donc la réponse est bloquée avant d'être
 * lisible. Cette fonction fait ce que faisait `R/course_utils.R` : échanger la
 * clé contre un jeton, puis paginer les activités.
 *
 * Secrets attendus (Cloudflare > Settings > Variables and Secrets) :
 *   GARMIN_PERSONAL_API_KEY  clé `GCDC_…`
 *   APPITO_SYNC_TOKEN        jeton partagé avec les appareils
 */

interface Env {
	GARMIN_PERSONAL_API_KEY?: string;
	APPITO_SYNC_TOKEN?: string;
}

interface Context {
	request: Request;
	env: Env;
}

const GARMIN_BASE = 'https://personal.connectapi.garmin.com';
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
const ACTIVITIES_PATH = '/activitylist-service/activities/search/activities';
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
/** Le jeton Garmin vaut ~24 h ; on le renouvelle un peu avant. */
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

interface CachedToken {
	value: string;
	expiresAt: number;
}

/** Portée du module : réutilisé tant que l'instance du Worker reste chaude. */
let cachedToken: CachedToken | null = null;

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
}

function failure(status: number, error: string, detail?: string): Response {
	return json(status, detail ? { error, detail: detail.slice(0, 200) } : { error });
}

/** Comparaison à durée constante : évite de laisser fuiter le jeton par timing. */
function sameSecret(given: string, expected: string): boolean {
	if (given.length !== expected.length) return false;
	let diff = 0;
	for (let index = 0; index < given.length; index += 1) {
		diff |= given.charCodeAt(index) ^ expected.charCodeAt(index);
	}
	return diff === 0;
}

function bearer(request: Request): string {
	const header = request.headers.get('authorization') ?? '';
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	return match ? match[1].trim() : '';
}

/** Échange la clé personnelle contre un jeton court. `null` si Garmin refuse. */
async function garminToken(apiKey: string): Promise<string | null> {
	if (cachedToken && cachedToken.expiresAt > Date.now()) {
		return cachedToken.value;
	}

	// Pas d'en-tête `Accept` : l'API répond 406. Corps vide.
	const response = await fetch(`${GARMIN_BASE}${TOKEN_PATH}`, {
		method: 'POST',
		headers: { Authorization: `ApiKey ${apiKey}` }
	});

	if (!response.ok) return null;

	const raw = (await response.text()).trim().replace(/^"|"$/g, '');
	if (!raw) return null;

	cachedToken = { value: raw, expiresAt: Date.now() + TOKEN_TTL_MS };
	return raw;
}

interface ActivitiesPage {
	ok: boolean;
	status: number;
	activities: unknown[];
	/** Jeton refusé : à renouveler puis réessayer. */
	expired: boolean;
}

async function fetchPage(token: string, start: number): Promise<ActivitiesPage> {
	const url = `${GARMIN_BASE}${ACTIVITIES_PATH}?start=${start}&limit=${PAGE_SIZE}`;
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
	});

	if (response.status === 401 || response.status === 403) {
		return { ok: false, status: response.status, activities: [], expired: true };
	}
	if (!response.ok) {
		return { ok: false, status: response.status, activities: [], expired: false };
	}

	const body: unknown = await response.json();
	if (!Array.isArray(body)) {
		return { ok: false, status: 502, activities: [], expired: false };
	}

	return { ok: true, status: 200, activities: body, expired: false };
}

async function collectActivities(token: string): Promise<unknown[] | null> {
	const activities: unknown[] = [];

	for (let page = 0; page < MAX_PAGES; page += 1) {
		const result = await fetchPage(token, page * PAGE_SIZE);
		if (result.expired) return null;
		if (!result.ok) throw new Error(`garmin_${result.status}`);

		activities.push(...result.activities);
		if (result.activities.length < PAGE_SIZE) break;
	}

	return activities;
}

export const onRequestGet = async (context: Context): Promise<Response> => {
	const { request, env } = context;

	const syncToken = env.APPITO_SYNC_TOKEN?.trim();
	const apiKey = env.GARMIN_PERSONAL_API_KEY?.trim();
	if (!syncToken || !apiKey) {
		return failure(500, 'config_missing');
	}

	if (!sameSecret(bearer(request), syncToken)) {
		return failure(401, 'unauthorized');
	}

	try {
		let token = await garminToken(apiKey);

		if (!token) {
			return failure(502, 'garmin_auth');
		}

		let activities = await collectActivities(token);
		if (activities === null) {
			// Jeton périmé avant l'heure : on en redemande un, une seule fois.
			cachedToken = null;
			token = await garminToken(apiKey);
			if (!token) return failure(502, 'garmin_auth');
			activities = await collectActivities(token);
			if (activities === null) return failure(502, 'garmin_auth');
		}

		return json(200, { fetchedAt: new Date().toISOString(), activities });
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message.startsWith('garmin_429')) return failure(502, 'garmin_rate');
		return failure(502, 'garmin_network');
	}
};
