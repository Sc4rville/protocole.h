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
