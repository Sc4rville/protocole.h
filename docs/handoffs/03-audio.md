# Handoff 3 : SFX, ambiances et mixage

## Mission

Kusaila veut un jeu riche en bruitages, pas vingt variantes du même bip. Reprendre `Sc4rville/protocole.h`, branche `handoff/protocole-five-lots`, puis créer `work/afterworld-audio`. Terminer et vérifier le système audio des deux parcours sans toucher à leur physique ou au lobby.

État : `src/afterworld/Sound.js` contient GameAudio. Le manifeste `src/afterworld/public/media/sfx/manifest.json` décrit 24 WAV synthétisés localement avec ZzFX, déjà générés. Ne pas relancer leur génération par défaut. `sound-recipes.mjs` et `scripts/generate-sfx.mjs` existent. Le pack `public/audio/` contient aussi des candidats CC0 d'une autre session ; ce ne sont pas des sons générés par nous ni des sons déjà écoutés/mixés. Préserver ses originaux, manifestes et licences.

Lire Sound.js, ses appels dans Player et Game, le manifeste synthétique, puis le relais audio dans `docs/equipe/scarville.md`. Utiliser les plans de génération existants si nécessaires, ne pas inventer une API ou demander des clés présentes uniquement sur le PC. Aucune nouvelle génération payante sans accord explicite. Les sons de secours procéduraux doivent suffire à jouer hors API.

## Droits et fichiers

Tu possèdes `src/afterworld/Sound.js`, `sound-recipes.mjs`, `scripts/generate-sfx.mjs`, `public/media/sfx/` sous ce package, les nouveaux `src/afterworld/audio-preview/`, `tests/audio.test.mjs`, `tests/audio-preview.py`, et `docs/handoffs/results/03-audio.json`. Les ressources déjà générées ne sont remplacées qu'après défaut démontré ; conserver une provenance et ne pas relancer tout le pack.

Ne pas modifier Player, Game, World, game-state, les tests de gameplay, le package racine, le lobby, les fichiers de génération d'images ou `public/audio/`. Les appels manquants sont signalés au lot 1 avec le nom d'événement et l'endroit précis. Les voix et le verdict appartiennent à Yann.

Accès en écriture, commits et push autorisés sur TA branche. Pas de main, fusion, force-push, suppression de sources, modification des droits ou publication. Ne pas changer la configuration Git. Identité humaine : Kusaila <nalydavinci@protonmail.com>. Aucun secret dans les fichiers, logs ou navigateur.

## Interface à conserver

```js
export class GameAudio {
  async unlock() {}
  setMuted(value) {}
  setPaused(value) {}
  play(id, { gain = 1, rate = 1, pan = 0 } = {}) {}
  ambience(mode) {}
  flight(speed, active) {}
  dispose() {}
  probe() {}
}
```

Les IDs existants ne changent pas : pas métal/pierre A/B, jump, land-soft, land-hard, lane-whoosh, slide, air-dive, glider-open, rebound, perfect-rebound, collect, checkpoint, press-warning, press-impact, hit, recover, finish, ui-confirm, hell-room, heaven-air, flight-air. Lire les chaînes exactes du manifeste pour les pas.

`probe()` reste en lecture seule et renvoie état réel d'AudioContext, muted, masterGain, activeLoops et peak mesuré APRÈS le volume maître. Ce n'est pas un compteur inventé d'événements.

## Corrections et design attendus

1. Aucun AudioContext/autoplay au chargement. Créer/réveiller le contexte dans un geste utilisateur explicite ; dédupliquer chargements et décodages. Un échec audio ne doit jamais bloquer jouer ou reprendre. Les chemins doivent fonctionner sur le serveur isolé et sous `/afterworld/`.
2. Mute coupe aussi les sons et boucles déjà actifs. Pause suspend proprement puis reprend même si le son était muet. Changement de monde, replay et dispose ne laissent ni boucle fantôme ni tâche différée qui relance l'ancien monde.
3. Corriger le risque actuel : stopLoop programme un setTimeout puis setLoop peut réutiliser cette même source avant son arrêt. Invalider/canceller l'arrêt ou créer une nouvelle source, sans empiler les timers à chaque frame. Un changement de mode pendant loadBuffers ne doit pas ouvrir les deux ambiances après chargement. Les limites de polyphonie doivent tenir aussi avec des appels en attente.
4. Distinguer les matières et fonctions : pas courts, frottement de glisse, souffle de voile, percussion grave de presse, avertissement lisible, énergie et checkpoint distincts. Vent de vol proportionnel à la vitesse réelle, ambiances discrètes, pas de répétition agressive. Maître initial autour de 0.32 ; pièce sous les actions. Vérifier le signal, ne pas prétendre avoir entendu les haut-parleurs.
5. Vérifier les jointures des boucles. Le générateur actuel recopie un mélange au début ET à la fin sans preuve de continuité. Si une correction est nécessaire, traiter une copie ciblée et documenter la dérivation, pas une régénération générale. Un fichier téléchargé reste identifié CC0/source, jamais présenté comme une génération IA.

## Tests et livrables

Aperçu isolé avec boutons réels pour déclencher chaque famille, démarrer les ambiances, changer de mode pendant chargement, muter en pleine lecture, pause/reprise et dispose. Ne pas modifier le menu du jeu pour cet aperçu.

Tests obligatoires : tous les WAV se décodent ; geste utilisateur => contexte running et peak > 0.00001 lors d'un événement ; après mute et 250 ms, masterGain nul et peak < 0.000001 ; unmute reprend sans rechargement ; une seule ambiance active pour le monde sélectionné ; aucune fuite après dix reprises ; fermeture complète de dispose ; échec fetch traité sans exception non gérée. Mesures de fichier si nécessaires : peak = max(abs(samples)), RMS = sqrt(sum(sample²)/N). Rapporter les valeurs réellement observées, pas des adjectifs audio inférés.

Commandes de tests dans ton lot :

```sh
node --test src/afterworld/tests/audio.test.mjs
/tmp/protocole-browser-venv/bin/python src/afterworld/tests/audio-preview.py
```

Réutiliser la venv et les serveurs présents sur le PC ; les chemins et processus locaux ne sont pas automatiquement disponibles dans le Cloud. Utiliser Chromium headless, ne jamais piloter Brave. Garder le serveur utilisé disponible et retourner l'URL vérifiée.

Pousser ta branche et écrire `docs/handoffs/results/03-audio.json` avec fichiers touchés, tests/signal réel, provenance, changements d'interface éventuels refusés, captures et limites d'écoute. Ne pas modifier les suivis communs. Le lot 1 garde la responsabilité des événements de jeu et le coordinateur intégrera ton audio après revue.
