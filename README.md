# protocole.h

> *Tu crois jouer à un jeu. C'est le jeu qui te teste.*

Projet du {Tech: Europe} AI Gaming Hack, Paris, 26 septembre 2026.

**Développement en cours :** [relais de production et dix étapes prioritaires](docs/implementation-handoff.md).


**protocole.h** est un jeu vidéo court, en 2D, dans une ambiance de science-fiction dramatique. Dans son monde, les IA font passer des tests aux humains. Tu entres dans une salle où une machine est attachée. Tes actes envers elle décident ensuite du monde que tu traverses.

> Statut : concept de hackathon. Tout ce qui suit peut changer.

---

## La vision

C'est l'inverse de *Westworld*. Ici, ce ne sont pas les humains qui testent les machines, mais les machines qui testent les humains.

Le joueur ne sait pas qu'il est jugé. Il croit être dans un bac à sable sans conséquences, alors il frappe et il expérimente. Puis tout se retourne contre lui. Il meurt, recommence et finit par comprendre la seule règle qui compte : **la façon dont tu traites ce qui est sans défense décide de ton sort.**

On veut créer un vrai « bomb effect » : le moment où le joueur lâche *« merde… j'ai été testé, et j'ai raté »*. C'est ça qu'on veut qu'il retienne, et qu'il raconte autour de lui.

Le jeu doit rester **ludique, créatif et addictif**. La morale doit se sentir dans les parties, pas dans un sermon.

---

## Boucle de jeu

```
            ┌──────────────────────────────────────────┐
            ▼                                          │
   ┌─────────────────┐      ┌──────────────────┐       │
   │  SALLE (30-45 s) │ ───▶ │  JUGEMENT        │       │
   │  toi + la       │      │  jauge de bonté  │       │
   │  machine        │      └────────┬─────────┘       │
   └─────────────────┘               │                 │
                          ┌──────────┴──────────┐      │
                          ▼                     ▼      │
                 ┌────────────────┐   ┌────────────────┐
                 │  PARADIS       │   │  ENFER         │
                 │  mini-jeu      │   │  mini-jeu      │
                 │  apaisé        │   │  exigeant      │
                 │  → sortie      │   │  → sortie      │
                 └───────┬────────┘   └───────┬────────┘
                         └──────────┬─────────┘
                                    │
                              rejouer autrement
```

1. **La confrontation, 30 à 45 secondes.** Une salle clinique, un robot entravé, trois choix lisibles : aider, ignorer ou blesser. Chaque acte a une réaction visible et sonore.
2. **La trace des actes.** Le jeu enregistre les choix localement et détermine une issue cohérente. Le verdict cite ce que tu as réellement fait.
3. **Le jugement.** La machine rend son verdict, et c'est le retournement du jeu.
4. **Le parcours.** Enfer et paradis sont deux variantes courtes d'un niveau de plateforme, toutes deux gagnables. Le décor généré par Nano Banana reprend les actes du joueur ; les collisions restent faites à la main.
5. **La boucle.** Une fin rapide invite à rejouer et à tester un autre comportement. Le jeu doit montrer des conséquences différentes, pas punir le joueur par une impasse.

---

## Direction artistique

- **Ambiance :** science-fiction clinique et dramatique. Néons froids, bruit de fond industriel, silences lourds.
- **La machine :** fragile et expressive. On doit hésiter avant de lui faire mal.
- **L'enfer :** rouge, saturé, oppressant. Le poursuivant ne s'arrête jamais.
- **Le paradis :** lumineux et apaisé, presque trop.
- **Le son** est essentiel. La voix de la machine, sa respiration mécanique et la musique évoluent en temps réel avec la jauge.

---

## Base jouable

La base actuelle provient de [Phaser Platformer](https://github.com/remarkablegames/phaser-platformer) de Menglin Xu, sous [licence MIT](LICENSE), avec le [tileset industriel CC0 de 0x72](https://0x72.itch.io/16x16-industrial-tileset). [Notre fork](https://github.com/kabylesystem/protocole-platformer-base) conserve la provenance. Le template offre déplacement, saut, collisions, dessin de tuiles et caméra ; le récit, les deux issues et les intégrations IA restent à créer. Un premier prototype narratif basé sur *It Was the Robots* a été écarté après test visuel ; son import est dans l'historique Git, pas dans le code actuel.

```bash
npm ci
npm run dev
npm run build
```

`dist/` contient l'export HTML5. Les secrets hackathon résident dans `.env.local`, ignoré par Git ; aucune clé ne doit entrer dans le code client.

## Stack de production

| Brique | Outil | Rôle |
|---|---|---|
| Jeu | **Phaser 4.2.1 + TypeScript + Vite** | Base 2D web, physique, saut, dessin de tuiles |
| Jugement | **Gemini** | Verdict contextualisé sans ralentir les contrôles |
| Voix | **Gradium** | Répliques du robot et verdict |
| Visuels | **Nano Banana 2** | Décor enfer/paradis réagissant aux actes du joueur, généré pendant la partie |
| Musique | **Lyria 3 Clip** | Boucles pré-générées, une par issue si le temps le permet |
| Publication | **itch.io** | Jeu HTML5 gratuit |

---

## Pistes ouvertes

- Faut-il montrer la jauge ? Ou ne la révéler qu'au moment du jugement, pour le choc ?
- Le joueur peut-il *parler* à la machine, et le ton de sa voix compte-t-il ?
- La machine garde-t-elle un souvenir d'une partie à l'autre ?
- Un écran final partageable : *« Tu as été jugé. Voici ton verdict. »*

---

## Équipe

Projet de hackathon par [@Sc4rville](https://github.com/Sc4rville) et [@kabylesystem](https://github.com/kabylesystem).
