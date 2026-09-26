# Relais assets · protocole.h

## Point d'entrée

Dépôt : `Sc4rville/protocole.h`. Dossier local : `/home/kusaila/future/paris-ai-gaming-hack-2026-09-26/protocole.h`.

Lire ce document, puis `public/cellule-assets/asset-catalog.json` et `docs/equipe/kusaila.md`. Galerie locale : `http://127.0.0.1:8766/`. Depuis le serveur Vite du dépôt, utiliser `/cellule-assets/`.

## Livraison du 26 septembre 2026

- **96 références sélectionnées** dans `asset-catalog.json`, avec un identifiant stable, le fichier retenu et ses limites d'intégration.
- **109 images Google** : 38 sorties initiales, 9 retouches de cadrage, 59 extensions et 3 corrections ciblées. Les 59 extensions couvrent 43 objets/modules, 11 références de personnage ou de pose et 5 lieux. Aucun de ces jobs ne reste à produire.
- **6 dérivations locales**, chacune en JPEG et PNG RGBA ; 5 sont retenues, le premier détourage du verrou est écarté. Cela représente **121 fichiers de référence**, variantes et essais compris, hors planches.
- **8 planches de la sélection** dans `public/cellule-assets/contact-sheets/`. Leur `snapshot.json` fige les 96 entrées présentées ; les empreintes sont dans `delivery-manifest.json`.
- Tous les originaux restent conservés. Une génération réussie ou une présence dans la sélection n'est pas une approbation de modèle 3D, de rig ou de matériau final.

## Références à utiliser

Le robot maître reste `public/cellule-assets/00-robot-master-blue-eyes.jpg`. Le premier `00-robot-master.jpg` sans les yeux cyan est archivé.

Le verrou principal est `public/cellule-assets/08-verrou-contention-clean-v2.jpg`, avec sa version PNG du même nom. Support, molette et bracelet sont entiers. Le support a été rendu opaque à partir des couleurs source ; ses contours restent légèrement irréguliers. Les poses `40-verrou-ouvert.jpg` et `41-verrou-ferme.jpg` sont également entières, mais ne constituent pas deux images calibrées d'une animation mécanique.

Pour les objets isolés, préférer `09-module-avant-bras-clean`, `16-miroir-observation-clean`, `21-module-route-enfer-clean` et `27-orbe-energie-clean`. Les JPEG et PNG sont présents ; câbles fins, reflets et émissions restent à reprendre lors de l'intégration.

Les références `45-obstruction-metal-v2`, `61-enfer-rampe-v2` et `82-paradis-anneau-direction-v2` remplacent leurs premières propositions dans le catalogue. Ces premiers essais contenaient respectivement un avant-bras non demandé, deux dalles en collage et plusieurs anneaux. Ne pas les utiliser comme références principales.

## Limites et provenance

Lire `public/cellule-assets/quality-review.json` avant la modélisation. Le luminaire garde du décor en fond, l'arbre conserve une portion de plateforme et certaines poses ne garantissent ni l'assise ni le côté anatomique demandé. Les trois voies d'une rampe doivent être définies dans la géométrie du jeu, pas déduites du marquage de l'image.

Le pack contient des images de référence, cinq détourages retenus et quatre propositions de base couleur. Il ne contient pas de nouveaux meshes, GLB, rigs, animations, sprites de production ni jeux PBR complets. `public/lobby-test/assets/robot-provisional.glb` reste provisoire et ne correspond pas au nouveau robot.

`generation-results.jsonl` conserve modèle, dimensions, empreintes, prompts hachés et références réellement utilisées. `derivation-results.jsonl` décrit les opérations locales et leurs sources, y compris le masque corrigé du verrou. `delivery-manifest.json` distingue sélection, archives et réserves de revue.

Les prompts sont conservés dans `generation-plan.json`, `robot-eyes-plan.json`, `game-extension-plan.json`, `review-fixes-plan.json`, `pack-expansion-plan.json` et `expansion-corrections-plan.json`. Les corrections ont de nouveaux noms ; aucun ancien rendu n'a été écrasé.

## Consigne pour la session qui reprend

Partir des fichiers réellement présents et du catalogue, sans régénérer le pack. Vérifier les mises à jour du dépôt avant l'intégration. Le robot maître et la cellule approuvée définissent l'identité ; l'humain et les extensions sont des propositions, pas une nouvelle identité narrative validée par l'équipe.

Réutiliser les références pour construire des éléments séparés : robot articulable, fauteuil, verrou, molette, pince, sonde et parties mobiles. Ne pas convertir une image de salle en faux niveau navigable. Les collisions, dimensions de parcours, timings, commandes et règles de victoire restent indépendants des visuels.

Respecter les fichiers des autres sessions : `src/scenes/Main.tsx`, `src/sprites/Player.ts`, `src/platformer/`, `src/afterworld/`, `public/afterworld/`, les cartes de niveau et `docs/implementation-handoff.md` ont des modifications locales préexistantes. Ne pas les écraser ni les embarquer dans un commit d'assets. Le raccord verdict/lobby reste à coordonner avec Yann/Sc4rville selon le contrat V1.

## Galerie et reprise sans doublon

La galerie lit les deux journaux et le manifeste, s'actualise toutes les cinq secondes et conserve le zoom ouvert. Elle masque les essais explicitement écartés sans les supprimer du dépôt. Les cinq détourages retenus disposent d'un lien PNG transparent. Recharger l'onglet pour prendre la nouvelle version de la galerie.

Réutiliser un serveur actif sur 8766. Seulement si ce port est libre, lancer depuis la racine du dépôt :

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory public/cellule-assets
```

Les générations sont terminées : ne pas relancer les lots ni créer un agent doublon à partir d'un ancien indicateur d'activité. Cette reprise n'a déclenché aucun nouveau handoff cloud. Les clés ne doivent jamais figurer dans le pack, la galerie ou Git.

Contrôles de cette livraison : images décodées, dimensions et empreintes confrontées aux journaux, correspondance catalogue/manifeste et inspection des planches. La galerie a été testée en Chromium headless à 1440 et 390 pixels : zoom, fermeture, actualisation, téléchargement PNG vérifié par empreinte, sans débordement horizontal ni erreur console. Ces contrôles ne sont pas un test du gameplay ni une validation des modèles 3D.
