# Relais de production — protocole.h

État au 26 septembre 2026, ~12:30 CEST. Ce document est le relais commun entre Kusaila, Sc4rville, Devin et Codex. Devin code ; Codex vérifie les choix, le jeu réel et les critères du jury. Mettre cette page à jour après chaque livraison.

## Répartition décidée par l'équipe

- **Yann** : la partie d'avant, de l'écran de départ à la confrontation avec le robot et au verdict. Créer sa propre scène et ses composants ; conserver les actes du joueur sous forme de données.
- **Kusaila** : toute la partie plateforme, à partir du verdict : déplacement, saut, niveau enfer/paradis, obstacles, checkpoints, fin et rejouer. Il possède `src/scenes/Main.tsx`, `src/sprites/Player.ts` et les cartes de niveau.
- **Devin** : aider sur des tâches délimitées par Yann ou Kusaila, sans modifier en parallèle les fichiers dont l'autre s'occupe. **Codex** : vérifier l'intégration et les critères du jury.

**Interface commune à fixer avant de travailler séparément :** la scène de plateforme reçoit une issue (`hell` ou `heaven`), la liste des actes (`help`, `ignore`, `hurt` au minimum) et une graine stable. La logique de gameplay lit l'issue ; Gemini/Gradium/Nano Banana peuvent utiliser les actes pour personnaliser le texte, la voix et le décor. La plateforme doit rester jouable si ces appels échouent. Au verdict, Yann passe ces données à la scène de Kusaila ; ils testent ensemble les deux issues.

## But non négociable

Avant **19:00 CEST** : jeu gratuit jouable sur itch.io, GitHub public avec code complet et README technique. Projet **créé aujourd'hui** (boilerplate autorisé), équipe de cinq maximum, **au moins deux technologies partenaires utilisées réellement**. Une partie courte : confronter un robot sans défense, agir, découvrir qu'il nous juge, puis traverser un niveau enfer ou paradis. Le monde visuel peut réagir aux actes ; il n'est pas nécessaire d'imposer le dessin au joueur.

Le jury juge **performance**, **exécution/game feel/art/polish/équilibre**, **nouveauté** et **envie de rejouer**. Chaque décision doit aider au moins un de ces points. Une expérience finie de 2–4 minutes bat une longue démo incomplète.

## Base actuelle vérifiée

- Repo d'équipe : `Sc4rville/protocole.h` (encore privé). Checkout local : `~/future/paris-ai-gaming-hack-2026-09-26/protocole.h`.
- Nouveau fork : `kabylesystem/protocole-platformer-base` depuis `remarkablegames/phaser-platformer` (MIT), avec tileset industriel de 0x72 (CC0). Phaser 4.2.1, TypeScript, Vite ; déplacement, **saut**, collisions, caméra, obstacles, dessin de tuiles. Démo source : https://remarkablegames.org/phaser-platformer/.
- Le premier import, `It Was the Robots` au commit `392da8c`, a été abandonné après test : trop sombre, commandes peu lisibles, **aucun saut**, presque toute l'histoire déjà écrite. Son code ne doit pas redevenir la base finale. La critique de Kusaila est enregistrée dans le skill `fork-first`.
- Nouvelle base testée localement : `npm ci --ignore-scripts`, `npm run lint:tsc`, `npm run build` passent. Chromium headless : HTTP 200, canvas chargé, saut visible, aucune erreur console lors de l'essai. URL du serveur local actuellement lancé : `http://127.0.0.1:5173/`.
- La base est encore un **template**, pas `protocole.h`. Elle n'a ni confrontation ni verdict ni fin. L'art est cohérent mais simple ; la jouabilité mobile est insuffisante : à 390 px, le canvas n'occupe que 195 px de haut et aucun contrôle tactile n'est prêt. FPS et partie complète non mesurés.
- [Capture desktop de la base](captures/baseline-desktop.png) · [capture mobile](captures/baseline-mobile.png). Elles doivent être remplacées par les captures du vrai jeu à mesure qu'il avance.

## Partenaires et accès : état réel

| Technologie | Usage recommandé | État |
| --- | --- | --- |
| **Gemini** | Formuler un verdict court à partir d'actions structurées ; rester cohérent avec un score local déterministe | Clé du **projet hackathon** vérifiée par `models.list` HTTP 200. Jamais la clé Gemini personnelle de Kusaila. |
| **Gradium** | Réactions vocales françaises du robot, puis verdict parlé | Clé testée : TTS HTTP 200, échantillon WAV produit. |
| **Nano Banana 2** `gemini-3.1-flash-image` | Créer un visuel enfer/paradis qui reprend les actes du joueur ; lancer dès que le verdict est connu, afficher quand prêt pendant le parcours ou à la fin | Modèle présent dans `models.list` du projet hackathon ; **génération non encore testée**. |
| **Lyria 3 Clip** `lyria-3-clip-preview` | Pré-générer deux boucles instrumentales de 30 s, une par issue ; mixer sous la voix | Modèle présent dans `models.list` ; **génération non encore testée**. |
| **Veo 3.1** | Une courte transition pré-générée seulement si le jeu est déjà complet | Modèle présent dans `models.list` ; génération et délai non testés. Ne pas mettre sur le chemin d'une partie. |

Les secrets `GEMINI_API_KEY` et `GRADIUM_API_KEY` sont déjà ajoutés aux **secrets d'organisation Devin** via le CLI, sans apparaître dans Git ou les commandes. Pour Devin CLI **local**, `.env.local` (mode 0600, gitignoré) contient ces deux variables et `GOOGLE_CLOUD_PROJECT`. Charger explicitement l'environnement si nécessaire ; aucun `VITE_*` secret et aucune clé dans le navigateur. Les secrets Cloud sont injectés aux **nouvelles** sessions, donc redémarrer une session déjà lancée si elle ne les voit pas. Dans Devin, utiliser Fusion avec GPT-6 Astra en modèle fort et SWE-2 en assistant pour ce chantier exigeant.

## Mécanique recommandée

Le cœur : **les actes du joueur fabriquent sa sentence**. Dans une seule salle, aider, ignorer ou blesser le robot produit une réaction visible/sonore immédiate. Un score local transparent pour le code, invisible pour le joueur, choisit l'issue. Gemini rédige une phrase qui cite les actes ; Gradium la prononce. Nano Banana transforme le décor selon ces mêmes actes : un bras arraché, une réparation ou une porte ouverte doit se voir dans le monde final. **Les collisions, obstacles et timings restent codés à la main** pour garantir un bon platformer ; l'image générée habille le décor. Afficher une variante pré-générée si Nano Banana tarde ou échoue. La génération interactive est un effet de surprise, pas un écran de chargement.

La démo source permet de dessiner des tuiles, mais Kusaila a explicitement dit que le dessin n'est **pas obligatoire**. Garder cette mécanique seulement si elle améliore immédiatement le jeu et ne détourne pas du jugement. Un autre usage interactif de Nano Banana peut être meilleur.

## Dix workflows pour Devin, par priorité

1. **Base propre** : `git pull`, installer, build, préserver licence MIT et crédit CC0 ; retirer les marques de la démo source du parcours. Garder le projet simple, sans migration de moteur.
2. **Partie complète minimale** : début → salle du robot → verdict → niveau → fin → rejouer. Avec placeholders, toute la boucle doit marcher avant d'ajouter des services.
3. **Confrontation lisible** : une scène, un robot clairement vulnérable, trois actions (aider / ignorer / blesser), touches et feedback évidents ; 30–45 s maximum.
4. **Conséquences déterministes** : journal local des actes, score caché, issue expliquable ; ne pas laisser un LLM décider seul du résultat.
5. **Verdict fort** : révélation brève et mémorable, texte local de secours, transition visuelle distincte vers enfer ou paradis.
6. **Platformer qui se joue bien** : réutiliser le saut/collisions de la base, construire un seul niveau court avec checkpoint et fin ; régler accélération, hauteur du saut et hitboxes. Enfer difficile mais gagnable ; paradis agréable sans être automatique.
7. **Identité visuelle et audio** : remplacer le look de template, améliorer contraste et entrée dans le jeu, feedback des actions, transitions, bruitage et équilibre musique/voix. Tester desktop et mobile ; si le mobile reste non jouable, viser d'abord une version desktop nette et l'indiquer honnêtement.
8. **Gemini + Gradium** : endpoint serveur ou contenu généré côté développement, aucun secret client ; démontrer un verdict contextualisé et des répliques Gradium réellement jouées. Pré-générer les phrases fixes pour éviter l'attente.
9. **Nano Banana interactif + Lyria** : générer un décor personnalisé **en arrière-plan** à partir des actes, avec fallback ; pré-générer les deux musiques. Mesurer latence et taille. Veo seulement après ces intégrations stables.
10. **Sortie** : deux parties complètes testées (enfer/paradis), aucun blocage ni erreur, ZIP HTML5, publication itch.io gratuite, GitHub public, README avec installation, architecture, modèles/API, crédits et preuves d'usage des partenaires ; soumission avant 19:00.

## Points d'entrée du code

- `src/main.ts` : Phaser, format du canvas, physique, scènes.
- `src/scenes/Main.tsx` : niveau d'exemple, obstacles, mort/restart ; à transformer ou remplacer par des scènes originales.
- `src/sprites/Player.ts` : mouvement et saut. Vérifier le ressenti en jeu, pas seulement le code.
- `src/graphics/TileMarker.ts` : dessin de cases ; optionnel selon la mécanique retenue.
- `src/components/HelpText.tsx` : consignes temporaires de la démo, à remplacer par une introduction au jeu.
- `public/tilemaps/` et `public/sprites/` : assets de la base, créditer 0x72.

## Rangement du dépôt

La racine ne garde que ce que l'outillage exige (README, LICENSE, `index.html`, configs Vite/TS/ESLint, `package*.json`). Tout le reste a sa place :

- `docs/implementation-handoff.md` : ce relais, à tenir à jour.
- `docs/equipe/` : une fiche de suivi par personne (`scarville.md`, `kusaila.md`).
- `docs/captures/` : captures d'écran du jeu.
- `src/` : le code ; `public/` : les assets servis tels quels.

Ne pas créer de nouveau fichier de notes à la racine. Identité de commit : `Scarville <205611309+Sc4rville@users.noreply.github.com>`, jamais une adresse personnelle — le dépôt devient public.

## Règle de livraison

Après chaque workflow : ouvrir le jeu, jouer la scène touchée, donner le commit et dire ce qui marche réellement. `npm run build` seul ne valide ni la lisibilité ni le plaisir de jouer. Documenter tout changement de direction ici pour que Codex et Devin travaillent sur le même état.
