# Passe 4 — Dette technique

> **État (24/09/2026) :** ce rapport décrit le code à `9c824eb` (app v1.27.3). Correctifs depuis, errata et nouveaux constats : [`08-remediation.md`](08-remediation.md).

> Traduction française de [`../04-tech-debt.md`](../04-tech-debt.md). En cas d'écart, la version anglaise fait foi pour les extraits de code.

Base `origin/main` @ `9c824eb`, app **v1.27.3**. Lecture seule. Le skill `engineering:tech-debt` n'est pas installé : j'ai donc appliqué à la main la checklist du handoff. Les métriques proviennent de scripts jetables dans le scratchpad (analyse de la longueur des fonctions par appariement naïf des accolades, comptage des références, fenêtres dupliquées de 6 lignes, évaluation de `I18N`). Toute référence `:N` sans nom de fichier désigne `youtube-playlist-manager.html`.

## 1. Taille et forme

| Partie de `youtube-playlist-manager.html` | Lignes | Octets |
|---|---|---|
| Fichier entier | 15 457 | 784 106 |
| CSS `<style>` (:22–1321) | 1 300 | 60 KB |
| Corps HTML (:1323–2759) | 1 437 | 128 KB |
| JS `<script>` (:2760–15454) | 12 695 | 595 KB |
| — dont `I18N` fr+en (:2774–4331) | 1 558 | 78 KB |
| — dont `CHANGELOG` (:4418–4610) | 193 | 27 KB, **en français seulement**, affiché aussi aux utilisateurs EN (`:6732` `CHANGELOG.map(...)`) |
| Lignes de commentaire (`^\s*//`) | 1 139 | — |

Décomptes au niveau du code :
- 461 fonctions nommées dans le script de l'app ; 10 dépassent 100 lignes et 34 dépassent 50 lignes.
- 322 gestionnaires inline `on*=` (AUD-02) et 724 attributs inline `style="`.
- 389 appels à `document.getElementById(`.
- **59 blocs `catch` vides** (`catch (e|_|err) { }`).
- Reel Studio : 1 786 lignes, dont **16 fonctions réimplémentées** depuis l'app.

## 2. Items du backlog #G15–#G19 (vérification)

| Item | État | Preuve | Résidu |
|---|---|---|---|
| #G15 dédoublonner `parseDuration` + formateurs | 🟡 | Un seul `parseDuration` (`:9801`) ✅. Mais il reste **trois** formateurs de durée : `formatDuration` (`:9808`), `formatIsoDuration` (`:13924`, plan de visionnage, `h:mm:ss`) et un formateur inline dans `performDiscoverSearch` (`:11873-11874`). Reel Studio a son propre `parseDuration` (`reel-studio.html:889`). | → AUD-34 |
| #G16 supprimer le code mort | ✅ | `drawBarChart` a disparu (grep : uniquement dans le CHANGELOG `:4561`) | Nouveau code mort trouvé, → AUD-38 |
| #G17 `APP.lang` | ✅ | `:8922-8924` `// #G17: APP.lang was never assigned … const lang = currentLang \|\| 'fr';`, et aucun autre `APP.lang` | — |
| #G18 fusion par id | ✅ | `:12193-12205` (passe 3) | — |
| #G19 drapeau « dirty » sur l'auto-cache | ✅ | `:7762` `APP_DIRTY = false;   // #G19: the cache write IS the save` | — |

## 3. Constats

### AUD-32 — état « Mode Musique » orphelin (P2, fonctionnel ; corrige #J2 de la passe 0)
- `tests.html:2367-2370` : le test `'the old dedicated music button is gone from the detail header'` vérifie `!w.document.getElementById('musicModeBtn')`. Le bouton de #J2 a été **retiré** et remplacé par le filtre de bibliothèque de #17.
- `:10657` `function toggleMusicMode()` a désormais **0 référence** (décompte du script : 1 = la définition), et pourtant
- `:10650` `musicMode = (… localStorage.getItem('reelMusicMode') === '1');` est toujours lu, et
- `:10673` `resetVideoFilters()` exécute `if (ft) ft.value = musicMode ? 'music' : 'all';`, puis `:10678` `if (musicMode) { onFilterTypeChange(); }`.

Un utilisateur qui avait activé le bouton avant son retrait ne peut plus le désactiver : le bouton « Réinitialiser » des filtres réinitialise **vers** Musique. La passe 0 avait marqué #J2 ✅ sur la foi du code. En réalité, #J2 a été remplacé par #17, et ce résidu est un bug. **Correctif :** supprimer `musicMode`, `updateMusicModeBtn` et `toggleMusicMode`, supprimer une fois la clé `reelMusicMode` au démarrage, et l'ajouter à la liste de purge (AUD-03). **Effort** S.

### AUD-33 — duplication app ↔ Reel Studio (P3)
Fonctions définies dans **les deux** fichiers : `hexToHsl`, `hsl`, `categoricalsFor`, `accentsFor`, `applyTheme`, `hexToRgb`, `rgbToHsv`, `hsvToRgb`, `openPicker`, `closePicker`, `renderPicker`, `cpFromHex`, `cpFromRgb`, `cpDrag`, `pickThumb`, `parseDuration`. Les deux définissent `const THEMES` (`:6802`, `reel-studio.html:625`), et 37 fenêtres identiques de 6 lignes sont partagées. Chaque correctif de thème ou de sélecteur de couleur (#70, #72, #74) a dû être appliqué deux fois. Le lecteur IndexedDB est lui aussi dupliqué (`reel-studio.html:936` contre `cacheStore`). **Correctif :** extraire `theme.js`, `picker.js`, `thumbs.js` et `cache-read.js` sous forme de modules ES simples servis à côté des pages (aucun bundler nécessaire). **Effort** M.

### AUD-34 — trois formateurs de durée (P3, résidu de #G15)
Voir §2. Les sorties diffèrent pour une même entrée : `formatDuration(3725)` donne `1h02m`, le plan de visionnage donne `1:02:05`, Discover donne `1:02:05`. **Correctif :** un seul `formatDuration(seconds, style)`. **Effort** S.

### AUD-35 — fonctions longues (P3)
| Fonction | Ligne | Lignes |
|---|---|---|
| `ytApi` | :7302 | 214 |
| `runCacheDiagnostic` | :6322 | 195 |
| `executeRestore` | :14755 | 173 |
| `performDiscoverSearch` | :11768 | 159 |
| `refreshDashboard` | :7953 | 133 |
| `showAutoCategorizerModal` | :13644 | 124 |
| `loadBackupFromStorage` | :5889 | 122 |
| `generateStatisticsCharts` | :12698 | 122 |
| `exportLibrary` | :15054 | 115 |
| `generateDashboardCharts` | :8249 | 104 |

`ytApi` est longue mais cohérente ; la découper selon ses propres bannières (gates / cache / charge / fetch-retry / map-error / post-process) lors de son passage côté serveur. `executeRestore` et `showAutoCategorizerModal` mélangent E/S, quota, interface de progression et chaînes DOM dans un même corps. C'est ce mélange qui a laissé passer inaperçus #78 (pas de garde de quota sur l'analyse) et AUD-22 (la restauration contourne `checkQuotaBudget`). **Effort** M chacune.

### AUD-36 — erreurs avalées en silence (P3)
Il y a 59 blocs `catch` vides. Beaucoup sont légitimes : écritures de stockage, `try { showToast(...) } catch (e) {}`. Le même motif a masqué le bug de la v1.27.3 (« the catch fell back … without a word in the console », CHANGELOG `:4419+`) et masque l'échec de quota de #78 (`getVideoDetails` renvoie `{}` en cas d'erreur). **Correctif :** un helper `swallow(tag)` qui appelle au moins `log('debug', …)`, et une règle de lint contre les catch vides hors des wrappers de stockage. **Effort** S.

### AUD-37 — monolithe en un seul fichier (P3)
784 KB dans un seul fichier : les tables i18n (78 KB), le CHANGELOG (27 KB), le CSS (60 KB) et les templates sont tous livrés à chaque chargement et tous différenciés dans un seul fichier. Les globales couplent tout (passe 1, A1/A2). Le découpage est bloqué principalement par les 322 gestionnaires inline (AUD-02), qui ont besoin de noms de fonctions globaux. `tests.html` accède aussi aux globales `w.<fn>` : tout découpage en modules doit donc conserver une surface d'export sur `window`, sinon les 281 tests cassent. **Effort** L (par étapes, voir §5).

### AUD-38 — code mort (P4)
- `toggleMusicMode` / `updateMusicModeBtn` (`:10651-10665`) : voir AUD-32.
- `addToQueueFromCard` (`:8853`) : 0 référence.
- `isCategoryAssignable` (`:9851`) : 0 référence (le backlog du 10 août la liste comme API livrée).
- Balisage + CSS de `#miniPlayer` (AUD-29).
- Les branches `If-Match` / 412 (AUD-18).
- `updateProgress` est définie deux fois : en global à `:13769`, et comme fonction interne à `executeRestore` à `:14813`, qui la masque.

Pas mort : `onYouTubeIframeAPIReady` (`:8417`) est le callback global de l'API IFrame.

### AUD-39 — constantes magiques (P3)
- Copies du quota : AUD-22 (`:2612`, `:6509`, `:14722`, `:14762`).
- Plafonds de pages : valeur par défaut `maxPages = 20` (`:7517`) et le littéral `p < 20` (`:11481`). Voir AUD-13 et AUD-01.
- Rétention : `daysSinceLogin > 30` (`:6306-6307`), âge de la sauvegarde `hours >= 24` (`:6099`, `checkBackupSafety`), fenêtre de reprise OAuth `600_000` (`:6711`).
- Minuteries : durée de vie des toasts `3000` / `10000` (`:15258`, `:15265`), et 10 littéraux `setTimeout(…, ≥100)`.
- Noms de clés de stockage : 32 chaînes littérales réparties dans le fichier (AUD-03 a besoin d'un registre).
- Taille de lot 50 : `slice(0, 50)`, `i + 50` à une dizaine d'endroits.

Les « lignes codées en dur citées dans les handoffs » mentionnées par le handoff ne peuvent pas être recoupées, car les handoffs des lots sont absents (« non vérifié »). **Correctif :** un bloc `CONFIG` à côté de `QUOTA_LIMITS` (limites, plafonds, rétention, minuteries) et un registre `APP_STORAGE_KEYS`. **Effort** S.

### AUD-40 — couplage à l'ordre de déclaration (P3)
`:5521` `// Video details cache — MUST be declared before loadBackupFromStorage() to avoid TDZ`, et `var cacheStore` (`:5678`) utilise `var` exprès pour le hoisting. L'état `let` de niveau module (`videoDetailsCache`, `currentDetailVideos`, `moveVideosCache`, `musicMode`, `PLAYER`, `restoreData`…) est lu d'une section à l'autre. Réordonner le code pour un découpage peut introduire des erreurs TDZ qui n'apparaissent qu'à l'exécution. **Correctif :** déplacer cet état dans `APP` (ou dans un petit module `state`) avant tout découpage. **Effort** M.

### AUD-41 — CHANGELOG en français seulement et sans accents (P4)
`:4418-4610` contient des notes de version visibles par l'utilisateur, en français replié en ASCII (« Categorisation auto », « desormais »), affichées dans la modale de version quel que soit `currentLang`. **Correctif :** le sortir du bundle de l'app dans un `changelog.json` (FR/EN), ou ne garder les notes que dans le backlog. **Effort** S.

## 4. Classement coût/bénéfice

Le bénéfice est évalué selon la réduction du risque et la préparation à la Phase 4 ; le coût est S ≈ ≤ ½ jour, M ≈ 1–3 jours, L ≈ > 1 semaine.

| Rang | Item | Bénéfice | Coût | Pourquoi maintenant |
|---|---|---|---|---|
| 1 | AUD-39 `CONFIG` + registre `APP_STORAGE_KEYS` | Élevé : débloque AUD-03 (P1 RGPD), AUD-22, AUD-13 | S | Données pures, aucun changement de comportement |
| 2 | AUD-32 + AUD-38 suppression du code mort | Moyen : corrige un état bloqué visible par l'utilisateur | S | Suppression uniquement |
| 3 | AUD-36 helper `swallow()` | Moyen : rend visible le prochain bug de la classe de #78 | S | Mécanique |
| 4 | AUD-34 un seul formateur de durée | Faible à moyen | S | Fonction pure, facile à tester |
| 5 | Extraire les modules purs (tables de quota, `normalizeEndpoint`, `getQuotaCost`, `parseDuration`/formateurs, `musicScore`, `parseArtistTitle`, `detectShort`, `csvCell`, `escapeHtml`/`escapeJsAttr`) dans `lib/*.js`, toujours exposés sur `window` pour la page et `tests.html` | Élevé : partagés avec Studio, réutilisables par le proxy Node, testables sous Node | M | Préalable à la Phase 4 |
| 6 | AUD-33 modules partagés thème/sélecteur/miniatures pour l'app + Studio | Moyen | M | Utilise le mécanisme de l'étape 5 |
| 7 | AUD-40 déplacer l'état épars dans `APP` | Moyen : réduit le risque de chaque déplacement ultérieur | M | Avant de découper les vues |
| 8 | AUD-02 gestionnaires inline → délégation d'événements (`data-action`) par vue | Élevé : permet une CSP stricte et corrige structurellement la classe XSS (AUD-04/05/06) | L | Vue par vue, un commit chacune |
| 9 | AUD-35 découper les fonctions longues | Moyen | M | En même temps que la vue à laquelle chacune appartient |
| 10 | AUD-37 découpage du fichier (fichier CSS, `i18n/fr.json`, `i18n/en.json`, scripts par vue) | Moyen : temps de chargement, bruit dans les diffs | L | En dernier, une fois que 5–9 l'ont rendu mécanique |
| 11 | AUD-41 changelog hors du bundle | Faible | S | À tout moment |

## 5. Ordre de refactorisation compatible avec l'extraction du backend en Phase 4

L'ordre d'extraction de la passe 1 §6 est auth → proxy → Redis → PostgreSQL. Les refactorisations qui rendent chaque étape peu coûteuse :

1. **Avant auth/proxy :** rangs 1, 5 et 3. Le modèle de quota, la normalisation des endpoints et le mapping des erreurs deviennent importables à la fois par le navigateur et par le proxy Node : le proxy réutilise ainsi le code testé au lieu de le redériver. La signature de `ytApi` reste la jointure (passe 1).
2. **Pendant l'arrivée du proxy :** découper `ytApi` (AUD-35) en `transport` (qui devient l'appel `fetch('/api/yt/…')`) et `policy` (cache, quota, retry, qui passent côté serveur). Corriger AUD-17/18/19/20 au passage ; ils sont tous dans cette fonction.
3. **Avant PostgreSQL :** rang 7 (état dans `APP`) plus un **schéma de sauvegarde versionné** (AUD-06). Ce même schéma devient le modèle SQL et le miroir hors ligne IndexedDB, et doit porter `itemId` (AUD-14) et `complete` (AUD-13).
4. **Piste UI indépendante, à tout moment :** rangs 2, 4, 6, 8, 9, 10, 11. C'est la suppression des gestionnaires inline (8) qui permet enfin `script-src 'self'` sans `'unsafe-inline'`.

Tout au long du processus, conserver les exports `window.<fn>` jusqu'à ce que `tests.html` soit migré vers l'import de modules. Sinon, le filet de sécurité des 281 cas de test est perdu précisément au moment où l'on en a besoin.
