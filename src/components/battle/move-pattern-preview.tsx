import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PokemonSprite } from '@/components/pokemon-sprite';
import { ThemedText } from '@/components/themed-text';
import { STATUS_EFFECT_PRESENTATION } from '@/constants/status-effects';
import { getMoveStatusChance } from '@/services/battle-rules';
import { getMoveLabel } from '@/utils/labels';
import type { MovePattern, Pokemon, PokemonMove } from '@/types/game';

interface MovePatternPreviewProps {
  move: PokemonMove;
  pattern: MovePattern;
  pokemon?: Pokemon;
}

export function MovePatternPreview({ move, pattern, pokemon }: MovePatternPreviewProps) {
  const status = move.statusEffect
    ? STATUS_EFFECT_PRESENTATION[move.statusEffect]
    : null;

  return (
    <View style={styles.preview}>
      <View style={styles.header}>
        {pokemon ? <PokemonSprite pokemon={pokemon} size={38} /> : null}
        <View style={styles.titleGroup}>
          <ThemedText style={styles.eyebrow}>ATTACK PREVIEW</ThemedText>
          <ThemedText style={styles.name}>
            {pokemon
              ? `${getMoveLabel(pokemon.name)} · ${getMoveLabel(move.name)}`
              : getMoveLabel(move.name)}
          </ThemedText>
        </View>
      </View>
      {status ? (
        <ThemedText style={styles.status}>
          {status.label.toUpperCase()} · {Math.round(getMoveStatusChance(move))}%
        </ThemedText>
      ) : null}
      <View style={styles.pattern}>
        {Array.from({ length: pattern.footprintSize }, (_, row) => (
          <View key={row} style={styles.patternRow}>
            {Array.from({ length: pattern.footprintSize }, (_, column) => {
              const hit = pattern.hitCells.some(
                (cell) => cell.row === row && cell.column === column
              );
              return (
                <View
                  key={column}
                  style={[
                    styles.patternCell,
                    hit && styles.patternHit,
                    hit && status ? { backgroundColor: status.color } : null,
                  ]}>
                  {hit && status ? (
                    <Image contentFit="contain" source={status.icon} style={styles.statusIcon} />
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <ThemedText style={styles.details}>
        {pattern.hitCells.length} hit cells ·{' '}
        {pattern.effectivePower === null
          ? 'fails until its condition is met'
          : `${pattern.effectivePower} power`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#25394a',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  titleGroup: {
    alignItems: 'flex-start',
  },
  eyebrow: {
    color: '#fffaf0',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  name: {
    color: '#fffaf0',
    fontSize: 12,
    fontWeight: '800',
  },
  status: {
    color: '#fffaf0',
    fontSize: 10,
    fontWeight: '900',
  },
  pattern: {
    alignItems: 'center',
    gap: 3,
  },
  patternRow: {
    flexDirection: 'row',
    gap: 3,
  },
  patternCell: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patternHit: {
    backgroundColor: '#efb34f',
    borderColor: '#ffd787',
  },
  statusIcon: {
    width: 15,
    height: 15,
  },
  details: {
    color: '#fffaf0',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
});
