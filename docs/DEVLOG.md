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
