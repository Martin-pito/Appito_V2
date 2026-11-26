# Journal de développement — Appito V2

Une entrée par session. Des faits, des décisions, des échecs. Pas de narration.

---

## 2026-11-24 — M0, M1, M2 et une partie de M3/M4

### Fait

- Dépôt `Martin-pito/Appito_V2` (public, vide) rattaché en `origin`.
- SvelteKit 3.2, Svelte 5.57, Vite 8, TypeScript 6 : projet neuf, runes.
- 5 routes : `Aujourd'hui`, `Musculation`, `Course`, `Gestion`, `Réglages`.
- Jetons de design repris de la v1 (`www/styles.css`) dans
  `src/lib/design/tokens.css` — modes clair/nuit, aucun hex en dur ailleurs.
- Coquille responsive : navigation basse < 900 px, rail latéral au-delà.
- IndexedDB (Dexie) : `movements`, `sets`, `runs`, `settings`.
  `updatedAt` partout, suppressions logiques (`deletedAt`) dès le schéma v1.
- Musculation : sélection par chips récentes + liste complète, formulaire
  poids avec pas de 2,5 kg, préremplissage depuis la dernière séance, KPI,
  filtres période/répétitions, historique, suppression en deux temps, CSV.
- Gestion : création, renommage, suppression en cascade avec compteur.
- Réglages : thème auto/clair/sombre, export JSON, import fusion/remplacement,
  effacement local, rappel de sauvegarde à 30 jours.
- PWA : manifeste, 7 icônes + 3 écrans de démarrage générés par `sharp`,
  service worker précachant l'app shell.
- 32 tests Vitest sur le domaine (volumes, filtres, progression, fusion,
  collisions de noms, allure, pondérations, formatage).
- `npm run check` : 0 erreur (Svelte + service worker via tsconfig séparé).

### Décisions

- **SvelteKit 3 a supprimé `$lib` et `$service-worker`.** Remplacés par les
  imports `#lib/*` (package.json) et `$app/manifest` / `$app/env` /
  `$app/service-worker`. Le tsconfig généré a `paths: {}` : ajout explicite de
  `#lib/*` pour que TypeScript résolve les modules `.ts`.
- **L'index d'unicité de `nameKey` est applicatif, pas SQL.** Un mouvement
  supprimé (tombstone) doit pouvoir être recréé sous le même nom.
- **La fusion arbitre par `updatedAt`, tombstones comprises.** Les deux
  appareils peuvent écrire (décision issue de la relecture de conception).
- **Collision de noms à la fusion** : on garde le mouvement le plus ancien, on
  marque l'autre supprimé et on réaffecte ses séries.
- **Figma n'existe pas encore** : les jetons v1 servent de source provisoire ;
  le fichier Figma les reprendra à l'identique (mapping 1:1 documenté).
- **`Pito.png` (200×200) est agrandi par Lanczos.** Un master 1024 serait
  meilleur ; `npm run icons` accepte n'importe quelle source.

### Échecs et corrections

- `import * as repo, { type X }` : syntaxe invalide, séparé en deux imports.
- `asset('/icons/...')` : Kit 3 attend un chemin sans slash initial.
- TypeScript 6 déprécie `baseUrl` : `paths` fonctionne sans, une fois le
  tsconfig régénéré proprement (un `perl -pi` a cassé le JSON, réécrit à la main).
- Service worker : `cache.addAll` échoue en bloc si une seule URL manque.
  À surveiller lors du premier déploiement (chemins sans `.html`).

### Reste

- Déploiement GitHub Pages + activation de Pages sur le dépôt.
- Vérifier si GitHub Pages sert `/musculation` depuis `musculation.html`
  (sinon basculer sur le routeur à hash, prévu pour les hôtes sans réécriture).
- Graphique ECharts (M3).
- Script d'export Garmin et page Course (M5).

---

## 2026-11-25 — mise en ligne

### Fait

- Premier commit poussé sur `main`, workflow de déploiement vert.
- **Pages activé** : `https://martin-pito.github.io/Appito_V2/`.
- Le dépôt était privé : GitHub Pages n'existe pas pour un dépôt privé en
  offre gratuite (422 « Your current plan does not support GitHub Pages »).
  Rendu public — il ne contient que du code et des icônes.
- Vérifié en production : les 5 routes répondent 200, le manifeste et les
  icônes aussi, `/musculation` redirige bien vers `/musculation/`.
- **Hors ligne vérifié sur le site déployé** : service worker actif, 47 entrées
  en cache, formulaire de saisie chargé réseau coupé, série enregistrée hors
  ligne (toast de confirmation).
- Captures mobile 390×844 et bureau 1440×900 pour les cinq écrans.

### Décisions

- **`trailingSlash` n'est plus une option globale dans SvelteKit 3.** Elle
  s'exporte depuis `+layout.ts` ; combinée à `adapter-static`, elle produit
  `musculation/index.html`, ce que GitHub Pages sert sans réécriture. Les
  chemins d'assets relatifs (`../_app/...`) sont calculés en conséquence.
- Le dépôt reste public : aucune donnée d'entraînement n'y entre (`.gitignore`).

### Corrections d'interface après captures

- Ligne de mouvement en Gestion : les trois blocs étaient empilés (nom, stats,
  actions) et donnaient des lignes de 200 px de haut. Regroupés dans une seule
  ligne flexible.
- Formulaire de saisie plafonné à 640 px : sur 1440 px, les champs faisaient
  550 px de large.
- `card-head` passe à la ligne : le bouton « Exporter » écrasait le texte des
  réglages sur mobile.
- Date d'accueil : `text-transform: capitalize` mettait « Novembre » en
  majuscule ; seule la première lettre est désormais capitalisée.
- « Exportée le jamais » → « Aucune sauvegarde exportée pour le moment ».
- Sélecteur d'import : libellés raccourcis, `padding-right` porté à 46 px pour
  que la flèche ne coupe plus le texte ; bouton natif du champ fichier stylé.
- **Musculation sur bureau** : saisie et analyse côte à côte (deux colonnes
  au-delà de 1000 px, KPI en 2×2 à droite). Le formulaire seul dans une carte
  de 1100 px laissait un grand vide.
- Page Course : icônes de contrôle alignées en haut de ligne au lieu d'être
  centrées sur un paragraphe de trois lignes.

### Reste

- Installation réelle sur Android et sur ordinateur (M4).
- Graphique ECharts (M3), import Garmin (M5), migration v1 (M7).

---

## 2026-11-26 — Garmin en direct, relais Cloudflare

### Fait

- **API Garmin testée en direct** : `OPTIONS` sur
  `personal.connectapi.garmin.com` → `403` sans `Access-Control-Allow-Origin` ;
  `POST` d'échange → `401`, toujours sans CORS. Aucun navigateur ne peut
  l'appeler, clé ou pas. Le relais serveur n'est pas un confort, c'est la seule
  voie.
- `src/lib/garmin/map.ts` : portage de `course_activity_vers_ligne`
  (`R/course_utils.R`), 28 champs, neuf types de course, absences en `null`.
- `src/lib/garmin/client.ts` : `planSync` (ajout / mise à jour / inchangé),
  préservation de `importedAt` et des tombstones, écriture uniquement des
  changements réels.
- `functions/api/garmin/activities.ts` : jeton applicatif, échange de clé,
  cache de jeton en mémoire (23 h), pagination 100 × 50, erreurs stables.
- `static/_routes.json` : seule `/api/*` invoque la Function.
- Service worker : `/api/*` ne passe plus par le cache.
- Page Course : bouton Synchroniser, saisie du jeton au premier usage, états
  (jamais / N ajout / à jour / hors ligne / jeton refusé). Réglages : gestion
  du jeton et date de dernière synchro.
- 65 tests Vitest (dont 12 mapping, 12 synchro, 9 relais).
- Vérifié en navigateur sur le build local : relais simulé → 2 courses
  (le vélo est filtré), seconde synchro « 2 course(s) déjà à jour », hors
  ligne → message explicite, aucune requête servie par le cache.

### Décisions

- **Cloudflare Pages + une Function**, plutôt qu'un import de fichier : même
  expérience que la v1 (un bouton), clé hors du dépôt et hors du navigateur,
  dépôt privé accepté, coût nul.
- Deux secrets distincts : la clé Garmin et `APPITO_SYNC_TOKEN`. Le second
  empêche un inconnu qui trouve l'URL de consommer la clé.
- Le jeton applicatif vit dans `localStorage`, saisi une fois par appareil.
  Cloudflare Access est écarté : la session expirerait en salle, hors ligne.
- L'ancienne décision « import par fichier » est abandonnée, y compris dans
  `AGENTS.md`.

### Échecs

- `import.meta.env.BASE_URL` vaut `'./'` quand `base` est vide : l'appel
  partait vers `/course/api/garmin/activities` (404). Le chemin est désormais
  construit en absolu.
- Le serveur `vite preview` garde le manifeste de l'ancien build : après un
  rebuild, les chunks hashés répondaient 404. Redémarrer l'aperçu.
- Test de pagination : `activityId` défini deux fois, refusé par
  `svelte-check` ; l'objet de base est maintenant étalé en premier.

### Reste

- Création du projet Cloudflare et pose des deux secrets (voir
  `docs/DEPLOIEMENT.md`).
- Sonde de bout en bout depuis Cloudflare, puis export/import des données,
  dépôt privé et suppression de GitHub Pages.
