# Consignes projet — Appito V2

## Git

- `main` = version déployée. Cloudflare Pages construit chaque push
  (bascule depuis GitHub Pages en cours, voir `docs/DEPLOIEMENT.md`).
- Le travail en cours se fait sur une branche courte (`feat/…`, `fix/…`),
  fusionnée dans `main` quand `npm run check` et `npm test` passent.
- Commits conventionnels : `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
- Ne jamais committer de données d'entraînement : ni base, ni export JSON.

## Qualité

- `npm run check` (types Svelte + service worker) doit passer avant tout commit.
- `npm test` doit rester vert. Toute logique de calcul va dans
  `src/lib/domain/` et reçoit un test.
- Pas de couleur hexadécimale dans un composant : uniquement les variables de
  `src/lib/design/tokens.css`.

## Suivi

- À chaque fin de session : mettre à jour `docs/DEVLOG.md` (fait, décisions,
  échecs) et cocher `docs/ROADMAP.md`.
- Un jalon n'est clos que lorsque son critère de sortie est vérifié sur
  l'application déployée, pas quand le code est écrit.

## Produit

- Mobile d'abord : cibles ≥ 44 px, saisie à une main, pas de dépendance réseau.
- Toute suppression destructive est logique (tombstone) et confirmée dans l'UI.
- L'application parle à Garmin uniquement via le relais `/api/garmin/*`. La
  clé personnelle et `APPITO_SYNC_TOKEN` vivent dans les secrets Cloudflare,
  jamais dans le dépôt, jamais dans `build/`.
- Une synchronisation ne touche `updatedAt` que si un champ a changé : la
  fusion de sauvegarde arbitre par cette date.
