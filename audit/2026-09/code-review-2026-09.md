# Audit de code — septembre 2026 / Code audit — September 2026

Dépôt / Repository `stemdiv/Reel-Manager` · base `origin/main` @ `9c824eb` · app **v1.27.3** · Reel Studio, `tests.html`, `sw.js` · 24/09/2026.
Rapports détaillés / Detailed reports: [`00-reconciliation.md`](00-reconciliation.md) · [`01-architecture.md`](01-architecture.md) · [`02-security.md`](02-security.md) · [`03-code-review.md`](03-code-review.md) · [`04-tech-debt.md`](04-tech-debt.md) · [`05-testing.md`](05-testing.md) · [`06-accessibility.md`](06-accessibility.md).
Sans préfixe, `:N` désigne `youtube-playlist-manager.html`. / Without a prefix, `:N` means `youtube-playlist-manager.html`.

---

# 🇫🇷 Version française

## 1. Synthèse

- Lots 1–3 : 18 éléments sur 20 livrés et prouvés dans le code. #82 est partiel (AUD-01). Le repli HEAD de #68 n'est pas faisable côté client. **281/281 tests verts** en local, sans aucun appel réseau vers Google.
- Mais **5 risques P1** subsistent, et deux régressions de correctifs « livrés » : #G7 (via le cache, AUD-14) et #J2 (AUD-32).
- **Top 5 des risques :**
  1. **AUD-04 / AUD-05 (XSS)** : un titre de vidéo, dans Discover, ou de playlist mise en favori, exécute du code avec le jeton de l'utilisateur. La CSP garde `'unsafe-inline'`.
  2. **AUD-13 (perte de données)** : les playlists de plus de 1 000 vidéos sont tronquées sans rien dire. La sauvegarde, garde-fou des actions destructrices, est donc incomplète.
  3. **AUD-28 (CGU)** : Reel Studio joue l'audio avec la vidéo hors écran, y compris en onglet masqué.
  4. **AUD-03 (RGPD)** : « Supprimer mes données » oublie 17 clés, dont le journal de diagnostic et les favoris.
  5. **AUD-14 (intégrité)** : après un démarrage depuis le cache, Déplacer copie au lieu de déplacer, et réordonner ou supprimer échoue.
- Aucun référentiel hors backlogs n'était présent. Toute affirmation qui en dépend est marquée « non vérifié ».

## 2. Tableau des constats dédupliqués

Sévérité : **P1** sécurité exploitable, perte de données ou CGU · **P2** bug fonctionnel ou erreur de quota · **P3** maintenabilité, performance ou durcissement · **P4** cosmétique. Effort : S ≤ ½ j · M 1–3 j · L > 1 sem.

| ID | Sév. | Catégorie | fichier:ligne | Constat | Preuve | Correctif recommandé | Effort | Item existant |
|---|---|---|---|---|---|---|---|---|
| AUD-04 | P1 | Sécurité/XSS | :11948, :11961 | Les gestionnaires Discover échappent `'` mais pas `\` : un titre casse la chaîne JS | `playVideo('${v.videoId}','${(v.title\|\|'').replace(/'/g,"\\'")…` | Utiliser `escapeJsAttr()` (:14952) ou des `data-*` | S | CR1/#G1 |
| AUD-05 | P1 | Sécurité/XSS | :8296, :12730 | Titres de playlist (favoris tiers inclus) non échappés dans `title="…"` | `title="${p.name} — ${t('dashboard_drill_to_library')}"` | `escapeHtml()` | S | CR1/#G1, #63, #64 |
| AUD-03 | P1 | RGPD | :6284-6288, :6309-6313 | Purge « Supprimer mes données » / 30 j : 17 clés oubliées (`diagnosticLog`, `bookmarkedPlaylists`, `appLang`, `studioTheme`…) | `'oauthScope', 'lastLoginTimestamp', 'recentSearches', 'userInfo'` | Registre `APP_STORAGE_KEYS` unique pour les deux chemins | S | #G5, CR5, #8 |
| AUD-13 | P1 | Données/API | :7517, :7900, :7541-7544 | Plafond de 20 pages = 1 000 éléments, liste partielle en cas d'erreur, puis sauvegardée | `fetchAllPages(endpoint, params = {}, itemsKey = 'items', maxPages = 20)` | `maxPages: 100` + drapeau `complete`, refuser d'écraser le cache | M | #51, #3 |
| AUD-28 | P1 | CGU YouTube | `reel-studio.html:255`, :1683, :1538-1540 | Lecteur replié hors écran pendant la lecture ; lecture en arrière-plan voulue | `transform: translate(-50%, 110%)` / `collapsePlayer = () => …remove('open')` | Dock visible ≥ 200×200 ou pause au repli ; pause sur `hidden` | S | #B12, #17 |
| AUD-06 | P2 | Sécurité/entrée | :6040, :5920, :14775-14780 | Import de sauvegarde sans schéma → XSS persistant (dossiers, tags, ids) | `APP.playlists = backup.playlistObjects;` | Validation de schéma + échappement des puits | M | #67 |
| AUD-07 | P2 | Sécurité/XSS | `reel-studio.html:1483` | Échappement HTML utilisé dans un contexte JS | `onclick="UI.plTag='${esc(t.name)}'…"` | Échappeur JS ou `data-*` | S | — |
| #G6 | P2 | OAuth | :6584-6590, :6682-6686 | Flux implicite sans `state`, PKCE ni contrôle d'audience | `` `response_type=token&` `` | `state` en sessionStorage maintenant, PKCE avec la Phase 4 | S/L | #G6 (⏸ #75) |
| AUD-14 | P2 | Intégrité/cache | :7712-7725, :5948-5963 | Les éléments reconstruits depuis le cache n'ont pas d'`id` → Déplacer copie, réordonner ou supprimer échoue | `if (!sourceItem?.id) { stuck.push(videoId); continue; }` (:12441-12444) | Persister `itemId` dans les deux sérialiseurs | S | #G7, #F2 |
| AUD-15 | P2 | Quota | :6185, :9350 | 6 clés d'estimation absentes → coût 1 ; upload vérifié sur le pool | `return costs[action] \|\| count;` | Ajouter les clés, bucket `'upload'` | S | #76, CR4 |
| AUD-16 | P2 | Actions groupées | :12434, :12466 | Déplacer s'interrompt au premier échec sans invalider les caches ni compter | `} catch (err) { showToast(t('toast_error', …` | try par élément + `finally` | S | #G7 |
| AUD-17 | P2 (« non vérifié ») | Cache | :7492-7494 | Cache seulement si l'en-tête `ETag` est lisible en CORS | `const etag = res.headers.get('ETag'); if (etag) {` | Repli sur `body.etag` | S | #54, #60, #61 |
| AUD-32 | P2 | Fonctionnel | :10650, :10673, `tests.html:2370` | État « Mode Musique » orphelin : le bouton a disparu, la clé reste lue | `ft.value = musicMode ? 'music' : 'all';` | Supprimer l'état et la clé | S | #J2 |
| AUD-01 | P3 | Quota | :11479-11481 | Parcours des playlists d'une chaîne : jusqu'à 20 appels, sans pré-vol | `for (let p = 0; p < 20; p++) {` | Plafond de 2–3 pages + `checkQuotaBudget` | S | #82 |
| AUD-02 | P3 | Sécurité/archi | :7-10 | 322 gestionnaires inline imposent `'unsafe-inline'` ; refactor non suivi au backlog | `'unsafe-inline' is required for now … tracked in the backlog` | Délégation d'événements par vue | L | #G1, #G12 |
| AUD-08 | P3 | CSP | :10 | Ni `form-action` ni `frame-ancestors` (meta) ; aucune CSP sur 2 pages | `script-src 'self' 'unsafe-inline' …` | Compléter, et passer par un en-tête HTTP | S | #G12 |
| AUD-09 | P3 | Supply chain | `quota-estimator.html:7` | Chart.js via CDN sans SRI, même origine que l'app | `<script src="https://cdnjs…chart.umd.min.js"></script>` | SRI + `crossorigin` ou copie locale | S | — |
| AUD-10 | P3 | Journal | :4692-4726, :4655 | Motifs de rédaction ancrés ; `msg` jamais rédigé ; titres journalisés | `/^ya29\.[A-Za-z0-9_\-\.]+$/` | Motifs non ancrés, rédiger `msg` | S | #66 |
| #G13 | P3 | OAuth | :5576, :5587, :5618 | Jeton dans le hash pendant deux `await` avant `checkAuth()` | `await loadBackupFromStorage();` … `checkAuth();` | Lire et effacer le hash en tout premier | S | #G13 (rouvrir) |
| AUD-18 | P3 | API | :7340, :7371 | `If-Match` est du code mort | `const cached = method === 'GET' ? cacheGet(cacheKey) : null;` | Supprimer ou indexer par ressource | S | #55 |
| AUD-19 | P3 | API | :7387-7391 | POST rejoués → doublons | `// Idempotency caveat … Accepted risk` | Pas de rejeu POST ; vérifier l'existence | S | #49, #50 |
| AUD-20 | P3 | API | :7454-7468 | 403 `rateLimitExceeded` affiché comme « session expirée » | `throw promptReconnect(new Error(t('error_session_expired')));` | Traiter comme un 429 | S | #B13 |
| AUD-21 | P3 | Quota | :7380, :9201, :9410 | Facturation avant la requête (ytApi) vs après succès (uploads) ; les uploads sautent le reset Pacifique | `const { bucket, cost } = chargeQuota(endpoint, method);` | Une règle unique | S | CR4, #47 |
| AUD-22 | P3 | Quota | :2612, :6509, :14722, :14762 | Copies codées en dur de 10 000 / 50 ; la restauration contourne `checkQuotaBudget` | `${quota} / 10,000 units` | Dériver de `QUOTA_LIMITS`/`YT_QUOTA_COSTS` | S | #76 |
| AUD-23 | P3 | Fusion | :12214, :6173 | Sources non chargées = 0 ; pas de dédoublonnage ; estimation fausse | `const videos = APP.allVideos[sourceId] \|\| [];` | Charger, dédoublonner, corriger l'estimation | S | #G18 |
| AUD-24 | P3 | Fantômes | :9793-9796, :12537 | Classement dépendant des miniatures du cache ; favoris tiers inclus | `if (hasThumb \|\| hasVideoDate) return 'available';` | Exclure les favoris, revérifier en direct | S | #G8, #G9 |
| AUD-25 | P3 | Musique | :10356, :10236 | Deux classifieurs musique divergents | `classifyVideoType` vs `musicScore` | Un seul score | M | #J1, #17 |
| AUD-27 | P3 | i18n | :7321, :7473, :12702, :14531… | ≥ 40 chaînes visibles hors `t()` (en plus de #80) | `` `Erreur API (${errCode})` `` | Clés FR/EN | M | #80 |
| AUD-30 | P3 | Service worker | `sw.js:12`, `:19`, `:56` | Précache cross-origin fragile ; pas d'`ignoreSearch` ; version manuelle | `cache.addAll(STATIC_ASSETS)` | Retirer la police, `ignoreSearch`, version liée à la release | S | — |
| AUD-33 | P3 | Dette | `reel-studio.html:625-935` | 16 fonctions dupliquées app ↔ Studio | `const THEMES = {` ×2 | Modules partagés | M | — |
| AUD-34 | P3 | Dette | :9808, :13924, :11873 | 3 formateurs de durée | `formatIsoDuration(iso)` | Un seul formateur | S | #G15 |
| AUD-35 | P3 | Dette | :7302, :6322, :14755 | 10 fonctions > 100 lignes | `ytApi` 214 lignes | Découper | M | — |
| AUD-36 | P3 | Dette | (59 sites) | 59 `catch {}` vides | `try { showToast(…) } catch (e) {}` | Helper `swallow()` qui journalise | S | #78 |
| AUD-37 | P3 | Dette | fichier entier | Monolithe de 784 Ko | CSS 60 Ko · HTML 128 Ko · JS 595 Ko | Découpage progressif | L | — |
| AUD-39 | P3 | Dette | :7517, :6307, :6711 | Constantes magiques, 32 noms de clés en dur | `daysSinceLogin > 30` | Bloc `CONFIG` + registre | S | — |
| AUD-40 | P3 | Dette | :5521 | Couplage à l'ordre de déclaration (TDZ) | `// … MUST be declared before loadBackupFromStorage()` | État dans `APP` | M | — |
| AUD-42 | P3 | A11y | :80-92, :6155 | Contrastes du thème clair (1,7–2,6:1) ; `--text4` < 3:1 partout | quota `color:${color}` | Jetons `--accent-text` sombres | S/M | — |
| AUD-43 | P3 | A11y | :144, :927-930 | Accent libre sans garde ; bordures à 1,4:1 | `.btn-primary { … color: #1a0a06; }` | Texte auto par luminance | S | #74 |
| AUD-44 | P3 | A11y | :8296, :10561 | 86 éléments cliquables non focusables ; réordonner uniquement au glisser | `draggable="true"` | `<button>`, boutons ↑/↓ | M | — |
| AUD-45 | P3 | A11y | :2678, :15188-15191 | Modales sans `role`, focus non géré ; Échap sans effet sur le lecteur | `openModal(content) { …innerHTML = content; …add('active'); }` | `<dialog>` natif | S/M | — |
| AUD-46 | P3 | A11y | :927, :930 | Aucun `:focus-visible` ; `outline: none` | `outline: none;` | Contour global | S | — |
| AUD-47 | P3 | A11y/i18n | :2, :15198 | `lang` figé à `fr` ; politique de confidentialité en FR seulement | `<html lang="fr">` | `documentElement.lang`, clés i18n | S | #8 |
| AUD-48 | P3 | A11y | :15251-15270 | Toasts sans `aria-live`, 10 s pour agir | `toast.className = \`toast ${type}\`` | `role="status"`, pause au survol | S | — |
| AUD-50 | P3 | A11y | `reel-studio.html` | Aucun ARIA, 17 cliquables non focusables | 0 `aria-*` / `role` / `tabindex` | Comme AUD-44/45 | M | — |
| #J3 | P3 | Fonctionnel | :10390, :10555 | Genre affiché en badge, jamais écrit en tag | `if (gseg) genre = …` | Tag de genre optionnel | S | #J3 |
| AUD-11 | P4 | Entrée | :5041 | Pré-remplissage du deep link n'échappant que `"` | `prefilledId.replace(/"/g, '&quot;')` | Valider avec `BOOKMARK_ID_REGEX` | S | #63 |
| AUD-12 | P4 | Robustesse | :14651-14652 | CSV : titre `__proto__` lève une erreur ; cellules multilignes cassées | `playlistMap[plTitle] = {…}` | `Map` + vrai parseur CSV | S | — |
| AUD-26 | P4 | Shorts | :10120 | Shorts carrés ignorés | `return h > w && d <= SHORT_MAX_SECONDS;` | `h >= w` | S | #68 |
| AUD-29 | P4 | Dette | :2745-2757 | Mini-lecteur mort | seulement `classList.remove('active')` | Supprimer | S | — |
| AUD-31 | P4 | Cache | :5456-5458 | TTL « Tendances » promis, absent | commentaire sans entrée | Ajouter `videos.chart` 1 h | S | #81 |
| AUD-38 | P4 | Dette | :8853, :9851, :14813 | Fonctions mortes ; `updateProgress` masquée | `function addToQueueFromCard(…)` | Supprimer | S | #G16 |
| AUD-41 | P4 | i18n | :4418-4610 | CHANGELOG en français seulement, sans accents | `"CORRECTIF — Gestion des tags …"` | Sortir du bundle | S | — |
| AUD-49 | P4 | A11y | :587, :905, :95 | Animations fixes hors `prefers-reduced-motion` | `animation: fadeIn 0.3s;` | Règle globale | S | — |

## 3. Conformité CGU YouTube

| Exigence | App | Reel Studio |
|---|---|---|
| Lecteur visible pendant la lecture, pas d'audio seul | ✅ dock 320×180 visible (:8811-8813, :440) | ❌ **AUD-28** : feuille repliée hors écran pendant la lecture |
| Pas de lecture en arrière-plan | ✅ pause sur `visibilitychange`/`pagehide` (:8427-8428, #B12) | ❌ pause seulement si un onglet YouTube externe est ouvert (`reel-studio.html:1538-1540`) |
| Attribution | ✅ « Powered by YouTube Data API v3 » (:1369, :1578) | « non vérifié » |
| Paramètres IFrame (`enablejsapi`, `origin`) | ✅ (:8437-8438) ; `modestbranding` obsolète (P4) | ✅ `origin` (`reel-studio.html:1600`) |
| Suppression des données, politique de confidentialité | 🟡 AUD-03 (17 clés), politique en FR seulement (AUD-47) | clés Studio non purgées (AUD-03) |
| Pas d'appel non documenté | 🟡 playlists système `UUSH`/`UULF` : comportement non documenté, explicitement assumé (:10134) | — |

Les clauses exactes de la politique « YouTube API Services » n'ont pas été relues : « non vérifié ». Le backlog #17 écrit lui-même « no audio-only — ToS ».

## 4. Régressions depuis l'audit de mai 2026

L'audit du 14 mai 2026 **n'est pas dans le dépôt**. La comparaison se fonde sur l'annexe « Session of 14 May 2026 » du backlog v6.5 (items #43–#67), et reste « non vérifié » par rapport au document d'origine.

| Item de mai | État aujourd'hui | Réf. |
|---|---|---|
| #47 reset Pacifique | ✅ intact (:5291-5316), étendu aux 4 buckets | — |
| #48/#49/#50 retries 429/5xx/backoff | ✅ intacts ; ⚠ le POST est rejoué aussi (risque accepté) | AUD-19 |
| #51 plafond de pagination | ⚠ **est devenu une troncature silencieuse** des grandes playlists | AUD-13 |
| #53/#58 table de coûts, move ×100 | ✅ ; ⚠ 6 clés d'estimation manquantes ajoutées depuis | AUD-15 |
| #54 ETag / #60 cache HTTP / #61 cache search | « non vérifié » : peut-être inerte si `ETag` n'est pas exposé en CORS | AUD-17 |
| #55 If-Match | ❌ code mort, jamais atteignable | AUD-18 |
| #57 `fields=` | ✅ avec repli sans `fields=` (:7906) | — |
| #63 favoris + deep link | ✅ fonctionnel ; ⚠ vecteur de AUD-05, inclus à tort dans le nettoyage des fantômes | AUD-05, AUD-24 |
| #64 drill-down du tableau de bord | ⚠ la ligne de légende est un puits XSS | AUD-05 |
| #66 journal de diagnostic | 🟡 rédaction incomplète, non purgé | AUD-10, AUD-03 |
| #67 import depuis l'écran de connexion | ⚠ canal d'XSS persistant (pas de schéma) | AUD-06 |
| #43 mode lecture seule | ✅ (:7305) | — |

Régressions de correctifs postérieurs à mai : **#G7** (AUD-14, via le cache #F2/#G11) et **#J2** (AUD-32, bouton retiré, état resté).

## 5. Proposition de lots Claude Code

Format des lots 1–3 (reconstitué, les handoffs d'origine étant absents) : une branche par lot, **un commit par item**, message `fix(<zone>): … (AUD-xx)`, un cas de régression `tests.html` par item (identifiants de [`05-testing.md`](05-testing.md) §3), `APP_VERSION` incrémenté par item, backlog mis à jour.

| Lot | Branche | Items (un commit chacun, dans l'ordre) | Tests d'acceptation |
|---|---|---|---|
| **Lot 4 — Sécurité et CGU (P1)** | `lot4-security-tos` | 1. AUD-04 `escapeJsAttr` dans Discover · 2. AUD-05 échapper les titres en attribut · 3. AUD-03 registre `APP_STORAGE_KEYS` + purge complète (app + Studio) · 4. AUD-28 lecteur Studio visible ou en pause au repli + pause sur `hidden` · 5. #G13 hash lu et effacé en premier | X2, X3, X5, X6, X8 + test Studio |
| **Lot 5 — Intégrité des données** | `lot5-data-integrity` | 1. AUD-13 pagination 5 000 + drapeau `complete` + garde d'auto-sauvegarde · 2. AUD-14 `itemId` persisté et restauré · 3. AUD-24 fantômes : exclure les favoris + revérification (même lot que 2) · 4. AUD-16 Déplacer : try par élément + `finally` · 5. AUD-32 supprimer l'état Mode Musique · 6. AUD-23 fusion : charger + dédoublonner | T1, T2, W1–W8, M1, M2, M4 |
| **Lot 6 — Quota** | `lot6-quota` | 1. AUD-15 clés d'estimation + bucket upload · 2. AUD-22 dériver toutes les copies ; restauration via `checkQuotaBudget` · 3. AUD-21 règle de facturation unique + reset avant upload · 4. AUD-01 plafond #82 + pré-vol · 5. AUD-17 cache sans en-tête ETag · 6. AUD-18 retirer If-Match · 7. AUD-19 pas de rejeu POST · 8. AUD-20 403 rate-limit · 9. AUD-31 TTL tendances | Q1–Q9, T3–T9 |
| **Lot 7 — Durcissement** | `lot7-hardening` | 1. AUD-06 schéma de sauvegarde versionné · 2. AUD-07 échappeur JS dans Studio · 3. #G6 paramètre `state` (PKCE reste en Phase 4) · 4. AUD-10 rédaction du journal · 5. AUD-09 SRI Chart.js · 6. AUD-08 CSP `form-action` + CSP sur les pages outils · 7. AUD-11, AUD-12 | B1–B7, U1–U5, X1, X4, X7, X9 |
| **Lot 8 — Accessibilité** | `lot8-a11y` | 1. AUD-46 `:focus-visible` · 2. AUD-47 `lang` dynamique + politique i18n · 3. AUD-48 `aria-live` · 4. AUD-45 `<dialog>` · 5. AUD-42/43 jetons de contraste · 6. AUD-44 cliquables → boutons, réordonner au clavier · 7. AUD-49 · 8. AUD-50 Studio | à définir (pas de harnais a11y ; ajouter axe-core au pilote Playwright) |
| **Lot 9 — i18n et dette** | `lot9-debt` | 1. AUD-39 bloc `CONFIG` · 2. AUD-38 + AUD-29 code mort · 3. AUD-36 `swallow()` · 4. AUD-34 formateur unique · 5. AUD-27 chaînes hors `t()` (avec #80) · 6. AUD-41 changelog · 7. AUD-25 classifieur unique · 8. #J3 tag de genre · 9. AUD-33 modules partagés · 10. AUD-30 service worker | S1–S6 ; suite existante verte |
| **Chantier L (hors lots)** | — | AUD-02 délégation d'événements → CSP stricte ; AUD-35/37/40 découpage ; préalables Phase 4 (voir `04-tech-debt.md` §5) | — |

Pré-requis transverse : committer le pilote Playwright de la passe 5 comme contrôle CI (`05-testing.md` §4).

## 6. Référentiels manquants ou non vérifiés

| Référentiel | État |
|---|---|
| `claude_handoff-lot1/2/3-claude-code.md` | **Absent** : la répartition par lot n'a pas pu être vérifiée ; items reconstitués depuis la PR #1 et le backlog |
| `YouTube-API-Usage-Map-v2` | **Absent** : l'inventaire des appels a été reconstruit depuis le code (`01-architecture.md` §4) |
| `Unused-API-Opportunity-Analysis-v2` | **Absent** |
| `Music Mode — Design Spec v1` (`Reel-Music-Mode-Design-Spec.docx`) | **Absent** : valeurs contrôlées contre le handoff et la ligne #17 du backlog ; poids 0,2 / −0,5 et échantillon 50 « non vérifiés » |
| `Music-Filter-Design.docx` | **Absent** : périmètre de #J3 « non vérifié » |
| Audit code/API du 14 mai 2026 | **Absent** : régressions évaluées via l'annexe du backlog |
| `CODE-REVIEW-Fable5.docx` | **Absent** : les items #G cités viennent du backlog |
| `CLAUDE.md` | **Absent** |
| Politiques YouTube API Services (texte en vigueur) | Non relues : clauses AUD-28 « non vérifié » |
| Exposition CORS de l'en-tête `ETag` par googleapis | « non vérifié » (AUD-17) |
| Acceptation de `\` et `"` dans les titres YouTube | « non vérifié » (exploitabilité de AUD-04/05) |
| Hébergement (en-têtes HTTP, `frame-ancestors`) | « non vérifié » |
| Rendu réel, lecteur d'écran | Non testés (passe 6 en lecture de code) |
| Backlog v6.5 FR/EN (`.docx`) | Présent, lu. **Prochain numéro libre : #85** (et non #77) |

---

# 🇬🇧 English version

## 1. Summary

- Lots 1–3: 18 of the 20 items are shipped and proven in code. #82 is partial (AUD-01). The #68 HEAD fallback can't be built client-side. **281/281 tests pass** locally, with no network call to Google.
- But **5 P1 risks** remain, and two "shipped" fixes have regressed: #G7 (via the cache, AUD-14) and #J2 (AUD-32).
- **Top 5 risks:**
  1. **AUD-04 / AUD-05 (XSS):** a video title in Discover, or the title of a bookmarked playlist, runs code with the user's token. The CSP still allows `'unsafe-inline'`.
  2. **AUD-13 (data loss):** playlists over 1,000 videos are silently truncated. The backup that guards destructive actions is therefore incomplete.
  3. **AUD-28 (ToS):** Reel Studio plays audio with the video off-screen, including in a hidden tab.
  4. **AUD-03 (GDPR):** "Delete my data" misses 17 keys, including the diagnostic log and the bookmarks.
  5. **AUD-14 (integrity):** after a cache-first start, Move copies instead of moving, and reorder and delete fail.
- No reference document other than the backlogs was present. Every claim that depends on one is marked "not verified".

## 2. Deduplicated findings

Severity: **P1** exploitable security, data loss or ToS · **P2** functional bug or quota error · **P3** maintainability, performance or hardening · **P4** cosmetic. Effort: S ≤ ½ day · M 1–3 days · L > 1 week. Evidence excerpts are identical to the French table above and are not repeated. Each row's `file:line` points to them.

| ID | Sev. | Category | file:line | Finding | Recommended fix | Effort | Existing item |
|---|---|---|---|---|---|---|---|
| AUD-04 | P1 | Security/XSS | :11948, :11961 | Discover handlers escape `'` but not `\`, so a video title breaks out of the JS string | Use `escapeJsAttr()` (:14952) or `data-*` | S | CR1/#G1 |
| AUD-05 | P1 | Security/XSS | :8296, :12730 | Playlist titles (third-party bookmarks included) unescaped in `title="…"` | `escapeHtml()` | S | CR1/#G1, #63, #64 |
| AUD-03 | P1 | GDPR | :6284-6288, :6309-6313 | Delete-my-data / 30-day purge miss 17 keys (`diagnosticLog`, `bookmarkedPlaylists`, `appLang`, `studioTheme`…) | One `APP_STORAGE_KEYS` registry for both paths | S | #G5, CR5, #8 |
| AUD-13 | P1 | Data/API | :7517, :7900, :7541-7544 | 20-page cap = 1,000 items; partial list on error; then persisted | `maxPages: 100` + `complete` flag; refuse to overwrite the cache | M | #51, #3 |
| AUD-28 | P1 | YouTube ToS | `reel-studio.html:255`, :1683, :1538-1540 | Player collapsed off-screen while playing; background playback by design | Visible dock ≥ 200×200 or pause on collapse; pause on `hidden` | S | #B12, #17 |
| AUD-06 | P2 | Security/input | :6040, :5920, :14775-14780 | Backup import has no schema, giving persistent XSS (folders, tags, ids) | Schema validation + escape the sinks | M | #67 |
| AUD-07 | P2 | Security/XSS | `reel-studio.html:1483` | HTML escaping used in a JS context | JS escaper or `data-*` | S | — |
| #G6 | P2 | OAuth | :6584-6590, :6682-6686 | Implicit flow, no `state`, no PKCE, no audience check | `state` in sessionStorage now; PKCE with Phase 4 | S/L | #G6 (⏸ #75) |
| AUD-14 | P2 | Integrity/cache | :7712-7725, :5948-5963 | Cache-rebuilt items lack `id`: Move copies, reorder/delete fail | Persist `itemId` in both serializers | S | #G7, #F2 |
| AUD-15 | P2 | Quota | :6185, :9350 | 6 estimate keys missing (cost 1); upload checked against the pool | Add the keys; `'upload'` bucket | S | #76, CR4 |
| AUD-16 | P2 | Bulk actions | :12434, :12466 | Move aborts on the first failure without evicting caches or counting | Per-item try + `finally` | S | #G7 |
| AUD-17 | P2 (not verified) | Cache | :7492-7494 | Caches only if the `ETag` header is CORS-readable | Fall back to `body.etag` | S | #54, #60, #61 |
| AUD-32 | P2 | Functional | :10650, :10673, `tests.html:2370` | Orphaned Music Mode state: the button is gone, the key is still read | Remove the state and the key | S | #J2 |
| AUD-01 | P3 | Quota | :11479-11481 | Channel-playlist browsing up to 20 calls, no pre-flight | Cap at 2–3 pages + `checkQuotaBudget` | S | #82 |
| AUD-02 | P3 | Security/arch. | :7-10 | 322 inline handlers force `'unsafe-inline'`; the refactor is untracked | Event delegation per view | L | #G1, #G12 |
| AUD-08 | P3 | CSP | :10 | No `form-action`, no `frame-ancestors` (meta); no CSP on 2 pages | Complete it; serve via HTTP header | S | #G12 |
| AUD-09 | P3 | Supply chain | `quota-estimator.html:7` | Chart.js from CDN without SRI, same origin as the app | SRI + `crossorigin`, or vendor it | S | — |
| AUD-10 | P3 | Log | :4692-4726, :4655 | Anchored redaction patterns; `msg` never redacted; titles logged | Unanchored patterns; redact `msg` | S | #66 |
| #G13 | P3 | OAuth | :5576, :5587, :5618 | Token stays in the hash across two awaits before `checkAuth()` | Read and clear the hash first | S | #G13 (reopen) |
| AUD-18 | P3 | API | :7340, :7371 | `If-Match` is dead code | Remove it or key it by resource | S | #55 |
| AUD-19 | P3 | API | :7387-7391 | POST retried, so duplicates | No POST retry; check existence | S | #49, #50 |
| AUD-20 | P3 | API | :7454-7468 | 403 rateLimitExceeded shown as "session expired" | Treat it like 429 | S | #B13 |
| AUD-21 | P3 | Quota | :7380, :9201, :9410 | Charged before the request (ytApi) vs after success (uploads); uploads skip the Pacific reset | One rule | S | CR4, #47 |
| AUD-22 | P3 | Quota | :2612, :6509, :14722, :14762 | Hard-coded 10,000 / 50 copies; restore bypasses `checkQuotaBudget` | Derive from `QUOTA_LIMITS`/`YT_QUOTA_COSTS` | S | #76 |
| AUD-23 | P3 | Merge | :12214, :6173 | Unloaded sources count as 0; no dedupe; wrong estimate | Load, dedupe, fix the estimate | S | #G18 |
| AUD-24 | P3 | Ghosts | :9793-9796, :12537 | Classification depends on cached thumbnails; third-party bookmarks included | Exclude bookmarks; live re-check | S | #G8, #G9 |
| AUD-25 | P3 | Music | :10356, :10236 | Two diverging music classifiers | One score | M | #J1, #17 |
| AUD-27 | P3 | i18n | :7321, :7473, :12702, :14531… | ≥ 40 visible strings outside `t()` (beyond #80) | FR/EN keys | M | #80 |
| AUD-30 | P3 | Service worker | `sw.js:12`, `:19`, `:56` | Fragile cross-origin precache; no `ignoreSearch`; manual version | Drop the font entry; `ignoreSearch`; version tied to the release | S | — |
| AUD-33 | P3 | Debt | `reel-studio.html:625-935` | 16 functions duplicated between app and Studio | Shared modules | M | — |
| AUD-34 | P3 | Debt | :9808, :13924, :11873 | 3 duration formatters | One formatter | S | #G15 |
| AUD-35 | P3 | Debt | :7302, :6322, :14755 | 10 functions > 100 lines | Split them | M | — |
| AUD-36 | P3 | Debt | (59 sites) | 59 empty `catch {}` | Logging `swallow()` helper | S | #78 |
| AUD-37 | P3 | Debt | whole file | 784 KB monolith | Staged split | L | — |
| AUD-39 | P3 | Debt | :7517, :6307, :6711 | Magic constants; 32 hard-coded key names | `CONFIG` block + registry | S | — |
| AUD-40 | P3 | Debt | :5521 | Declaration-order (TDZ) coupling | State into `APP` | M | — |
| AUD-42 | P3 | A11y | :80-92, :6155 | Light-theme contrast 1.7–2.6:1; `--text4` < 3:1 everywhere | Dark `--accent-text` tokens | S/M | — |
| AUD-43 | P3 | A11y | :144, :927-930 | Free accent with no guard; borders 1.4:1 | Luminance-based button text | S | #74 |
| AUD-44 | P3 | A11y | :8296, :10561 | 86 non-focusable click targets; drag-only reorder | `<button>`s, ↑/↓ buttons | M | — |
| AUD-45 | P3 | A11y | :2678, :15188-15191 | Modals without role or focus management; Escape doesn't close the player | Native `<dialog>` | S/M | — |
| AUD-46 | P3 | A11y | :927, :930 | No `:focus-visible`; `outline: none` | Global outline | S | — |
| AUD-47 | P3 | A11y/i18n | :2, :15198 | `lang` stuck at `fr`; privacy policy FR-only | `documentElement.lang`; i18n keys | S | #8 |
| AUD-48 | P3 | A11y | :15251-15270 | Toasts without `aria-live`; 10 s to act | `role="status"`; pause on hover | S | — |
| AUD-50 | P3 | A11y | `reel-studio.html` | No ARIA; 17 non-focusable click targets | As AUD-44/45 | M | — |
| #J3 | P3 | Functional | :10390, :10555 | Genre shown as a badge, never written as a tag | Optional genre tag | S | #J3 |
| AUD-11 | P4 | Input | :5041 | Deep-link prefill escapes only `"` | Validate with `BOOKMARK_ID_REGEX` | S | #63 |
| AUD-12 | P4 | Robustness | :14651-14652 | CSV: `__proto__` title throws; multi-line cells break | `Map` + real CSV parser | S | — |
| AUD-26 | P4 | Shorts | :10120 | Square Shorts missed | `h >= w` | S | #68 |
| AUD-29 | P4 | Debt | :2745-2757 | Dead mini-player | Remove it | S | — |
| AUD-31 | P4 | Cache | :5456-5458 | Trending TTL promised but missing | Add a 1 h entry | S | #81 |
| AUD-38 | P4 | Debt | :8853, :9851, :14813 | Dead functions; shadowed `updateProgress` | Remove them | S | #G16 |
| AUD-41 | P4 | i18n | :4418-4610 | CHANGELOG French-only, accent-stripped | Move it out of the bundle | S | — |
| AUD-49 | P4 | A11y | :587, :905, :95 | Fixed animations outside `prefers-reduced-motion` | Global rule | S | — |

## 3. YouTube ToS compliance

| Requirement | App | Reel Studio |
|---|---|---|
| Visible player while playing, no audio-only | ✅ 320×180 visible dock (:8811-8813, :440) | ❌ **AUD-28**: collapsed sheet off-screen while playing |
| No background playback | ✅ pause on `visibilitychange`/`pagehide` (:8427-8428, #B12) | ❌ pauses only if an external YouTube tab is open (`reel-studio.html:1538-1540`) |
| Attribution | ✅ "Powered by YouTube Data API v3" (:1369, :1578) | not verified |
| IFrame parameters (`enablejsapi`, `origin`) | ✅ (:8437-8438); `modestbranding` deprecated (P4) | ✅ `origin` (`reel-studio.html:1600`) |
| Data deletion, privacy policy | 🟡 AUD-03 (17 keys); policy FR-only (AUD-47) | Studio keys not purged (AUD-03) |
| No undocumented calls | 🟡 `UUSH`/`UULF` system playlists: undocumented behaviour, explicitly acknowledged (:10134) | — |

The exact clauses of the YouTube API Services policies were not re-read: not verified. Backlog #17 itself says "no audio-only — ToS".

## 4. Regressions since the May 2026 audit

The 14 May 2026 audit **is not in the repo**. The comparison uses the backlog v6.5 appendix "Session of 14 May 2026" (items #43–#67), and is not verified against the original document.

| May item | Today | Ref. |
|---|---|---|
| #47 Pacific reset | ✅ intact (:5291-5316), extended to 4 buckets | — |
| #48/#49/#50 429/5xx/backoff retries | ✅ intact; ⚠ POST is retried too (accepted risk) | AUD-19 |
| #51 pagination cap | ⚠ **has become silent truncation** of large playlists | AUD-13 |
| #53/#58 cost table, move ×100 | ✅; ⚠ 6 estimate keys added since are missing | AUD-15 |
| #54 ETag / #60 HTTP cache / #61 search cache | not verified: possibly inert if `ETag` isn't CORS-exposed | AUD-17 |
| #55 If-Match | ❌ dead code, never reachable | AUD-18 |
| #57 `fields=` | ✅ with a no-`fields=` retry (:7906) | — |
| #63 bookmarks + deep link | ✅ working; ⚠ vector for AUD-05, wrongly included in ghost cleanup | AUD-05, AUD-24 |
| #64 dashboard drill-down | ⚠ the legend row is an XSS sink | AUD-05 |
| #66 diagnostic log | 🟡 incomplete redaction, not purged | AUD-10, AUD-03 |
| #67 login-screen import | ⚠ persistent XSS channel (no schema) | AUD-06 |
| #43 read-only mode | ✅ (:7305) | — |

Regressions of post-May fixes: **#G7** (AUD-14, through the #F2/#G11 cache) and **#J2** (AUD-32, button removed, state kept).

## 5. Proposed Claude Code lots

Lots 1–3 format (reconstructed, since the original handoffs are missing):
- one branch per lot, **one commit per item**, with the message `fix(<area>): … (AUD-xx)`
- one `tests.html` regression case per item, with IDs from [`05-testing.md`](05-testing.md) §3
- `APP_VERSION` bumped per item, and the backlog updated

| Lot | Branch | Items (one commit each, in order) | Acceptance tests |
|---|---|---|---|
| **Lot 4 — Security & ToS (P1)** | `lot4-security-tos` | 1. AUD-04 `escapeJsAttr` in Discover · 2. AUD-05 escape attribute titles · 3. AUD-03 `APP_STORAGE_KEYS` registry + full purge (app + Studio) · 4. AUD-28 Studio player visible or paused when collapsed + pause on `hidden` · 5. #G13 hash read and cleared first | X2, X3, X5, X6, X8 + a Studio test |
| **Lot 5 — Data integrity** | `lot5-data-integrity` | 1. AUD-13 5,000-item pagination + `complete` flag + auto-save guard · 2. AUD-14 persist and restore `itemId` · 3. AUD-24 ghosts: exclude bookmarks + live re-check (same lot as 2) · 4. AUD-16 Move: per-item try + `finally` · 5. AUD-32 remove the Music Mode state · 6. AUD-23 merge: load + dedupe | T1, T2, W1–W8, M1, M2, M4 |
| **Lot 6 — Quota** | `lot6-quota` | 1. AUD-15 estimate keys + upload bucket · 2. AUD-22 derive every copy; restore via `checkQuotaBudget` · 3. AUD-21 one charging rule + reset before upload · 4. AUD-01 #82 cap + pre-flight · 5. AUD-17 cache without an ETag header · 6. AUD-18 remove If-Match · 7. AUD-19 no POST retry · 8. AUD-20 rate-limit 403 · 9. AUD-31 trending TTL | Q1–Q9, T3–T9 |
| **Lot 7 — Hardening** | `lot7-hardening` | 1. AUD-06 versioned backup schema · 2. AUD-07 Studio JS escaper · 3. #G6 `state` parameter (PKCE stays in Phase 4) · 4. AUD-10 log redaction · 5. AUD-09 Chart.js SRI · 6. AUD-08 CSP `form-action` + CSP on the tool pages · 7. AUD-11, AUD-12 | B1–B7, U1–U5, X1, X4, X7, X9 |
| **Lot 8 — Accessibility** | `lot8-a11y` | 1. AUD-46 `:focus-visible` · 2. AUD-47 dynamic `lang` + i18n policy · 3. AUD-48 `aria-live` · 4. AUD-45 `<dialog>` · 5. AUD-42/43 contrast tokens · 6. AUD-44 click targets → buttons, keyboard reorder · 7. AUD-49 · 8. AUD-50 Studio | to be defined (no a11y harness; add axe-core to the Playwright driver) |
| **Lot 9 — i18n & debt** | `lot9-debt` | 1. AUD-39 `CONFIG` block · 2. AUD-38 + AUD-29 dead code · 3. AUD-36 `swallow()` · 4. AUD-34 one formatter · 5. AUD-27 strings outside `t()` (with #80) · 6. AUD-41 changelog · 7. AUD-25 one classifier · 8. #J3 genre tag · 9. AUD-33 shared modules · 10. AUD-30 service worker | S1–S6; existing suite green |
| **Track L (outside lots)** | — | AUD-02 event delegation → strict CSP; AUD-35/37/40 split; Phase 4 prerequisites (see `04-tech-debt.md` §5) | — |

Cross-cutting prerequisite: commit the Pass 5 Playwright driver as a CI gate (`05-testing.md` §4).

## 6. Missing or unverified references

| Reference | Status |
|---|---|
| `claude_handoff-lot1/2/3-claude-code.md` | **Missing**: lot boundaries couldn't be verified; items rebuilt from PR #1 and the backlog |
| `YouTube-API-Usage-Map-v2` | **Missing**: call inventory rebuilt from the code (`01-architecture.md` §4) |
| `Unused-API-Opportunity-Analysis-v2` | **Missing** |
| `Music Mode — Design Spec v1` (`Reel-Music-Mode-Design-Spec.docx`) | **Missing**: values checked against the handoff and backlog row #17; weights 0.2 / −0.5 and sample size 50 not verified |
| `Music-Filter-Design.docx` | **Missing**: #J3 scope not verified |
| Code/API audit of 14 May 2026 | **Missing**: regressions assessed via the backlog appendix |
| `CODE-REVIEW-Fable5.docx` | **Missing**: #G items cited from the backlog |
| `CLAUDE.md` | **Missing** |
| YouTube API Services policies (current text) | Not re-read: AUD-28 clauses not verified |
| CORS exposure of `ETag` by googleapis | Not verified (AUD-17) |
| YouTube accepting `\` and `"` in titles | Not verified (AUD-04/05 exploitability) |
| Hosting (HTTP headers, `frame-ancestors`) | Not verified |
| Real rendering, screen reader | Not tested (Pass 6 is code reading) |
| Backlog v6.5 FR/EN (`.docx`) | Present, read. **Next free number: #85** (not #77) |
