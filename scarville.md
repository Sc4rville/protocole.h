# Sc4rville — suivi de session

## Rôle

Yann / Sc4rville prend en charge le **lobby et le test** : les interactions du joueur avec la machine déterminent la version du jeu de plateforme qui sera lancée ensuite.

Kusaila prend en charge le **jeu de plateforme** : voir [kusaila.md](kusaila.md).

## Cadre commun

- Hackathon du 26 septembre 2026, avec une fenêtre annoncée de 7 h pour coder.
- Le README porte une idée, pas un cahier des charges figé. Préserver le retournement : le joueur croit tester une machine, mais c'est lui qui est testé.
- La base actuellement dans le repo est **Phaser + TypeScript + Vite, en 2D** ; les échanges précédents sur Three.js ne décrivent plus cette base.
- Référence commune : [README](README.md) et [relais de production](docs/implementation-handoff.md).

## Périmètre de Sc4rville

- Lobby, machine et interactions du test.
- Journal des actes et détermination de l'issue.
- Réactions de la machine et révélation du jugement.
- Transmission du résultat au parcours de Kusaila.

## Coordination avec Kusaila

- [ ] Convenir du format exact des données transmises : issue, actes utiles et éventuel décor personnalisé.
- [ ] Convenir du point d'entrée du platformer et de qui déclenche la transition.
- [ ] Coordonner les modifications des fichiers communs, notamment `src/main.ts`.
- [ ] Tester le passage lobby → plateforme pour les deux issues.

Le contrat technique reste à convenir ; aucun format d'API n'est imposé par ce suivi.

## Journal de session

### 2026-09-26 — répartition confirmée par Yann

- Sc4rville : lobby / test qui décide de la version du platformer.
- Kusaila : jeu de plateforme.
- Création des deux suivis. Aucune implémentation du lobby n'est déclarée terminée ici.

Ajouter à chaque reprise : ce qui a été fait, les fichiers touchés, les vérifications réellement effectuées, les blocages et la prochaine action.

## Synchronisation GitHub

À la demande de Yann : après chaque lot de modifications terminé, commiter et pousser sur GitHub sans attendre une nouvelle demande. Vérifier le diff avant chaque commit ; ne jamais inclure de secrets ni écraser le travail concurrent.
