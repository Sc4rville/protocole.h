# Relais assets · protocole.h

## Point d'entrée

Dépôt : `Sc4rville/protocole.h`. Dossier local : `/home/kusaila/future/paris-ai-gaming-hack-2026-09-26/protocole.h`.

Lire ce document, puis `public/cellule-assets/asset-catalog.json` et `docs/equipe/kusaila.md`. Galerie locale : `http://127.0.0.1:8766/`. Depuis le serveur Vite du dépôt, utiliser `/cellule-assets/`.

## État vérifié à la reprise du 26 septembre 2026

- Les 37 entrées du catalogue V1 ont une image JPEG. Le journal contient 38 générations réussies, dont le premier robot maître écarté, et aucune erreur enregistrée.
- Les quatre vues humaines sont terminées. Le processus précédent est terminé : ne pas relancer les mêmes jobs.
- Le robot de référence à conserver est `public/cellule-assets/00-robot-master-blue-eyes.jpg`. `00-robot-master.jpg` est un essai conservé, pas le maître à utiliser.
- Ce premier lot constitue un point de reprise, pas la livraison finale. Kusaila demande un pack beaucoup plus large et les objets entièrement cadrés : les corrections et l'extension suivront dans un lot séparé.
- Défauts déjà repérés : verrou de contention tronqué, résidus de décor sous certains objets, plusieurs angles de personnage imparfaits. Conserver les originaux ; les corrections auront de nouveaux noms et une sélection explicite.

## Ce que contient le pack

Images de référence 2D de personnages, accessoires, modules de parcours et environnements, plus quatre propositions de base couleur. Ce ne sont pas des meshes, GLB, rigs, animations, sprites détourés ni matériaux PBR complets. Le fichier `public/lobby-test/assets/robot-provisional.glb` reste provisoire et ne correspond pas au nouveau robot.

Le catalogue indique la fonction prévue de chaque image. `generation-results.jsonl` conserve les fichiers, dimensions, hachages, modèle et références réellement utilisés. Les prompts existants sont dans `generation-plan.json`, `robot-eyes-plan.json` et `game-extension-plan.json`.

## Consigne pour la session qui reprend

Partir des fichiers réellement présents et du catalogue, sans régénérer le pack. Vérifier les mises à jour du dépôt avant l'intégration. Le robot maître et la cellule approuvée définissent l'identité ; l'humain et les extensions sont des propositions, pas une nouvelle identité narrative validée par l'équipe.

Réutiliser les références pour construire des éléments séparés : robot articulable, fauteuil, verrou, molette, pince, sonde et parties mobiles. Ne pas convertir une image de salle en faux niveau navigable. Les collisions, dimensions de parcours, timings, commandes et règles de victoire restent indépendants des visuels.

Respecter les fichiers des autres sessions : `src/scenes/Main.tsx`, `src/sprites/Player.ts`, `src/platformer/`, les cartes de niveau et `docs/implementation-handoff.md` ont des modifications locales préexistantes. Ne pas les écraser ni les embarquer dans un commit d'assets. Le raccord verdict/lobby reste à coordonner avec Yann/Sc4rville selon le contrat V1.

## Reprise et secrets

Le `/handoff` intégré au CLI doit être lancé depuis cette session ouverte dans le dépôt, pas depuis `/home/kusaila`. La documentation du CLI précise que les modifications non committées sont transférées ; pousser les livrables sélectionnés donnera également un point de reprise Git explicite.

Les clés sont uniquement dans l'environnement ou les secrets provisionnés. Ne jamais les placer dans le pack, la galerie ou Git. Réutiliser les serveurs actifs ; ne démarrer la galerie sur 8766 que si aucun serveur n'y écoute.
