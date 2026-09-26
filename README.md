# protocole.h

> *Tu crois jouer à un jeu. C'est le jeu qui te teste.*
Projet du {Tech: Europe} AI Gaming Hack, Paris, 26 septembre 2026.


**protocole.h** est un jeu vidéo court, en 3D, dans une ambiance de science-fiction dramatique. Dans son monde, les IA font passer des tests aux humains. Tu entres dans une salle où une machine est attachée. Pendant une minute, tu peux lui faire ce que tu veux. Ensuite, c'est elle qui décide de ce que tu mérites.

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
   │  LOBBY  (60 s)  │ ───▶ │  JUGEMENT        │       │
   │  toi + la       │      │  jauge de bonté  │       │
   │  machine        │      └────────┬─────────┘       │
   └─────────────────┘               │                 │
                          ┌──────────┴──────────┐      │
                          ▼                     ▼      │
                 ┌────────────────┐   ┌────────────────┐
                 │  PARADIS       │   │  ENFER         │
                 │  mini-jeu      │   │  mini-jeu      │
                 │  facile        │   │  quasi         │
                 │  → victoire    │   │  impossible    │
                 └────────────────┘   │  → mort        │
                                      └───────┬────────┘
                                              │
                               retour au lobby, 30 s seulement
```

1. **Le lobby, 60 secondes.** Une salle clinique et sombre, avec une IA ou un robot entravé au centre. Le joueur interagit librement. Il peut frapper, électrocuter ou débrancher. Il peut aussi réparer, soigner, parler ou libérer. Chaque action a une réaction visible et sonore.
2. **La jauge de bonté.** Elle est invisible au début. Plus tard, peut-être, elle se révèle au joueur. Elle mesure ce que tu as fait, mais aussi *comment* tu l'as fait : ton hésitation, ton insistance, tes actes gratuits.
3. **Le jugement.** La machine rend son verdict, et c'est le retournement du jeu.
4. **Le mini-jeu.**
   - *Si tu as été cruel*, tu tombes en enfer. Une machine te traque, et c'est pensé pour que tu perdes.
   - *Si tu as été bon*, la course devient douce, presque offerte, et tu gagnes.
5. **La boucle.** Quand tu meurs, tu reviens au lobby, mais tu n'as plus que **30 secondes** pour te racheter. **La seule façon de gagner, c'est d'être bon avec la machine.**

---

## Direction artistique

- **Ambiance :** science-fiction clinique et dramatique. Néons froids, bruit de fond industriel, silences lourds.
- **La machine :** fragile et expressive. On doit hésiter avant de lui faire mal.
- **L'enfer :** rouge, saturé, oppressant. Le poursuivant ne s'arrête jamais.
- **Le paradis :** lumineux et apaisé, presque trop.
- **Le son** est essentiel. La voix de la machine, sa respiration mécanique et la musique évoluent en temps réel avec la jauge.

---

## Stack envisagée : suite Google

| Brique | Outil | Rôle |
|---|---|---|
| Cerveau de la machine | **Gemini** (API Gemini / Vertex AI) | Dialogues, réactions contextuelles, verdict final argumenté |
| Voix | **Gemini TTS / Cloud Text-to-Speech** | Voix de la machine, qui se dégrade ou s'adoucit selon tes actes |
| Écoute | **Gemini Live / Speech-to-Text** | Tu peux parler à la machine, et elle t'entend |
| Musique | **Lyria** | Bande-son générée qui suit la jauge de bonté |
| Cinématiques | **Veo** | Séquences de jugement, entrée en enfer ou au paradis |
| Visuels | **Imagen** | Textures, affiches, variations de la machine |
| 3D | Three.js / WebGL (ou moteur à définir) | Lobby, machine, mini-jeux |
| Hébergement | **Firebase / Cloud Run** | Déploiement web, scores, partage |

---

## Pistes ouvertes

- Faut-il montrer la jauge ? Ou ne la révéler qu'au moment du jugement, pour le choc ?
- Le joueur peut-il *parler* à la machine, et le ton de sa voix compte-t-il ?
- La machine garde-t-elle un souvenir d'une partie à l'autre ?
- Un écran final partageable : *« Tu as été jugé. Voici ton verdict. »*

---

## Équipe

Projet de hackathon par [@Sc4rville](https://github.com/Sc4rville) et [@kabylesystem](https://github.com/kabylesystem).
