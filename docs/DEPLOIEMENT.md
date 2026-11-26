# Déploiement — Cloudflare Pages et relais Garmin

À faire une fois, dans un navigateur, avec le compte GitHub `Martin-pito` et un
compte Cloudflare gratuit. Compter dix minutes.

## 1. Créer le projet Pages

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**.
2. Autoriser l'application GitHub de Cloudflare et lui donner accès au dépôt
   `Martin-pito/Appito_V2` (public ou privé, peu importe à ce stade).
3. Sélectionner `Appito_V2` → **Begin setup**.
4. Renseigner :

   | Champ | Valeur |
   |---|---|
   | Project name | `appito-v2` → URL `https://appito-v2.pages.dev` |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `npm run build` |
   | Build output directory | `build` |
   | Variable d'environnement | `NODE_VERSION` = `22` |

   Si `appito-v2` est déjà pris, choisir `appito` et noter l'URL obtenue.

5. **Save and Deploy**. Le premier build prend une à deux minutes.

## 2. Ajouter les deux secrets

Projet → **Settings** → **Variables and Secrets** → **Add** :

| Nom | Type | Valeur |
|---|---|---|
| `GARMIN_PERSONAL_API_KEY` | Secret | la clé `GCDC_…` de `Appito/secrets/Garmin connect.txt` |
| `APPITO_SYNC_TOKEN` | Secret | le jeton de synchronisation fourni avec ce guide |

Les secrets ne sont jamais dans le dépôt et ne partent pas dans le bundle
JavaScript. Les Pages Functions les lisent à l'exécution : pas besoin de
reconstruire, mais un **Retry deployment** ne fait pas de mal.

## 3. Vérifier le relais

Sans jeton, la fonction doit refuser :

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://appito-v2.pages.dev/api/garmin/activities
# attendu : 401
```

Avec le jeton, Garmin doit répondre depuis Cloudflare :

```bash
curl -s -H "Authorization: Bearer <APPITO_SYNC_TOKEN>" \
  https://appito-v2.pages.dev/api/garmin/activities \
  | head -c 300
# attendu : {"fetchedAt":"…","activities":[{"activityId":…}]}
```

C'est le point de non-retour : si la clé est refusée depuis une IP
d'hébergeur (`{"error":"garmin_auth"}`), s'arrêter ici et ne pas passer le
dépôt en privé.

## 4. Basculer l'application

Dans cet ordre, pour ne rien perdre :

1. Ouvrir l'ancienne adresse, **Réglages → Exporter** la sauvegarde JSON.
2. Ouvrir `https://appito-v2.pages.dev`, **Réglages → Importer** ce fichier,
   vérifier le nombre de séries et de courses.
3. Dans **Course**, saisir `APPITO_SYNC_TOKEN` quand il est demandé, puis
   **Synchroniser**. Vérifier que les courses Garmin arrivent.
4. Désinstaller l'ancienne PWA des appareils (elle survivrait dans son cache
   avec des données divergentes), puis installer la nouvelle depuis son URL.
5. Passer le dépôt en privé :

   ```bash
   gh api --method PATCH repos/Martin-pito/Appito_V2 -F private=true
   ```

6. Supprimer GitHub Pages et son workflow :

   ```bash
   gh api --method DELETE repos/Martin-pito/Appito_V2/pages
   git rm .github/workflows/deploy.yml
   git commit -m "chore: hébergement Cloudflare, dépôt privé"
   ```

7. Mettre à jour l'URL dans `README.md`, `docs/ROADMAP.md`, `docs/DEVLOG.md`
   et `AGENTS.md`.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| `500 config_missing` | un des deux secrets manque ou est vide |
| `502 garmin_auth` | clé Garmin expirée, révoquée, ou refusée depuis l'hébergeur |
| `502 garmin_rate` | trop d'appels Garmin ; attendre quelques minutes |
| `401` avec le jeton saisi dans l'app | jeton différent entre Cloudflare et l'appareil |
| la synchro réussit mais 0 course | aucune activité des types course dans le compte Garmin |

## Coût

Pages : statique illimité, 100 000 requêtes de Function par jour en offre
gratuite. L'usage réel est de quelques requêtes par synchronisation.
