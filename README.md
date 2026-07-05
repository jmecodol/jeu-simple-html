# 🚀 Guerre Spatiale

Un jeu de combat spatial multijoueur local, jouable directement dans le navigateur — aucune installation requise. Déployable en un clic sur **GitHub Pages**.

🎮 **[Jouer en ligne](https://[votre-username].github.io/jeu-simple-html/)**

---

## Modes de jeu

### ⚔️ Duel — Haut contre Bas
Deux équipes s'affrontent sur le même écran. L'équipe du haut (bleu clair) contre l'équipe du bas (orange).

- Touchez la **moitié haute** de l'écran pour invoquer un vaisseau dans l'équipe du haut.
- Touchez la **moitié basse** pour l'équipe du bas.
- La première équipe à atteindre **10 victoires** remporte le niveau.
- La première équipe à remporter **3 niveaux** gagne le match.
- La difficulté augmente à chaque niveau (vitesse des tirs, cadence de feu).

### 🤝 Équipe — 2 joueurs vs Ennemis
Deux joueurs coopèrent pour survivre à des vagues d'ennemis de plus en plus redoutables.

- Survivez à **5 vagues** pour gagner.
- Vous disposez de **10 vies partagées** — chaque destruction d'un vaisseau allié en consomme une.
- Les ennemis (vaisseaux rouges) se déplacent vers vous et tirent automatiquement.
- Chaque vague ajoute des ennemis supplémentaires avec plus de points de vie.

---

## Contrôles

| Action | Contrôle |
|---|---|
| Invoquer un vaisseau | Appuyer / cliquer sur l'écran |
| Déplacer un vaisseau | Glisser le doigt / la souris |
| Retirer un vaisseau | Relâcher |

Les vaisseaux **tirent automatiquement** sur les ennemis les plus proches. Évitez la **surchauffe** (le vaisseau devient semi-transparent et cesse de tirer).

---

## Bonus

Des pilules colorées apparaissent aléatoirement sur le terrain. Les récupérer confère un bonus temporaire à votre vaisseau :

| Icône | Bonus | Effet |
|---|---|---|
| ⚡ | Laser | Tir ultra-rapide en ligne droite |
| ◎ | Ring | Salve de 8 balles dans toutes les directions |
| » | Rapid | Cadence de tir doublée |
| ≡ | Triple | 3 balles en éventail |
| ⬡ | Shield | Absorbe un tir |
| ✦ | Scatter | 5 balles en large éventail |
| ◈ | Sniper | Balle unique très rapide et précise |
| ↻ | Bounce | Les balles rebondissent sur les murs |
| ◉ | Mega | Balle massive à large rayon |
| ○ | Ghost | Absorbe jusqu'à 3 tirs |
| ⊛ | Homing | Balles à tête chercheuse |
| ⁂ | Burst | Rafale serrée de 4 balles |
| ⇓ | Piercing | Traverse plusieurs ennemis |
| ◌ | Stealth | Vaisseau quasi-invisible |
| ✸ | Nova | Explose en 6 éclats à l'impact |
| ✹ | Quake | Salve radiale de 12 balles |
| ⬢ | Drill | Projectile ultra-rapide perforant |

---

## Déploiement sur GitHub Pages

Ce jeu est un **fichier HTML unique** sans dépendance externe.

1. Forkez ou clonez ce dépôt.
2. Dans les **Settings** du dépôt → **Pages**.
3. Sélectionnez la branche `main` et le dossier `/ (root)`.
4. Cliquez sur **Save** — le jeu est en ligne en quelques secondes.

---

## Développement local

Ouvrez simplement `index.html` dans un navigateur moderne. Aucun serveur ni build requis.

Si vous modifiez les fichiers dans `js/` (architecture modulaire), régénérez la version locale `file://` avec :

```bash
npm run build:legacy
```

Vérification rapide (échoue si `js/main.legacy.js` n'est pas à jour) :

```bash
npm run check:legacy
```

```bash
# Avec un serveur local optionnel (ex. VS Code Live Server, ou :)
npx serve .
```

---

## Technologies

- HTML5 Canvas
- Web Audio API (effets sonores génératifs)
- Pointer Events API (support souris, tactile et stylet)
- CSS pur — aucun framework
