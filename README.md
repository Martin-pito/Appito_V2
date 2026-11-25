# Appito V2

Application de suivi de la charge d'entraînement : séries de musculation et
courses à pied, dans une seule application installable sur téléphone et
ordinateur, **utilisable hors ligne**.

> V2 du projet [Appito](https://github.com/Martin-pito/Appito) (v1 en R/Shiny).
> Conception : [`docs/superpowers/specs/2026-11-24-appito-v2-design.md`](docs/superpowers/specs/2026-11-24-appito-v2-design.md).

## Ce que fait l'application

- **Musculation** : saisie rapide d'une série (mouvement, date, poids,
  répétitions, nombre de séries), préremplissage depuis la dernière séance,
  KPI (séries, poids max, volume, progression), historique, export CSV.
- **Course** : activités Garmin, allure, zones de FC, volume, body battery —
  alimentées par un fichier importé (jalon M5).
- **Gestion** : création, renommage et suppression des mouvements, avec
  suppression en cascade confirmée.
- **Réglages** : thème jour/nuit/auto, sauvegarde et restauration JSON,
  effacement local.
- **Hors ligne** : toutes les données restent dans le navigateur (IndexedDB),
  aucun serveur, aucune donnée envoyée.

## Stack

| Élément | Choix |
|---------|-------|
| Framework | SvelteKit 3 + Svelte 5 (runes) + TypeScript |
| Style | CSS custom properties, jetons Figma dans `src/lib/design/tokens.css` |
| Données | IndexedDB via Dexie, avec `updatedAt` et suppressions logiques |
| PWA | Manifeste + service worker précachant l'application (`$app/manifest`) |
| Tests | Vitest (domaine pur) |
| Hébergement | GitHub Pages (statique, HTTPS) |

## Développement

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # types Svelte + service worker
npm test           # tests du domaine
npm run build      # site statique dans build/
npm run icons      # régénère les icônes depuis static/brand/pito-source.png
```

Pour reproduire l'URL de production en local :

```bash
BASE_PATH=/Appito_V2 npm run build && npm run preview
```

## Installation sur les appareils

**Android (Chrome)** : ouvrir l'URL → menu ⋮ → « Installer l'application ».
**iOS (Safari)** : bouton Partager → « Sur l'écran d'accueil ».
**Ordinateur (Chrome/Edge)** : icône d'installation dans la barre d'adresse.

## Données et confidentialité

La base locale n'est jamais versionnée. Aucune donnée d'entraînement ne doit
entrer dans le dépôt : `.gitignore` exclut les exports et les fichiers de base.
Le fichier de sauvegarde est produit et lu uniquement par l'utilisateur.

## Suivi

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — jalons et état d'avancement.
- [`docs/DEVLOG.md`](docs/DEVLOG.md) — journal des sessions, décisions, échecs.
