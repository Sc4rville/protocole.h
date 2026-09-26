# Kusaila — suivi de session

## Rôle

Kusaila prend en charge le **jeu de plateforme**. Sa version dépend du résultat du lobby / test développé par Yann / Sc4rville : voir [scarville.md](scarville.md).

## Cadre commun

- Hackathon du 26 septembre 2026, avec une fenêtre annoncée de 7 h pour coder.
- Le concept reste modifiable ; le cœur est la conséquence des actes du joueur envers la machine.
- Base actuelle : **Phaser + TypeScript + Vite, en 2D**, issue de `remarkablegames/phaser-platformer`.
- Direction actuelle du README : enfer exigeant et paradis apaisé, tous deux gagnables.
- Référence commune : [README](../../README.md) et [relais de production](../implementation-handoff.md).

## Périmètre de Kusaila

- Déplacement, saut, collisions et ressenti du platformer.
- Niveau, obstacles et variantes correspondant au résultat du test.
- Mort, reprise, sortie du niveau et fin de parcours.
- Intégration du résultat fourni par le lobby, sans recoder le test de Sc4rville.

## Points d'entrée actuels

- `src/scenes/Main.tsx` : niveau d'exemple.
- `src/sprites/Player.ts` : mouvement et saut.
- `public/tilemaps/` et `public/sprites/` : assets de la base.
- `src/main.ts` : point partagé à coordonner avant modification.

## Coordination avec Sc4rville

- [ ] Convenir du format exact du résultat du lobby et du point d'entrée du platformer.
- [ ] Permettre de tester chaque variante sans attendre le lobby complet.
- [ ] Convenir du comportement de fin / retour au lobby.
- [ ] Tester ensemble les deux parcours complets.

Le contrat technique reste à convenir ; aucun format d'API n'est imposé par ce suivi.

## Direction demandée par Kusaila le 26 septembre

- Priorité au plaisir de jeu après la sentence du robot, indépendamment du verdict encore attendu.
- Enfer et paradis doivent différer par leurs mécaniques, pas seulement par leur couleur ou la difficulté des sauts.
- Après comparaison des licences et essai localhost, Kusaila a validé la base 3D `atiqur-rahman-pro/claude-bandicoot` (MIT). Le prototype dérivé reste isolé sous `public/runner/`, sans remplacer le démarrage Phaser ni toucher aux scènes de Yann.
- Le lot 2D commencé est suspendu, non vérifié et non livré. La migration du jeu principal et le raccord au lobby restent à coordonner.
- Kusaila a ensuite choisi deux boucles : enfer en runner à trois voies (saut, glissade, obstacles annoncés) ; paradis en glisse et rebonds (plané, collecte d'énergie, récupération douce après une chute). Valider d'abord les sensations avec des formes provisoires, sans figer le lore.
- Yann prépare les assets détaillés du robot, de l'humain, du miroir et des armes. Les réutiliser à leur publication ; ne pas inventer de noms de fichiers, de formats, de personnage définitif ni de nouveaux signaux d'armes. Les collisions restent indépendantes des modèles visuels.
- Le contrat de données V1 sera conservé pour le raccord, mais son hypothèse de parcours Phaser 2D ne décrit pas ce nouveau prototype. Le mapping des effets vers les deux boucles 3D reste à coordonner ; les données de test ne sont pas encore branchées.
- Conserver le sélecteur temporaire, deux parcours gagnables, une fin et rejouer ; commit et push après chaque lot réellement testé.
- Avant de choisir une base ou d’engager un gros changement, servir une démo sur localhost et attendre la validation de Kusaila ; répéter ce point de contrôle aux étapes importantes.

## Journal de session

### 2026-09-26 — répartition confirmée par Yann

- Kusaila : jeu de plateforme.
- Sc4rville : lobby / test qui choisit la version du platformer.
- Création du suivi. La base existe ; aucune adaptation du platformer n'est déclarée terminée ici.

Ajouter à chaque reprise : ce qui a été fait, les fichiers touchés, les vérifications réellement effectuées, les blocages et la prochaine action.
