# Garmin en direct — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La page Course lit les activités Garmin via un relais Cloudflare, sans fichier intermédiaire, et le dépôt redevient privé.

**Architecture:** Une Pages Function `GET /api/garmin/activities` garde la clé, échange un jeton et pagine l'API Garmin. Le client mappe les activités brutes vers `Run`, compare à Dexie et n'écrit que les changements. Le site reste statique et prérendu ; `/api/*` est exclu du service worker.

**Tech Stack:** SvelteKit 3 / Svelte 5 / TypeScript, Dexie 4, Cloudflare Pages + Functions, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-garmin-direct-design.md`

## Global Constraints

- Aucun secret dans le dépôt ni dans `build/` : la clé Garmin et `APPITO_SYNC_TOKEN` vivent uniquement dans les secrets Cloudflare.
- `npm run check` (Svelte + service worker) et `npm test` passent avant chaque commit.
- Aucune couleur hexadécimale dans un composant : uniquement `src/lib/design/tokens.css`.
- `trailingSlash: 'always'`, routes prérendues, `BASE_PATH` vide (site servi à la racine).
- Commits conventionnels (`feat:`, `fix:`, `docs:`, `chore:`), travail sur une branche courte.

## Review Focus

- **Clé Garmin refusée depuis une IP d'hébergeur** : la sonde de la tâche 6 doit échouer bruyamment avant toute migration, sinon on découvre le problème après avoir supprimé Pages.
- **Réponse Garmin partielle ou vide** : `movingDuration` absent, `activityType` en chaîne au lieu d'objet, zones nulles. Le mapping doit produire `null`, jamais `0`, et ne rien écrire si la réponse est inexploitable.
- **Synchro répétée** : `updatedAt` ne doit pas bouger sans changement réel, sinon la fusion de sauvegarde écrase l'autre appareil.
- **Hors ligne** : une synchro tentée sans réseau ne doit jamais répondre depuis le cache du service worker.
- **Jeton applicatif absent** : l'interface doit expliquer quoi faire, pas afficher une erreur réseau.

---

### Task 1: Mapping Garmin → `Run`

**Files:**
- Create: `src/lib/garmin/map.ts`
- Create: `src/lib/garmin/map.test.ts`

**Interfaces:**
- Produces: `COURSE_TYPES: readonly string[]`, `isCourseType(typeKey: unknown): boolean`, `mapGarminActivity(activity: unknown): Run | null`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// map.test.ts
it('convertit une activité complète', () => {
	const run = mapGarminActivity(fixtureComplete);
	expect(run?.garminId).toBe(2147483001);
	expect(run?.durationS).toBe(2880);      // movingDuration, pas duration
	expect(run?.elapsedS).toBe(3010);
	expect(run?.hrZone4).toBe(1140);
	expect(run?.best1kS).toBe(268);
	expect(run?.type).toBe('running');
});
it('préfère startTimeLocal, retombe sur startTimeGMT', () => { ... });
it('met null quand une valeur manque, jamais 0', () => {
	const run = mapGarminActivity({ ...fixtureComplete, averageHR: undefined });
	expect(run?.avgHr).toBeNull();
	expect(run?.distanceM).toBe(10_240);
});
it('accepte activityType sous forme de chaîne', () => { ... });
it('refuse une activité non-course', () => {
	expect(mapGarminActivity({ ...fixtureComplete, activityType: { typeKey: 'cycling' } })).toBeNull();
});
it('refuse une activité sans identifiant', () => { ... });
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- map`
Expected: FAIL, `mapGarminActivity is not defined`.

- [ ] **Step 3: Implémenter `src/lib/garmin/map.ts`**

Reprendre `course_activity_vers_ligne` de `R/course_utils.R:296-344`. `COURSE_TYPES` = les 9 types de `course_utils.R:12-22`. `importedAt` = `new Date().toISOString()`, `updatedAt` = même valeur, `deletedAt` = `null`, `source` = `'garmin'`.

- [ ] **Step 4: Lancer les tests**

Run: `npm test -- map`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garmin/map.ts src/lib/garmin/map.test.ts
git commit -m "feat: mapping des activités Garmin vers Run"
```

---

### Task 2: Synchro sans réécriture inutile

**Files:**
- Create: `src/lib/garmin/client.ts`
- Create: `src/lib/garmin/client.test.ts`
- Modify: `src/lib/db/repo.ts` (nouvelles fonctions pures testables)

**Interfaces:**
- Consumes: `mapGarminActivity` (Task 1), `db.runs` (Dexie)
- Produces:
  - `sameRun(a: Run, b: Run): boolean` — ignore `updatedAt`, `importedAt`
  - `planSync(existing: Run[], incoming: Run[]): { added: Run[]; updated: Run[]; unchanged: number }`
  - `syncRuns(fetchImpl?: typeof fetch): Promise<SyncResult>` avec `SyncResult = { added: number; updated: number; unchanged: number; total: number }`
  - `class SyncError extends Error { kind: 'offline' | 'unauthorized' | 'server' | 'config' | 'payload' }`

- [ ] **Step 1: Tests qui échouent**

```ts
it('classe ajout, mise à jour et inchangé', () => { ... });
it('ne réécrit pas updatedAt quand rien ne change', () => { ... });
it('ne ressuscite pas une course supprimée localement', () => { ... });
it('signale offline quand fetch rejette', async () => {
	await expect(syncRuns(() => Promise.reject(new TypeError('Failed to fetch'))))
		.rejects.toMatchObject({ kind: 'offline' });
});
it('signale unauthorized sur 401', ...);
it('signale payload sur un JSON sans tableau activities', ...);
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -- client`

- [ ] **Step 3: Implémenter** — `sameRun` compare les champs métier ; `planSync` conserve `importedAt` et `deletedAt` des lignes existantes ; `syncRuns` fait un `fetch('/api/garmin/activities', { headers: { Authorization: 'Bearer ' + token } })`, mappe, filtre `null`, puis écrit `added` + `updated` en une transaction Dexie. Zéro écriture si `updated.length === 0 && added.length === 0`.

- [ ] **Step 4: Tests verts** — `npm test -- client`

- [ ] **Step 5: Commit** — `feat: synchronisation Garmin idempotente`

---

### Task 3: Le service worker ignore `/api/*`

**Files:**
- Modify: `src/service-worker.ts:44-60`

**Interfaces:**
- Consumes: rien
- Produces: comportement — toute requête dont le chemin commence par `<scope>api/` n'est jamais interceptée.

- [ ] **Step 1: Ajouter la garde** — en tête du handler `fetch`, après le filtre de méthode :

```ts
if (new URL(request.url).pathname.startsWith(new URL(self.registration.scope).pathname + 'api/')) return;
```

- [ ] **Step 2: Vérifier à la main** — `npm run build`, `npm run preview`, ouvrir la page, onglet Réseau : la requête `/api/garmin/activities` doit apparaître sans « (from ServiceWorker) ».

- [ ] **Step 3: Commit** — `fix: le service worker ne met plus l'API en cache`

---

### Task 4: La fonction Cloudflare

**Files:**
- Create: `functions/api/garmin/[[path]].ts`
- Create: `static/_routes.json`
- Create: `.dev.vars.example` (documentation, sans valeur)

**Interfaces:**
- Produces: `GET /api/garmin/activities` → `200 { fetchedAt, activities: unknown[] }` ; erreurs `401 { error: 'unauthorized' }`, `502 { error: 'garmin_auth' | 'garmin_network' | 'garmin_rate' }`, `500 { error: 'config_missing' }`.

- [ ] **Step 1: Écrire la fonction**

Échange `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token`, en-tête `Authorization: ApiKey <env.GARMIN_PERSONAL_API_KEY>`, **sans** `Accept`, corps vide. Jeton en cache de module avec expiration à 23 h. Puis `GET .../activitylist-service/activities/search/activities?start=N&limit=100`, en-tête `Bearer`, `Accept: application/json`, jusqu'à page incomplète ou 50 pages. Vérifie `Authorization: Bearer <env.APPITO_SYNC_TOKEN>` avant tout appel Garmin.

- [ ] **Step 2: `static/_routes.json`**

```json
{ "version": 1, "include": ["/api/*"], "exclude": [] }
```

- [ ] **Step 3: Essayer en local** — `npx wrangler pages dev build --binding APPITO_SYNC_TOKEN=test` avec la clé dans `.dev.vars` (jamais commité). Vérifier `401` sans jeton, `200` avec.

- [ ] **Step 4: Commit** — `feat: relais Garmin côté Cloudflare`

---

### Task 5: Interface Course et jeton

**Files:**
- Create: `src/lib/garmin/token.ts`
- Modify: `src/routes/course/+page.svelte`
- Modify: `src/routes/reglages/+page.svelte`

**Interfaces:**
- Consumes: `syncRuns`, `SyncError` (Task 2)
- Produces: `getSyncToken(): string | null`, `setSyncToken(value: string): void`, `clearSyncToken(): void`

- [ ] **Step 1: `token.ts`** — `localStorage['appito-sync-token']`, jamais dans le build.

- [ ] **Step 2: Page Course** — bouton « Synchroniser » (désactivé pendant l'appel), états « jamais synchronisé », « synchronisé il y a X », « N ajout(s), N mise(s) à jour », message clair par `SyncError.kind` (`offline` → « Pas de réseau : les courses déjà présentes restent disponibles. »). Champ de saisie du jeton si absent, avec lien vers Réglages.

- [ ] **Step 3: Réglages** — section « Synchronisation Garmin » : champ jeton (masqué), bouton d'effacement, date de dernière synchro.

- [ ] **Step 4: Vérifier** — `npm run check` puis parcours manuel en `preview` avec la fonction locale.

- [ ] **Step 5: Commit** — `feat: synchronisation Garmin depuis la page Course`

---

### Task 6: Migration d'hébergement

**Files:**
- Delete: `.github/workflows/deploy.yml`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`, `AGENTS.md`, `docs/ROADMAP.md`, `docs/DEVLOG.md`

- [ ] **Step 1: Sonde de bout en bout** — après le premier build Cloudflare avec les deux secrets, `curl -H "Authorization: Bearer <jeton>" https://<projet>.pages.dev/api/garmin/activities`. Attendu : `200` et des activités réelles. **Si échec, arrêt : ne pas passer le dépôt en privé.**
- [ ] **Step 2: Export depuis l'ancienne URL**, import sur la nouvelle, contrôle du nombre de séries.
- [ ] **Step 3: Dépôt privé** — `gh api --method PATCH repos/Martin-pito/Appito_V2 -F private=true`.
- [ ] **Step 4: Supprimer Pages** — `gh api --method DELETE repos/Martin-pito/Appito_V2/pages`.
- [ ] **Step 5: `ci.yml`** — `npm ci`, `npm run check`, `npm test` sur push et pull request.
- [ ] **Step 6: Documentation** — URL, installation, secrets à configurer, désinstallation de l'ancienne PWA.
- [ ] **Step 7: Commit** — `chore: hébergement Cloudflare, dépôt privé`

---

### Task 7: Vérification finale

- [ ] `npm run check` et `npm test` verts.
- [ ] `grep -r "GCDC_" build/` → aucun résultat ; `grep -r "$APPITO_SYNC_TOKEN" build/` → aucun résultat.
- [ ] Deux synchros : la seconde annonce `0 ajout, 0 mise à jour, N inchangées`.
- [ ] Hors ligne : page Course affichée, synchro refusée proprement, musculation utilisable.
- [ ] Dépôt privé, Pages supprimé, URL Cloudflare en HTTPS.
