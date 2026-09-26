# Handoff 1 : terminer les deux parcours jouables

## Mission et point de départ

Tu travailles pour Kusaila sur `Sc4rville/protocole.h`. Utiliser le dépôt configuré dans cette session, branche de départ `handoff/protocole-five-lots`. Créer ta propre branche `work/afterworld-gameplay` depuis cet instantané. C'est du travail en cours, pas une livraison validée. Si cette branche ou `src/afterworld/Player.jsx` manque, ne recrée pas le jeu : signale le problème au coordinateur.

Le joueur croit tester un robot ; après son verdict il traverse un enfer ou un paradis reflétant ses actes. Ton lot concerne seulement les deux parcours, pas le lobby de Yann. Kusaila a essayé et approuvé la fluidité de la démo Ecctrl, pas encore cette adaptation. Il veut un vrai jeu court, lisible et amusant, avec fin et rejouer. Conserver le sélecteur indépendant du lobby.

Lire `docs/equipe/kusaila.md`, `docs/implementation-handoff.md`, `docs/asset-handoff.md`, puis les fichiers de `src/afterworld/`. Les passages historiques qui imposent encore Phaser 2D ne décrivent pas ce prototype isolé. Ne pas migrer le démarrage principal.

## Droits et propriété

Tu peux modifier, tester, commiter et pousser ton lot sur TA branche. Ne pas pousser sur main, fusionner une PR, force-push, modifier les droits GitHub, exposer un secret ni publier le jeu. Ne pas changer la configuration Git. Identité humaine : Kusaila <nalydavinci@protonmail.com>. Conserver les licences.

Fichiers à toi : `src/afterworld/Player.jsx`, `Game.jsx`, `World.jsx`, `game-state.js`, `styles.css`, `main.jsx`, `index.html`, `tests/state.test.mjs`, `tests/play.py`. Les configurations du package isolé ne changent que si un défaut démontré l'exige. Ne pas modifier le package racine, `src/main.ts`, le lobby, `src/scenes/Main.tsx`, `src/sprites/Player.ts`, `src/platformer/`, `public/runner/`, les cartes 2D ou les générations dans `public/cellule-assets/`.

Le lot 2 produit de l'art dans `src/afterworld/art/` et `src/afterworld/public/media/models/`. Le lot 3 possède `Sound.js`, les fichiers sonores et ses tests. Ne pas écrire dans leurs fichiers. Ne pas remplacer leur travail par un autre sous-système. Tu gardes les appels à l'interface `GameAudio` existante.

## État réel à reprendre

- Ecctrl 2.0.2, Rapier, R3F et React sont déjà utilisés par le package isolé. Pas de nouvelle recherche de moteur, pas de réinstallation si node_modules existe et fonctionne. En VM neuve seulement, installer avec le lockfile du package.
- `World.jsx` est entièrement enregistré. Sa parenthèse manquante a été corrigée. Le build a réussi AVANT les derniers correctifs de contrôleur ; refaire une vérification ciblée.
- Les 24 WAV procéduraux existent, ainsi que le mannequin animé Quaternius CC0, les décodeurs Draco locaux et deux textures dérivées. Ne pas régénérer ces ressources.
- 8 tests unitaires passent. Un test ajouté couvre désormais les entrées de vol partielles sans NaN.
- Le dernier essai réel enfer franchit saut, glissade, changements de voie, checkpoints 140/270 et reprise après mort. Le corps reste stable après les corrections. Il atteint 351 m mais ÉCHOUE ensuite : pas de victoire et chute infinie après la route. Pas de victoire complète à revendiquer.
- Cause visible du défaut de sortie : `HELL.length=380`, départ z=8, porte z=-372, mais le dernier sol se termine exactement à z=-372 alors que gagner exige encore d'être au sol. Étendre le dernier sol au-delà du portail, sans modifier la distance ou le portail. Remplacer la dernière zone par `{ start: -257, end: -392, section: 2 }`. Ajouter une vraie reprise après chute hors route en enfer.
- Les dernières corrections de Player stabilisent userData, gardent la masse pendant la réduction de capsule, utilisent un rayon descendant pour les réceptions et empêchent le saut répété sur appui maintenu. Ne pas les annuler. Le rayon doit toucher une surface réelle avec normale vers le haut, pas seulement les coordonnées d'une île.
- L'ancien test paradis a montré rebond et vol, mais aucune victoire. Les correctifs de réception du paradis n'ont pas encore été rejoués. `tests/play.py --case heaven` ne couvre actuellement que le premier vol. Les options mobile/audio existent dans le parseur mais n'ont pas encore de scénario : ne pas présenter leur absence d'erreur comme un test réussi.

## Comportement demandé

1. Enfer : trois voies [-2.6, 0, 2.6], avance à 12, saut dosable, buffer 0.12 s et coyote 0.09 s sans double saut, glissade de 0.75 s qui réduit VRAIMENT le collider sans changer brutalement sa masse. Reprise sûre aux checkpoints. Pas de contact mortel invisible plusieurs mètres avant le mesh. Presses annoncées, contact suivi même si la fermeture commence pendant l'occupation. La deuxième presse couvre les deux voies prévues, pas une largeur décorative d'une seule voie.
2. Paradis : conserver les cinq îles définies dans HEAVEN. Déplacement libre au sol, ressorts, puis Espace maintenu pour planer au sommet du rebond. Bas/S = piqué, Haut/W/Z = redressement, gauche/droite = trajectoire. Relâcher Espace ferme le plané. Ne pas effacer l'impulsion verticale du ressort en ouvrant la voile trop tôt. Les rebonds et checkpoints sont impossibles depuis dessous. Chute : récupération sur la dernière île réellement atteinte, sans gain infini de collecte.
3. Deux sorties réellement franchissables, replay propre, pause complète et touches utilisables après clic sur un bouton. Pas d'entrée collante après pause, changement d'onglet ou pointercancel. Les boutons tactiles doivent supporter deux doigts.
4. Améliorer le rendu existant sans attendre les modèles : matériaux éclairés et lisibles, UV à échelle cohérente, chemin dégagé, caméra qui cadre joueur et prochaine cible. Enfer industriel, paradis blanc suspendu et végétalisé. Conserver l'indépendance entre art et collisions. Intégrer les exports du lot 2 seulement une fois livrés, sans changer leurs fichiers.
5. Garder `window.__protocole.read()` et `.audio()` strictement en lecture seule. Aucun bouton ou API de téléportation, auto-win ou mode invincible pour faire réussir les tests.

## Vérifications

Depuis la racine :

```sh
npm --prefix src/afterworld test
npm --prefix src/afterworld run build
/tmp/protocole-browser-venv/bin/python src/afterworld/tests/play.py --case hell
/tmp/protocole-browser-venv/bin/python src/afterworld/tests/play.py --case heaven
```

Le chemin Python est celui de la machine de Kusaila. Sur la VM, utiliser un environnement Playwright existant s'il est disponible ; sinon installer seulement le nécessaire dans un environnement isolé. Le test peut recevoir `BASE_URL`. Le jeu avance à vitesse normale par vraies touches, jamais par mutation de son état.

Compléter les scénarios : deux victoires intégrales, mort/reprise, checkpoint, saut court/long, maintien sans bunny-hop, vol piqué/redressement, chute/récupération, replay, pause, clavier après bouton, tactile 390x844, aucune erreur console, ressources locales. Capturer les départs, obstacles, presses, réceptions, victoires et mobile. LIRE les images, pas seulement les produire. Le test de performance en logiciel headless ne prouve pas la fluidité sur la machine de Kusaila.

Runtime local déjà actif : `protocole-preview-afterworld.service`, port 5186 ; anciens serveurs 5173/5174 et 5181 à 5185 à préserver. Sur le PC, vérifier et réutiliser, ne pas redémarrer ce qui fonctionne. Sur une VM, ces processus n'existent pas : créer ton propre serveur. Ne jamais piloter Brave ou le bureau de Kusaila. Laisser ton aperçu actif à la fin.

## Livrable

Un lot jouable testé et une branche poussée, sans fusion automatique. Écrire `docs/handoffs/results/01-moteur.json` avec état, commit, fichiers touchés, commandes et résultats, captures, défauts restants et URL réellement vérifiée. Ne pas modifier les journaux communs pendant les autres lots. Le coordinateur les consolidera. Ne pas dire que le jeu est amusant simplement parce qu'une automatisation gagne.
