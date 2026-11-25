# Appito V2 — Garmin en direct, dépôt privé

Date : 2026-11-25
Statut : proposition, en attente d'approbation
Remplace partiellement : `2026-11-24-appito-v2-design.md` (section M5 et hébergement)

## Intention

Les activités Garmin doivent arriver dans l'app sans passer par un fichier
exporté puis importé : même expérience que la v1 R/Shiny, où l'on clique
« synchroniser » et les courses sont là. En parallèle, le dépôt Git redevient
privé.

## Ce qui a été vérifié avant d'écrire

Test réel contre l'API, avec une origine de navigateur :

```
OPTIONS https://personal.connectapi.garmin.com/personalapitoken-service/...
  -> 403, aucun Access-Control-Allow-Origin
POST    (échange de clé, clé factice)
  -> 401, aucun Access-Control-Allow-Origin
```

Conclusion : **aucun navigateur ne peut appeler cette API**, quelle que soit la
clé. Le R fonctionne parce que c'est le processus R qui appelle, côté serveur.
« Direct » signifie donc « via un relais serveur », pas « depuis la page ».

Contrat de l'API, repris de `R/course_utils.R` :

| Étape | Requête |
|-------|---------|
| Jeton | `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token`, en-tête `Authorization: ApiKey <clé>`, **sans** en-tête `Accept` (406 sinon), corps vide → texte brut, valable ~24 h |
| Activités | `GET https://personal.connectapi.garmin.com/activitylist-service/activities/search/activities?start=0&limit=100`, `Authorization: Bearer <jeton>`, `Accept: application/json` |
| Pagination | pages de 100, arrêt sur page vide ou incomplète, plafond 50 pages |

## Objectifs

1. Une page Course alimentée par Garmin, sans manipulation de fichier.
2. Le dépôt `Martin-pito/Appito_V2` redevient privé.
3. La clé `GCDC_…` ne se trouve ni dans le dépôt, ni dans le code livré au
   navigateur.
4. L'application reste installable (PWA), utilisable hors ligne, et la saisie
   de musculation ne dépend jamais du réseau.

## Non-objectifs

- Synchroniser la musculation : elle reste locale, saisie à la main.
- Écrire chez Garmin (créer/modifier une activité).
- Temps réel ou tâche planifiée : la synchronisation est déclenchée par
  l'utilisateur.
- Comptes multi-utilisateurs.
- Parité complète des quatre sections de la v1 sur la page Course : la
  première livraison donne les KPI et l'historique, les sections « cœur &
  intensité » et « charge & récupération » suivent.

## Anti-objectifs

- Un site qui ne fonctionne plus quand le relais tombe : la lecture des
  données déjà synchronisées doit continuer hors ligne.
- Une clé Garmin présente dans le bundle JavaScript, même obfusquée.
- Un dépôt public par accident lors du passage en privé.

## Contraintes

- GitHub Pages ne sert pas un dépôt privé en offre gratuite (vérifié :
  `422 Your current plan does not support GitHub Pages`) et n'exécute pas de
  code : il faut changer d'hébergeur pour avoir à la fois le privé et le relais.
- L'API Garmin n'a pas de CORS : le relais est obligatoire.
- Le relais doit tourner sans maintenance et sans coût.
- Le build reste statique, prérendu, avec `trailingSlash: 'always'`
  (`musculation/index.html`), ce qui n'exige aucune réécriture d'URL.

## Approches examinées

| | Description | Verdict |
|---|---|---|
| **A. Cloudflare Pages + Function** | Site statique et une fonction `/api/garmin` dans le même projet. Clé dans un secret Cloudflare. Dépôt privé accepté. | **Retenue** : gratuit, zéro maintenance, pas de jeton GitHub à gérer, secrets hors du dépôt. |
| B. Vercel | Même principe avec une fonction serverless. | Équivalent techniquement, quotas plus serrés, aucun avantage ici. |
| C. Relais sur le PC | Petit serveur local gardant la clé chez soi. | Écartée : le PC doit être allumé, le téléphone doit être sur le même réseau, et HTTPS → HTTP local est bloqué par le navigateur. |

## Architecture retenue

```
Téléphone / PC (PWA)                Cloudflare                    Garmin
┌──────────────────────┐     ┌────────────────────────┐    ┌──────────────┐
│ Course (Svelte)      │────▶│ /api/garmin/*          │───▶│ token +      │
│  syncRuns()          │     │  Pages Function        │    │ activities   │
│  Dexie (runs)        │◀────│  clé en secret         │◀───│              │
└──────────────────────┘     └────────────────────────┘    └──────────────┘
        │
        └── hors ligne : lit Dexie, ne parle à personne
```

### Hébergement

Un projet Cloudflare Pages connecté au dépôt privé :

- commande de build : `npm run build`
- dossier de sortie : `build`
- variable de build : `NODE_VERSION=22`
- secrets (chiffrés, jamais dans le dépôt) :
  - `GARMIN_PERSONAL_API_KEY` — la clé `GCDC_…`
  - `APPITO_SYNC_TOKEN` — jeton partagé, voir Sécurité
- `BASE_PATH` disparaît : le site est servi à la racine de
  `<projet>.pages.dev`. Le support de la variable reste dans `vite.config.ts`
  pour un éventuel sous-chemin.

### La fonction

`functions/api/garmin/[[path]].ts` — une seule route, `GET /api/garmin/activities`.

1. Vérifie le jeton applicatif (`Authorization: Bearer <APPITO_SYNC_TOKEN>`).
   Secret absent ou jeton invalide → `401`, sans appeler Garmin.
2. Échange la clé contre un jeton Garmin, **mis en cache en mémoire du Worker**
   (portée du module, expiration à ~23 h) pour ne pas refaire l'échange à
   chaque requête.
3. Pagine les activités (100 par page, plafond 50).
4. Répond `{ fetchedAt, activities: [...] }` en JSON, avec
   `Cache-Control: no-store`.

Erreurs : `502` avec un message court et stable (`garmin_auth`, `garmin_rate`,
`garmin_network`, `config_missing`), jamais la clé ni la réponse brute de
Garmin au-delà de 200 caractères.

`static/_routes.json` limite l'invocation de la fonction à `/api/*` : le
statique reste servi gratuitement et sans limite.

**Le service worker doit ignorer `/api/*`.** Tel qu'il est écrit, il cache
toute requête GET de même origine : la première réponse de synchro serait mise
en cache et resservie, et la page annoncerait un succès avec des données
figées — exactement le contraire du comportement hors ligne attendu. Les
requêtes `/api/` sortent du gestionnaire `fetch` et vont directement au réseau.

### Le mapping Garmin → `Run` (travail à faire, pas existant)

`runFromGarmin` (`src/lib/domain/runs.ts`) ne fait que **compléter des valeurs
par défaut** sur des champs déjà nommés en camelCase. Il ne lit pas le format
Garmin. La conversion réelle existe uniquement dans `R/course_utils.R`
(`course_activity_vers_ligne`, ~28 champs) et doit être portée :

`src/lib/garmin/map.ts` (nouveau) — `mapGarminActivity(activity: unknown): Run | null`

| Garmin | `Run` | Remarque |
|---|---|---|
| `activityId` | `garminId` | clé d'unicité |
| `activityType.typeKey` | `type` | filtre `COURSE_TYPES` (9 types, repris de la v1) |
| `activityName` | `name` | `"Course"` si vide |
| `startTimeLocal` puis `startTimeGMT` | `date` | |
| `movingDuration` puis `duration` | `durationS` | |
| `duration` | `elapsedS` | |
| `distance`, `elevationGain`, `elevationLoss` | `distanceM`, `elevationGainM`, `elevationLossM` | |
| `averageHR`, `maxHR` | `avgHr`, `maxHr` | |
| `hrTimeInZone_1..5` | `hrZone1..5` | |
| `calories`, `averageSpeed`, `maxSpeed` | idem | |
| `averageRunningCadenceInStepsPerMinute`, `maxRunningCadenceInStepsPerMinute` | `avgCadence`, `maxCadence` | |
| `strideLength`, `differenceBodyBattery`, `moderateIntensityMinutes`, `vigorousIntensityMinutes`, `steps`, `fastestSplit_1000` | `strideCm`, `bodyBattery`, `moderateIntensityMin`, `vigorousIntensityMin`, `steps`, `best1kS` | |
| — | `source: 'garmin'`, `importedAt` | |

Valeurs absentes → `null`, jamais `0` (la v1 distingue les deux). Un test Vitest
par famille de champs, avec une activité brute recopiée de la vraie réponse.

### Le client

`src/lib/garmin/client.ts` (nouveau) :

- `syncRuns(): Promise<{ added, updated, unchanged, total }>` — appelle le
  relais, mappe, filtre les non-courses, puis compare à la base.
- **Écriture seulement si le contenu change.** Un `bulkPut` naïf
  réestampillerait `updatedAt` à chaque synchro pour toutes les courses : la
  fusion de sauvegarde arbitre par `updatedAt`, donc toutes les courses
  deviendraient « les plus récentes » et écraseraient les corrections faites
  sur l'autre appareil. `importedAt` garde la première vue, `updatedAt` ne
  bouge que si un champ a réellement changé.
- Les lignes supprimées localement (`deletedAt` non nul) ne sont pas
  ressuscitées par une synchro.
- Lève une erreur typée (`offline`, `unauthorized`, `server`, `config`) que la
  page traduit en message.
- Une seule transaction Dexie : rien n'est écrit si la réponse est incomplète.

`src/lib/garmin/token.ts` : le jeton applicatif saisi une fois par appareil,
stocké dans `localStorage` (clé `appito-sync-token`), jamais dans le build.

Page Course : bouton « Synchroniser », état (`jamais`, `en cours`,
`il y a X`, `erreur`), KPI et historique existants. Hors ligne, le bouton
explique qu'il faut du réseau et les données locales restent affichées.
Si aucun jeton n'est encore saisi, un champ apparaît une seule fois.

### Sécurité

Ce que ça protège : la clé Garmin ne quitte jamais Cloudflare ; le dépôt privé
ne contient aucun secret ; un inconnu qui découvre l'URL ne peut pas consommer
la clé sans le jeton applicatif.

Ce que ça ne protège pas : le jeton applicatif vit dans le navigateur de
l'appareil. Quelqu'un qui a physiquement l'appareil déverrouillé peut le lire.
C'est le niveau de protection d'une app personnelle, pas d'un service public.
La parade réelle serait Cloudflare Access, écartée : la session expirerait et
casserait l'usage hors ligne en salle.

Rotation : changer `APPITO_SYNC_TOKEN` dans Cloudflare, ressaisir le jeton sur
chaque appareil. Changer la clé Garmin se fait chez Garmin puis dans le secret.

### Migration d'hébergement

**Le changement d'origine efface les données locales.** IndexedDB et
`localStorage` sont propres à une origine : rien ne suit de
`martin-pito.github.io/Appito_V2` vers `<projet>.pages.dev`. Ce qui a été saisi
sur le site actuel doit être exporté depuis Réglages, puis réimporté sur la
nouvelle adresse.

Ordre, pour ne jamais laisser l'app sans URL ni perdre une saisie :

1. Créer le projet Pages, connecter le dépôt (encore public), build.
2. **Sonde de bout en bout** : appeler `/api/garmin/activities` avec le jeton
   applicatif et vérifier que Garmin répond depuis l'infrastructure Cloudflare.
   C'est le point de non-retour : si la clé est refusée depuis une IP
   d'hébergeur, tout le reste est à revoir.
3. Vérifier la synchro réelle et l'affichage des courses sur
   `https://<projet>.pages.dev`.
4. **Depuis l'ancienne URL** : exporter la sauvegarde JSON, puis l'importer sur
   la nouvelle adresse. Contrôler le nombre de séries et de courses.
5. Passer le dépôt en privé (`gh api --method PATCH ... -F private=true`).
6. Supprimer le site GitHub Pages (`gh api --method DELETE .../pages`) et le
   workflow `deploy.yml`, remplacé par un `ci.yml` qui lance `check` et `test`
   sur chaque push et pull request.
7. Mettre à jour README (URL, installation), AGENTS, ROADMAP, DEVLOG.
8. Désinstaller l'ancienne PWA des appareils : elle continuerait à fonctionner
   depuis son cache, avec des données qui divergent de la nouvelle adresse.

## Vérification

Critères d'acceptation, tous constatés sur le site déployé :

1. `GET /api/garmin/activities` sans jeton → `401`.
2. Avec le jeton, la réponse contient les activités Garmin réelles, et le
   nombre correspond à celui de Garmin Connect.
3. La page Course déclenche la synchro, affiche N courses, distance, allure et
   FC moyenne cohérentes avec la v1 pour les mêmes activités (même activité,
   mêmes chiffres).
4. Deux synchro successives ne créent aucun doublon (`garminId` unique) et la
   seconde annonce `0 ajout, 0 mise à jour, N inchangées` — donc aucun
   `updatedAt` modifié.
5. Réseau coupé après une synchro : la page Course s'affiche, les courses sont
   là, le bouton explique l'impossibilité, la musculation reste utilisable.
   Une synchro tentée hors ligne ne doit **jamais** répondre depuis le cache du
   service worker.
6. Le bundle livré ne contient ni `GCDC_` ni la valeur de `APPITO_SYNC_TOKEN`
   (recherche dans `build/`).
7. Les données saisies sur l'ancienne origine ont été exportées puis
   réimportées : même nombre de séries après le déménagement.
8. Le dépôt est privé, GitHub Pages est supprimé, et l'URL Cloudflare répond.

## Coût

Cloudflare Pages : statique illimité, fonctions 100 000 requêtes/jour gratuites.
L'usage réel est de quelques requêtes par synchronisation. Aucune carte
bancaire demandée.

## Laissé au constructeur

- Découpage exact des fichiers de la fonction (un seul fichier suffit).
- Forme du cache de jeton (variable de module, horodatage).
- Emplacement du champ de saisie du jeton (Réglages plutôt que Course).
- Libellés et états de la page Course.
- Détail de la comparaison avant écriture (empreinte de contenu ou diff champ
  à champ) — l'exigence est le résultat : aucun `updatedAt` touché sans
  changement réel.
- Tests : `mapGarminActivity` (une activité brute par famille de champs),
  filtrage des types, synchro idempotente, refus sans jeton.

## Points ouverts

- **Provisionnement** : la création du projet Pages, l'installation de
  l'application GitHub de Cloudflare et la saisie des deux secrets sont des
  actions de navigateur. Qui les fait, et avec quel niveau d'assistance ?
  (voir la question posée avec ce document)
- **Validité de la clé depuis une IP d'hébergeur** : rien n'indique dans la
  documentation Garmin que la clé personnelle soit liée à une IP, mais elle n'a
  jamais été utilisée ailleurs que depuis le PC. La sonde de l'étape 2 tranche.
