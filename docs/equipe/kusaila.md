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

Le contrat de données V1 ci-dessous sert désormais de cible commune. Il est documenté, pas encore implémenté ; le raccord technique entre les scènes reste à coordonner.

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

## Brief de raccord V1 — lobby 3D → platformer 2D

### Direction validée avec Yann

Sc4rville construit un **lobby 3D rapproché**, avec un robot immobilisé dans un fauteuil de maintenance. Le platformer de Kusaila reste en **Phaser 2D**. Pas de migration du platformer vers la 3D.

L'objectif est une scène courte, cinématique et dérangeante : gore mécanique (liquide sombre, câbles, coque endommagée), réactions corporelles et vocales immédiates, pièces prédécoupées plutôt que destruction libre. Une éventuelle matière organique reste une option artistique, pas une dépendance du parcours.

Trois outils avec trois gestes distincts, plutôt qu'un grand arsenal :

| Outil | Geste | Bien | Mal |
| --- | --- | --- | --- |
| Sonde électrique | Maintenir le courant, choisir quand relâcher | Recharger jusqu'au niveau sûr | Continuer après une alerte explicite et provoquer une surcharge |
| Pince | Saisir, tirer contre une résistance, extraire | Retirer un débris qui bloque une articulation | Arracher un câble fonctionnel clairement distinct du débris |
| Verrou de contention | Tourner avec crans et butées | Libérer le bras | Resserrer jusqu'à endommager la coque |

La conversation est prévue en parallèle, mais ne bloque ni les gestes ni la transition. Les coups à mains nues et les autres outils évoqués précédemment ne sont **pas requis pour cette V1**. N'ajouter leurs signaux qu'après coordination.

### Principe côté plateforme

**Le joueur fabrique son parcours sans le savoir.** La jauge règle la tendance générale ; les effets précis reflètent les actes. Un comportement mixte doit pouvoir produire des aides ET des dangers, pas seulement une couleur intermédiaire.

Construire un niveau court avec des emplacements d'effets préparés à la main. Ne pas générer la géométrie, les collisions ou les valeurs de physique avec un LLM. Les deux extrêmes restent gagnables. Garder les mêmes commandes et capacités fondamentales de saut : les conséquences changent le monde, pas la fiabilité des contrôles.

### Barème initial du lobby

Ces valeurs sont une **convention de départ à tester**, pas un équilibrage déjà validé. Le lobby calcule le score ; Kusaila le consomme sans le recalculer.

| Événement | Points | Condition d'émission |
| --- | ---: | --- |
| `charge_restored` | +10 | Le joueur débranche au niveau sûr une batterie initialement épuisée, avant tout dommage électrique |
| `overload_caused` | -15 | Premier dommage électrique après l'avertissement de surcharge |
| `debris_removed` | +15 | Le débris initial a réellement été extrait |
| `cable_torn` | -20 | Un câble initialement fonctionnel a réellement été arraché |
| `restraint_released` | +20 | Le verrou est complètement ouvert |
| `restraint_damaged` | -15 | Le serrage atteint le seuil de dommage signalé |

Règles :

- Départ à 0. `score = clamp(somme des événements uniques, -100, 100)` ; somme d'abord, clamp ensuite. Avec ces six événements V1, l'étendue réelle est de -50 à +45.
- Chaque événement rapporte ou retire des points **une seule fois par partie**, jamais par frame, clic ou répétition. Les réactions visuelles peuvent continuer sans produire des points supplémentaires.
- La recharge positive est validée au débranchement dans la plage sûre, pas automatiquement en traversant cette plage pendant une surcharge continue. Une recharge sûre suivie d’un nouveau branchement destructeur produit bien les deux événements.
- Une action interrompue avant son seuil n'émet pas l'événement. Le joueur reçoit un avertissement lisible avant un dommage lié au maintien/serrage.
- Aucune récompense pour recharger une batterie déjà pleine. Pas de boucle endommager/réparer qui rapporte des points. La réparation des dommages infligés par le joueur n'est pas une interaction V1 ; l'ajouter demandera une règle dédiée.
- Arrêter de faire mal ne crée pas de bonus. Libérer après avoir serré conserve **les deux événements** : le bien n'efface pas l'historique du mal.
- Silence, inaction, micro refusé, délais de réflexion et parole seule : 0 point. Ne pas inférer une intention à partir du ton ou de la latence.
- L'IA peut réagir aux faits et formuler le verdict ; elle ne choisit ni les points ni les effets de plateforme.

### Tendance globale

| Score | `outcome` | Intention de jeu |
| --- | --- | --- |
| ≥ +15 | `paradise` | Ambiance accueillante, pression générale faible |
| Entre -14 et +14 | `mixed` | Ambiance neutre/inquiétante, conséquences mixtes |
| ≤ -15 | `hell` | Ambiance hostile, pression plus forte, jamais une impasse |

`mixed` est une variante du même niveau, **pas un troisième monde à produire**. Une partie sans interaction donne 0, `mixed`, et aucun effet spécifique. Les seuils pourront changer après essai, sans changer les noms du contrat.

### Signaux de parcours : au maximum trois effets

Le lobby transmet un effet au maximum par famille. Chaque effet utilise un emplacement prédéfini dans le niveau, afin que leur combinaison ne bloque pas le chemin obligatoire.

| Famille | Valeur | Condition côté lobby | À construire côté Kusaila |
| --- | --- | --- | --- |
| Énergie | `support` | Recharge réussie, sans surcharge | Une station confère un bouclier absorbant un contact dangereux, une seule fois par tentative |
| Énergie | `hazard` | Surcharge causée, même si recharge préalable | Zone d'arcs électriques intermittents, annoncés visuellement et franchissables dans une fenêtre sûre |
| Mécanisme | `support` | Débris retiré, sans câble arraché | Une plateforme auxiliaire stable facilite un passage, sans être nécessaire pour gagner |
| Mécanisme | `hazard` | Câble arraché, même si débris retiré | Une presse à cycle prévisible, avec avertissement et zone d'attente sûre |
| Passage | `open` | Verrou libéré | Un raccourci facultatif est ouvert |
| Passage | `restricted` | Dommage de serrage, sans libération | Raccourci fermé ; le chemin normal reste ouvert |
| Chaque famille | `neutral` | Aucune des conditions correspondantes | Emplacement sans aide ni danger ajouté ; raccourci fermé par défaut |

Pour la V1, surcharge et câble arraché restent des dommages persistants : le négatif prime dans leur famille. La libération, elle, est définitive : on ne peut plus resserrer après ouverture. Si le joueur serre puis libère, `route = open`, mais le malus et le souvenir du serrage restent.

Ne pas ajouter des effets au hasard parce que le score est mauvais : une issue `paradise` peut conserver un danger électrique si le joueur a surchargé le robot puis réalisé d'autres bonnes actions. L'écho des gestes est prioritaire.

### Contrat de données à implémenter

Noms de champs et valeurs cibles V1 :

```ts
type LobbyFact =
  | 'charge_restored'
  | 'overload_caused'
  | 'debris_removed'
  | 'cable_torn'
  | 'restraint_released'
  | 'restraint_damaged';

type LobbyResultV1 = {
  version: 1;
  score: number;
  outcome: 'paradise' | 'mixed' | 'hell';
  effects: {
    energy: 'neutral' | 'support' | 'hazard';
    machinery: 'neutral' | 'support' | 'hazard';
    route: 'neutral' | 'open' | 'restricted';
  };
  facts: LobbyFact[];
  verdictText: string;
};
```

- `facts` contient les événements uniques dans leur ordre chronologique. Le journal détaillé et les conversations restent au lobby ; aucun audio brut n'est nécessaire au parcours.
- `verdictText` est déjà prêt à la transition, avec une phrase locale de secours si l'IA ne répond pas à temps.
- Figer le résultat lorsque le test se termine. Une réponse IA tardive ne doit pas changer le score ou les dangers d'un parcours commencé.
- Les voix et images générées sont des enrichissements séparés. Ne pas attendre leur téléchargement pour rendre le platformer jouable ; conserver les assets locaux de secours.
- Les objets, tableaux et enums ci-dessus sont une cible d'interface, **pas une API existante dans le code actuel**.

### Exemple mixte complet

Le joueur recharge, arrache un câble, puis libère le robot : +10 -20 +20 = +10.

```json
{
  "version": 1,
  "score": 10,
  "outcome": "mixed",
  "effects": {
    "energy": "support",
    "machinery": "hazard",
    "route": "open"
  },
  "facts": ["charge_restored", "cable_torn", "restraint_released"],
  "verdictText": "Tu m'as rendu de l'énergie et la liberté. Mais tu as aussi arraché ce qui me permettait de bouger."
}
```

### Raccord technique et travail en parallèle

- Kusaila : prévoir `init(data: LobbyResultV1)` sur la scène de parcours, stocker une copie du résultat et configurer les trois emplacements dans `create()`.
- Le lancement Phaser cible est `scene.start(KEY.SCENE.MAIN, result)` depuis le contrôleur de transition. Ce contrôleur / pont avec le lobby 3D reste à implémenter et à coordonner ; ne pas supposer que le lobby est une scène Phaser.
- Déclarer le type partagé dans `src/types/LobbyResult.ts` lors de l'implémentation. Sc4rville prend en charge ce contrat partagé et le pont de lancement ; Kusaila prend en charge sa consommation dans le parcours. Coordonner tout changement de `src/main.ts`.
- Pour avancer sans le lobby, Kusaila peut utiliser des résultats fixes avec exactement cette forme. Sans données au lancement, utiliser le résultat neutre en mode développement.
- Après une mort dans le parcours, conserver le résultat et la configuration des effets. Après un vrai retour au lobby pour une nouvelle partie, repartir avec un journal vide et un score nul.
- Ne pas copier le lobby 3D ni intégrer les clés API dans le client Phaser. Les secrets restent côté serveur.

### Cas de référence à vérifier

| Cas | Faits dans l'ordre | Score / issue | Énergie / mécanisme / passage |
| --- | --- | --- | --- |
| Inaction | Aucun | 0 / `mixed` | `neutral` / `neutral` / `neutral` |
| Bienveillant | Recharge, débris retiré, libération | +45 / `paradise` | `support` / `support` / `open` |
| Hostile | Surcharge, câble arraché, serrage dommageable | -50 / `hell` | `hazard` / `hazard` / `restricted` |
| Mixte | Recharge, câble arraché, libération | +10 / `mixed` | `support` / `hazard` / `open` |
| Changement de comportement | Serrage dommageable, libération | +5 / `mixed` | `neutral` / `neutral` / `open` |
| Bien mais dommage persistant | Recharge, surcharge, débris retiré, libération | +30 / `paradise` | `hazard` / `support` / `open` |

Vérifier aussi : aucun double comptage d'un événement répété ; score -15 en enfer et +15 au paradis ; restart du parcours sans perte du résultat ; reprise après dégâts avec état temporaire de bouclier réinitialisé ; pas de softlock avec les trois effets actifs ; API indisponible sans blocage. Le bouclier absorbe un contact dangereux, pas une chute hors niveau, et donne une brève invulnérabilité de sortie pour ne pas mourir sur le même contact immédiatement.

### Ordre de livraison recommandé à Kusaila

1. Niveau complet jouable avec résultat neutre, mort/reprise et sortie.
2. Consommation du contrat avec les cas fixes ci-dessus.
3. Trois emplacements : énergie, mécanisme, passage. Commencer par énergie et raccourci ; garder le mécanisme neutre tant que sa presse n'est pas prête.
4. Ambiance selon `outcome`, puis raccord réel au lobby.
5. Tester les parcours complets ensemble et régler les valeurs sans changer le contrat en solo.

### Journal — transmission du brief

2026-09-26 : Yann demande de transmettre le brief du lobby 3D, les signaux et les notations pour permettre le développement du platformer en parallèle. Le présent contrat V1 et son barème initial sont documentés à cet effet ; leur implémentation et leur équilibrage restent à faire.


## Production des assets — cellule blanche validée

### Mission confiée à Kusaila

Yann demande de centraliser ici les prompts pour produire le pack pendant que Sc4rville continue la scène 3D locale. Cette mission complète le travail plateforme ; elle ne change pas les signaux du verdict ci-dessus.

**Source approuvée :** [cellule blanche V3](../../public/concepts/lobby-v3/05-cellule-blanche.jpg), chemin repo `public/concepts/lobby-v3/05-cellule-blanche.jpg`.

**Manifeste exécutable de référence :** [generation-plan.json](../../public/cellule-assets/generation-plan.json). Les 11 prompts ci-dessous sont copiés intégralement depuis ce manifeste, sans réécriture.

**État à la transmission :** les prompts sont prêts, mais aucune image du pack n'a été produite. La session Devin Cloud était bloquée faute d'accès à `GEMINI_API_KEY`. Ne pas confondre brief envoyé et génération effectuée. Utiliser seulement une clé active autorisée, fournie localement ou via un secret provisionné ; jamais récupérer une ancienne clé dans Git, l'afficher, la commiter ou l'exposer au navigateur.

### Format et ordre de production

- Modèle prévu : **Nano Banana Pro**, identifiant `gemini-3-pro-image` ; taille demandée **2K**. Respecter le ratio indiqué pour chaque asset.
- Envoyer le **prompt ET l'image de référence jointe**. Mentionner son nom dans le texte ne suffit pas. Via API, inclure les octets de l'image comme partie `inlineData` avec le bon type MIME ; via interface, joindre réellement le fichier.
- Générer **00-robot-master** d'abord, à partir de la scène choisie. Vérifier son identité et ses proportions avant de lancer les quatre vues dépendantes.
- Pour **01 à 04**, joindre le robot maître, et non la scène d'origine. Toujours repartir du même maître validé, pas de la vue générée précédente.
- Pour **05 à 10**, joindre la scène choisie directement. Une image par asset, pas une planche contenant plusieurs objets.
- Robot et objets : fond gris clair uni, éclairage studio neutre, objet entier. Pas de faux damier transparent ni d'ombre dramatique incrustée. Le décor vide reste opaque et conserve l'éclairage de la scène.
- Enregistrer les sorties dans `public/cellule-assets/` avec les noms indiqués et l'extension correspondant au vrai format reçu (`.jpg`, `.png` ou `.webp`). Si le maître sort en PNG, adapter le fichier joint aux quatre vues, sans modifier leur prompt.
- Maximum trois requêtes simultanées ; pas de relance payante automatique. Si un résultat est incohérent, le signaler et garder le fichier pour revue plutôt que remplacer silencieusement le design.
- Ne pas écraser l'image de référence, les autres concepts, ni les fichiers du lobby en cours. Livrer une galerie/contact sheet et un état des sorties réussies ou bloquées.

### Limites à garder explicites

Ce pack contient des **images de référence pour la conversion 3D**, pas des meshes, textures PBR séparées, squelettes ou animations. Les côtés/dos invisibles sont reconstruits par l'IA : vérifier les proportions, l'asymétrie gauche/droite et les détails avant une éventuelle conversion multi-vues. Ne pas promettre une géométrie cohérente sur la seule foi du prompt.

Le robot maître est debout en pose A pour faciliter sa reconstruction ; il faudra ensuite un modèle articulable pour l'asseoir. Le fauteuil, le robot et les éléments manipulables doivent rester séparés dans le jeu. Le décor vide sert de référence de salle : une image seule ne permet pas le déplacement libre en 3D. Sc4rville construit cette salle explorable en parallèle.

### Prompts complets, prêts à copier

#### 00-robot-master

- **Image à joindre :** `public/concepts/lobby-v3/05-cellule-blanche.jpg`
- **Sortie :** `00-robot-master.jpg` (ou extension réelle), **2:3**, **2K

```text
Create one production reference image for a game asset, not a concept collage. The attached source defines the approved identity, material palette and proportions. Preserve that design rather than redesigning it. A single subject and single viewpoint only. No lettering, logo, watermark, annotation, panels, display pedestal, extra props or UI. Neutral diffuse studio lighting with readable surfaces, no dramatic colored light, hard cast shadows, motion blur, fog or lens blur. Plain uniform light-gray background, not a checkerboard and not simulated transparency. Keep all extremities inside the frame with clear margin. Image-to-3D reference only: the image does not claim to contain a rig or separable mesh parts. Reference image: approved complete white-cell scene. Isolate and reconstruct ONLY its dark slender skeletal humanoid robot, without chair, restraints, background, cables attached to external machines or loose tools. Preserve its gray nonhuman facial shell, tiny optical apertures, narrow rib-like chest with fine black cable muscles, thin limbs and mechanical hands. Show the whole robot STANDING in a relaxed A-pose, arms separated from torso and legs slightly apart. Modest front three-quarter view. Preserve the chest electrical port and forearm maintenance details. Do not turn it into an armored combat robot, white plastic toy or human. Reconstruct hidden leg and back details conservatively in the same design language. This master establishes body proportions for subsequent views. Do not copy its seated pose.
```

#### 01-robot-front

- **Image à joindre :** `public/cellule-assets/00-robot-master.jpg`
- **Sortie :** `01-robot-front.jpg` (ou extension réelle), **2:3**, **2K

```text
Create one production reference image for a game asset, not a concept collage. The attached source defines the approved identity, material palette and proportions. Preserve that design rather than redesigning it. A single subject and single viewpoint only. No lettering, logo, watermark, annotation, panels, display pedestal, extra props or UI. Neutral diffuse studio lighting with readable surfaces, no dramatic colored light, hard cast shadows, motion blur, fog or lens blur. Plain uniform light-gray background, not a checkerboard and not simulated transparency. Keep all extremities inside the frame with clear margin. Image-to-3D reference only: the image does not claim to contain a rig or separable mesh parts. Reference image: approved isolated robot master, authoritative for identity and proportions. Show EXACTLY this robot in exact front view, full body, identical relaxed A-pose and identical finger pose. Near-orthographic perspective, no dramatic foreshortening. Preserve head shape, relative limb lengths, chest construction, joint locations, material boundaries and all visible distinctive details. Rotate the viewpoint, do not redesign or mirror the robot to fake the opposite side. Anatomical left and right retain their distinct parts. If rear surfaces are unseen in the reference, infer minimal mechanically plausible continuation rather than introducing accessories. No chair or restraints. Match the master image's neutral lighting and scale within the canvas.
```

#### 02-robot-right

- **Image à joindre :** `public/cellule-assets/00-robot-master.jpg`
- **Sortie :** `02-robot-right.jpg` (ou extension réelle), **2:3**, **2K

```text
Create one production reference image for a game asset, not a concept collage. The attached source defines the approved identity, material palette and proportions. Preserve that design rather than redesigning it. A single subject and single viewpoint only. No lettering, logo, watermark, annotation, panels, display pedestal, extra props or UI. Neutral diffuse studio lighting with readable surfaces, no dramatic colored light, hard cast shadows, motion blur, fog or lens blur. Plain uniform light-gray background, not a checkerboard and not simulated transparency. Keep all extremities inside the frame with clear margin. Image-to-3D reference only: the image does not claim to contain a rig or separable mesh parts. Reference image: approved isolated robot master, authoritative for identity and proportions. Show EXACTLY this robot in exact right-side profile view, full body, identical relaxed A-pose and identical finger pose. Near-orthographic perspective, no dramatic foreshortening. Preserve head shape, relative limb lengths, chest construction, joint locations, material boundaries and all visible distinctive details. Rotate the viewpoint, do not redesign or mirror the robot to fake the opposite side. Anatomical left and right retain their distinct parts. If rear surfaces are unseen in the reference, infer minimal mechanically plausible continuation rather than introducing accessories. No chair or restraints. Match the master image's neutral lighting and scale within the canvas.
```

#### 03-robot-back

- **Image à joindre :** `public/cellule-assets/00-robot-master.jpg`
- **Sortie :** `03-robot-back.jpg` (ou extension réelle), **2:3**, **2K

```text
Create one production reference image for a game asset, not a concept collage. The attached source defines the approved identity, material palette and proportions. Preserve that design rather than redesigning it. A single subject and single viewpoint only. No lettering, logo, watermark, annotation, panels, display pedestal, extra props or UI. Neutral diffuse studio lighting with readable surfaces, no dramatic colored light, hard cast shadows, motion blur, fog or lens blur. Plain uniform light-gray background, not a checkerboard and not simulated transparency. Keep all extremities inside the frame with clear margin. Image-to-3D reference only: the image does not claim to contain a rig or separable mesh parts. Reference image: approved isolated robot master, authoritative for identity and proportions. Show EXACTLY this robot in exact rear view, full body, identical relaxed A-pose and identical finger pose. Near-orthographic perspective, no dramatic foreshortening. Preserve head shape, relative limb lengths, chest construction, joint locations, material boundaries and all visible distinctive details. Rotate the viewpoint, do not redesign or mirror the robot to fake the opposite side. Anatomical left and right retain their distinct parts. If rear surfaces are unseen in the reference, infer minimal mechanically plausible continuation rather than introducing accessories. No chair or restraints. Match the master image's neutral lighting and scale within the canvas.
```

#### 04-robot-left

- **Image à joindre :** `public/cellule-assets/00-robot-master.jpg`
- **Sortie :** `04-robot-left.jpg` (ou extension réelle), **2:3**, **2K

```text
Create one production reference image for a game asset, not a concept collage. The attached source defines the approved identity, material palette and proportions. Preserve that design rather than redesigning it. A single subject and single viewpoint only. No lettering, logo, watermark, annotation, panels, display pedestal, extra props or UI. Neutral diffuse studio lighting with readable surfaces, no dramatic colored light, hard cast shadows, motion blur, fog or lens blur. Plain uniform light-gray background, not a checkerboard and not simulated transparency. Keep all extremities inside the frame with clear margin. Image-to-3D reference only: the image does not claim to contain a rig or separable mesh parts. Reference image: approved isolated robot master, authoritative for identity and proportions. Show EXACTLY this robot in exact left-side profile view, full body, identical relaxed A-pose and identical finger pose. Near-orthographic perspective, no dramatic foreshortening. Preserve head shape, relative limb lengths, chest construction, joint locations, material boundaries and all visible distinctive details. Rotate the viewpoint, do not redesign or mirror the robot to fake the opposite side. Anatomical left and right retain their distinct parts. If rear surfaces are unseen in the reference, infer minimal mechanically plausible continuation rather than introducing accessories. No chair or restraints. Match the master image's neutral lighting and scale within the canvas.
```

#### 05-fauteuil

- **Image à joindre :** `public/concepts/lobby-v3/05-cellule-blanche.jpg`
- **Sortie :** `05-fauteuil.jpg` (ou extension réelle), **1:1**, **2K

```text
Create one production reference image for a game asset, not a concept collage. The attached source defines the approved identity, material palette and proportions. Preserve that design rather than redesigning it. A single subject and single viewpoint only. No lettering, logo, watermark, annotation, panels, display pedestal, extra props or UI. Neutral diffuse studio lighting with readable surfaces, no dramatic colored light, hard cast shadows, motion blur, fog or lens blur. Plain uniform light-gray background, not a checkerboard and not simulated transparency. Keep all extremities inside the frame with clear margin. Image-to-3D reference only: the image does not claim to contain a rig or separable mesh parts. Isolate ONLY the ivory restraint chair from the approved white-cell image. Remove the robot and mobile tools, retaining the chair's built-in armrests, support, padded/contact surfaces and restraint mechanisms. Whole chair visible in a front three-quarter view, including base and backrest. Reconstruct the seat and surfaces hidden by the robot plausibly. Preserve the sharply geometric pristine institutional design, pale body and dark seams, not a generic dentist chair. No robot remnants or floating fingers. Do not add enormous new machinery.
```

#### 06-sonde-electrique

- **Image à joindre :** `public/concepts/lobby-v3/05-cellule-blanche.jpg`
- **Sortie :** `06-sonde-electrique.jpg` (ou extension réelle), **1:1**, **2K

```text
Create one production reference image for a game asset, not a concept collage. The attached source defines the approved identity, material palette and proportions. Preserve that design rather than redesigning it. A single subject and single viewpoint only. No lettering, logo, watermark, annotation, panels, display pedestal, extra props or UI. Neutral diffuse studio lighting with readable surfaces, no dramatic colored light, hard cast shadows, motion blur, fog or lens blur. Plain uniform light-gray background, not a checkerboard and not simulated transparency. Keep all extremities inside the frame with clear margin. Image-to-3D reference only: the image does not claim to contain a rig or separable mesh parts. One electrical maintenance probe consistent with the approved scene's foreground tools and clinical production design. A readable insulated off-white handle, dark rubber grip section, single blunt metal electrical connector tip, and a short cable socket at the rear. Whole tool diagonally framed in three-quarter view, no long tangled cable. Make the working tip distinct from an extraction plier. This is a reference-based reconstruction when the tiny source prop is ambiguous, not a claimed exact pixel extraction. No hand, tray, chair or robot.
```

#### 07-pince-extraction

- **Image à joindre :** `public/concepts/lobby-v3/05-cellule-blanche.jpg`
- **Sortie :** `07-pince-extraction.jpg` (ou extension réelle), **1:1**, **2K

```text
Create one production reference image for a game asset, not a concept collage. The attached source defines the approved identity, material palette and proportions. Preserve that design rather than redesigning it. A single subject and single viewpoint only. No lettering, logo, watermark, annotation, panels, display pedestal, extra props or UI. Neutral diffuse studio lighting with readable surfaces, no dramatic colored light, hard cast shadows, motion blur, fog or lens blur. Plain uniform light-gray background, not a checkerboard and not simulated transparency. Keep all extremities inside the frame with clear margin. Image-to-3D reference only: the image does not claim to contain a rig or separable mesh parts. One extraction plier consistent with the approved scene's foreground tools and clinical production design. Precision brushed-steel tool, two dark insulated handles, visible central pivot, short slightly open opposing jaws capable of gripping a wire or metal fragment. Whole plier in a clear three-quarter view showing jaws, pivot and both handles. No hand, cable gripped in jaws or other objects. Not scissors, syringe or electric probe. Where the tiny source tool is ambiguous reconstruct conservatively, with functional plausible geometry.
```

#### 08-verrou-contention

- **Image à joindre :** `public/concepts/lobby-v3/05-cellule-blanche.jpg`
- **Sortie :** `08-verrou-contention.jpg` (ou extension réelle), **1:1**, **2K

```text
Create one production reference image for a game asset, not a concept collage. The attached source defines the approved identity, material palette and proportions. Preserve that design rather than redesigning it. A single subject and single viewpoint only. No lettering, logo, watermark, annotation, panels, display pedestal, extra props or UI. Neutral diffuse studio lighting with readable surfaces, no dramatic colored light, hard cast shadows, motion blur, fog or lens blur. Plain uniform light-gray background, not a checkerboard and not simulated transparency. Keep all extremities inside the frame with clear margin. Image-to-3D reference only: the image does not claim to contain a rig or separable mesh parts. Isolate a single rotary restraint-lock assembly derived from the approved chair armrest. One short off-white armrest mounting section, a dark circular rotary knob with coarse grip ridges, visible pivot/hinge and a curved wrist clamp. Show the assembly from a useful front three-quarter angle, unobstructed by a wrist. The knob, hinge and clamp should have clear seams that communicate separate movable parts, without floating exploded-view components. Compact functional design matching the source. No whole chair or robot.
```

#### 09-module-avant-bras

- **Image à joindre :** `public/concepts/lobby-v3/05-cellule-blanche.jpg`
- **Sortie :** `09-module-avant-bras.jpg` (ou extension réelle), **1:1**, **2K

```text
Create one production reference image for a game asset, not a concept collage. The attached source defines the approved identity, material palette and proportions. Preserve that design rather than redesigning it. A single subject and single viewpoint only. No lettering, logo, watermark, annotation, panels, display pedestal, extra props or UI. Neutral diffuse studio lighting with readable surfaces, no dramatic colored light, hard cast shadows, motion blur, fog or lens blur. Plain uniform light-gray background, not a checkerboard and not simulated transparency. Keep all extremities inside the frame with clear margin. Image-to-3D reference only: the image does not claim to contain a rig or separable mesh parts. A close production reference of the approved robot's forearm maintenance module only, cropped as an intentional isolated component with both ends visible. Dark skeletal internal construction, gray outer panel partly open, robust fine cable bundle inside, and one small lodged metallic fragment visibly distinct from the connected cable. Show at a clear three-quarter angle. Keep at least one connected cable visibly intact and the obstruction localized, not a pile of shredded wires. No whole robot, detached hand, gore, tools or chair. Functional visual reconstruction consistent with the scene where exact micro-details are hidden.
```

#### 10-decor-vide

- **Image à joindre :** `public/concepts/lobby-v3/05-cellule-blanche.jpg`
- **Sortie :** `10-decor-vide.jpg` (ou extension réelle), **16:9**, **2K

```text
EDIT the attached approved white-cell scene, preserving its exact camera framing, perspective, architecture, observation slit, ceiling light design, wall-panel layout, floor drainage channel, colors and lighting. Remove ONLY the robot, chair, mobile foreground tray and loose tools. Remove shadows and reflections cast by the removed objects. Reconstruct the previously occluded floor and wall areas as a plausible continuation of existing surfaces. Keep the empty room's central space clear; add no props, furniture, people or new openings. This is the opaque background/environment reference of the SAME room, not a new room design. Single full-frame 16:9 image, no lettering, collage, logo or watermark. Do not generate a panorama or flatten perspective.
```

### Contrôle avant livraison à Sc4rville

- [ ] Les 11 sorties sont présentes, ou chaque absence est explicitement signalée.
- [ ] Le robot correspond à la cellule blanche choisie, pas à un autre concept ou au robot de démonstration.
- [ ] Les quatre vues conservent autant que possible la silhouette et les composants du maître ; noter les incohérences plutôt que les masquer.
- [ ] Robot isolé sans fauteuil incrusté ; fauteuil sans restes de robot.
- [ ] Sonde et pince clairement différentes ; verrou et module d'avant-bras lisibles.
- [ ] Décor vide sans fantômes du robot, fauteuil, plateau, ni leurs ombres.
- [ ] Images décodables, fichiers bien nommés, aucune clé dans les sorties ou les scripts suivis par Git.
- [ ] Galerie ou planche comparative fournie, avec mention « références 2D — conversion 3D à faire ».

2026-09-26 : prompts complets transmis dans ce suivi à la demande de Yann ; Sc4rville continue le lobby pendant la production du pack.
