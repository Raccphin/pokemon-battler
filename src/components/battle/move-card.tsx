import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';

import { ThemedText } from '@/components/themed-text';
import { getMoveLabel } from '@/services/battle-rules';
import type { PokemonMove } from '@/types/game';

interface MoveCardProps {
  move: PokemonMove;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDrop: (x: number, y: number) => void;
}

export function MoveCard({
  move,
  selected,
  disabled,
  onSelect,
  onDragStart,
  onDrop,
}: MoveCardProps) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        !disabled && (Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10),
      onPanResponderGrant: onDragStart,
      onPanResponderRelease: (_, gesture) => {
        onDrop(gesture.moveX, gesture.moveY);
      },
      }),
    [disabled, onDragStart, onDrop]
  );

  return (
    <View
      {...panResponder.panHandlers}
      style={[styles.wrapper, selected && styles.selectedWrapper]}>
      {selected ? (
        <View pointerEvents="none" style={styles.tooltip}>
          <ThemedText style={styles.tooltipTitle}>ATTACK PATTERN</ThemedText>
          {Array.from({ length: move.patternSize }, (_, row) => (
            <View key={row} style={styles.patternRow}>
              {Array.from({ length: move.patternSize }, (_, column) => (
                <View key={column} style={styles.patternCell} />
              ))}
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${getMoveLabel(move.name)}, ${move.patternSize} by ${move.patternSize} pattern`}
        disabled={disabled}
        onPress={onSelect}
        style={({ pressed }) => [
          styles.card,
          selected && styles.selected,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}>
        <ThemedText style={styles.name}>{getMoveLabel(move.name)}</ThemedText>
        <ThemedText style={styles.detail}>
          {move.patternSize}×{move.patternSize} · {move.power} power
        </ThemedText>
        <ThemedText style={styles.type}>{move.type.toUpperCase()}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '48%',
    position: 'relative',
  },
  selectedWrapper: {
    zIndex: 1,
  },
  card: {
    minHeight: 84,
    padding: 12,
    justifyContent: 'space-between',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e8e4da',
  },
  selected: {
    borderColor: '#e65d43',
    backgroundColor: '#fff3ed',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
  },
  detail: {
    fontSize: 12,
    color: '#666666',
  },
  type: {
    color: '#a4523e',
    fontSize: 10,
    fontWeight: '800',
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 2,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#25394a',
    elevation: 4,
    zIndex: 2,
  },
  tooltipTitle: {
    marginBottom: 2,
    color: '#fffaf0',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  patternRow: {
    flexDirection: 'row',
    gap: 2,
  },
  patternCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#efb34f',
    borderWidth: 1,
    borderColor: '#ffd787',
  },
});
