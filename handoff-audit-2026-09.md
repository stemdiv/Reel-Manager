# Handoff Claude Code — Audit complet du code (septembre 2026)

Rédigé le 24 septembre 2026. Cible : l'ensemble du dépôt `stemdiv/Reel-Manager`, en priorité `youtube-playlist-manager.html` (v1.12.1 au moment des handoffs lots 1–3 ; relire `APP_VERSION` pour la version réelle), `reel-studio.html`, `tests.html`, le service worker et les documents présents à la racine. Modèle : Opus 5.5.

## Règles pour toute la session

- **Lecture seule.** Aucune modification de code. Seuls fichiers créés : ceux de `audit/2026-09/`. Un défaut qui appelle un correctif est consigné dans le rapport, jamais corrigé.
- **Aucun appel à l'API YouTube.** Pas d'OAuth et aucune requête consommant du quota. L'exécution locale de `tests.html` est autorisée.
- **Démarrage en plan mode.** Présenter le plan des passes, puis attendre mon « go ». Après chaque passe, résumer en 5 lignes et attendre mon « go » pour la suivante.
- **Travail sur la branche `audit/2026-09`.** Un commit par passe. Les commandes `git commit -m "..."` sont données prêtes à coller, avec un message en anglais préfixé `audit:`.
- **Rapport final bilingue FR + EN.** Les rapports intermédiaires de chaque passe peuvent être en anglais.
- **Preuves obligatoires.** Chaque constat cite `fichier:ligne` et un extrait de 1 à 3 lignes. Ce qui n'a pas pu être vérifié est marqué « non vérifié », sans supposition.
- **Identifiants provisoires `AUD-01`, `AUD-02`…** Le prochain numéro de backlog libre n'est pas confirmé (#77 si #76 est le dernier de la v6.4). Si un constat recoupe un item existant (#G6, #B12, #76…), citer cet identifiant au lieu d'en créer un.

## Référentiels à charger d'abord

Lire s'ils sont présents à la racine du dépôt (pas de dossier `docs/`), et signaler explicitement ceux qui manquent :

- les handoffs lots 1, 2 et 3 (`claude_handoff-lot1/2/3-claude-code.md`) ;
- `YouTube-API-Usage-Map-v2` et `Unused-API-Opportunity-Analysis-v2` ;
- `Music Mode — Design Spec v1` ;
- l'audit code/API du 14 mai 2026 (conformité ytApi, cache, ETag, retries, fields=) ;
- `CLAUDE.md`, s'il existe.

## Passe 0 — Réconciliation (sans skill)

Pour chaque item des lots 1–3, attribuer le statut **livré / partiel / non livré**, avec la preuve dans le code. Vérifier aussi les items « probablement faits » :

- CR1/#G1 + #G12 : XSS et CSP (ligne ~10) ;
- CR3/#G3 : cache après écriture ;
- CR2/#G2 : lecture d'une playlist entière ;
- CR5/#G5 : purge RGPD `userInfo` ;
- #J1, #J2, #J3 : Mode Musique.

Sortie : `audit/2026-09/00-reconciliation.md`, un tableau par lot.

## Passe 1 — Architecture (`engineering:architecture`)

Cartographier les modules logiques du monolithe HTML : état `APP`, `ytApi`, quota, cache, i18n, vues, lecteur, backup, log, service worker. Tracer les flux de données et **chaque appel à l'API YouTube avec son coût et son bucket**. Évaluer l'écart avec la cible SaaS Phase 4 (proxy Node/Express, PostgreSQL, Redis) : ce qui devra être extrait, et dans quel ordre.

Sortie : `01-architecture.md`, avec un diagramme Mermaid.

## Passe 2 — Sécurité (`/security-review`)

Points obligatoires :

- **Cycle OAuth.** Token dans le hash de l'URL (#G13), absence de PKCE ou de `state` (#G6), expiration du token, stockage dans `localStorage`.
- **XSS.** Tout rendu de titre, description, nom de chaîne ou tag issu de l'API ou saisi par l'utilisateur ; tout usage de `innerHTML`.
- **CSP.** Complétude de la politique (domaines, `unsafe-inline`, `frame-src` YouTube).
- **Injection de formules CSV à l'export** (#G10).
- **Log diagnostic.** Solidité de `_logRedact()`, fuites possibles dans les exports.
- **Import de backup JSON.** Validation du schéma et pollution de prototype.
- **Deep links** (`?bookmark=`) : validation des entrées.

Sortie : `02-security.md`.

## Passe 3 — Revue de code (`engineering:code-review`, sur l'ensemble du code et non sur un diff)

Zones prioritaires :

- **`ytApi`.** Retries et idempotence des POST/PUT/DELETE, 429/5xx, ETag/If-Match, cache LRU et invalidation après écriture, `fetchAllPages`.
- **Quota.** Conformité au modèle à trois buckets (#76 : pool 10 000, search 100 appels, upload 100 appels). Contrôler les copies de la limite codées en dur, la migration `quotaUnits`, les pré-vols et le reset Pacifique.
- **Actions groupées.** « Move » qui ne supprime pas la source (#G7), détection des fantômes (#G8), complexité O(n²) du nettoyage (#G9).
- **Mode Musique.** Écarts entre le scoring implémenté et la spec : « +Topic » +0,9, categoryId 10 +0,7, durée 2–7 min, motif « Artist - Title », seuils 80 % / 50–80 %, overrides permanents.
- **Filtre Shorts** (#68) : heuristique `embedHeight > embedWidth && durée ≤ 180 s`, playlists `UUSH`/`UULF`, fallback HEAD.
- **i18n.** Parité des clés FR et EN, textes codés en dur hors `t()`.
- **Conformité CGU YouTube.** Pas de lecture audio seule, lecteur visible, attribution. Vérifier aussi #B12 (le lecteur continue en arrière-plan).
- **Service worker.** Stratégie de cache et risque de CSS ou JS obsolètes après une mise à jour.

Sortie : `03-code-review.md`.

## Passe 4 — Dette technique (`engineering:tech-debt`)

À examiner :

- code mort, duplications, fonctions trop longues ;
- #G15 à #G19 : `parseDuration`, code mort, `APP.lang`, fusion par id, dirty flag ;
- taille et découpage du fichier unique ;
- constantes magiques et lignes de code en dur citées dans les handoffs.

Classer par coût/bénéfice et proposer un ordre de refactoring compatible avec l'extraction backend de la Phase 4.

Sortie : `04-tech-debt.md`.

## Passe 5 — Stratégie de test (`engineering:testing-strategy`)

Base : les cas de `tests.html` (54 cas au 16 septembre ; recompter). Identifier les comportements critiques sans test, en priorité quota, opérations d'écriture, migration de l'état, import/export de backup, parsing des URL de playlist et scoring musique. Proposer une liste de cas à ajouter, chacun avec son nom, son entrée et le résultat attendu, sans les écrire.

Sortie : `05-testing.md`.

## Passe 6 — Accessibilité (`design:accessibility-review`)

Audit WCAG 2.1 AA par lecture du code :

- contrastes pour chaque thème et skin ;
- navigation au clavier (modales, Deck, lecteur, mini-player) ;
- rôles et labels ARIA sur les boutons-icônes ;
- focus visible ;
- cibles tactiles sur mobile ;
- `prefers-reduced-motion`.

Sortie : `06-accessibility.md`.

## Passe 7 — Consolidation

Produire `audit/2026-09/code-review-2026-09.md`, **bilingue FR + EN** (section FR puis section EN, ou colonnes jumelles) :

1. **Synthèse** : 10 lignes maximum, avec le top 5 des risques.
2. **Tableau des constats dédupliqués.** Colonnes : `ID | Sévérité P1–P4 | Catégorie | fichier:ligne | Constat | Preuve | Correctif recommandé | Effort S/M/L | Item existant`.
3. **Section « Conformité CGU YouTube ».**
4. **Section « Régressions depuis l'audit de mai 2026 ».**
5. **Proposition de lots Claude Code** pour les correctifs, au format des handoffs lots 1–3, avec un commit par item.
6. **Liste des référentiels manquants ou non vérifiés.**

Barème de sévérité :

- **P1** : sécurité exploitable, perte de données ou violation des CGU ;
- **P2** : bug fonctionnel ou erreur de quota ;
- **P3** : maintenabilité ou performance ;
- **P4** : cosmétique.

Clôture : ouvrir une PR `audit/2026-09 → main` intitulée `audit: full code review 2026-09`, avec la synthèse en description. Aucun merge.
