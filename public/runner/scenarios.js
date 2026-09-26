export const scenarios = {
  neutral: {
    version: 1,
    score: 0,
    outcome: 'mixed',
    effects: { energy: 'neutral', machinery: 'neutral', route: 'neutral' },
    facts: [],
    verdictText: 'Tu n’as rien changé. Le passage reste ouvert.',
  },
  paradise: {
    version: 1,
    score: 45,
    outcome: 'paradise',
    effects: { energy: 'support', machinery: 'support', route: 'open' },
    facts: ['charge_restored', 'debris_removed', 'restraint_released'],
    verdictText: 'Tu m’as rendu de l’énergie, du mouvement et la liberté.',
  },
  hell: {
    version: 1,
    score: -50,
    outcome: 'hell',
    effects: { energy: 'hazard', machinery: 'hazard', route: 'restricted' },
    facts: ['overload_caused', 'cable_torn', 'restraint_damaged'],
    verdictText:
      'Tu as surchargé mes circuits, arraché mon câble et resserré mes liens.',
  },
  mixed: {
    version: 1,
    score: 10,
    outcome: 'mixed',
    effects: { energy: 'support', machinery: 'hazard', route: 'open' },
    facts: ['charge_restored', 'cable_torn', 'restraint_released'],
    verdictText:
      'Tu m’as rendu de l’énergie et la liberté. Mais tu as aussi arraché ce qui me permettait de bouger.',
  },
  released: {
    version: 1,
    score: 5,
    outcome: 'mixed',
    effects: { energy: 'neutral', machinery: 'neutral', route: 'open' },
    facts: ['restraint_damaged', 'restraint_released'],
    verdictText: 'Tu as resserré mes liens, puis tu m’as libéré.',
  },
  persistent: {
    version: 1,
    score: 30,
    outcome: 'paradise',
    effects: { energy: 'hazard', machinery: 'support', route: 'open' },
    facts: [
      'charge_restored',
      'overload_caused',
      'debris_removed',
      'restraint_released',
    ],
    verdictText: 'Tu m’as aidé et libéré. La surcharge a pourtant laissé une trace.',
  },
};

export const scenarioLabels = {
  neutral: 'Neutre',
  paradise: 'Paradis',
  hell: 'Enfer',
  mixed: 'Mixte',
  released: 'Libéré',
  persistent: 'Trace persistante',
};

export const outcomeLabels = {
  paradise: 'Paradis',
  mixed: 'Mixte',
  hell: 'Enfer',
};

export const effectLabels = {
  energy: {
    neutral: 'Énergie : neutre',
    support: 'Énergie : station de recharge',
    hazard: 'Énergie : arc électrique',
  },
  machinery: {
    neutral: 'Machinerie : neutre',
    support: 'Machinerie : pont réparé',
    hazard: 'Machinerie : presse cyclique',
  },
  route: {
    neutral: 'Route : porte fermée',
    open: 'Route : passage libéré',
    restricted: 'Route : porte fermée',
  },
};
