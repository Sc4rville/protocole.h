# Handoff 4 : préparer le raccord verdict vers après-mondes

## Mission et dépendance

Reprendre `Sc4rville/protocole.h`, branche `handoff/protocole-five-lots`, puis créer `work/afterworld-verdict`. Préparer un adaptateur testé pour connecter le résultat de Yann aux parcours, sans remplacer son lobby ni inventer son état d'avancement. Ce lot peut préparer le contrat et les tests maintenant ; l'activation de la transition dépend d'un accord de Yann et du coordinateur.

Lire `docs/equipe/kusaila.md` (contrat V1), `docs/equipe/scarville.md`, `docs/implementation-handoff.md`, puis le vrai code du lobby et de `src/afterworld/`. Le README et certains suivis sont historiques : ne pas déduire l'état courant d'une phrase ancienne. Dans la copie locale inspectée, `public/lobby-test/` est une scène technique ; le travail de Yann peut continuer ailleurs.

## Droits et séparation

Tu peux créer et modifier `src/afterworld/integration/` et `docs/handoffs/results/04-verdict.json`, avec tests et fixtures à l'intérieur de ce dossier. Tu peux commiter et pousser sur TA branche. Pas d'écriture dans les scènes de Yann, `src/main.ts`, Player, Game, World, Sound, game-state, les packages ou les suivis communs. Pas de main, fusion automatique, force-push, changement de visibilité, nouveaux secrets ou modification de configuration Git. Identité humaine : Kusaila <nalydavinci@protonmail.com>.

Le lot 1 active l'appel côté jeu après revue. Yann active l'émission côté lobby. Tu n'as pas l'autorisation de modifier leurs fichiers en parallèle. Ne pas contourner ce verrou par une copie du lobby ou une simulation présentée comme réelle.

## Contrat existant, à préserver

```ts
type LobbyFact = 'charge_restored' | 'overload_caused' | 'debris_removed' | 'cable_torn' | 'restraint_released' | 'restraint_damaged';
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

Le lobby calcule le score et les effets. L'adaptateur ne les recalcule pas, n'infère rien de la voix, du silence ou de la latence et n'ajoute pas de signal d'arme. Les effets mixtes doivent être conservés : un paradis peut contenir un danger électrique.

Créer un module JS pur `src/afterworld/integration/lobby-result.js` avec exactement cette interface :

```js
export function parseLobbyResult(value) {}
export function planAfterworld(result, { mixedMode = null } = {}) {}
export function createVerdictLatch() {}
```

Décisions fixées : parseLobbyResult retourne une copie immuable valide ou null. Valider version, score fini entre -100 et 100, enums, facts uniques parmi les six valeurs et verdictText chaîne. Copier/freeze les champs explicitement, jamais réutiliser les tableaux/objets mutables de l'appelant. Ne pas corriger silencieusement un score incohérent avec les faits : leur autorité reste au lobby.

planAfterworld conserve tous les champs et ajoute `mode` : hell => hell, paradise => heaven. Pour mixed, utiliser UNIQUEMENT mixedMode explicitement hell/heaven ; sinon retourner un résultat de planification avec `mode:null` et `needsMixedMode:true`. Le choix mixed n'est pas approuvé pour ce runner : ne pas l'inventer d'après le score. Résultat invalide => null.

createVerdictLatch retourne `{ accept, read, reset }`. accept enregistre le premier résultat valide immuable ; les réponses suivantes ne modifient pas une sentence déjà figée. Une entrée invalide ne verrouille pas. reset n'est utilisé que pour une NOUVELLE partie de lobby, pas pour rejouer le même parcours. Aucune dépendance navigateur, réseau ou clé.

## Cas de test figés depuis le contrat

Conserver ces attentes, ne pas rééquilibrer :

| Cas | facts dans l'ordre | score | outcome | energy / machinery / route |
| --- | --- | --- | --- | --- |
| Inaction | [] | 0 | mixed | neutral / neutral / neutral |
| Bienveillant | charge_restored, debris_removed, restraint_released | 45 | paradise | support / support / open |
| Hostile | overload_caused, cable_torn, restraint_damaged | -50 | hell | hazard / hazard / restricted |
| Mixte | charge_restored, cable_torn, restraint_released | 10 | mixed | support / hazard / open |
| Serrage puis libération | restraint_damaged, restraint_released | 5 | mixed | neutral / neutral / open |
| Bien avec dommage | charge_restored, overload_caused, debris_removed, restraint_released | 30 | paradise | hazard / support / open |

Ajouter : entrée mal formée, version inconnue, facts dupliqués, enum inconnu, score NaN/infini, mutation de l'objet source après accept, réponse tardive après accept, reset explicite, mixed non choisi, retry sans reset. Un texte de verdict affiché plus tard doit être du texte, pas du HTML injecté.

```sh
node --test src/afterworld/integration/lobby-result.test.mjs
```

## Préparer, sans activer en douce

Cartographier les points réels où le lobby pourrait émettre le résultat et où le jeu démarrerait. Rapporter les chemins/fonctions réellement trouvés. Indiquer précisément ce qui manque côté Yann : emission du contrat, choix mixed, transition, nouvelle partie, accès serveur Gemini/Gradium. Ne pas affirmer que ces intégrations sont terminées simplement parce qu'une clé ou un script de test existe.

Les appels IA et voix restent côté serveur autorisé ; aucune clé VITE_*, aucune copie de .env, aucune récupération de credentials. Une indisponibilité ne doit pas empêcher de jouer : le texte de secours et le résultat local appartiennent au producteur de verdict. Le sélecteur actuel reste utilisable tant que le raccord n'est pas approuvé.

Runtime : conserver les serveurs existants si local. Aucun besoin de nouveau serveur pour ces tests purs. Une VM ne partage pas le localhost de Kusaila.

## Livrable

Branche avec adaptateur et tests, plus `docs/handoffs/results/04-verdict.json` : contrat observé, exports, cas passés, points de branchement prouvés, décisions encore nécessaires. Signaler clairement « raccord non activé » tant que Yann et le lot 1 n'ont pas validé leurs côtés. Ne pas attendre en boucle : livrer ce lot préparatoire, puis reprendre la même session après coordination.
