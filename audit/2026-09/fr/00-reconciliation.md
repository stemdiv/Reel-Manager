# Passe 0 — Réconciliation des lots 1–3 avec le code

> Traduction française de [`../00-reconciliation.md`](../00-reconciliation.md). En cas d'écart, la version anglaise fait foi pour les extraits de code.

Branche d'audit `audit/2026-09`, base `origin/main` @ `9c824eb`. Code examiné : `youtube-playlist-manager.html` **v1.27.3** (`APP_VERSION`, l.4414 ; le handoff citait la v1.12.1, qui était la version *antérieure* aux lots 1–3). Passe en lecture seule ; aucun appel API effectué.

## 0. Sources et leurs lacunes

| Référentiel demandé par le handoff | Présent ? | Ce qui a été utilisé à la place |
|---|---|---|
| `claude_handoff-lot1/2/3-claude-code.md` | **Absent** | Description de la PR [stemdiv/Reel-Manager#1](https://github.com/stemdiv/Reel-Manager/pull/1) (la PR fusionnée « Lots 1–3 », 23 commits, v1.12.0 → v1.27.3) + backlog v6.5 §« Shipped — session of 16 September 2026 » |
| `YouTube-API-Usage-Map-v2`, `Unused-API-Opportunity-Analysis-v2` | **Absent** | Table des coûts dans le code (`YT_QUOTA_COSTS`, l.5175) — utilisée en passe 1 |
| `Music Mode — Design Spec v1` (`Reel-Music-Mode-Design-Spec.docx`) | **Absent** | Ligne #17 du backlog + les chiffres du handoff lui-même (+0.9 / +0.7 / 2–7 min / 80 % / 50–80 %) |
| Audit code/API de mai 2026 | **Absent** | Annexe du backlog « Session of 14 May 2026 » (items #47–#60) |
| `CLAUDE.md` | **Absent** | — |
| Backlogs | Présents | `Backlog-YT-Playlist-Manager{,-EN}.docx` v6.5 (16 sept. 2026), texte extrait |

Conséquences :
- **Les frontières entre lots sont « non vérifié ».** La PR #1 fusionne les lots 1, 2 et 3 en une seule liste sans indiquer à quel lot appartient chaque item. Les tableaux ci-dessous sont donc regroupés selon les sections de la PR #1 elle-même (Quota/API, Fonctionnalités, Correctifs de production), et non par numéro de lot.
- **Le prochain numéro libre du backlog est #85, et non #77.** Le backlog v6.5 utilise déjà #77–#84 (« Reminder — next free backlog number: #85 »). La mention du handoff « #77 si #76 est le dernier » est périmée. Les identifiants provisoires `AUD-xx` sont conservés comme demandé.
- Le handoff parle d'un modèle à **trois buckets**. Le code (et le backlog #83) en compte **quatre** : `pool`, `search`, `upload`, `stats` (l.5239). Ce n'est pas un défaut : `videos.batchGetStats` a reçu son propre bucket en juin 2026.

Légende : ✅ livré · 🟡 partiel · ❌ non livré · ⚪ non vérifié.

---

## Tableau A — Lots 1–3, section « Quota & API » (PR #1)

| Item | Statut | Preuve (`file:line` — extrait) | Note |
|---|---|---|---|
| **#76** quota à trois buckets | ✅ | `youtube-playlist-manager.html:5232` — `const QUOTA_BUCKETS = { 'search.GET': 'search', 'videos.POST': 'upload', 'videos.batchGetStats.GET': 'stats' }`<br>`:5239` — `const QUOTA_LIMITS = { pool: 10000, search: 100, upload: 100, stats: 10000 };` | Point d'entrée unique `chargeQuota()` l.5273. L'ancien `quotaUnits` est migré une seule fois dans `readQuotaState()` l.5362–5365. Reset Pacifique l.5291/5303. Revue de conformité complète → passe 3. |
| Correctif annexe de #76 : `videos/rate` facturé au bucket upload | ✅ | `:5258` — `return String(endpoint).split('?')[0].split(/[/:]/).filter(Boolean).join('.');`<br>`:5225` — `'videos.rate.POST': 50,` | Les sous-chemins et les méthodes `:custom` sont désormais conservés. |
| **#73** filtres Discover réellement envoyés | ✅ | `:11659-11661` — `params.videoDefinition = f.definition; … params.videoCaption … params.videoLicense`<br>`:11666` — `if (after) params.publishedAfter = after;` | |
| Réponses partielles `fields=` | ✅ | `:7896` — `fields: 'nextPageToken,items(id,contentDetails(videoId,videoPublishedAt),snippet(…`<br>`:7906` — `'playlistItems with fields= failed, retrying without it'` | Un nouvel essai sans `fields=` protège contre un sélecteur invalide. |
| Région/langue alignées sur la langue de l'UI (catégories + recherche) | ✅ | `:13621-13624` — `ytApi('videoCategories', { part: 'snippet', regionCode: lr.regionCode, hl: lr.relevanceLanguage })`<br>`:11602` — `fr: { regionCode: 'FR', relevanceLanguage: 'fr' },` | Le backlog #77 note un défaut résiduel : le libellé du tag dépend de la langue du scan (item ouvert, pas une régression). |
| Miniatures fhd/qhd, `pickThumb()` unique | ✅ | `:9827` — `function pickThumb(thumbs, want) {`<br>`:7896` — `…thumbnails(medium(url),high(url),default(url),fhd(url),qhd(url)` | Côté Reel Studio ⚪ non vérifié (passe 3). |

## Tableau B — Lots 1–3, section « Fonctionnalités » (PR #1)

| Item | Statut | Preuve | Note |
|---|---|---|---|
| **#68** Shorts — (1) playlists système | ✅ | `:10137` — `const CHANNEL_SYSTEM_PLAYLISTS = { uploads: 'UU', longForm: 'UULF', shorts: 'UUSH', live: 'UULV' };` | |
| #68 — (2) heuristique `embedHeight > embedWidth && ≤ 180 s` | ✅ | `:10120` — `return h > w && d <= SHORT_MAX_SECONDS;`<br>`:10108` — `const SHORT_MAX_SECONDS = 180;`<br>`:7934` — `maxHeight: 8192,` | Correspond exactement au backlog #68. |
| #68 — (3) repli `HEAD youtube.com/shorts/{id}` | ❌ | Aucun `HEAD` / `youtube.com/shorts` nulle part dans le fichier (grep : 0 résultat). | Le backlog le qualifie de « verification only, unofficial ». Depuis un navigateur, c'est de toute façon impossible : requête cross-origin sans CORS, et `connect-src` (l.10) n'autorise pas `youtube.com`. Il faudrait le backend de la Phase 4. **Ce n'est pas un défaut, mais un écart de scope** — à reclasser dans le backlog. |
| **#I3** like dans le lecteur (`getRating` / `rate`) | ✅ | `:5196` — `'videos.getRating.GET': 1,`<br>`:8644` — `await ytApi('videos/rate', { id: item.videoId, rating: next }, 'POST');` | |
| **#I2** s'abonner depuis Discover | ✅ | `:14202` — `const data = await ytApi('subscriptions', { part: 'snippet' }, 'POST', {`<br>`:6178` — `'subscribe': count * YT_QUOTA_COSTS['subscriptions.POST'],` | |
| **#G14** élévation vers le scope d'écriture en popup + reprise | ✅ | `:6650` — `function openOAuthPopup(scope) {`<br>`:6623-6628` — `window.opener.postMessage({ type: OAUTH_POPUP_MESSAGE, token, … }, window.location.origin);`<br>`:6640` — `if (!event \|\| event.origin !== (expectedOrigin \|\| window.location.origin)) return false;` | Origine verrouillée dans les deux sens. Analyse de sécurité approfondie → passe 2. |
| **#G11** autoCache → IndexedDB + repli + migration | ✅ | `:5672` — `const CACHE_DB_NAME = 'ytpm';`<br>`:5576` — `const m = await cacheStore.migrateLegacy();`<br>`reel-studio.html:943` — `req = indexedDB.open('ytpm');` | « Supprimer mes données » vide aussi la base (`:6292`). |
| **#17** Mode Musique (vue tracklist, détection, forçage, lentille, lecteur ancré) | ✅ | `:10220-10228` — `topicChannel: 0.9, musicCategory: 0.7, … MUSIC_PLAYLIST_THRESHOLD = 0.8; MUSIC_MIXED_THRESHOLD = 0.5;`<br>`:10210` — `if (override === 'music' \|\| override === 'video') return override;`<br>`:440` — `.player-modal-overlay.docked .player-video-wrap { padding-bottom: 180px; }` | Détail dans le tableau D. |
| **#18** préréglage CSV prêt pour le transfert | ✅ | `:15031` — `var TRANSFER_CSV_HEADERS = ['title', 'artist', 'album', 'isrc'];`<br>`:9717` — `sel.value = currentDetailViewMode === 'music' ? 'csv-transfer' : 'csv';` | Présélectionné dans la vue Musique, conformément à la spécification. |
| **#81** tuile Tendances (`chart=mostPopular`) | ✅ | `:8114` — `chart: 'mostPopular',`<br>`:8088` — `// videos.list?chart=mostPopular is 1 unit from the pool — not the search bucket,` | ⚠ Le commentaire sur le TTL l.5456–5458 (« re-fetching it on every dashboard visit would spend units ») **n'est suivi d'aucune entrée TTL**. `chart=mostPopular` partage la clé `videos.GET` (5 min). → passe 3. |
| **#82** playlists/chaînes Discover + parcours des playlists d'une chaîne avec « plafond de pages » | 🟡 | `:11479-11481` — `// 1 unit per page, capped: a channel with hundreds of playlists must not quietly turn one click into twenty calls.`<br>`for (let p = 0; p < 20; p++) {` | **Le plafond est de 20 pages**, donc un clic *peut* devenir vingt appels, ce qui contredit à la fois le commentaire et le backlog #82 (« so one click cannot become twenty calls »). Aucun `checkQuotaBudget()` avant la boucle. → **AUD-01** (P3, quota). |
| **#I1** couvertures de playlist personnalisées | ✅ | `:9884` — `var FEATURES = { playlistCovers: true };`<br>`:10001` — `async function uploadPlaylistCover(playlistId, file) {` | Le feature flag est **activé** par défaut. |
| **#B13** mappage honnête des 403 | ✅ | `:7465-7468` — `if (reason === 'accessNotConfigured' \|\| … ) { throw new Error(t('error_not_registered')); }`<br>`throw promptReconnect(new Error(t('error_session_expired')));` | La ligne voisine `:7473` `` `Erreur API (${errCode})` `` est codée en dur en français → i18n, passe 3. |
| **#B14** session perdue après rechargement → état hors ligne + invitation à se reconnecter | ✅ | `:4872-4875` — `function applyOfflineCacheState() { const offline = !APP.accessToken; … classList.toggle('offline-cache', offline);`<br>`:5644` — `if (applyOfflineCacheState()) {` | |

## Tableau C — Lots 1–3, section « Correctifs de production » (PR #1)

| Correctif | Statut | Preuve | Note |
|---|---|---|---|
| v1.27.1 forme avec deux-points `videos:batchGetStats` + repli en cas d'erreur réseau | ✅ | `:11580` — `const data = await ytApi('videos:batchGetStats', {`<br>`:11553-11557` — `// A method the browser cannot reach at all fails the CORS preflight … counts as unavailable too` | |
| v1.27.2 changer de type dans Discover ne vide plus la vue | ✅ | `:11731-11736` — chaque affinage est masqué par son id, `discoverEmbeddable` par son propre `label`, jamais par un parent commun | |
| v1.27.3 l'auto-catégorisation lit la table des détails | ✅ | `:13708-13709` — `const details = await getVideoDetails(videoIds); … for (const detail of Object.values(details)) {` | Le silence en cas d'épuisement du quota subsiste, déjà suivi sous **#78**/#79. Le libellé de progression codé en dur en français `:13693` est suivi sous **#80**. |

---

## Tableau D — Items « probablement faits » que le handoff demandait de confirmer

| Item | Statut | Preuve | Note |
|---|---|---|---|
| **CR1 / #G1** échappement XSS | 🟡 (échappement ✅, délégation ❌) | `:14961` — `function escapeHtml(str) {` (échappe `& < > " '`)<br>`:14952` — `function escapeJsAttr(str) {` | La liste de correctifs de #G1 disait aussi « replace inline onclick with event delegation ». **Il reste 263 `onclick="…"` et 322 gestionnaires inline `on*=`.** L'audit XSS puits par puits relève de la passe 2. |
| **#G12** CSP | 🟡 | `:10` — `script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com;`<br>`:7-9` — `'unsafe-inline' is required for now … needs the event-delegation refactor tracked in the backlog.` | #G12 demandait d'« interdire les gestionnaires inline » ; `'unsafe-inline'` annule cette partie. **Le « event-delegation refactor » cité par le commentaire n'a aucune entrée au backlog** (ni dans la v6.5 FR ni dans l'EN). → **AUD-02** (lacune de suivi). |
| **CR3 / #G3** cache invalidé après les écritures | ✅ | `:7885-7886` — `// opts.force bypasses the cache after a write (reorder/merge/move). if (!opts?.force) {`<br>`:10779` — `loadPlaylistVideos(currentDetailPlaylistId, { force: true });`<br>`:12456-12457` — `delete APP.allVideos[destId]; … delete APP.allVideos[sourceId];` | Également : fusion `:12232`, création depuis Discover `:12104`, ajout depuis Tendances `:8241`, suppression de playlist `:11018` ; la suppression des fantômes et des doublons filtre sur place `:12517`, `:12570`. Vidage du cache HTTP `invalidateCacheForWrite()` `:5495`. |
| **CR2 / #G2** lire une playlist entière | ✅ | `:8534-8537` — `// APP.allVideos holds raw playlistItems … videoId: v.contentDetails?.videoId \|\| v.snippet?.resourceId?.videoId,` | |
| **CR5 / #G5** purge RGPD de `userInfo` | 🟡 | `:6287` — `'oauthScope', 'lastLoginTimestamp', 'recentSearches', 'userInfo'` (Supprimer mes données)<br>`:6312` — la même liste se termine par `'userInfo'` (purge automatique à 30 jours) | CR5 (userInfo) ✅. **La seconde moitié de #G5 (« appLang … ideally clear all app-owned keys ») ❌** : l'app écrit 32 clés localStorage distinctes, et 15 ne figurent dans aucune des deux listes : `appLang`, `quotaState`, `apiCalls`, `quotaResetDate`, `diagnosticLog`, `bookmarkedPlaylists`, `discoverFilters`, `reelMusicMode`, `playlistViewMode`, `libraryLens`, `showPlaylistViews`, `trendingCategory`, `readOnlyMode`, `writeScopeAtLogin`, `appNamedTheme`/`themeAccents` (ces deux dernières sont purgées par « Supprimer » mais pas par la purge automatique). `diagnosticLog` et `bookmarkedPlaylists` contiennent des données utilisateur. → **AUD-03** (candidat P1, RGPD — la passe 2 confirme). |
| **#J1** filtre type de contenu / musique | ✅ | `:10356` — `function classifyVideoType(v) {`<br>`:1690` — `<select … id="filterType" … onchange="onFilterTypeChange()">` | |
| **#J2** Mode Musique en un clic | ✅ | `:10649-10650` — `let musicMode = false; … localStorage.getItem('reelMusicMode') === '1'`<br>`:10657` — `function toggleMusicMode() {` | Le scope est la vue détail ; « eventually deck/search » était optionnel. |
| **#J3** genre via `topicDetails` | 🟡 | `:7932` — `part: 'contentDetails,snippet,topicDetails,player',`<br>`:10390` — `if (gseg) genre = (GENRE_LABELS[gseg] \|\| gseg.replace(/_/g,' '));`<br>`:10555` — genre affiché en badge sur la carte | « Confirmer la musique » ✅. **« Tag de genre automatique » ❌** : le genre est affiché en badge et jamais écrit dans `playlistTags`. Le backlog marque #J3 ✅ : soit l'item est partiel, soit la spécification a été restreinte (non vérifié sans le document Music-Filter-Design). |

### Score du Mode Musique comparé à la spécification (valeurs issues du handoff)

| Valeur de la spécification | Code | Concordance |
|---|---|---|
| « - Topic » +0.9 | `:10220` `topicChannel: 0.9` | ✅ |
| categoryId 10 +0.7 | `:10221` `musicCategory: 0.7` | ✅ |
| Durée 2–7 min | `:10243` `if (seconds >= 120 && seconds <= 420) score += MUSIC_SIGNALS.trackLength;` (+0.2) | ✅ (poids ⚪ absent du handoff) |
| Motif « Artiste - Titre » | `:10244` `if (hasArtistTitlePattern(v.title \|\| '')) score += MUSIC_SIGNALS.artistTitle;` (+0.2) | ✅ (poids ⚪) |
| Seuils 80 % / 50–80 % | `:10227-10228` | ✅ |
| Forçages permanents | `:10197` `localStorage.getItem('playlistViewMode')` — persisté, et prioritaire sur la détection `:10210` | ✅ (non purgé : voir AUD-03) |
| Seuil par vidéo 0.7, échantillon de 50, vidéo longue −0.5 | `:10224-10229` | ⚪ absent du handoff ; document de spécification manquant |

---

## Nouveaux identifiants provisoires ouverts dans cette passe

| ID | Résumé | Sévérité proposée |
|---|---|---|
| AUD-01 | #82 parcours des playlists d'une chaîne : un plafond de 20 pages contredit « cannot become twenty calls », pas de pré-vol de quota | P3 |
| AUD-02 | Le « event-delegation refactor » cité par le commentaire CSP n'a aucune entrée au backlog ; 263 `onclick` inline rendent `'unsafe-inline'` toujours nécessaire | P3 (posture de sécurité ; réévaluée en passe 2) |
| AUD-03 | La purge RGPD oublie 15 des 32 clés localStorage de l'app (dont `diagnosticLog`, `bookmarkedPlaylists`, `appLang` nommée par #G5) | Candidat P1 |

Items existants confirmés comme toujours ouverts : **#G6** (PKCE/state, ⏸ en attente de #75), **#78**, **#79**, **#80**.

## Bilan

- Lots 1–3 (PR #1, 20 lignes) : **18 ✅, 1 🟡 (#82), 1 ❌ (repli HEAD de #68, non faisable côté client)**.
- « Probablement faits » (8 lignes) : **4 ✅ (CR2, CR3, J1, J2), 4 🟡 (CR1/#G1, #G12, CR5/#G5, #J3)**.
