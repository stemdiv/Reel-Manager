# Passe 3 — Revue de code (ensemble du code, pas un diff)

> **État (24/09/2026) :** ce rapport décrit le code à `9c824eb` (app v1.27.3). Correctifs depuis, errata et nouveaux constats : [`08-remediation.md`](08-remediation.md).

> Traduction française de [`../03-code-review.md`](../03-code-review.md). En cas d'écart, la version anglaise fait foi pour les extraits de code.

Base `origin/main` @ `9c824eb`, app **v1.27.3**. Lecture seule ; aucun appel API. Le skill `engineering:code-review` n'est pas installé, j'ai donc appliqué à la main la checklist du handoff. Toute référence `:N` sans nom de fichier désigne `youtube-playlist-manager.html`. Sévérité : P1 sécurité / perte de données / CGU · P2 bug fonctionnel ou de quota · P3 maintenabilité / performance · P4 cosmétique.

## Synthèse

| ID | Sév. | Domaine | Constat |
|---|---|---|---|
| AUD-13 | **P1** | ytApi / sauvegarde | Les playlists de plus de 1 000 éléments sont tronquées sans rien dire, et l'échec d'une page ultérieure renvoie une liste partielle. La liste tronquée est auto-sauvegardée et exportée, ce qui met en échec le garde-fou de sauvegarde (#3). |
| AUD-28 | **P1** | CGU YouTube | Reel Studio : replier le lecteur fait glisser la vidéo hors écran pendant que l'audio continue, et la lecture en onglet masqué continue par conception |
| AUD-14 | **P2** | Cache / actions groupées | Les éléments reconstruits depuis le cache n'ont **pas d'`id` de playlistItem**. Déplacer copie à nouveau (la régression #G7), et réordonner, supprimer les doublons ou supprimer les fantômes échoue, jusqu'à un rafraîchissement complet manuel. |
| AUD-15 | **P2** | Quota | `estimateQuotaCost()` n'a pas d'entrée pour 6 clés d'action utilisées par les appelants, et se replie donc sur `count` (1 unité). Un upload de sous-titres passe le pré-vol à 1 unité au lieu de 400, et `videos.insert` est vérifié sur le pool au lieu du bucket upload. |
| AUD-16 | **P2** | Actions groupées | `performMove()` s'interrompt au premier insert en échec sans vider les caches ni indiquer combien d'éléments ont déjà été déplacés |
| AUD-17 | P2 (« non vérifié ») | Cache HTTP | Les réponses ne sont mises en cache que si l'**en-tête de réponse** `ETag` est lisible. En CORS, il peut ne pas être exposé, ce qui rendrait tout le cache à TTL inerte. |
| AUD-18 | P3 | ytApi | `If-Match` est du code mort : `cached` vaut toujours `null` pour PUT/DELETE |
| AUD-19 | P3 | ytApi | Les POST sont rejoués sur 5xx et erreurs réseau, donc `playlists.insert` / `playlistItems.insert` peuvent créer des doublons (accepté dans un commentaire, non atténué) |
| AUD-20 | P3 | ytApi | Un 403 `rateLimitExceeded` / `userRateLimitExceeded` est affiché comme « session expirée » avec une demande de reconnexion |
| AUD-21 | P3 | Quota | Les règles de facturation diffèrent : `ytApi` facture avant la requête (échecs inclus), les uploads directs seulement en cas de succès, et les uploads sautent la vérification du reset Pacifique |
| AUD-22 | P3 | Quota | Copies codées en dur des limites et des coûts : carte d'aide antérieure à #76, diagnostic « / 10,000 » avec seuils de couleur 500/100, restauration avec des littéraux `50` sans pré-vol de bucket |
| AUD-23 | P3 | Fusion | Les playlists non chargées apportent 0 vidéo sans rien dire, les doublons entre sources sont insérés deux fois, et l'estimation est fausse (compte un DELETE qui n'a jamais lieu, omet `playlists.insert`) |
| AUD-24 | P3 | Fantômes #G8/#G9 | La classification repose sur la présence d'une miniature, que le cache peut ne pas avoir. L'analyse et le nettoyage groupé incluent les playlists **mises en favori, non possédées** (403, quota facturé). Aucune revérification en direct avant la suppression groupée. |
| AUD-25 | P3 | Musique | Deux classifieurs musique indépendants qui peuvent diverger : `classifyVideoType()` (#J1/#J2) et `musicScore()` (#17) |
| AUD-26 | P4 | Shorts #68 | `h > w` manque les Shorts carrés |
| AUD-27 | P3 | i18n | ≥ 40 chaînes visibles contournent `t()` en plus de #80 ; les libellés de statut CSV sont uniquement en français ; 45 valeurs FR sont identiques à l'EN, plusieurs non traduites |
| AUD-29 | P4 | Lecteur | La barre `#miniPlayer` est une UI morte : elle n'est jamais que désactivée |
| AUD-30 | P3 | Service worker | Le CSS de police cross-origin dans le pré-cache peut faire échouer l'installation, et n'est de toute façon jamais servi ; la navigation hors ligne ignore `?bookmark=` ; `CACHE_NAME` est incrémenté à la main |
| AUD-31 | P4 | Cache | #81 tendances : le commentaire promet un TTL plus long qui n'existe pas |
| AUD-01 | P3 | Quota | (Passe 0) #82 parcours des playlists d'une chaîne jusqu'à 20 appels, sans pré-vol |
| #78, #80 | — | — | Items existants reconfirmés (garde de quota de l'auto-catégorisation ; chaînes de classification) |

---

## 1. `ytApi`

### AUD-13 — troncature silencieuse à 1 000 éléments, listes partielles en cas d'erreur (P1)
- `:7517` `async function fetchAllPages(endpoint, params = {}, itemsKey = 'items', maxPages = 20) {`
- `:7900` `videos = await fetchAllPages('playlistItems', params);` : pas de surcharge de `maxPages`.
- `:7548` `` console.warn(`[fetchAllPages] Hit page cap (${maxPages}) … `` est le seul signal, et il va dans la console.
- `:7541-7544` `if (pageCount === 0) throw err; console.error(...); break;` : un échec sur la page 2+ renvoie les pages déjà récupérées comme si la liste était complète.

Les playlists YouTube contiennent jusqu'à 5 000 éléments. Le tableau tronqué devient `APP.allVideos[id]` et se propage dans `autoSaveCache` (`:7712`), la sauvegarde manuelle (`:14445`), l'export CSV, la fusion, le déplacement, les doublons, les fantômes et le plan Watch. `shouldSkipAutoSave()` (`:7674`) ne protège que du cas vide. Un utilisateur dont les playlists sont grandes fait confiance à une sauvegarde à laquelle manque tout ce qui suit l'élément 1 000. Cette sauvegarde est le garde-fou des actions destructrices (backlog #3). **Correctif :** passer `maxPages: 100` (5 000 / 50) pour `playlistItems`, renvoyer `{ items, complete }` depuis `fetchAllPages`, refuser d'écraser le cache avec une liste incomplète, et signaler les playlists partielles dans l'UI. **Effort** M.

### AUD-17 — le cache dépend d'un en-tête `ETag` exposé en CORS (P2, « non vérifié »)
- `:7492-7494` `const etag = res.headers.get('ETag'); if (etag) { … cacheSet(cacheKey, {` ; rien n'est mis en cache sinon.

Dans un `fetch` cross-origin, seuls les en-têtes de la liste blanche CORS sont lisibles, sauf si le serveur en liste d'autres dans `Access-Control-Expose-Headers`. Je n'ai pas vérifié si `www.googleapis.com` expose `ETag`. Si ce n'est pas le cas, le chemin de réponse fraîche (`:7343`) ne se déclenche jamais et chaque TTL de `API_CACHE_CONFIG` est inerte. Cela coûterait silencieusement du quota partout, y compris pour le TTL agressif de 5 min de `search.GET` (#76). **Vérification :** une lecture dans les DevTools ; `API_CACHE.size` reste à 0. **Correctif :** se replier sur `responseBody.etag`, que l'API YouTube renvoie toujours dans le corps, et mettre en cache même sans etag lorsque TTL > 0. **Effort** S.

### AUD-18 — `If-Match` jamais envoyé (P3)
- `:7340` `const cached = method === 'GET' ? cacheGet(cacheKey) : null;`
- `:7371` `if ((method === 'PUT' || method === 'DELETE') && cached?.etag) {` : inatteignable. Même s'il ne l'était pas, la clé est l'URL d'écriture, pas l'URL GET de la ressource.

La branche 412 (`:7419-7422`) est morte aussi. **Correctif :** la supprimer, ou rechercher l'etag en cache de la ressource par id. **Effort** S.

### AUD-19 — rejeux non idempotents (P3)
Commentaire `:7387-7391` : `// Idempotency caveat: POST/PUT/DELETE retries could theoretically duplicate … Accepted risk`. Les erreurs réseau (`:7396-7407`) et les 5xx (`:7425-7446`) rejouent n'importe quelle méthode. Une réponse perdue sur `playlists.insert` crée deux playlists, que « nettoyer les fantômes » ne nettoie pas. **Correctif :** ne pas rejouer les POST sur erreur réseau ou 5xx. À la place, relister et vérifier si l'élément existe. **Effort** S.

### AUD-20 — 403 de limitation de débit signalé comme session expirée (P3)
`:7454-7468` : tout 403 qui n'est pas `quotaExceeded`/`accessNotConfigured` finit en `throw promptReconnect(new Error(t('error_session_expired')));`. L'API YouTube renvoie un **403** avec la raison `rateLimitExceeded` / `userRateLimitExceeded`, qui permet une nouvelle tentative ; l'utilisateur se voit donc demander de se reconnecter au lieu d'attendre. **Correctif :** traiter ces raisons comme un 429. **Effort** S.

### Correct
- 429 avec `Retry-After` plafonné à 60 s et backoff full-jitter (`:5393-5421`, `:7428-7432`).
- Quota facturé une fois par appel logique, pas par nouvelle tentative (`:7379-7383`).
- LRU plafonné à 500 entrées et 250 Ko (`:5434-5490`).
- Invalidation à l'écriture avec vidage inter-ressources `playlistItems → playlists`, `subscriptions → channels` (`:5495-5518`).
- `fetchAllPages` propage une erreur de première page (corrige le bug de bibliothèque vide de la v1.11.0).

## 2. Quota (#76)

**Conformité au modèle ✅.** `QUOTA_BUCKETS` / `QUOTA_LIMITS` (`:5232-5239`) correspondent à #76 (pool 10 000 unités ; search 100 appels ; upload 100 appels) plus le bucket `stats` pour `batchGetStats` (#83). `normalizeEndpoint()` (`:5253-5259`) gère `videos/rate` et `videos:batchGetStats`. Le reset Pacifique utilise `Intl` avec `America/Los_Angeles` (`:5291-5301`). Migration : `readQuotaState()` déplace l'ancien `quotaUnits` dans `pool` une seule fois et supprime la clé même un jour périmé (`:5362-5366`, `:5378`). Le pré-vol de recherche de Discover utilise le bucket search et refuse d'emblée lorsqu'il est vide (`:11788-11795`).

### AUD-15 — clés de pré-vol manquantes, mauvais bucket pour les uploads (P2)
`:6185` `return costs[action] || count;`. La table (`:6171-6184`) n'a pas d'entrée pour ces clés, pourtant utilisées par les appelants :

| Appelant | Clé passée | Coût réel | Estimé |
|---|---|---|---|
| `:9132` mise à jour de vidéo | `video_update` | 50 | 1 |
| `:9177` miniature | `thumbnail_set` | 50 | 1 |
| `:9254` upload de sous-titres | `caption_insert` (la table a `caption_upload`) | **400** | 1 |
| `:9319` mise à jour de chaîne | `channel_update` | 50 | 1 |
| `:9350` upload de vidéo | `video_insert`, bucket par défaut **pool** | 1 appel, bucket **upload** | 1 unité du pool |
| `:10761` réordonner | `reorder_video` | 50 | 1 |

Avec le pool à 9 990, un upload de sous-titres passe le pré-vol sans rien dire et dépasse de 390. Avec le bucket upload à 100/100, le pré-vol de l'upload vidéo passe quand même puisqu'il regarde le pool. **Correctif :** ajouter les clés, aligner `caption_insert`, passer `'upload'` à `:9350`, et faire lever une erreur pour une clé inconnue en développement. **Effort** S.

### AUD-21 — règles de facturation incohérentes (P3)
`ytApi` facture **avant** le `fetch` (`:7380`), donc les échecs et les erreurs réseau comptent aussi. Les uploads directs facturent **après** succès (`:9201`, `:9275`, `:9410`, `:10027`) et n'appellent jamais `checkQuotaDailyReset()` (seul `ytApi` le fait, `:7379`). Le premier upload d'une nouvelle journée Pacifique est donc ajouté aux compteurs de la veille puis effacé par l'appel `ytApi` suivant. CR4 demandait de « ne compter qu'en cas de succès HTTP ». Le commentaire du code soutient l'inverse (Google facture les requêtes invalides). Choisir une règle et l'appliquer partout. **Effort** S.

### AUD-22 — copies codées en dur des limites et des coûts (P3)
- `:2612` Carte d'aide, en anglais uniquement et antérieure à #76 : `YouTube API is limited to <strong …>10,000 units/day</strong>. Reads cost 1 unit, writes cost 50.`
- `:6509` diagnostic : `` ${quota} / 10,000 units `` avec les seuils `quota > 500 ? red : quota > 100 ? yellow`, donc 5 % du pool s'affiche en rouge.
- `:14722-14723` et `:14762` : coût de restauration `selected.length * 50 + totalVideos * 50`, un littéral 50, pas `YT_QUOTA_COSTS`. `executeRestore()` n'appelle **pas** `checkQuotaBudget()` ; il se contente de `confirm()` (`:14768`).

**Correctif :** tout dériver de `QUOTA_LIMITS` / `YT_QUOTA_COSTS` et faire passer la restauration par `checkQuotaBudget`. **Effort** S.

Également non protégés, à faible coût, P4 : `videos.rate` (`:8644`, 50), `subscriptions.insert` (`:14202`, 50 ; son estimation `subscribe` à `:6178` n'est utilisée par aucun appelant), `captions.list` (`:9218`, **50** unités par lecture), la suppression d'un doublon unique (`:12568`), la suppression d'un fantôme unique (`:12514`).

## 3. Actions groupées

### AUD-14 — les éléments reconstruits depuis le cache n'ont pas de `playlistItem.id` (P2, régression #G7 en pratique)
- La sérialisation abandonne l'id de l'élément. Auto-cache `:7712-7725` : `return { videoId, title: …, position: …, thumbnail: …, … addedAt: … };`. Sauvegarde manuelle `:14445-14456` : mêmes champs.
- Reconstruction `:5948-5963` : `APP.allVideos[pl.id] = pl.videos.map(v => ({ contentDetails: { videoId: …, duration: … }, snippet: { … } }))`, sans `id`.
- Le démarrage depuis le cache ne recharge jamais (`:7579-7582` « Cache-first: if backup exists … skip API calls »), et `loadPlaylistVideos()` renvoie tout tableau en cache non vide (`:7886-7889`).

Conséquences dans une session normale démarrée depuis le cache (le comportement par défaut depuis #F2) :
- **Déplacer** (`:12426-12450`) : l'insert réussit, puis `if (!sourceItem?.id) { stuck.push(videoId); continue; }`. Chaque élément est copié et non retiré, signalé comme « bloqué ». C'est le bug d'origine de #G7, avec un avertissement cette fois.
- **Réordonner** (`:10749-10756`) : `dataset.itemId` est vide, donc l'opération échoue avec `'Missing item data'`.
- **Suppression de doublons / de fantômes** (`:12514`, `:12568`) : `ytApi('playlistItems', { id: undefined }, 'DELETE')` échoue, **et 50 unités sont facturées** d'abord (AUD-21).

Cela ne refonctionne qu'après le bouton « Actualiser » du tableau de bord, qui recharge tout (`:7644`) ou une écriture qui évince cette playlist. La suite de régression injecte probablement des éléments au format de l'API ; vérifié en passe 5. **Correctif :** persister `itemId` dans les deux sérialiseurs et le reconstruire en `id`. S'il manque, forcer le chargement de la playlist avant toute écriture au niveau des éléments. **Effort** S.

### AUD-16 — Déplacer s'interrompt en cours de route sans nettoyage (P2)
Dans `performMove()`, l'insert (`:12434`) n'est pas dans un `try` par élément. Le premier échec (quota, 409, réseau) saute au `catch` externe (`:12466`), qui se contente d'un toast. `delete APP.allVideos[destId/sourceId]` (`:12456-12457`) et `loadAllPlaylists()` sont sautés, donc les deux vues affichent un contenu périmé et l'utilisateur ne sait pas combien d'éléments ont été déplacés. **Correctif :** try/catch par élément comme dans `performMerge`, avec éviction dans un `finally`. **Effort** S.

### AUD-23 — cas limites de la fusion (P3)
- `:12214` `const videos = APP.allVideos[sourceId] || [];` : une playlist sélectionnée jamais chargée (typiquement un favori) apporte 0. L'UI affiche bien `(0 vidéos)` (`:12145`), mais ne la charge pas.
- Il n'y a pas de dédoublonnage entre les sources.
- Estimation `:6173` `'merge': count * INSERT + DELETE, // … + 1 delete of source playlist` : aucune playlist n'est supprimée, et les 50 de `playlists.insert` lors de la création d'une destination (`:12198`) manquent.

**Effort** S.

### AUD-24 — fantômes (#G8/#G9) (P3)
- `:9793-9796` `const hasThumb = …; const hasVideoDate = !!item?.contentDetails?.videoPublishedAt; if (hasThumb || hasVideoDate) return 'available';`. Les éléments reconstruits depuis le cache n'ont jamais `videoPublishedAt` ni `status` (`:5948-5963`), donc la distinction « privée » / « supprimée » est perdue après un rechargement, et tout élément mis en cache sans miniature devient un « fantôme ». La suppression est actuellement bloquée par AUD-14 (pas d'id). Corriger AUD-14 seul rendrait ces faux positifs supprimables, donc les deux doivent être livrés ensemble, avec une revérification en direct des candidats par `videos.list` avant la suppression groupée.
- `:12487`, `:12537` : les deux boucles parcourent `Object.entries(APP.allVideos)`, **playlists mises en favori incluses**. L'utilisateur ne peut pas supprimer d'éléments de la playlist de quelqu'un d'autre : chaque tentative renvoie un 403 et est pré-facturée 50 unités.

Le O(n²) de #G9 est corrigé : mode silencieux, une seule nouvelle analyse (`:12547-12551`) ✅. #G7 est corrigé au niveau de l'API (`:12447` DELETE après insert) ✅, mais voir AUD-14.

## 4. Mode Musique vs spécification (voir passe 0, tableau D)
Le calcul du score et les seuils correspondent aux chiffres du handoff (`:10219-10228`).

### AUD-25 — deux classifieurs (P3)
`classifyVideoType()` (`:10356-10392`) pilote le filtre #J1 et la bascule « Mode Musique » de #J2. Il repose sur des mots-clés, des topics et des catégories, et ignore les chaînes « - Topic » et la durée. `musicScore()` (`:10236-10246`) pilote la vue Musique de #17 et le verdict de la playlist. La même vidéo peut être de la musique pour l'un et pas pour l'autre, p. ex. un upload « - Topic » sans `categoryId` ni détails de topic. **Correctif :** faire en sorte que `classifyVideoType` utilise `musicScore` plus sa propre liste d'exclusion. **Effort** M.

## 5. Shorts (#68)
✅ L'heuristique `h > w && d <= 180` (`:10114-10121`), `maxHeight: 8192` (`:7934`) et les playlists système `UUSH`/`UULF` (`:10137`) correspondent toutes au backlog.
- **AUD-26** (P4) : les Shorts carrés (`h === w`) sont classés comme standard.
- Repli HEAD : non livré et non faisable depuis le navigateur (passe 0).
- `_isShort` survit au cache (`:7721`, `:5974`) ✅.

## 6. i18n — AUD-27 (P3)
**Parité ✅**, d'après un script qui fait un `eval` de `I18N` dans Node :
- 688 clés FR et 688 clés EN, 0 manquante de chaque côté, 0 incohérence de paramètres d'interpolation.
- Sur 608 clés référencées statiquement, 1 est « manquante » (`discover_sort_label_`, un préfixe dynamique, faux positif). 81 clés n'ont aucune référence statique ; elles sont peut-être dynamiques, « non vérifié ».

**Chaînes hors `t()`**, en plus des huit listées dans #80 :
- Erreurs : `:7321` `'Accès en écriture requis — …'`, `:7421` `'Cette ressource a été modifiée ailleurs …'`, `:7445` `` `Server error (${res.status}) …` ``, `:7473` `` `Erreur API (${errCode})` ``, `:7509`, `:7406`, `:9387`, `:9403`, `:9405`, `:12084`, `:10756` `'Missing item data'`.
- Toasts : `:7601` `'Upgrading cache format — …'`, `:7769` `` `Cache FAILED: …` ``.
- Noms d'actions affichés dans `confirm()` via `checkBackupSafety`/`checkQuotaBudget` : FR `:10952`, `:10960`, `:11004`, `:11007`, `:12173`, `:12190`, `:12411`, `:12420`, `:12533`, `:12543`, `:14379`, `:14387` ; EN `:9131`, `:9132`, `:9176`, `:9177`, `:9253`, `:9254`, `:9287`, `:9318`, `:9319`, `:9349`, `:9350`.
- Gabarits : `:8027` `items`, `:8029` `largest:`, `:12145` `vidéos`, `:12617` `'Unknown'`, `:12638` `Apparaît dans … playlists`, `:12702` `'Sans catégorie'`, `:12199` `'Merged playlist'`, `:14306`, `:14313` `vidéos`, `:15011`, `:9398` `Mo`, carte d'aide `:2612`.
- Statut CSV `'Supprimée' / 'Privée' / 'Disponible'` (`:14531`, `:15116`). La restauration reconnaît `'Supprim'` ou `'Deleted'`, donc les libellés ne peuvent pas être simplement traduits sans garder ce parseur tolérant.

**Valeurs FR non traduites** (45 identiques à l'EN) : surtout des emprunts légitimes (Dashboard, Deck, Playlists), mais p. ex. `studio_upload_video: 'Upload video'`, `header_backup_tooltip: 'Backup'`, `beta_title: 'Feature Lab'`, `detail_duration_long: 'Long (> 20 min)'`.

**Effort** M.

## 7. Conformité aux CGU YouTube

| Règle | App (`youtube-playlist-manager.html`) | Reel Studio |
|---|---|---|
| Lecteur visible pendant la lecture (pas d'audio seul) | ✅ `minimizePlayer()` ancre le lecteur, ne le masque pas : `:8811-8813` « dock, do not hide … the embed must stay on screen », `.docked … padding-bottom: 180px` (`:440`) | ❌ **AUD-28**, voir ci-dessous |
| Pause quand la page est masquée (#B12) | ✅ `:8427-8428` | ❌ par conception : `reel-studio.html:1538-1540` met en pause sur `hidden` **seulement si** un onglet YouTube externe est actif |
| Attribution | ✅ « Powered by YouTube Data API v3 » (`:1369`, `:1578`) | « non vérifié » (aucune chaîne trouvée par grep) |
| Paramètres de l'IFrame API | `enablejsapi: 1, origin` (`:8437-8438`) ✅ ; `modestbranding` est obsolète (P4) | `origin: location.origin` (`reel-studio.html:1600`) ✅ |
| Suppression des données / confidentialité | 🟡 AUD-03 | Clés Studio non purgées (AUD-03) |

### AUD-28 — Reel Studio joue l'audio avec la vidéo masquée (P1, CGU)
- `reel-studio.html:255` `.player-sheet { … transform: translate(-50%, 110%); … }`, et `:258` `.player-sheet.open { transform: translate(-50%, 0); }` : la feuille repliée, qui contient l'iframe (`:489` `<div class="sheet-video"><div id="ytHost"></div></div>`), est déplacée entièrement hors écran.
- `reel-studio.html:1683` `const collapsePlayer = () => document.getElementById('playerSheet').classList.remove('open');` : la lecture n'est pas mise en pause. Une `player-bar` en bas avec miniature, précédent/lecture/suivant reste affichée (`:505-514`), ce qui permet une écoute audio seule avec des commandes de transport.
- `reel-studio.html:1538-1541` : un onglet en arrière-plan continue de jouer sauf si un onglet YouTube ouvert depuis Studio existe. Le backlog #B12 le consigne comme voulu (« it is a music UI, listening in the back… »).

Les politiques YouTube API Services exigent que le lecteur intégré soit visible et interdisent de séparer l'audio de la vidéo ainsi que la lecture en arrière-plan. Les numéros exacts des clauses n'ont pas été vérifiés par rapport au texte en vigueur (« non vérifié »), mais la ligne #17 du backlog dit elle-même « no audio-only — ToS ». **Correctif :** ancrer la feuille à ≥ 200×200 une fois repliée, comme le fait l'app principale, ou mettre en pause au repli. Mettre aussi en pause sur `visibilitychange` dans Studio. **Effort** S.

### AUD-29 — mini-lecteur mort (P4)
`#miniPlayer` (`:2745-2757`) ne subit jamais que `classList.remove('active')` (`:8806`, `:8816`, `:8834`) ; rien n'ajoute `active`. C'est du balisage et du CSS morts, restes d'avant le lecteur ancré (`:506-535`, `:571-580`).

## 8. Service worker — AUD-30 (P3)
- ✅ Le HTML est en network-first (`sw.js:44-57`), donc une nouvelle release est servie au prochain chargement en ligne. Comme le CSS et le JS de l'app sont **inline**, le risque de CSS/JS périmés soulevé par le handoff ne s'applique pas à l'app principale.
- `sw.js:12` pré-cache `https://fonts.googleapis.com/css2?...` via `cache.addAll` (`:19`). Si cette requête échoue à l'installation (hors ligne, bloquée, CSP du contexte du SW), **toute l'installation échoue**. Le gestionnaire fetch retourne aussi immédiatement pour tout hôte `googleapis.com` (`:39-43`), donc la copie en cache n'est jamais servie.
- `sw.js:56` `.catch(() => caches.match(event.request))` : pas d'`ignoreSearch`, donc une navigation hors ligne vers `?bookmark=…` ou `reel-studio.html?v=…` ne trouve aucune page en cache. L'app estampille délibérément les liens Studio avec la version (`:6773-6777`), et chaque version devient une nouvelle entrée de cache.
- `sw.js:6` `CACHE_NAME = 'reel-manager-v32'` est incrémenté à la main, sans lien avec `APP_VERSION` (`:4414`).

**Correctif :** retirer l'entrée de pré-cache cross-origin, utiliser `ignoreSearch: true` pour les navigations, et dériver `CACHE_NAME` de la release. **Effort** S.

### AUD-31 (P4)
Le commentaire `:5456-5458` « The trending chart is refreshed by YouTube far less often than hourly; re-fetching it on every dashboard visit would spend units » n'est suivi d'aucune entrée de TTL, donc `chart=mostPopular` utilise le TTL générique de 5 min de `videos.GET` (et aucun du tout si AUD-17 se confirme).
