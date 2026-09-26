# Passe 8 — État des correctifs (lots 4 à 9)

État de chaque constat de cet audit après les lots de correctifs proposés dans [`../code-review-2026-09.md`](../code-review-2026-09.md) §5, au 24/09/2026. Les rapports de passe 00 à 06 et le tableau consolidé restent tels qu'écrits : ils décrivent le code à `9c824eb` (app v1.27.3). Ce rapport consigne ce qui a changé depuis, ce que les correctifs ont révélé sur l'audit lui-même (errata), et les constats apparus pendant le travail.

Original anglais : [`../08-remediation.md`](../08-remediation.md).

## 1. Synthèse

- Six lots, six pull requests empilées, **aucune fusionnée à ce jour**. Ordre de fusion : [#3](https://github.com/stemdiv/Reel-Manager/pull/3) → [#4](https://github.com/stemdiv/Reel-Manager/pull/4) → [#5](https://github.com/stemdiv/Reel-Manager/pull/5) → [#6](https://github.com/stemdiv/Reel-Manager/pull/6) → [#7](https://github.com/stemdiv/Reel-Manager/pull/7) → [#8](https://github.com/stemdiv/Reel-Manager/pull/8). Cette PR ([#2](https://github.com/stemdiv/Reel-Manager/pull/2)) reste non fusionnée, comme le prévoit le cahier des charges.
- App v1.27.3 → **v1.27.51**, Reel Studio → **0.7.6**. Un commit par élément, chacun avec ses tests ; chaque nouveau cas a été rejoué sur le commit qui précède son correctif et y échoue, sauf les tests de garde cités plus bas.
- `tests.html` : 281 cas → **447, tous au vert**, exécutés en headless avec tout hôte autre que `127.0.0.1` bloqué (aucun appel à l'API YouTube, aucun quota).
- Sur les 53 lignes du tableau consolidé : **44 corrigées**, **3 partiellement** (#G6, AUD-08, AUD-33), **1 faux positif** (AUD-31), **5 ouvertes** (AUD-02, AUD-26, AUD-35, AUD-37, AUD-40, hors de tout lot).
- Le travail de correction a fait apparaître **4 nouveaux constats** (AUD-51 à AUD-54). AUD-51 et AUD-52 étaient de vrais bugs du code en production, dont une faille XSS (AUD-52). Trois sont corrigés ; AUD-54 reste ouvert et non analysé.

| Lot | PR | Branche | Commits | Tests après | Version de l'app après |
|---|---|---|---|---|---|
| 4 — Sécurité et CGU | [#3](https://github.com/stemdiv/Reel-Manager/pull/3) | `lot4-security-tos` | 5 | 301 | 1.27.8 |
| 5 — Intégrité des données | [#4](https://github.com/stemdiv/Reel-Manager/pull/4) | `lot5-data-integrity` | 6 | 319 | 1.27.14 |
| 6 — Quota | [#5](https://github.com/stemdiv/Reel-Manager/pull/5) | `lot6-quota` | 10 | 344 | 1.27.23 |
| 7 — Durcissement | [#6](https://github.com/stemdiv/Reel-Manager/pull/6) | `lot7-hardening` | 8 | 380 | 1.27.31 |
| 8 — Accessibilité | [#7](https://github.com/stemdiv/Reel-Manager/pull/7) | `lot8-a11y` | 9 | 411 | 1.27.40 |
| 9 — i18n et dette | [#8](https://github.com/stemdiv/Reel-Manager/pull/8) | `lot9-debt` | 11 | 447 | 1.27.51 |

## 2. État par constat

État : **Corrigé** · **Partiel** (la part restante est nommée) · **Ouvert** · **Faux positif**. Les commits se trouvent sur la branche du lot indiqué.

| ID | Sév. | État | Lot | Commit | Notes |
|---|---|---|---|---|---|
| AUD-03 | P1 | Corrigé | 4 | `4832302` | Registres `APP_STORAGE_KEYS` / `APP_SESSION_KEYS` communs aux deux purges, clés de Studio comprises ; un test échoue si une clé écrite par l'une des pages en est absente. |
| AUD-04 | P1 | Corrigé | 4 | `2bc07d6` | `escapeJsAttr()` corrigé et appliqué ; **7 emplacements**, et non les 2 relevés (erratum E2). Exploitation reproduite sur l'ancien code. |
| AUD-05 | P1 | Corrigé | 4 | `31ecf7c` | `escapeHtml()` sur les attributs des graphiques et des listes. |
| AUD-13 | P1 | Corrigé | 5 | `bf69b98` | Plafond de 100 pages (5 000 éléments), indicateur `complete`, la sauvegarde automatique refuse de remplacer une liste plus longue déjà en cache, sauvegarde et export avertissent. Mesuré sur l'ancien code : 1 000 éléments chargés sur 3 000. |
| AUD-28 | P1 | Corrigé | 4 | `d2fec92` | Replier ancre le lecteur en 356 × 200, visible ; Studio se met en pause quand l'onglet est masqué. |
| AUD-06 | P2 | Corrigé | 7 | `2461e75` | `sanitizeBackup()` pour l'import, le chargement au démarrage et la restauration ; `schemaVersion: 1` ; dossiers, tags, emojis et chaque `<img src>` échappés. |
| AUD-07 | P2 | Corrigé | 7 | `bfac8b8` | `escJs()` dans Studio, 11 gestionnaires. Reel Studio 0.7.3. |
| #G6 | P2 | Partiel | 7 | `b75d656` | `state` envoyé et vérifié (redirection et fenêtre surgissante). **Reste ouvert :** PKCE et la vérification d'audience (il faut un serveur, phase 4). |
| AUD-14 | P2 | Corrigé | 5 | `02dafc0` | `itemId` conservé dans le cache et la sauvegarde ; les anciens caches sont rechargés une fois. Mesuré sur l'ancien code : Déplacer envoyait 0 suppression. |
| AUD-15 | P2 | Corrigé | 6 | `900fa77` | Six clés d'estimation manquantes (l'envoi de sous-titres était estimé à 1 unité au lieu de 400) ; l'envoi de vidéo vérifie le compteur `upload`. |
| AUD-16 | P2 | Corrigé | 5 | `bc66203` | Déplacer indique ce qui a été déplacé, copié sans retrait, ou non traité, et recharge les deux playlists. |
| AUD-17 | P2 | Corrigé | 6 | `19fd743` | Réponses GET mises en cache pour leur durée de vie, `ETag` lisible ou non. « non vérifié » : que Google expose `ETag` à la page — le correctif n'en dépend pas. |
| AUD-32 | P2 | Corrigé | 5 | `9f3ee1d` | État et bouton du Mode Musique supprimés ; `reelMusicMode` effacé au démarrage. |
| AUD-01 | P3 | Corrigé | 6 | `bd33480` | Playlists d'une chaîne plafonnées à 3 pages, avec pré-vérification. L'ancien test du #82 acceptait 20 appels ; il en exige désormais 3. |
| AUD-02 | P3 | **Ouvert** | — | — | La délégation d'événements relève du chantier L. D'ici là `'unsafe-inline'` reste ; AUD-44/50 donnent l'accès clavier sans elle. |
| AUD-08 | P3 | Partiel | 7 | `1701e14` | `form-action 'none'` sur les quatre pages ; CSP sur les deux pages outils (l'estimateur par empreinte de script). **Reste ouvert :** `frame-ancestors` demande un en-tête HTTP de l'hébergeur. |
| AUD-09 | P3 | Corrigé | 7 | `b1e4d53` | Chart.js servi par l'app (npm 4.4.1, non modifié) avec `integrity` ; un SRI sur cdnjs n'était pas possible ici (erratum E6). |
| AUD-10 | P3 | Corrigé | 7 | `bdcb9d1` | Motifs de jetons non ancrés, `msg` filtré, titres retirés du journal ; `diagnosticLog` purgé depuis AUD-03. |
| #G13 | P3 | Corrigé | 4 | `9942c2a` | Fragment lu et effacé avant toute attente dans `init()`. |
| AUD-18 | P3 | Corrigé | 6 | `039531b` | Chemin `If-Match` / 412 supprimé (il ne pouvait jamais s'exécuter). |
| AUD-19 | P3 | Corrigé | 6 | `e9a502f` | Un POST n'est renvoyé qu'après un 429 explicite. |
| AUD-20 | P3 | Corrigé | 6 | `0a1fcdb` | Les 403 `rateLimitExceeded` / `userRateLimitExceeded` sont retentés comme un 429. |
| AUD-21 | P3 | Corrigé | 6 | `2ce4031` | `chargeCall()` : chaque requête facturée est comptée avant l'envoi, après la remise à zéro du Pacifique, envois compris. |
| AUD-22 | P3 | Corrigé | 6, 9 | `d155169`, `f947283` | Toutes les limites et tous les coûts affichés viennent des tables de quota. Deux copies non relevées par l'audit (erratum E3). |
| AUD-23 | P3 | Corrigé | 5 | `9ffc40d` | La fusion charge chaque source, insère chaque vidéo une fois, estime ce qu'elle insérera. |
| AUD-24 | P3 | Corrigé | 5 | `7f3d630` | Favoris exclus ; candidats revérifiés en direct (1 unité pour 50 vidéos) ; rien n'est supprimé si la vérification échoue. Mesuré sur l'ancien code : 13 éléments supprimés alors qu'un seul était un vrai fantôme. |
| AUD-25 | P3 | Corrigé | 9 | `d011aa8` | Un seul classifieur, deux réponses imbriquées : `isTrack` (#17) et `isMusic` (#J1). Un simple oui/non aurait cassé l'une des deux spécifications (un set de deux heures est de la musique pour #J1, pas une piste pour #17). |
| AUD-27 | P3 | Corrigé | 9 | `f947283` | Environ 130 textes (l'audit en comptait 40+) et les huit du #80 ; en-têtes et statuts CSV, genres, tags proposés, dates. Le panneau de diagnostic du cache, destiné aux développeurs, reste en anglais. |
| AUD-30 | P3 | Corrigé | 9 | `741be04` | Pré-cache limité à l'app (avec `shared/core.js`), `ignoreSearch` hors ligne, cache nommé d'après la version, scripts et JSON d'abord par le réseau. L'échec d'installation s'est reproduit dans le banc de test, où les hôtes Google sont bloqués. |
| AUD-33 | P3 | Partiel | 9 | `02b6ce3` | Fonctions pures (couleurs, miniatures, durées) déplacées dans `shared/core.js`. **Reste ouvert :** l'application des thèmes, le sélecteur de couleur et les lecteurs IndexedDB (erratum E5). |
| AUD-34 | P3 | Corrigé | 9 | `11f9489` | Une fonction de formatage, deux styles ; une seule lecture ISO. Le tableau de bord en avait une copie non relevée (erratum E4). |
| AUD-35 | P3 | **Ouvert** | — | — | Chantier L. |
| AUD-36 | P3 | Corrigé | 9 | `a42b893` | `swallow(tag, err, level)` ; 72 blocs vides au moment du correctif (les 59 de l'audit plus ceux ajoutés par les lots 4 à 8), 56 passent par elle, 6 du journal commentés ; un test façon linter. |
| AUD-37 | P3 | **Ouvert** | — | — | Chantier L. L'app s'est allégée d'environ 47 Ko avec AUD-41. |
| AUD-39 | P3 | Corrigé | 9 | `06a4c43` | Bloc `CONFIG` figé ; le registre des clés est livré avec AUD-03. |
| AUD-40 | P3 | **Ouvert** | — | — | Chantier L. |
| AUD-42 | P3 | Corrigé | 8 | `93756c9` | Jetons revus par thème ; `--accent-text` borne tout accent par la syntaxe de couleur relative (≥ 4,9:1 en clair, ≥ 5,2:1 en sombre, pour toute teinte). |
| AUD-43 | P3 | Corrigé | 8 | `93756c9` | Fond du bouton principal borné, son texte sombre garde ≥ 6:1 ; bords des champs à 3:1. Aucun avertissement nécessaire dans le sélecteur. |
| AUD-44 | P3 | Corrigé | 8 | `b8998c5` | Une règle centrale donne à chaque cible cliquable un arrêt de tabulation et un rôle (`link` quand elle contient d'autres contrôles), Entrée/Espace l'activent ; boutons ↑/↓ pour réordonner. |
| AUD-45 | P3 | Corrigé | 8 | `e9894a9` | Rôle et nom de dialogue, focus qui entre et revient, reste de la page `inert`, Échap ancre le lecteur. Pas de `<dialog>` natif (erratum E7). |
| AUD-46 | P3 | Corrigé | 8 | `c67f33d` | Anneau `:focus-visible` global, app et Studio ; plus aucun `outline: none`. |
| AUD-47 | P3 | Corrigé | 8 | `00dda9f` | `lang` suit l'interface ; politique de confidentialité en français et en anglais. |
| AUD-48 | P3 | Corrigé | 8 | `0f2574f` | Région live, erreurs en alerte, compte à rebours suspendu sous le pointeur ou le focus. |
| AUD-50 | P3 | Corrigé | 8 | `9314ee9` | Studio : noms des commandes, barres de progression en curseurs, cartes au clavier, repères nommés. |
| #J3 | P3 | Corrigé | 9 | `fbd1c3b` | La catégorisation automatique propose le genre commun d'une playlist comme tag. |
| AUD-11 | P4 | Corrigé | 7 | `6fa9d63` | Le lien profond ne garde qu'un identifiant de playlist valide. |
| AUD-12 | P4 | Corrigé | 7 | `eb35508` | Lecteur RFC 4180 ; `Map`. |
| AUD-26 | P4 | **Ouvert** | — | — | Shorts carrés : dans aucun lot. |
| AUD-29 | P4 | Corrigé | 9 | `7258db3` | Mini-lecteur mort supprimé, avec son minuteur de progression. |
| AUD-31 | P4 | **Faux positif** | 6 | `9fc23e7` | La durée de cache d'une heure des tendances existait (`buildTrendingParams`) ; elle n'a pris effet qu'avec la correction d'AUD-17. Commentaire corrigé, test ajouté (erratum E1). |
| AUD-38 | P4 | Corrigé | 9 | `7258db3` | Fonctions inutilisées supprimées ; le `updateProgress` masqué renommé. |
| AUD-41 | P4 | Corrigé | 9 | `370d555` | `changelog.json`, en français (accents restaurés, vérifiés mécaniquement) et en anglais, chargé à la demande et échappé. La traduction anglaise n'a pas été relue par une personne. |
| AUD-49 | P4 | Corrigé | 8 | `e0e3b8a` | Les animations réduites coupent les keyframes et le défilement animé ; le clignotement d'une carte devient un contour fixe. |

Items du backlog touchés en chemin : **#80** corrigé avec AUD-27 ; **#78 / #79** (garde-fou de quota de la catégorisation automatique) toujours ouverts — AUD-36 rend cet échec visible dans le journal, sans ajouter le garde-fou.

## 3. Nouveaux constats

| ID | Sév. | État | Lot | Commit | Constat |
|---|---|---|---|---|---|
| AUD-51 | P2 | Corrigé | 6 | `c0260cd` | **Les couvertures de playlist personnalisées (#I1) ne pouvaient jamais être envoyées.** Le `img-src` de la CSP n'autorisait pas `blob:` : l'image choisie ne pouvait pas être décodée, et chaque tentative finissait sur « Cette image n'a pas pu être lue. ». Les tests du #I1 n'atteignaient jamais cette étape. Trouvé en testant AUD-15. |
| AUD-52 | P1 | Corrigé | 9 | `39da97f` | **XSS dans la vue Abonnements.** Les 100 premiers caractères de la description de chaque chaîne allaient dans `innerHTML` sans échappement ; le propriétaire de la chaîne contrôle ce texte. Absent de l'inventaire des points d'injection de l'audit (les titres étaient couverts, pas les descriptions). Trouvé en passant cette vue par `t()` (AUD-27). |
| AUD-53 | P3 | Corrigé | 8 | `2e9f846` | Un passage axe-core 4.13 (WCAG 2.0/2.1 A/AA, bibliothèque de test, thèmes sombre et clair) après les éléments du lot 8 : champs de la vue Sauvegarde sans libellé, étiquettes Beta sur une variable `--warning` jamais définie (2:1 sur blanc), filtre actif de la bibliothèque à 2,6:1 en clair, ligne d'accueil et menu de tri sans nom dans Studio. Violations : contraste de l'app 175 → 0, de Studio 44 → 0 ; libellés 42 → 0. |
| AUD-54 | P4 | **Ouvert** | — | — | Chaque exécution de `tests.html` signale une erreur de page, `Cannot set properties of null (setting 'textContent')`. Présente avant le lot 4 et après le lot 9. « non vérifié » : quel appel la déclenche, et si un utilisateur peut la rencontrer. |

## 4. Errata de l'audit

| # | Où | Correction |
|---|---|---|
| E1 | AUD-31 | **Faux positif.** La durée de cache des tendances était fixée dans `buildTrendingParams` (`_ttlMs`). Ce qui la rendait inopérante, c'était AUD-17 (pas de mise en cache sans `ETag` lisible). |
| E2 | AUD-04 | Sous-évalué : **7** gestionnaires utilisaient l'échappement défectueux, et non 2. |
| E3 | AUD-22 | Deux autres copies en dur : le coût de « créer la playlist » dans Découvrir, et le « / 10k » de la tuile de quota du tableau de bord. |
| E4 | AUD-34 | Une quatrième lecture des durées ISO dans les totaux du tableau de bord. |
| E5 | AUD-33 | Sur les 16 fonctions données comme dupliquées, **5 étaient identiques** ; les autres avaient déjà divergé (couleurs de repli, un `hexToHsl` qui échouait sur une valeur non textuelle, signatures différentes pour le sélecteur). Le correctif « modules partagés » est une extraction pour les fonctions pures, et un choix de conception pour le reste. |
| E6 | AUD-09 | L'empreinte SRI du fichier cdnjs ne pouvait pas être calculée depuis cet environnement (cdnjs injoignable) ; une empreinte devinée bloquerait le script. L'alternative de l'audit, servir le fichier avec l'app, a été retenue. |
| E7 | AUD-45 | Le `<dialog>` natif recommandé n'a pas été retenu : `showModal()` place la fenêtre au-dessus de la zone des notifications, si bien qu'une erreur levée depuis une fenêtre resterait grisée et inaccessible. `inert` sur le reste de la page donne le même confinement. |
| E8 | AUD-25 | « Un seul score » casserait une spécification : #J1 compte les mix et les sets live comme de la musique, #17 les garde hors de la vue Musique. Le correctif garde un classifieur unique avec deux réponses imbriquées. |
| E9 | AUD-27 | Le compte était d'environ 130 textes visibles, et non 40+. |
| E10 | AUD-36 | 72 blocs vides au moment du correctif (59 à `9c824eb`, plus quelques-uns ajoutés par les lots 4 à 8). |
| E11 | 05-testing §4 | Le pilote Playwright doit bloquer les service workers (`serviceWorkers: 'block'`) : une fois `sw.js` correctement installé (AUD-30), ses requêtes échappaient à `route()`. `sw.js` est désormais testé en l'exécutant dans une portée de worker simulée. Les hôtes de l'API YouTube et de la connexion Google ne passent jamais par le worker : la garantie de zéro quota n'a pas été touchée. |

## 5. Reste à faire

- **Chantier L :** AUD-02 (délégation d'événements, puis CSP stricte), AUD-35 (fonctions longues), AUD-37 (découpage du fichier), AUD-40 (état indépendant de l'ordre des déclarations), et les prérequis de la phase 4 de `04-tech-debt.md` §5.
- **Éléments partiels :** #G6 (PKCE, vérification d'audience), AUD-08 (en-tête `frame-ancestors` chez l'hébergeur), AUD-33 (thèmes, sélecteur, lecteurs du cache).
- **Dans aucun lot :** AUD-26 (Shorts carrés), #78/#79 (garde-fou de quota de la catégorisation automatique), AUD-54.
- **Documents :** les backlogs `.docx` ne sont pas mis à jour ; le journal des modifications anglais attend une relecture humaine.
- **CI :** le pilote Playwright reste un script local ; `05-testing.md` §4 recommande de le committer comme porte de CI (avec le blocage des service workers de l'erratum E11).
