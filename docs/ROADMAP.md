# Feuille de route — Appito V2

État au **2026-11-26**. Un jalon est clos quand son critère de sortie est
vérifié, pas quand le code est écrit.

## M0 — Socle du dépôt ✅

- [x] Dépôt `Martin-pito/Appito_V2`, branche `main`
- [x] SvelteKit 3 + TypeScript + adapter-static
- [x] Vérification des types (`npm run check`)
- [x] Tests du domaine (`npm test`)
- [x] Déploiement GitHub Pages par workflow
- [x] `README`, `ROADMAP`, `DEVLOG`, `AGENTS.md`

**Critère de sortie** : build vert et site accessible en HTTPS. *(atteint dès
le premier déploiement)*

## M1 — Design et navigation ✅

- [x] Jetons de design (couleurs, espaces, rayons, typo) en variables CSS
- [x] Modes jour / nuit / auto, sans flash au chargement
- [x] Navigation basse sur mobile, latérale sur bureau
- [x] Coquille d'application (en-tête, contenu, toasts)
- [x] Accessibilité de base : focus visible, cibles ≥ 44 px, `aria-current`

**Critère de sortie** : cinq écrans navigables, thème persistant. *Atteint.*

## M2 — Mouvements et séries ✅

- [x] Schéma IndexedDB versionné (Dexie)
- [x] `updatedAt` + suppressions logiques dès la v1 du schéma
- [x] Huit mouvements par défaut, unicité casse/accents
- [x] CRUD des séries, préremplissage depuis la dernière séance
- [x] Suppression en deux temps (pas de perte accidentelle)
- [x] Tests du domaine (normalisation, volume, filtres, progression)

**Critère de sortie** : saisir, relire et supprimer une série, y compris après
rechargement. *Atteint.*

## M3 — Analyse musculation 🟡

- [x] KPI : séries, poids max, volume, progression vs période précédente
- [x] Filtres période et répétitions
- [x] Historique et export CSV
- [ ] Graphique ECharts (courbe poids/volume, zoom, tooltip)
- [ ] Test de non-régression visuelle

**Critère de sortie** : parité v1 de la page Musculation, graphique compris.

## M4 — PWA installable 🟡

- [x] Manifeste (nom, icônes, `standalone`, raccourcis)
- [x] Icônes 192/512/maskable/Apple + écrans de démarrage
- [x] Service worker précachant l'app (`$app/manifest`)
- [ ] Installation vérifiée sur Android
- [ ] Installation vérifiée sur ordinateur
- [ ] Comportement hors ligne vérifié après redémarrage

**Critère de sortie** : installation réelle et saisie hors ligne. *iOS non
testé sur appareil.*

## M5 — Course et Garmin en direct 🟡

- [x] Mapping Garmin → `Run` (28 champs, replis de la v1, valeurs absentes en
      `null`)
- [x] Synchro idempotente : `updatedAt` intact sans changement réel
- [x] Le service worker ne met jamais `/api/*` en cache
- [x] Relais Cloudflare `GET /api/garmin/activities` : jeton applicatif, jeton
      Garmin en mémoire, pagination 100, erreurs stables
- [x] Interface Course (jeton, bouton, états) et Réglages (gestion du jeton)
- [x] 12 tests de mapping + 12 tests de synchro + 9 tests de relais
- [ ] Projet Cloudflare créé, deux secrets posés
- [ ] Sonde de bout en bout : Garmin répond depuis Cloudflare
- [ ] 106 courses synchronisées, métriques identiques à la v1
- [ ] Sections cœur & intensité, allure & volume, charge & récupération
- [ ] Export CSV des courses

**Critère de sortie** : 106 courses sans doublon, chiffres identiques à la v1,
sur l'URL déployée.

## M8 — Dépôt privé et hébergement ⬜

- [x] Relais sans secret dans le bundle (vérifié : `build/` ne contient ni
      `GCDC_` ni le jeton)
- [x] Workflow `ci.yml` (check + tests)
- [ ] Export depuis l'ancienne origine, import sur `pages.dev`
- [ ] Dépôt passé en privé
- [ ] GitHub Pages supprimé, `deploy.yml` retiré

**Critère de sortie** : dépôt privé, aucune URL morte, données intactes.

## M6 — Gestion, Aujourd'hui, Réglages 🟡

- [x] Gestion des mouvements (créer, renommer, supprimer)
- [x] Écran Aujourd'hui (dernière séance, volume 7 j, rappel de sauvegarde)
- [x] Réglages (thème, sauvegarde, restauration, effacement)
- [ ] Correction détaillée d'une séance (date, poids, reps, séries)
- [ ] Synthèse par mouvement avec mini-tendance

**Critère de sortie** : parité v1 de Gestion, plus les nouveaux écrans.

## M7 — Migration v1 et finitions ⬜

- [ ] Export JSON depuis la base v1 (script R ou Python)
- [ ] Import idempotent dans v2
- [ ] Vérification : 0 série perdue, 106 courses intactes
- [ ] Documentation d'installation définitive
- [ ] Revue d'accessibilité (contrastes, clavier, lecteur d'écran)

**Critère de sortie** : données v1 utilisables dans v2 sans ressaisie.

## Après

- Sauvegarde automatique locale (rotation)
- Synchronisation optionnelle entre appareils (hors périmètre actuel)
- Publication sur les stores via Capacitor, si le besoin apparaît
