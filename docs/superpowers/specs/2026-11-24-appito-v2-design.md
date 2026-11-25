# Appito V2 — conception

Date : 2026-11-24
Statut : proposition à valider
Remplace : Appito v1 (Shiny, `github.com/Martin-pito/Appito`)

## 1. Intention et pourquoi

Appito v1 est une application Shiny de suivi de charge d'entraînement :
musculation (séries par mouvement) et course à pied (activités Garmin mises
en cache). Elle fonctionne, mais reste un site web piloté par un serveur R :
pas d'icône installable, pas d'usage hors ligne, dépendance à un `shiny::runApp()`
sur un ordinateur allumé.

Appito V2 doit être **une application qu'on installe** sur téléphone et sur
ordinateur, qu'on ouvre d'un pouce à la salle, qui **enregistre une série
sans réseau**, et qui conserve le monitoring de course (KPI, zones, allure,
body battery) déjà construit dans la v1.

Pourquoi maintenant : la v1 a atteint sa limite structurelle. Shiny repose
sur un websocket permanent ; l'écriture hors ligne y est un bricolage, pas
une fonctionnalité. L'effort de ces dernières semaines porte sur le domaine
(multi-mouvements, migrations, métriques Garmin), pas sur la présentation :
ce domaine se transpose, la coquille Shiny non.

## 2. Objectifs

- **O1** Application installable sur Android, iOS et bureau (PWA), avec icône,
  nom, thème et écran de démarrage.
- **O2** Saisie d'une série en moins de 10 secondes, avec les valeurs de la
  dernière séance en préremplissage.
- **O3** Fonctionnement complet hors ligne (lecture et écriture), y compris
  première ouverture après installation.
- **O4** Parité fonctionnelle avec la v1 sur Musculation, Course et Gestion.
- **O5** Zéro serveur à maintenir, zéro secret embarqué, hébergement statique
  gratuit, données personnelles stockées sur l'appareil.
- **O6** Design piloté par Figma : jetons de couleur/espacement/typo uniques,
  modes jour et nuit.
- **O7** Suivi de projet lisible dans le dépôt : feuille de route, journal de
  développement, explication de chaque avancée.

## 3. Non-objectifs

- Pas de compte utilisateur, pas de multi-utilisateur.
- Pas de synchronisation temps réel entre appareils (voir §10).
- Pas de publication sur les stores dans cette version.
- Pas de réécriture du pipeline Garmin : on réutilise la logique R existante.
- Pas de fonctionnalités sociales, pas de coach, pas de nutrition.

## 4. Anti-objectifs (échec même si ça « marche »)

- Une app qui perd une série parce que le réseau est tombé.
- Une app qui demande de ressaisir ce qui existe déjà en v1.
- Une app dont l'écran de saisie demande plus de 4 gestes.
- Deux sources de vérité pour les jetons de design (Figma + CSS divergents).
- Un dépôt où l'on ne comprend pas, trois semaines plus tard, où en est le
  projet.

## 5. Contraintes

- **C1** La clé API Garmin est un secret personnel (`GCDC_…`) : elle ne peut
  pas être embarquée dans un client. Elle reste sur l'ordinateur.
- **C2** Les endpoints Garmin ne sont pas prévus pour un appel navigateur
  (CORS) : l'app ne parlera jamais directement à Garmin.
- **C3** iOS efface le stockage des sites peu utilisés ; une sauvegarde
  exportable est obligatoire, pas optionnelle.
- **C4** L'utilisateur est seul, sur deux appareils (téléphone + PC).
- **C5** Le dépôt est privé aujourd'hui et l'historique v1 doit rester lisible :
  on ne réécrit pas l'historique de `Appito`, on crée `Appito-V2`.
- **C6** La saisie se fait debout, une main, parfois avec des gants : cibles
  tactiles ≥ 44 px, pas de menu déroulant à 30 entrées sans recherche.

## 6. Approches considérées

| # | Approche | Verdict |
|---|----------|---------|
| A | Shiny conservé + PWA (manifeste, service worker, VPS) | Écartée : aucune écriture hors ligne fiable, serveur 24/7, UI contrainte par Bootstrap 3 |
| B | API R (Plumber) + front PWA réécrit | Écartée : deux codebases à maintenir pour un utilisateur unique |
| C | App native Flutter/React Native + backend | Écartée : réécriture totale + comptes développeur + backend, disproportionné |
| **D** | **Réécriture local-first en PWA, sans serveur, Garmin en import différé** | **Retenue** |

D gagne parce que : une seule codebase, l'offline est natif (pas ajouté),
aucun serveur ni secret à héberger, installation possible sur les trois
plateformes, et le travail de domaine de la v1 est réutilisable via un
script d'export.

## 7. Décisions techniques (mes appels, révisables)

| Sujet | Décision | Raison |
|-------|----------|--------|
| Framework | **SvelteKit 2 + Svelte 5 (runes) + TypeScript** | Compilation en site statique, bundle léger, composants proches du HTML/CSS donc fidélité Figma maximale |
| Style | **CSS custom properties**, pas de Tailwind | Les jetons de la v1 (`--red`, `--surface`, `--radius`…) sont déjà des variables CSS : mapping 1:1 avec les variables Figma, modes jour/nuit gratuits |
| Graphiques | **ECharts** (import modulaire) | Couvre zones empilées, axe d'allure inversé, tooltips riches ; remplace Highcharts sans régression |
| Stockage | **IndexedDB via Dexie 4**, schéma typé + migrations | Fiable sur iOS/Android, requêtes indexées, pas de dépendance à OPFS |
| PWA | **`@vite-pwa/sveltekit`** (Workbox), `registerType: autoUpdate` | Manifeste, précache de l'app shell, fallback hors ligne |
| Garmin | **Import de fichier JSON** produit par un script local | C1 + C2 ; le script réutilise `R/course_utils.R` de la v1 |
| Hébergement | **GitHub Pages** (ou Cloudflare Pages), HTTPS, gratuit | Statique, aucun secret, déploiement par GitHub Actions |
| Sauvegarde | Export/import JSON complet + fusion | C3, et transfert manuel entre téléphone et PC |
| Tests | **Vitest** (domaine) + **Playwright** (parcours, viewport mobile, mode hors ligne) | Le domaine (volumes, moyennes pondérées, zones) est testable sans UI |
| Langue | Interface et code documentés en français | Cohérence avec la v1 |

## 8. Parité fonctionnelle v1 → v2

### Musculation
| v1 | v2 |
|----|----|
| Sélecteur de mouvement (recherche) | Sélecteur avec recherche + derniers mouvements utilisés en tête |
| Ajout / modification / suppression de série | Idem, en 1 écran, sans modale pour l'ajout |
| Date, poids, reps, nombre de séries | Idem, avec préremplissage de la dernière séance du mouvement |
| 4 KPI : séries, poids max, volume, progression | Idem |
| Filtres période + répétitions | Idem |
| Graphique Highcharts interactif | ECharts (zoom, tooltip, export image) |
| Historique + export CSV | Idem |
| Confirmation de suppression | Idem |

### Course
| v1 | v2 |
|----|----|
| Synchronisation Garmin dans l'app | Import d'un fichier `garmin-courses.json` (script local) |
| Cache local SQLite | Table `runs` dans IndexedDB, `garminId` unique (upsert) |
| Vue d'ensemble, Cœur & intensité, Allure & volume, Charge & récupération, Historique | Idem, mêmes métriques et mêmes définitions |
| Filtre de période commun | Idem |
| Export CSV | Idem |

### Gestion
| v1 | v2 |
|----|----|
| Créer / renommer / supprimer un mouvement (doublons refusés, casse et accents) | Idem |
| Corriger / supprimer une séance | Idem |
| Synthèse par mouvement | Idem |

### Nouveau en v2
- Écran **Réglages** : thème, sauvegarde/restauration, import Garmin,
  à propos, réinitialisation.
- **Écran d'accueil « Aujourd'hui »** : dernière séance, suggestion de
  mouvement, accès direct à la saisie (le geste le plus fréquent).
- Migration depuis la v1 par fichier JSON.

## 9. Modèle de données (IndexedDB)

```ts
// db v1
movements: { id: string; name: string; nameKey: string; createdAt: string }
sets:      { id: string; movementId: string; date: string; /* YYYY-MM-DD */
             weight: number; reps: number; setCount: number; updatedAt: string }
runs:      { garminId: number; name; date; type; distanceM; durationS;
             elapsedS; elevationGainM; elevationLossM; avgHr; maxHr;
             hrZone1..5; calories; avgSpeed; maxSpeed; avgCadence; maxCadence;
             strideCm; bodyBattery; moderateIntensityMin; vigorousIntensityMin;
             steps; best1kS; source; importedAt }
settings:  { key: string; value: unknown }   // thème, dernier mouvement, etc.
meta:      { key: string; value: unknown }   // schemaVersion, lastBackupAt
```

Règles conservées de la v1 :
- `nameKey` = minuscules + accents repliés + espaces normalisés, unicité.
- Volume = `weight × reps × setCount`.
- Suppression d'un mouvement = suppression en cascade de ses séries, avec
  confirmation chiffrée.
- Allure calculée à la lecture (`durationS / km`), jamais stockée.
- FC moyenne de période pondérée par la durée ; zones = somme des 5 zones.
- `garminId` unique : un réimport met à jour, ne duplique pas.

Index : `sets.movementId`, `sets.date`, `runs.date`, `movements.nameKey`.

## 10. Hors ligne, appareils et sauvegarde

- **Hors ligne total** : l'app shell est précachée ; toutes les écritures vont
  dans IndexedDB ; aucune requête réseau n'est nécessaire après installation.
- **Deux appareils, deux bases** : téléphone = capture, PC = analyse/archive.
  Transfert par **export/import JSON** (fichier partagé via le cloud de
  l'utilisateur). L'import propose deux modes : *remplacer* ou *fusionner*
  (clé = `id` + `updatedAt`, la version la plus récente gagne).
- **Rappel de sauvegarde** : bandeau discret si `lastBackupAt` > 30 jours.
- **Évolution possible, hors périmètre** : synchronisation optionnelle via un
  Worker Cloudflare + D1, ou dossier Nextcloud. Décision reportée après usage
  réel ; le modèle de données (ids stables, `updatedAt`) la rend possible.

## 11. Écrans et navigation

Barre de navigation basse sur mobile (4 entrées), latérale sur bureau ≥ 900 px.

1. **Aujourd'hui** — dernière séance, volume de la semaine, bouton « Nouvelle
   série », rappel de sauvegarde.
2. **Musculation** — onglets internes *Saisie* / *Progression* : formulaire,
   KPI, courbe, historique, export CSV.
3. **Course** — sections de la v1 (vue d'ensemble, cœur, allure, charge,
   historique), import Garmin, filtre de période.
4. **Gestion** — mouvements, correction des séances, synthèse.
5. **Réglages** — accessible depuis l'en-tête : thème, sauvegarde, import,
   version.

## 12. Identité visuelle et Figma

- Reprise de la DA v1 : noir/blanc/rouge, glassmorphism sobre, Poppins.
- **Figma = source de vérité** : 5 écrans × 2 modes, bibliothèque de
  composants (carte KPI, champ, bouton primaire/danger, carte graphique,
  barre de navigation, feuille de saisie).
- Jetons Figma (variables, modes `light`/`dark`) exportés en
  `src/lib/design/tokens.css` ; aucun code hexadécimal en dur dans les
  composants.
- Icônes et lancement : master 1024×1024, `icon-192`, `icon-512`,
  `maskable-512` (zone de sécurité 80 %), `apple-touch-icon-180`,
  `favicon.ico`, écrans de démarrage iOS, `theme_color` et
  `background_color`. Génération par script (`sharp`) depuis un master
  fourni ; à défaut, agrandissement propre de `Pito.png` (200×200).
- Accessibilité : contraste AA, focus visible, `prefers-reduced-motion`,
  cibles ≥ 44 px, libellés ARIA sur les actions icône.

## 13. Tests

- **Domaine (Vitest)** : calcul des KPI, filtres, volumes, moyennes
  pondérées, zones, agrégation hebdomadaire, parsing et fusion d'import,
  migrations Dexie, unicité des mouvements.
- **Parcours (Playwright)** : ajout d'une série hors ligne (context offline),
  persistance après rechargement, installation/manifeste valide, import
  Garmin idempotent, export CSV, navigation clavier.
- **Non-régression visuelle** : captures Playwright en 390 px et 1280 px,
  jour et nuit (comparaison manuelle au départ, automatique ensuite).

## 14. Jalons

| Jalon | Contenu | Critère de sortie |
|-------|---------|-------------------|
| M0 | Dépôt `Appito-V2`, SvelteKit, CI, Pages, ROADMAP + DEVLOG | `npm run build` vert, déploiement automatique |
| M1 | Jetons de design, layout, navigation, thème jour/nuit | Écrans vides navigables, AA vérifié |
| M2 | Mouvements + séries : CRUD local, Dexie, tests | Parité Musculation (hors graphique) |
| M3 | KPI, courbe ECharts, historique, export CSV | Parité Musculation complète |
| M4 | PWA : manifeste, service worker, icônes, hors ligne | Installation réelle Android + iOS + bureau |
| M5 | Import Garmin (script R + écran d'import), page Course | Parité Course |
| M6 | Gestion, Aujourd'hui, Réglages, sauvegarde/restauration | Parité v1 + nouveaux écrans |
| M7 | Migration v1 → v2 (export JSON), polissage, doc | Données v1 utilisables dans v2 |

Ordre imposé par le risque : M4 (installabilité) arrive avant M5, parce que
c'est la promesse centrale et qu'un problème d'installation découvert après
la page Course coûterait plus cher.

## 15. Suivi de projet (demande explicite)

- `README.md` : quoi, comment lancer, comment installer sur son téléphone.
- `docs/ROADMAP.md` : jalons ci-dessus en cases à cocher, avec état daté.
- `docs/DEVLOG.md` : une entrée par session — ce qui a été fait, ce qui a
  cassé, ce qui reste. Pas de narration, des faits et des décisions.
- Commits conventionnels (`feat:`, `fix:`, `docs:`…), un jalon = une branche
  courte, fusion dans `dev`, `main` = version déployée.
- Chaque fin de session : `docs/DEVLOG.md` mis à jour + ROADMAP ajustée.

## 15 bis. Décisions prises après relecture (2026-11-24)

| Question | Décision | Conséquence |
|----------|----------|-------------|
| Qui écrit quoi ? | **Les deux appareils peuvent écrire** (le PC sert aussi à corriger une séance et à gérer les mouvements) | `updatedAt` sur **toutes** les tables et **suppressions logiques** (`deletedAt`) dès le schéma v1 ; la fusion arbitre par date, tombstones comprises. Coût : ~30 lignes, évite une migration douloureuse |
| Conflit de noms à la fusion | Deux mouvements actifs de même `nameKey` → on garde le plus ancien, l'autre est marqué supprimé, ses séries sont réaffectées | La fusion ne casse jamais l'unicité ; l'index unique est applicatif, pas SQL (un tombstone ne doit pas bloquer une recréation) |
| Fichier Figma | **Il n'existe pas encore.** M1 part des jetons de la v1 (`styles.css`, ~45 variables, modes jour/nuit), déjà repris dans `src/lib/design/tokens.css` | O6 devient « Figma rattrape les jetons existants », pas « Figma précède tout ». Aucun hex en dur : le remplacement sera mécanique |
| Hébergement | Le dépôt `Appito_V2` a été créé **public** → **GitHub Pages gratuit** | M0 tient sans changer le plan ; l'app est publique mais ne contient aucune donnée |
| Données v1 | La base locale contient 106 courses, 8 mouvements, **0 série** | M7 se réduit à un import idempotent du cache de courses ; le script d'export Garmin devient l'outil central |
| Appareils de test | Android + bureau testés ; **iOS non testé sur appareil** | M4 s'arrête à « installable, iOS vérifié en théorie » tant qu'aucun iPhone n'est disponible |

Le point 4 de la relecture (0 série en base) retire la migration de musculation
du chemin critique : l'import v1 sera donc **rejouable et idempotent**, pas un
script ponctuel.

## 16. Ce qui reste au constructeur

- Choix exact des composants Figma et du master d'icône (fourni par
  l'utilisateur ou agrandi depuis `Pito.png`).
- Découpage interne des composants Svelte et nommage des fichiers.
- Bibliothèque de dates (native `Intl` d'abord), de formulaires et de
  validation — préférence pour zéro dépendance quand c'est raisonnable.
- Détail du script d'export Garmin (réutilisation directe de
  `R/course_utils.R`, sortie JSON versionnée).
- Politique de sauvegarde automatique locale (fréquence, rotation).
