# Handoff 2 : art 3D et décors des après-mondes

## Mission

Pour Kusaila, reprendre `Sc4rville/protocole.h`, branche de départ `handoff/protocole-five-lots`, puis créer ta branche `work/afterworld-art`. Produire des éléments 3D exploitables et un habillage détaillé pour les parcours enfer/paradis. Pas une galerie d'images ou un nouvel échantillon de moteur.

Lire `docs/asset-handoff.md`, `public/cellule-assets/asset-catalog.json`, `quality-review.json`, puis `src/afterworld/World.jsx` et `game-state.js`. Les images continuent d'arriver d'une autre session : préserver les originaux et journaux, ne pas relancer de génération déjà faite. Vérifier les fichiers présents avant d'utiliser une entrée planifiée.

Les JPG sont des références et propositions de couleur, PAS des meshes, rigs ou matériaux PBR complets. Le robot maître est `00-robot-master-blue-eyes.jpg`. Le GLB du lobby est provisoire et ne correspond pas à ce robot. Les vues humaines, poses et extensions ne prouvent pas une validation narrative finale. Ne pas prétendre reconstruire un humain animé en affichant son JPG.

## Propriété et droits

Écriture autorisée uniquement dans :
- `src/afterworld/art/` : composants visuels, exporteurs, aperçu isolé et tests visuels.
- `src/afterworld/public/media/models/` et `src/afterworld/public/media/materials/` : nouveaux exports locaux.
- `src/afterworld/public/licenses/afterworld-art-sources.json` et `docs/handoffs/results/02-art.json`.

Tu peux commiter et pousser sur TA branche, pas main. Pas de fusion, force-push, changement de droits GitHub, suppression de ressources ou publication. Ne pas changer la configuration Git. Identité humaine : Kusaila <nalydavinci@protonmail.com>. Aucun secret. Conserver les licences et provenance.

Ne pas modifier Player, Game, World, game-state, Sound, les packages, le bootstrap Phaser ou le lobby de Yann. Le lot 1 possède l'intégration et la physique. Produire un module importable, pas un patch concurrent de World. Si le snapshot afterworld manque, le signaler au lieu de réinventer son code.

## Direction et contraintes fixes

Enfer : usine froide en métal sombre mais éclairé, câbles continus, caniveaux, tôles, poutrelles, machines et presses articulées. Rouge/ambre pour les dangers, blanc pour les bords utiles. Donner une profondeur de salle, pas une piste seule dans le noir. Références 21 à 24, 28 à 30, 34 et 36.

Paradis : architecture blanche suspendue, îles asymétriques, bords arrondis, nervures sous les terrasses, végétation localisée, arches, lumière cyan discrète et couches de nuages. Références 25 à 29, 31 et 35, puis extensions réellement présentes. Le milieu des îles reste praticable. Pas de forêt de sphères identiques ou d'image d'environnement plaquée sur un cube.

Unité : mètre. Up : +Y. Avant du personnage : +Z, son parent Ecctrl l'oriente. Origine des accessoires : centre au sol. Humain : environ 1.8 m, pieds à y=0. Conserver des pièces distinctes pour piston, ressort, lampes et émission.

Dimensions de gameplay intouchables : voies centrées à -2.6/0/2.6 ; barrière par voie 2.4 x 0.8 x 0.6 ; barre de glissade largeur 7.9, bas 1.15, haut 1.65, profondeur 0.75 ; bloc 2.4 x 3.8 x 1.4. Presse : 2.4 de largeur pour une voie, 5 pour deux voies. Les îles utilisent exactement les dimensions de HEAVEN. Le visuel peut détailler ces volumes sans déplacer la surface ou masquer le danger.

Le mannequin animé `src/afterworld/public/media/AnimationLibrary.glb` est Quaternius CC0 et reste la solution de secours. Ne pas l'écraser. Livrer un remplaçant seulement s'il est réellement animé et vérifié ; sinon documenter ce qui reste provisoire plutôt que livrer une pose figée. Réutiliser une base sous licence vérifiée avant de réécrire un rig entier.

## Interface de livraison

Créer `src/afterworld/art/AfterworldArt.jsx` avec des exports séparés, sans collider ni contrôle du jeu :

```jsx
export function HumanVisual({ motion, sliding, gliding, paused, t }) {}
export function PropVisual({ kind, width = 2.4, phase = 'open', active = false, t = 0 }) {}
export function WorldDressing({ mode, islands, elapsed = 0 }) {}
```

`motion` : idle, walk, run, jump, land. `kind` : hurdle, overhead, block, press, pad, checkpoint, exit. `phase` : open, warning, closed, opening. `t` et `elapsed` viennent du jeu ; pas de timer indépendant qui continue en pause. Exporter seulement les composants réellement terminés et les décrire dans un manifeste. Aucun retour d'état vers la physique.

Les GLB, textures et décodeurs doivent être locaux, avec chemins relatifs compatibles avec `/afterworld/`. Pas de HDR, fonte ou modèle téléchargé au runtime. sRGB pour base couleur ; ne pas déclarer une image couleur comme normale. Répétition UV à l'échelle des objets. Instancer les répétitions et limiter les lumières ; ne pas promettre un FPS non mesuré.

## Vérification et rendu attendu

Construire un aperçu séparé dans `art/` sur Vite existant, sans toucher au menu principal. Montrer chaque accessoire et les deux ambiances. Vérifier silhouettes, dimensions, pivots, faces, textures, détails proches et cadrage de parcours à 1280x800 et 390x844. Capturer une course, un saut, une glissade, un plané et une réception pour tout personnage livré. Lire les captures et corriger les défauts visibles.

Préserver les serveurs locaux actifs, en particulier 5186 ; une VM doit lancer son propre serveur. Réutiliser dépendances et assets présents, pas de génération ou installation répétée. Ne pas prendre le contrôle du navigateur ou du bureau de Kusaila.

Terminer avec la branche poussée et `docs/handoffs/results/02-art.json` : exports disponibles, fichier/source/licence de chaque ressource, statut provisoire/final réellement justifié, dimensions vérifiées, captures, limites et consignes d'import pour le lot 1. Aucun changement aux documents communs des autres sessions.
