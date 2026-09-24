# Passe 5 — Stratégie de test

> Traduction française de [`../05-testing.md`](../05-testing.md). En cas d'écart, la version anglaise fait foi pour les extraits de code.

Base `origin/main` @ `9c824eb`, app **v1.27.3**. Le skill `engineering:testing-strategy` n'est pas installé : j'ai donc appliqué à la main la checklist du handoff. Aucun test n'a été écrit, conformément aux instructions. `tests.html` a été **exécuté en local** (détails au §1).

## 1. Suite actuelle : recomptage et exécution locale

**Recomptage.** Le handoff indique « 54 cas au 16 septembre ». Ce chiffre est obsolète. La PR [stemdiv/Reel-Manager#1](https://github.com/stemdiv/Reel-Manager/pull/1) annonçait déjà 281, et le recomptage le confirme :
- **28 suites / 281 cas**, d'après le tableau `SUITES` de `tests.html:418`.
- Le lanceur se trouve à `tests.html:2983`. Il charge `youtube-playlist-manager.html` dans une iframe de même origine (`tests.html:66`) et appelle les globales de l'app sous la forme `w.<fn>`.

**Exécution locale, 24 sept. 2026, sur cette branche :**
- Serveur : `python3 -m http.server 8099 --bind 127.0.0.1` depuis la racine du dépôt, comme dans `.claude/launch.json`.
- Navigateur : Chromium headless via Playwright 1.56.1. **Toute requête vers un hôte autre que 127.0.0.1 a été interrompue** : aucun trafic de quota ni OAuth n'était donc possible.
- Pilote : un script jetable dans le scratchpad qui attend « ready », clique sur `#run` et lit `#summary` ainsi que chaque ligne `.case.fail`.

```
"summary": "281 passed · 0 failed",  "total": 281,  "groups": 28,  "fails": [],
"blockedCount": 4,  "blockedHosts": ["fonts.googleapis.com"],  "pageErrors": []
```

Les seules tentatives sortantes ont été 4 requêtes de feuilles de style de polices. Aucune requête vers `googleapis.com/youtube`, `oauth2` ou `accounts.google.com` n'a été émise : les stubs de la suite tiennent donc.

**Cas par suite :**

| Suite | Cas | Suite | Cas |
|---|---|---|---|
| #tags-auto | 5 | #B13 #B14 | 13 |
| #76 auto-cache | 10 | #68 Shorts | 14 |
| #G8 ghosts | 14 | #I3 like | 9 |
| #G9 bulk ghosts | 3 | batchGetStats | 14 |
| #G18 merge by id | 6 | #I2 subscribe | 10 |
| #G7 move | 6 | #G14 popup | 12 |
| #G10 CSV | 20 | #G11 IndexedDB | 11 |
| #G13 hash | 3 | #17 music | 23 |
| #G15 parseDuration | 9 | #17 #18 p2 | 14 |
| #G16 | 1 | #81 trending | 11 |
| #G17 | 1 | #82 discover entities | 16 |
| #G19 | 2 | #I1 covers | 14 |
| #76b buckets | 13 | #73 Discover filters | 11 |
| videoCategories | 6 | thumbnails | 9 |

(Un décompte statique avec `awk` trouve 280, car un cas est déclaré sur une ligne de forme différente ; le décompte à l'exécution fait foi.)

**Points forts.**
- Les cas de régression descendent jusqu'au vrai `fetch` ou au DOM là où c'est important (#B13/#B14, batchGetStats).
- Le stockage est sauvegardé puis restauré, IndexedDB compris (`tests.html:83-117`).
- La frontière de sécurité de #G14 est testée (12 cas sur `isValidOAuthMessage`).

## 2. Carte de couverture des comportements critiques

Un décompte statique des références à chaque nom de fonction dans `tests.html` (0 = jamais nommée) est un indicateur approché, pas une couverture de lignes. Il n'y a aucun outil de couverture, « non vérifié ».

| Zone | Couvert | **Non couvert (0 référence)** |
|---|---|---|
| Quota | `getQuotaCost` (22), `chargeQuota` (5), `checkQuotaBudget` (4), `loadQuotaState` (3), `checkQuotaDailyReset` (2), `estimateQuotaCost` (2 : uniquement `subscribe`, `tests.html:1795`) | Cas limites de `readQuotaState` ; `estimateQuotaCost` pour les 6 clés manquantes (AUD-15) ; pré-vol du bucket upload ; coût de la restauration |
| Transport `ytApi` | Mapping 403/401, garde sans jeton (#B13/#B14), repli de batchGetStats | `fetchAllPages` (plafond de pages, page partielle, AUD-13) ; `computeBackoffDelay`, `parseRetryAfter`, `isRetryableStatus` ; boucle de retry 429/5xx ; LRU de `cacheGet`/`cacheSet` ; `invalidateCacheForWrite` ; cache par ETag (AUD-17) |
| Écritures | `performMove` (3), `performMerge` (3), `removeGhostVideo` (3) avec des éléments au format de l'API | **Éléments reconstruits depuis le cache (sans `id`) → AUD-14 est invisible** : le jeu de données de test (fixture) du déplacement injecte `{ id: 'ITEM_A', … }` (`tests.html:198`). Exclusion des favoris dans `cleanAllGhosts` ; `removeDuplicateFromPlaylist` ; réordonnancement par `onVideoDrop` ; `executeRestore` ; interruption du déplacement en cours de route (AUD-16) |
| Migration d'état | `quotaUnits` → buckets (`tests.html:170-171`), ancien `autoCache` → IDB (#G11), `shouldSkipAutoSave` (9) | `loadBackupFromStorage` (0) ; cache à l'ancien format sans miniatures ; clé obsolète `reelMusicMode` (AUD-32) |
| Import/export de sauvegarde | Garde CSV via `csvRow` (20), `csvUnescapeCell` (7) | `createBackup` (0), `parseJSONForRestore` (0), `parseCSVForRestore`/`parseCSVLine` (0), `importBackupFromLoginScreen` (0), rejet par schéma (AUD-06), titres `__proto__` (AUD-12), aller-retour export JSON → import |
| Analyse d'URL | — | `extractPlaylistId` (0), deep link `?bookmark=` (0), `addBookmark` (0) |
| Score musique | `parseArtistTitle` (10), `playlistMusicVerdict` (6), `musicScore` (3), `classifyVideoType` (1) | Bornes des seuils (0,7 / 0,8 / 0,5 exactement), pénalité des formats longs, accord entre les deux classifieurs (AUD-25) |
| Sécurité | `isValidOAuthMessage` (11), nettoyage du hash par `checkAuth` (2) | `escapeHtml`/`escapeJsAttr` (0) ; XSS au niveau des puits (AUD-04/05) ; `_logRedact` (0) ; couverture des clés par `deleteAllUserData`/`checkAutoPurge` (0, AUD-03) ; chronologie du jeton dans le hash dans `init()` (réouverture de #G13) |
| CGU / lecteur | lecteur ancré (#17 p2), #B12 « non vérifié » | Reel Studio n'a **aucun harnais de test** (AUD-28) |

## 3. Cas à ajouter (nom · entrée · résultat attendu), non écrits

La priorité suit le handoff : quota, écritures, migration d'état, import/export de sauvegarde, analyse d'URL, score musique. Ensuite la sécurité, puis les régressions ouvertes par cet audit. Chaque ligne est rédigée de façon à pouvoir être collée comme cas de test `tests.html` avec un `ytApi`/`fetch` simulé (stub).

### 3.1 Quota
| # | Nom | Entrée | Résultat attendu |
|---|---|---|---|
| Q1 | chaque clé de pré-vol a un coût | chaque chaîne `action` passée à `checkQuotaBudget(...)` dans l'app (`video_update`, `thumbnail_set`, `caption_insert`, `channel_update`, `video_insert`, `reorder_video`, `cover_set`, …) | `estimateQuotaCost(key, 1)` ≠ repli à 1 ; égal à l'entrée de `YT_QUOTA_COSTS` (50 / 400 / 1) |
| Q2 | l'upload de vidéo fait le pré-vol du bucket upload | `APP.quota = { pool: 0, search: 0, upload: 100, stats: 0 }`, appeler le chemin d'upload avec `confirm` simulé pour enregistrer l'appel | `confirm` appelé avec le texte `confirm_quota_exceed` ; aucun `fetch` |
| Q3 | l'upload de sous-titres près de la limite du pool est intercepté | `pool: 9_990`, pré-vol `caption_insert` | `checkQuotaBudget` demande confirmation, coût 400, reste 10 |
| Q4 | la restauration utilise le pré-vol | 2 playlists × 3 vidéos, `pool: 9_900` | `checkQuotaBudget` appelé avec un coût de 400 ; aucun chemin avec le littéral `50` |
| Q5 | ancienne clé et nouvel état présents ensemble | `quotaUnits='500'`, `quotaState='{"pool":10}'`, même jour Pacifique | `APP.quota.pool === 10` ; `quotaUnits` supprimée |
| Q6 | `quotaState` corrompu | `quotaState='{not json'` | tous les buckets à 0, aucune exception |
| Q7 | frontière du jour Pacifique | `Date` simulée à 2026-09-24T06:59:59Z contre 07:00:01Z (PDT) | `getPacificDateString()` renvoie `2026-09-23` puis `2026-09-24` ; le reset vide les 4 buckets |
| Q8 | le premier appel de la journée est un upload | `quotaResetDate` périmé, puis `chargeQuota('videos','POST')` via le chemin d'upload | le reset a lieu avant la facturation (upload = 1, pool = 0) |
| Q9 | la règle de facturation est uniforme | `ytApi` avec un `fetch` rejeté (réseau) et un upload avec `res.ok=false` | les deux sont facturés, ou aucun, selon la règle retenue (AUD-21) |

### 3.2 Transport et cache de `ytApi`
| # | Nom | Entrée | Résultat attendu |
|---|---|---|---|
| T1 | `fetchAllPages` va au-delà de 20 pages pour playlistItems | stub renvoyant `nextPageToken` pour 60 pages de 50 | 3 000 éléments renvoyés ; `complete: true` |
| T2 | la pagination partielle est signalée | la page 3 lève une erreur | le résultat est marqué incomplet, et l'auto-sauvegarde refuse d'écraser un cache plus complet |
| T3 | le 429 respecte `Retry-After` avec un plafond | première réponse 429 `Retry-After: 120`, puis 200 | un seul retry après un délai de 60 000 ms (sleep simulé), quota facturé une seule fois |
| T4 | backoff 5xx borné | 3× 503 puis 200 | 4 fetch ; délais ≤ 1 000/2 000/4 000 (borne supérieure du jitter) |
| T5 | le POST n'est pas rejoué aveuglément | POST `playlists` → 503 puis 200 | un seul POST, ou une vérification d'existence avant le retry (AUD-19) |
| T6 | le 403 rateLimitExceeded est rejouable | corps `errors[0].reason='rateLimitExceeded'` | rejoué comme un 429 ; pas de toast de reconnexion (AUD-20) |
| T7 | le cache fonctionne sans en-tête ETag | 200 avec le corps `{etag:'x', items:[…]}`, sans en-tête `ETag` | le second GET identique dans le TTL n'effectue aucun `fetch` (AUD-17) |
| T8 | éviction LRU | 501 GET distincts mis en cache | `API_CACHE.size === 500`, la clé la plus ancienne évincée |
| T9 | invalidation à l'écriture | `playlists?…` et `playlistItems?playlistId=P` en cache, puis POST `playlistItems` pour P | les deux entrées vidées ; un `videos?id=Z` sans rapport conservé |

### 3.3 Écritures et actions groupées
| # | Nom | Entrée | Résultat attendu |
|---|---|---|---|
| W1 | **déplacement après un démarrage depuis le cache** | alimenter via `loadBackupFromStorage()` à partir de `SAMPLE_CACHE()` (sans ids d'éléments), puis `performMove` | POST + DELETE émis (id d'élément récupéré ou playlist chargée de force) ; rien n'est signalé « bloqué » (AUD-14) |
| W2 | réordonnancement après un démarrage depuis le cache | même alimentation, `onVideoDrop` | PUT `playlistItems` avec un vrai id, et non `'Missing item data'` |
| W3 | le déplacement s'interrompt proprement | la 2ᵉ de 3 insertions lève une erreur | la 1ʳᵉ est entièrement déplacée ; caches de la source et de la destination évincés ; le toast indique 1 déplacée / 2 non (AUD-16) |
| W4 | le nettoyage groupé des fantômes ignore les favoris | `APP.allVideos` contient un fantôme dans une playlist possédée et un dans une playlist mise en favori | exactement 1 DELETE ; estimation = 50 (AUD-24) |
| W5 | revérification du fantôme avant suppression | un candidat est disponible d'après un stub `videos.list` en direct | non supprimé |
| W6 | suppression des doublons | 2 occurrences dans plusieurs playlists | 1 DELETE avec le bon id d'élément ; cache mis à jour |
| W7 | la fusion charge les sources non chargées | une source avec `APP.allVideos[id] === undefined` | `loadPlaylistVideos(id)` appelé avant l'insertion (AUD-23) |
| W8 | la fusion dédoublonne | le même videoId dans 2 sources | 1 insertion |
| W9 | le mode lecture seule bloque tous les chemins d'écriture | `readOnlyMode=true`, appeler déplacer/fusionner/restaurer/uploader | 0 `fetch` ; erreur localisée |

### 3.4 Migration d'état et démarrage
| # | Nom | Entrée | Résultat attendu |
|---|---|---|---|
| M1 | l'aller-retour par le cache préserve les ids d'éléments | `autoSaveCache()` puis `loadBackupFromStorage()` | chaque `APP.allVideos[pl][i].id` est égal à l'id playlistItem d'origine |
| M2 | l'aller-retour par le cache préserve l'état fantôme | un élément privé (`status.privacyStatus='private'`, sans miniatures) | toujours `ghostStatus === 'private'` après rechargement |
| M3 | ancien cache sans miniatures, avec un jeton | `SAMPLE_CACHE` sans les miniatures, jeton défini | un rafraîchissement complet est déclenché une fois |
| M4 | `reelMusicMode` obsolète | `reelMusicMode='1'` dans le stockage, `resetVideoFilters()` | `filterType.value === 'all'` ; clé supprimée (AUD-32) |
| M5 | IDB indisponible | `indexedDB.open` lève une erreur | le repli localStorage est utilisé, l'app démarre, `cacheStore` indique le backend |

### 3.5 Import / export de sauvegarde
| # | Nom | Entrée | Résultat attendu |
|---|---|---|---|
| B1 | aller-retour export JSON → import | sortie de `createBackup()` passée à `parseJSONForRestore()` | mêmes playlists, titres, videoIds, tags, dossiers |
| B2 | le schéma rejette les champs hostiles | `playlistObjects[0].id = "x');alert(1);//"`, `folders[0].name = '<img src=x onerror=…>'` | import refusé, ou valeurs assainies ; rien n'est rendu sans échappement (AUD-06) |
| B3 | titre `__proto__` dans un CSV | ligne CSV avec la playlist `__proto__` | analysée comme une playlist normale (à base de Map) ; aucune exception (AUD-12) |
| B4 | saut de ligne entre guillemets dans un CSV | une cellule de titre `"line1\nline2"` | une vidéo, titre contenant un saut de ligne |
| B5 | aller-retour de la garde anti-formule CSV avec import | titres `=A1`, `'Round Midnight` | cellule exportée `'=A1` ; la réimportation donne `=A1` et `'Round Midnight` inchangés |
| B6 | les libellés de statut survivent à un changement de langue | export en EN puis restauration | les lignes supprimées sont toujours ignorées (`'Deleted'` et `'Supprimée'`) |
| B7 | l'import depuis l'écran de connexion refuse le non-JSON / le vide | fichier `.csv` ; `{playlists:[]}` | `toast_import_invalid` ; stockage intact |

### 3.6 Analyse d'URL
| # | Nom | Entrée | Résultat attendu |
|---|---|---|---|
| U1 | ids bruts | `PLabcdefghij`, `LLxxxxxxxxxx`, `RDxxxxxxxxxx` | renvoyés tels quels |
| U2 | URL complètes | `https://www.youtube.com/playlist?list=PL…`, `https://youtu.be/xyz?list=PL…&t=3`, `https://music.youtube.com/playlist?list=OLAK5…` | l'id |
| U3 | rejette les entrées invalides | `PL`, `javascript:alert(1)`, `list=<script>`, `https://evil/?list=PL"onx=` | `null` |
| U4 | le deep link n'ouvre que la modale | `?bookmark=PLabc…` au démarrage | `showAddBookmarkModal` appelé, aucun `ytApi` avant confirmation |
| U5 | le pré-remplissage du deep link est inerte | `?bookmark="><img src=x onerror=alert(1)>` | la valeur du champ est égale à la chaîne brute ; aucun élément injecté |

### 3.7 Score musique
| # | Nom | Entrée | Résultat attendu |
|---|---|---|---|
| S1 | borne du seuil par vidéo | categoryId `'10'` seul, 30 s | score 0,7 → musique (≥) |
| S2 | pénalité des formats longs | « X - Topic », 25 min | 0,9 − 0,5 = 0,4 → pas musique |
| S3 | bornes de durée d'un morceau | 119 s / 120 s / 420 s / 421 s avec uniquement le motif artiste-titre | 0,2 / 0,4 / 0,4 / 0,2 |
| S4 | bornes du verdict de playlist | 40/50 musique → 0,8 ; 25/50 → 0,5 ; 24/50 | `music` / `mixed` / `video` |
| S5 | la surcharge l'emporte sur la détection | verdict `music`, surcharge `video` | `effectiveViewMode === 'video'` |
| S6 | les classifieurs concordent | une vidéo « - Topic » sans categoryId ni topics | `classifyVideoType().isMusic === isMusicVideo()` (AUD-25) |

### 3.8 Sécurité et vie privée
| # | Nom | Entrée | Résultat attendu |
|---|---|---|---|
| X1 | `escapeJsAttr` ne casse aucune chaîne | `a\'b`, `a\\`, `"x"`, saut de ligne | la chaîne du gestionnaire s'évalue en l'entrée d'origine |
| X2 | gestionnaires des cartes Discover | un titre de résultat `x\');window.__pwn=1;//` rendu, puis la carte cliquée | `window.__pwn` indéfini ; `playVideo` reçoit exactement le titre (AUD-04) |
| X3 | attribut de la légende du tableau de bord | un titre de playlist `a" onmouseover="window.__pwn=1` | la valeur de l'attribut est égale au titre ; aucun attribut supplémentaire (AUD-05) |
| X4 | gestionnaire de tag de Reel Studio | tag `a';window.__pwn=1;'` | aucune exécution (AUD-07) ; nécessite un harnais Studio |
| X5 | « Supprimer mes données » efface toutes les clés de l'app | définir les 34 clés connues (32 app + 2 Studio) + un enregistrement IDB, lancer `deleteAllUserData` avec `confirm` simulé | `localStorage` ne contient plus aucune clé de l'app ; IDB vide (AUD-03) |
| X6 | l'auto-purge correspond à « Supprimer mes données » | `lastLoginTimestamp` il y a 31 jours | le même ensemble de clés effacé |
| X7 | `_logRedact` intercepte les jetons intégrés | `{ source: 'https://x/#access_token=ya29.abc&x=1' }`, `msg` contenant `Bearer ya29.x` | les deux rédigés |
| X8 | hash effacé avant tout await | espion sur `history.replaceState` et sur `cacheStore.migrateLegacy` | `replaceState` s'exécute en premier (#G13) |
| X9 | aller-retour de `state` (quand #G6 sera livré) | un hash sans `state`, ou avec un `state` erroné | jeton rejeté |

## 4. Recommandations structurelles

1. **Produire les jeux de données de test (fixtures) avec les propres fonctions d'écriture de l'app.** La suite #G7 construit les éléments à la main au format de l'API (`tests.html:198-199`) : elle ne peut donc pas voir ce que le cache perd (AUD-14). Alimenter via `autoSaveCache()` → `loadBackupFromStorage()` partout où une session démarrée depuis le cache est le cas réaliste.
2. **Exécuter la suite de tests en CI.** Le pilote Playwright utilisé au §1 fait environ 40 lignes : servir, bloquer tout hôte non local, cliquer, vérifier « 0 failed ». Le committer avec une GitHub Action aurait fait des 281 cas une condition de fusion. Actuellement, ils dépendent d'un clic manuel (`tests.html:58`).
3. **Ajouter un harnais pour Reel Studio.** Studio n'a aucun test et porte AUD-07 et AUD-28.
4. **L'extraction en modules purs (passe 4, rang 5)** permet d'exécuter les cas de quota, d'analyse, de musique et de CSV sous Node, sans navigateur, en quelques millisecondes.
5. **Couverture.** Lancer Chromium avec `page.coverage.startJSCoverage()` dans le même pilote pour remplacer l'indicateur statique du §2 par une vraie couverture de lignes.
