import { Text } from 'phaser-jsx';

/**
 * Help text that has a "fixed" position on the screen.
 */
export function HelpText() {
  return (
    <Text
      x={16}
      y={16}
      text={[
        'FLECHES / WASD : BOUGER ET SAUTER',
        'CLIC GAUCHE : DESSINER UNE PLATEFORME',
        'CLIC DROIT : EFFACER',
      ].join('\n')}
      style={{
        backgroundColor: '#131a2a',
        color: '#e7f6ff',
        font: '16px monospace',
        padding: { x: 20, y: 10 },
      }}
      scrollFactorX={0}
      scrollFactorY={0}
    />
  );
}
