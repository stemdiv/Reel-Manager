# Passe 6 — Accessibilité (WCAG 2.1 AA, lecture de code)

> Traduction française de [`../06-accessibility.md`](../06-accessibility.md). En cas d'écart, la version anglaise fait foi pour les extraits de code.

Base `origin/main` @ `9c824eb`, app **v1.27.3**. Le skill `design:accessibility-review` n'est pas installé : j'ai donc appliqué à la main la checklist du handoff. Cette passe est **uniquement une analyse statique** : aucun lecteur d'écran, aucun rendu navigateur. Les ratios de contraste sont calculés à partir des jetons CSS avec un script jetable (oklch → sRGB linéaire → luminance relative WCAG). Toute référence `:N` sans nom de fichier désigne `youtube-playlist-manager.html`.

## Synthèse

| ID | Sév. | WCAG | Constat |
|---|---|---|---|
| AUD-42 | P3 | 1.4.3 | **Thème clair :** les couleurs d'accent et sémantiques utilisées comme texte tombent à 1,7–2,6:1 ; `--text3` 3,9:1. `--text4` échoue dans tous les thèmes (2,3–2,6:1). |
| AUD-43 | P3 | 1.4.3 / 1.4.11 | Les accents choisis par l'utilisateur (skin personnalisé, thèmes Studio) n'ont aucune garde de contraste. Le texte de `.btn-primary` est figé à `#1a0a06`. Les bordures sont à 1,4:1 par rapport aux surfaces. |
| AUD-44 | P3 | 2.1.1 / 4.1.2 | 86 éléments `div`/`span`/`img` cliquables ne sont pas focusables (0 `tabindex`, 0 `role="button"`). Le réordonnancement se fait uniquement au glisser. |
| AUD-45 | P3 | 2.4.3 / 4.1.2 | Modales : ni `role="dialog"` ni `aria-modal`, le focus n'y est ni déplacé, ni piégé, ni restauré. La surcouche du lecteur ignore Échap. |
| AUD-46 | P3 | 2.4.7 | Aucun style `:focus-visible` nulle part. Les champs de formulaire définissent `outline: none` et le remplacent par une teinte de bordure à 40 % d'alpha. |
| AUD-47 | P3 | 3.1.1 | `<html lang="fr">` n'est jamais mis à jour quand l'interface passe en anglais. La politique de confidentialité est en français seulement, codée en dur. |
| AUD-48 | P3 | 4.1.3 | Les toasts (tous les retours) n'ont pas d'`aria-live`, et les toasts d'action disparaissent automatiquement après 10 s |
| AUD-49 | P4 | 2.3.3 (AAA) / bonne pratique | `prefers-reduced-motion` couvre les transformations au survol et `--dur`, mais pas les keyframes de 0,3 s des vues/modales/toasts, le flash de carte de 1,6 s, ni le défilement fluide |
| AUD-50 | P3 | 4.1.2 / 2.1.1 | Reel Studio : 0 attribut ARIA / role / tabindex, 17 éléments cliquables non focusables |
| — | ✅ | 2.5.5 (AAA) / mobile | Cibles tactiles d'au moins 44 px sous 768 px pour `.btn`, `.btn-icon`, `.sidebar-item` et les contrôles de formulaire |
| — | ✅ | 1.4.3 | Thème sombre et thèmes Studio : le texte courant passe largement. `.btn-primary` passe sur tous les skins prédéfinis. |

L'inventaire ARIA de toute l'app montre à quel point il est maigre : **1** `aria-label` (le menu hamburger, `:1383`), **1** `role` (`role="group"`), **4** `aria-pressed`, et **0** `aria-modal`, `aria-live`, `aria-expanded` et `tabindex`. Il y a 155 éléments `<button>`.

---

## 1. Contraste par thème et par skin

Jetons : thème sombre `:root` (`:23-35`), thème clair `body.light-theme` (`:80-92`), base Studio (`:6787-6796`), skins `SKINS` (`:7089-7100`, accent = `oklch(0.72 C H)` via `setSkinVars` `:7116-7122`), préréglages Studio `THEME_PRESETS` (`:6799-6800`).

### 1.1 Jetons de texte (AA : 4.5:1 texte normal, 3:1 grand texte / UI)

| Thème | `--text` | `--text2` | `--text3` | `--text4` | bordure vs surface |
|---|---|---|---|---|---|
| Sombre (fond) | 16,81 ✅ | 10,25 ✅ | 4,78 ✅ | **2,55 ❌** | 1,40 |
| Sombre (sur `--surface2`) | 15,19 | 9,26 | **4,32 ❌** | **2,31 ❌** | — |
| Clair (fond) | 16,19 ✅ | 8,02 ✅ | **3,91 ❌** | **2,39 ❌** | 1,50 |
| Clair (sur `--surface2`) | 15,10 | 7,48 | **3,64 ❌** | **2,23 ❌** | — |
| Studio Bi/Duo/Tri (fond) | 17,17 ✅ | 10,47 ✅ | 4,88 ✅ | **2,61 ❌** | 1,39 |

Utilisation :
- `color: var(--text3)` apparaît 74 fois, notamment pour les métadonnées, les compteurs et les indications.
- `color: var(--text4)` apparaît 18 fois, par exemple pour les mini-barres du tableau de bord `:8006` `font-size:9px;color:var(--text4)`.
- 58 déclarations ont une taille de police de 8–10 px : la tolérance « grand texte » ne s'applique donc jamais à elles.

### 1.2 Couleurs d'accent et sémantiques utilisées comme texte

| Skin (`oklch 0.72 C H`) | sur fond sombre | sur fond **clair** | texte `.btn-primary` `#1a0a06` sur l'accent |
|---|---|---|---|
| coral | 7,26 | **2,57** | 7,10 |
| amber | 7,57 | **2,47** | 7,41 |
| lime | 8,30 | **2,25** | 8,13 |
| teal | 8,39 | **2,23** | 8,21 |
| ocean | 8,17 | **2,29** | 7,99 |
| indigo | 7,83 | **2,39** | 7,66 |
| violet | 7,59 | **2,46** | 7,43 |
| rose | 7,34 | **2,54** | 7,19 |
| mono | 7,94 | **2,35** | 7,77 |
| gold | 7,81 | **2,39** | 7,65 |

| Sémantique | sur fond sombre | sur fond clair |
|---|---|---|
| `--green` | 9,71 | **1,92** |
| `--yellow` | 11,13 | **1,68** |
| `--orange` | 9,23 | **2,02** |
| `--blue` | 8,14 | **2,29** |
| `--danger` | 5,54 | 3,37 (grand texte uniquement) |

`color: var(--accent)` apparaît 47 fois (liens, états actifs, compteurs). L'**indicateur de quota**, le seul nombre de l'en-tête, est affiché en vert, jaune ou danger (`:6155` `` `<span style="color:${color}" …>${APP.quota.pool} / ${QUOTA_LIMITS.pool}</span>` ``). Dans le thème clair, il se situe à 1,7–3,4:1.

Les thèmes Studio reposent sur une base noire verrouillée : leurs préréglages passent donc sur fond sombre, à 5,2–16,4:1 comme texte et à 5,0–15,7:1 pour `.btn-primary`. Mais `body.light-theme` surcharge toujours les surfaces sous un thème Studio (commentaire `:7013-7014` « so body.light-theme keeps overriding surfaces in light mode »). Dans ce cas, les préréglages utilisés comme texte tombent à **1,16–3,67:1**. Par exemple, `#e8e8e8` donne 1,16 et `#f5e642` donne 1.22.

### AUD-42 (P3) — correctif
- Dériver un `--accent-text` distinct pour le thème clair : même teinte, L ≈ 0,50 en oklch, ce qui donne ≥ 4,5:1 sur `#f8f9fa`.
- Assombrir de la même façon les couleurs sémantiques de texte en mode clair.
- Relever `--text3` à ≈ `#6b6e76` (clair) ainsi que `--text4` pour que les deux atteignent 4,5:1, ou réserver `--text4` aux usages désactivés/décoratifs.

**Effort** S (jetons) + M (auditer les 47 usages de l'accent comme texte).

### AUD-43 (P3) — couleurs choisies par l'utilisateur et bordures
- `setAccentVars(hex)` accepte n'importe quelle couleur du sélecteur intégré à la page (#74), et `.btn-primary { background: var(--accent); color: #1a0a06; }` (`:144`) conserve un texte sombre. Un accent personnalisé comme `#1f2a6b` donne des boutons sombre sur sombre. **Correctif :** choisir `#1a0a06` ou `#fff` selon la luminance calculée, et avertir dans le sélecteur en dessous de 4,5:1.
- Bordures : 1,39–1,50:1 par rapport aux surfaces. Lorsqu'une bordure est la seule limite visible d'un champ (`.form-control`, `:927-930`), le critère 1.4.11 exige 3:1.

**Effort** S.

## 2. Navigation au clavier

### AUD-44 — cibles cliquables non focusables (P3)
L'analyse de l'ensemble du balisage compte des `onclick` sur 77 `<div>`, 8 `<span>` et 1 `<img>`. Il y a **0** `tabindex` et **0** `role="button"`. Exemples :
- `:8296` lignes de légende du tableau de bord `<div class="dash-pl-row" … onclick="…drillFromDashboard(…)">`
- cartes de playlist, cartes de statistiques (`.stat-card[onclick]` est stylé à `:268+`)
- miniatures du plan de visionnage, la tuile entière d'un résultat Discover (`:11947` `<div … onclick="event.stopPropagation();playVideo(…)">`)
- mini-miniature `:2747` `<img class="mini-thumb" … onclick="expandPlayer()">`

Un utilisateur au clavier ne peut pas ouvrir une playlist depuis le tableau de bord, explorer les statistiques en détail, ni lire un résultat Discover depuis sa miniature.
- Le **réordonnancement** se fait uniquement par glisser-déposer (`:10561` `draggable="true" ondragstart=…`, le seul endroit glissable). Il n'existe aucune alternative par bouton ou au clavier, ce qui enfreint 2.1.1.
- Les colonnes du **Deck** sont construites selon le même modèle de `div` cliquable (`:13312+`), « non vérifié » élément par élément.

**Correctif :** en faire des `<button>` ou des `<a href>` (cela vient naturellement avec la refactorisation par délégation d'événements d'AUD-02), et ajouter des boutons « monter / descendre » en mode réordonnancement. **Effort** M.

### AUD-45 — modales et surcouche du lecteur (P3)
- `:2678` `<div class="modal-overlay" id="modalOverlay" onclick="closeModal(event)">` : pas de `role="dialog"`, pas d'`aria-modal`, pas de libellé.
- `openModal()` (`:15188-15191`) définit `innerHTML` et ajoute `.active`. **Le focus n'est pas déplacé dans la boîte de dialogue**, n'y est pas piégé, et n'est pas rendu au déclencheur à la fermeture (`:15243-15247`).
- Échap ferme la modale générique (`:15372-15373` `} else if (e.key === 'Escape') { closeModal(); }`) ✅, mais **pas** la surcouche du lecteur (`:2686`). Le lecteur ancré (`:425-452`) n'est accessible par Tab que si le focus se trouve par hasard à proximité.

**Correctif :** utiliser un `<dialog>` natif avec `showModal()` (piège à focus intégré, Échap, `::backdrop`), et restaurer le focus sur le `document.activeElement` capturé à l'ouverture. **Effort** S–M.

### Raccourcis clavier
Ctrl/Cmd+K ouvre la recherche et Ctrl/Cmd+B ouvre la sauvegarde (`:15362-15371`). Ctrl+B masque le raccourci des favoris du navigateur dans Firefox (P4). Ils ne sont documentés qu'à des endroits « non vérifié ».

## 3. ARIA sur les boutons à icône
- 44 boutons ne contiennent qu'un SVG. 39 portent `title=` ou `data-i18n-title=`, que les navigateurs utilisent comme nom accessible.
- **4 n'ont aucun nom :** `:2753-2756` (précédent / lecture-pause / suivant / fermer de `#miniPlayer`), une interface morte selon AUD-29.
- Plusieurs valeurs de `title` dans les templates JS sont des littéraux anglais, pas des `t()` : `:9578` `title="Rename"`, `:12870` `title="Edit tags"`, `:13087` `title="Edit"`. Le nom accessible reste en anglais dans l'interface française (lié à AUD-27).
- État des bascules : `aria-pressed` est utilisé 4 fois (l'ancien bouton musique, `:10655`, est mort). Le filtre de bibliothèque, le filtre Shorts et les pastilles de thème/skin n'exposent aucun état pressé ou sélectionné, « non vérifié » de façon exhaustive.

**Correctif :** donner aux boutons à icône un `aria-label` via `t()` et ajouter `aria-pressed` sur les bascules. **Effort** S.

## 4. Focus visible — AUD-46 (P3)
- `grep` ne trouve **aucune** règle `:focus-visible` dans l'app.
- Les boutons sont réinitialisés (`:105` `button { … border: none; background: none; }`) ; les anneaux de focus du navigateur y survivent, mais de façon inégale selon les thèmes. Les anneaux sombres du navigateur sur `#0a0b0d` sont difficiles à voir, « non vérifié » visuellement.
- Champs de saisie : `:927` `outline: none;` puis `:930` `.form-control:focus { border-color: var(--accent-line); … }`. `--accent-line` est l'accent à **40 % d'alpha** (`:39`). Sur une bordure de base à 1,4:1, le changement au focus est discret. Même motif pour les champs du sélecteur de couleur (`:198-200`) et le champ de l'ID client (`:297-298`).

**Correctif :** ajouter une règle globale `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` et supprimer les déclarations `outline: none`. **Effort** S.

## 5. Cibles tactiles — ✅ avec des lacunes
- `@media (max-width: 768px)` : `.sidebar-item { … min-height: 44px; }` (`:1293`), `.btn { min-height: 44px; … }` (`:1294`), `.btn-icon { min-width: 44px; min-height: 44px; … }` (`:1296`), contrôles de formulaire à 44 px (`:1297`). #72 ajoute des cibles plus grandes dans la palette Studio.
- Lacunes : `.btn-sm` (`:152` `padding: 5px 10px; font-size: 12px`) est utilisé pour la plupart des actions de ligne (renommer, supprimer, modifier les tags). Que la hauteur minimale mobile de `.btn` s'y applique dépend du fait que l'élément porte les deux classes, ce qui est le cas dans les templates lus (`class="btn btn-secondary btn-sm"`).
- Les contrôles du lecteur ancré se réduisent à `padding: 5px 7px` avec des icônes de 14 px (`:445`, `:488`), soit environ 28 px.
- Les pastilles d'abonnement et les chips sont « non vérifié ».

## 6. Langue — AUD-47 (P3)
- `:2` `<html lang="fr">` (et `reel-studio.html:2`). `applyLanguage()` (`:4342+`) met à jour le texte et `langToggle` mais ne définit jamais `document.documentElement.lang` : une interface en anglais est donc lue avec une prononciation française (3.1.1, niveau A).
- La modale de politique de confidentialité est codée en dur en français (`:15198-15199` `Politique de confidentialité — Playlist Manager`, `toLocaleDateString('fr-FR')`). C'est de plus un texte juridique affiché aux utilisateurs EN (backlog #8).

**Correctif :** définir `lang` dans `applyLanguage`, et déplacer la politique dans `I18N`. **Effort** S.

## 7. Messages d'état — AUD-48 (P3)
`showToast()` (`:15251-15270`) ajoute un `<div class="toast">` avec `textContent`. Le conteneur n'a ni `role="status"` ni `aria-live` : les succès, erreurs et avertissements de quota sont donc muets pour les utilisateurs de lecteur d'écran (4.1.3). La durée de vie est de 3 s, ou de 10 s quand le toast porte une action (`:15258`, `:15265`). Une action que l'utilisateur ne peut pas atteindre en 10 s, comme « Reconnect » (`:7297`), disparaît (2.2.1). **Correctif :** `aria-live="polite"` (`assertive` pour les erreurs), et suspendre la disparition au survol ou au focus. **Effort** S.

## 8. `prefers-reduced-motion` — AUD-49 (P4)
Couvert ✅ :
- `:76-78` `--dur: 0ms`
- `:268-280` élévations au survol des thèmes Studio
- `applyTheme()` ignore les jetons de mouvement (`:7023-7026`)
- Reel Studio couvre son ticker, son égaliseur, ses cartes et ses effets de survol (`reel-studio.html:36, 69, 85, 91, 103, 172, 187, 217, 385`)

Non couvert :
- les animations par keyframes à durée fixe non liées à `--dur` : `:587` `.view.active { … animation: fadeIn 0.3s; }`, `:893` modale `fadeIn 0.2s`, `:905` `slideUp 0.3s`, `:945` toast `slideInRight 0.3s`, `:868` `plCardFlash 1.6s`
- `:95` `html { scroll-behavior: smooth; }` et `:8380` `scrollIntoView({ behavior: 'smooth' … })`

Ce sont de petits fondus, donc uniquement de niveau AAA, mais l'intention de respecter la préférence de mouvement réduit est déjà présente dans le code. L'étendre : `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation: none !important; scroll-behavior: auto !important; } }`. **Effort** S.

## 9. Reel Studio — AUD-50 (P3)
`reel-studio.html` contient **0** attribut `aria-*`, `role` ou `tabindex` et 17 éléments `<div>/<span>/<article>` cliquables (par ex. `:1136` `<article class="card pl-card reactive" onclick="go('playlists','…')">`, `:1483`). Sa feuille de lecteur se replie hors écran (AUD-28), et les boutons de transport de la barre inférieure sont des glyphes texte (`⏮ ▶ ⏭`, `reel-studio.html:512-514`) avec seulement un `title`. Il a les mêmes besoins que l'app : boutons/liens pour les cartes, `aria-label`, `lang`, styles de focus. **Effort** M.

## Non vérifié
- Rendu réel : la visibilité de l'anneau de focus du navigateur selon le thème, le contraste calculé réel des surcouches translucides (fonds `--accent-soft`), et le texte sur les miniatures (badges de durée `rgba(0,0,0,0.8)` sur les images, `:10569`).
- Comportement au lecteur d'écran des contrôles du lecteur IFrame YouTube (tiers).
- Interactions du Deck et du plan de visionnage, élément par élément.
