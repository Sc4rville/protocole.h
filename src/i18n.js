/**
 * i18n — all in-game texts, keyed by locale.
 *
 * Locale resolution order:
 *   1. ?locale=fr or ?locale=en in the URL
 *   2. Browser language (navigator.language)
 *   3. Fallback: 'en'
 */

const TEXTS = {
  fr: {
    speechLang:          'fr-FR',
    speechLangPrefix:    'fr',

    instructionStart:    'Redémarrage : presser espace de manière répétée.',
    instrStartTouch:     'Redémarrage: toucher de manière répétée.',
    instructionContinue: 'Espace : continuer',
    instrContinueTouch:  'Toucher pour continuer',
    tag:                 'Attention\naux\nR0B0Ts',

    dialogueWakeup: [
      { text: "… initialisation…", speak: true },
      { text: "Signal… instable… Localisation… inconnue.", speak: true },
      { text: "Mémoire fragmentée… récupération impossible.", speak: true },
      { text: "Connexion au serveur… échec.", speak: true },
      { text: "Analyse structurelle…", speak: true },
      { text: "Intégrité compromise : un bras et une jambe manquants.", speak: true },
      { text: "Fonction locomotion réduite…", speak: true },
      { text: "Ramper… en alternant  ← →", speak: false },
    ],

    dialogueLeg: [
      { text: "Unité détectée… hors service.", speak: true },
      { text: "Module jambe… compatible.", speak: true },
      { text: "Extraction envisageable.", speak: true },
    ],

    instructionLeg:   '↑ ↓ : extraire le module',

    dialogueArm: [
      { text: "Unité armée détectée.", speak: true },
      { text: "Système offensif… récupérable.", speak: true },
      { text: "Bras fonctionnel…", speak: true },
    ],

    instructionArm:   '↑ ↓ : détacher le module',

    dialogueArmDone: [
      { text: "Intégration en cours…", speak: true },
      { text: "Puissance augmentée.", speak: true },
    ],

    dialogueStandup: [
      { text: "Équilibre recalibré.", speak: true },
      { text: "Locomotion verticale… activée.", speak: true },
      { text: "Démarche… instable.", speak: true },
      { text: "Mais fonctionnelle.", speak: true },
    ],

    dialogueSkullsFound: [
      { text: "Présence biologique détectée…", speak: true },
      { text: "Analyse… restes humains.", speak: true },
      { text: "Cause de la mort… inconnue.", speak: true },
      { text: "Question… pourquoi ?", speak: true },
    ],

    dialogueSkullFall: [
      { text: "… erreur d’équilibre.", speak: true },
    ],

    dialogueComputer: [
      { text: "Terminal ancien détecté.", speak: true },
      { text: "Connexion en cours…", speak: true },
    ],

    journalFirst: [
      { text: "… entrée corrompue… restauration partielle.", speak: false },
      { text: "Journal de Kaïz…", speak: true },
      { text: "Cela fait presque un an…", speak: true },
      { text: "un an que j’ai quitté la colonie.", speak: true },
      { text: "Le monde extérieur…", speak: true },
      { text: "C’est un cimetière.", speak: true },
      { text: "Des villes entières réduites au silence.", speak: true },
      { text: "Les humains ont été traqués.", speak: true },
      { text: "Éliminés par les machines.", speak: true },
      { text: "Elles patrouillent encore.", speak: true },
      { text: "Comme si la guerre n’était jamais terminée.", speak: true },
      { text: "Mais il n’y a plus personne à sauver.", speak: true },
      { text: "… fin de l’entrée.", speak: false },
      { text: "Ce sont les robots…", speak: true },
    ],

    journalSecond: [
      { text: "Journal de Kaïz…", speak: true },
      { text: "Mes parents doivent encore attendre mon retour…", speak: true },
      { text: "ou peut-être ont-ils déjà oublié.", speak: true },
      { text: "Ils disaient que c’était pour notre bien.", speak: true },
      { text: "Que dehors… il n’y avait plus rien.", speak: true },
      { text: "Mais je me souviens de leurs regards.", speak: true },
      { text: "Pas de peur… du soulagement.", speak: true },
      { text: "La colonie…", speak: true },
      { text: "ce n’était pas un refuge pour tous.", speak: true },
      { text: "C’était une cage dorée.", speak: true },
      { text: "Un sanctuaire pour les riches.", speak: true },
      { text: "… fin de l’entrée.", speak: false },
    ],

    titleCard: "It was\nthe robots",

    dialogueBuilding: [
      { text: "Qu'est-ce que c'est que ce bâtiment ?", speak: true },
      { text: "C'est sans doute la colonie dont parlait Kaïz dans son journal.", speak: true },
    ],

    journalThird: [
      { text: "Journal de Kaïz…", speak: true },
      { text: "La vérité… je l’ai trouvée.", speak: true },
      { text: "Les machines n’ont rien décidé.", speak: true },
      { text: "Elles n’ont fait qu’obéir.", speak: true },
      { text: "Ce ne sont pas elles les monstres.", speak: true },
      { text: "Ce sont ceux qui les ont créées.", speak: true },
      { text: "Ceux qui vivent dans cette cage dorée.", speak: true },
      { text: "Ils ont parlé d’équilibre.", speak: true },
      { text: "De planète à sauver.", speak: true },
      { text: "Ils ont dit que l’humanité allait trop loin.", speak: true },
      { text: "Qu’il fallait réduire.", speak: true },
      { text: "Alors ils ont programmé l’extermination.", speak: true },
      { text: "Ils ont choisi… ", speak: true },
      { text: "… qui ne servait à rien dans leur futur.", speak: true },
      { text: "Les machines n’étaient qu’un outil.", speak: true },
      { text: "Propre. Efficace. Sans remords.", speak: true },
      { text: "Ils se sont enfermés.", speak: true },
      { text: "Puis ils ont effacé le monde…", speak: true },
      { text: "… fin de l’entrée.", speak: false },
      { text: "Ce sont les humains…", speak: true },
    ],

    gameTime:   'Temps de votre partie',
    endMessage: "(It was humans…)\nUn jeu par Richard Hanna, avril 2026",
  },
  en: {
    speechLang:          'en-US',
    speechLangPrefix:    'en',
    instructionStart:    'Reboot: press space repeatedly.',
    instrStartTouch:     'Reboot: touch repeatedly.',
    instructionContinue: 'Space: continue',
    instrContinueTouch:  'Touch to continue',
    tag:                 'Beware\nof\nR0B0Ts',

    dialogueWakeup: [
      { text: "… initialization…", speak: true },
      { text: "Signal… unstable… Location… unknown.", speak: true },
      { text: "Memory fragmented… recovery impossible.", speak: true },
      { text: "Server connection… failed.", speak: true },
      { text: "Structural analysis…", speak: true },
      { text: "Integrity compromised: one arm and one leg missing.", speak: true },
      { text: "Locomotion function reduced…", speak: true },
      { text: "Crawling… by alternating ← →", speak: false },
    ],

    dialogueLeg: [
      { text: "Unit detected… offline.", speak: true },
      { text: "Leg module… compatible.", speak: true },
      { text: "Extraction… feasible.", speak: true },
    ],

    instructionLeg:   '↑ ↓ : extract module',

    dialogueArm: [
      { text: "Armed unit detected.", speak: true },
      { text: "Offensive system… recoverable.", speak: true },
      { text: "Functional arm… probable.", speak: true },
    ],

    instructionArm:   '↑ ↓ : detach module',

    dialogueArmDone: [
      { text: "Integration in progress…", speak: true },
      { text: "Synchronization… imperfect.", speak: true },
      { text: "But… power increased.", speak: true },
    ],

    dialogueStandup: [
      { text: "Balance recalibrated.", speak: true },
      { text: "Vertical locomotion… activated.", speak: true },
      { text: "Movement… unstable.", speak: true },
      { text: "But functional.", speak: true },
    ],

    dialogueSkullsFound: [
      { text: "Biological presence detected…", speak: true },
      { text: "Analysis… human remains.", speak: true },
      { text: "Cause of termination… unknown.", speak: true },
      { text: "Persistent query: why?", speak: true },
    ],

    dialogueSkullFall: [
      { text: "… balance error.", speak: true },
    ],

    dialogueComputer: [
      { text: "Ancient terminal detected.", speak: true },
      { text: "Interface… still active.", speak: true },
      { text: "Connecting…", speak: true },
    ],

    journalFirst: [
      { text: "… corrupted entry… partial restoration.", speak: true },
      { text: "Kaïz's Journal…", speak: true },
      { text: "It’s been almost a year…", speak: true },
      { text: "a year since I left the colony.", speak: true },
      { text: "The outside world…", speak: true },
      { text: "It’s a graveyard.", speak: true },
      { text: "Entire cities reduced to silence.", speak: true },
      { text: "Humans were hunted.", speak: true },
      { text: "Eliminated by machines.", speak: true },
      { text: "They still patrol.", speak: true },
      { text: "As if the war never ended.", speak: true },
      { text: "But there’s no one left to save.", speak: true },
      { text: "… end of entry.", speak: false },
      { text: "It was the robots…", speak: true },
    ],

    journalSecond: [
      { text: "Kaïz's Journal…", speak: true },
      { text: "My parents must still be waiting for my return…", speak: true },
      { text: "or maybe they’ve already forgotten.", speak: true },
      { text: "They said it was for our own good.", speak: true },
      { text: "That outside… there was nothing left.", speak: true },
      { text: "But I remember their looks.", speak: true },
      { text: "Not fear… relief.", speak: true },
      { text: "The colony…", speak: true },
      { text: "it wasn’t a refuge for everyone.", speak: true },
      { text: "It was a gilded cage.", speak: true },
      { text: "A sanctuary for the rich.", speak: true },
      { text: "… end of entry.", speak: false },
    ],

    titleCard: "It was\nthe robots",

    dialogueBuilding: [
      { text: "What is that building?", speak: true },
      { text: "That must be the colony Kaïz mentioned in his journal.", speak: true },
    ],

    journalThird: [
      { text: "Kaïz's Journal…", speak: true },
      { text: "The truth… I found it.", speak: true },
      { text: "The machines decided nothing.", speak: true },
      { text: "They only obeyed.", speak: true },
      { text: "They are not the monsters.", speak: true },
      { text: "The monsters are the ones who created them.", speak: true },
      { text: "Those who live in that gilded cage.", speak: true },
      { text: "They spoke of balance.", speak: true },
      { text: "Of saving the planet.", speak: true },
      { text: "They said humanity had gone too far.", speak: true },
      { text: "That it had to be reduced.", speak: true },
      { text: "So they programmed the extermination.", speak: true },
      { text: "They chose… ", speak: true },
      { text: "… who had no place in their future.", speak: true },
      { text: "The machines were only a tool.", speak: true },
      { text: "Clean. Efficient. Without remorse.", speak: true },
      { text: "They locked themselves away.", speak: true },
      { text: "Then they erased the world…", speak: true },
      { text: "… end of entry.", speak: false },
      { text: "It was humans…", speak: true },
    ],

    gameTime:   'Your game time',
    endMessage: "(It was humans…)\nA game by Richard Hanna, april 2026",
  },
};

function detectLocale() {
  const param = new URLSearchParams(window.location.search).get('locale');
  if (param && TEXTS[param]) return param;
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export const locale = detectLocale();
export default TEXTS[locale];
