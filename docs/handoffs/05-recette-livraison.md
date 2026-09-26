# Handoff 5 : recette indépendante et préparation de livraison

## Mission

Pour Kusaila, prendre `Sc4rville/protocole.h`, branche `handoff/protocole-five-lots`, puis créer `work/afterworld-release`. Faire une revue indépendante et préparer la livraison complète. Commencer maintenant par l'audit et le scénario d'acceptation ; le feu vert final attend l'intégration des lots 1 à 4. Ne pas attendre indéfiniment ni déclarer réussi un jeu encore incomplet.

Lire les cinq briefs, les fichiers réellement présents et les suivis. Le snapshot est WIP. Ne pas confondre runner historique sous `public/runner/`, démo Ecctrl et nouveau jeu sous `src/afterworld/`. Les passes de l'ancien runner ne valident pas le nouveau.

## Périmètre et droits

Écriture autorisée : `tests/afterworld-acceptance.py`, `tests/afterworld-release.mjs`, `docs/handoffs/results/05-recette.json`, et artefacts de test/export dans un nouveau dossier temporaire. Les fichiers produit restent en lecture seule pendant les autres lots. Ne pas toucher aux tests de développement possédés par les lots 1 et 3. Rapporter les bugs avec reproduction et captures au bon propriétaire, sans deuxième implémentation concurrente.

Commits et push autorisés sur TA branche. Pas de merge, main, force-push, suppression, modification des hooks/politiques, changement de visibilité GitHub, déploiement public ou publication itch.io sans feu vert final du coordinateur. Ne pas changer la configuration Git. Identité humaine : Kusaila <nalydavinci@protonmail.com>. Jamais de secret dans les artefacts. Les fichiers privés ne font pas partie du jeu.

## État connu, ne pas le redécouvrir inutilement

Le contrôleur Ecctrl a été essayé et sa fluidité approuvée par Kusaila. L'adaptation après-mondes n'a pas encore deux victoires validées. Au snapshot, le test enfer atteint les checkpoints et 351 m, puis échoue à la sortie et tombe indéfiniment. Le lot 1 répare cela. Le test paradis ne couvre encore que le premier rebond/plané. Les options mobile et audio de son parseur ne sont pas implémentées : elles ne constituent pas une preuve.

Les images du pack ne sont pas des modèles 3D. Les WAV synthétiques sont présents, leur mixage est en cours. Le raccord au lobby est préparatoire et dépend de Yann. Le build seul ne démontre ni jouabilité, ni beauté, ni usage effectif des partenaires.

## Critères de recette, pas de triche

1. Enfer : menu, mort sans action, saut court et long, maintien sans saut automatique, glissade réelle, changement de voie, presse avec avertissement, checkpoints, mort après checkpoint et bonne reprise, portail final, replay à zéro. Positions/vitesses restent finies et plausibles ; aucune chute infinie ni victoire après téléportation. Vérifier que les volumes mortels correspondent aux objets visibles.
2. Paradis : déplacement au sol, saut, ressort normal et bien synchronisé, voile, piqué qui augmente la vitesse, redressement qui échange vitesse et altitude, trajectoires entre les cinq îles, collecte unique, chute/reprise, pas de checkpoint par contact latéral ou dessous, portail atteint au sol, replay. Tenir uniquement Espace ne doit pas terminer le parcours.
3. Interface/robustesse : clavier après un bouton, pause qui fige position et horloge, reprise sans touche fantôme, onglet masqué, tactile 390x844 avec deux doigts et pointercancel, focus visible, absence de débordement ou cible cachée par le HUD. Capturer départs, sauts, glissade, presses, checkpoints, réceptions et deux victoires. Lire les captures en desktop et mobile.
4. Audio et réseau : contexte non lancé au menu, geste utilisateur effectif, signal réel après événement, mute en pleine boucle, pause/reprise et pas d'empilement au replay. Utiliser la télémétrie audio, ne pas dire avoir écouté si seule une mesure est faite. Ressources du platformer locales, notamment Draco ; absence d'exception console. Les appels autorisés du verdict sont un flux distinct, pas un asset CDN à confondre avec le runtime local.
5. Une fois le raccord livré : deux parties complètes lobby -> verdict -> monde -> fin ; cas bienveillant, hostile et mixte avec aide ET danger ; réponse IA lente/absente ; résultat immuable après départ ; nouvelle partie vide le journal, retry le conserve. Vérifier l'usage réel d'au moins deux technologies partenaires selon le relais, avec preuve de leur exécution et secours local. Ne pas générer de données réelles dans un système partagé pour tester.

Piloter Chromium headless avec de vraies touches/pointeurs. `window.__protocole.read()` et `.audio()` sont en lecture seule. Interdits : mutation de state, téléportation, changement de vitesse du jeu, ajout d'un auto-win. Adapter les attentes au temps simulé normal si le rendu logiciel est lent, sans transformer ce délai en faux FPS matériel.

## Commandes finales, une seule passe complète après intégration

Depuis la racine :

```sh
npm --prefix src/afterworld test
npm --prefix src/afterworld run build
npm run lint:tsc
npx vite build --outDir /tmp/protocole-afterworld-release-check
/tmp/protocole-browser-venv/bin/python tests/afterworld-acceptance.py
```

Ne pas utiliser `npm run build` à la racine sans vérifier son clean : il contient actuellement `rm -rf dist`. Utiliser un dossier temporaire neuf et ne pas effacer un dossier préexistant d'une autre session. Si un échec concerne du code concurrent hors périmètre, le distinguer d'une régression du lot.

Sur le PC, conserver les serveurs actifs et la venv existante. Dans le Cloud, utiliser l'environnement disponible ou préparer seulement les dépendances manquantes. Ne pas piloter Brave/le bureau. Ne pas relancer un serveur sur le port d'un autre processus. Laisser un aperçu accessible et vérifier son URL réelle.

## Livraison à préparer

Vérifier le build servi sous `/afterworld/`, le chargement relatif des ressources, les licences et le contenu exact du paquet. Préparer un ZIP HTML5 jouable, pas simplement les sources, et une liste des prérequis pour le backend du verdict. Ne pas exposer de clé dans le ZIP. Proposer la procédure itch.io adaptée au vrai build ; ne pas prétendre avoir publié sans URL et preuve.

Auditer les documents existants et retourner les corrections nécessaires au coordinateur, sans les écraser pendant les autres sessions. Pas de pourcentage arbitraire de complétude ou de « tout est prêt » si le raccord manque.

Livrer `docs/handoffs/results/05-recette.json` avec pour chaque contrôle : pass/fail/blocked, commande ou action exacte, preuve/capture, propriétaire du défaut. Séparer dès maintenant l'audit préparatoire de la recette finale. Pousser seulement tes tests/rapport sur ta branche ; la revue, la fusion et le lancement public restent au coordinateur après accord de Kusaila.
