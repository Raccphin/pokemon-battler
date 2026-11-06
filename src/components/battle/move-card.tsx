import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { STATUS_EFFECT_PRESENTATION } from '@/constants/status-effects';
import { getMoveStatusChance } from '@/services/battle-rules';
import { getMoveLabel } from '@/utils/labels';
import type { MovePattern, PokemonMove } from '@/types/game';

interface MoveCardProps {
  move: PokemonMove;
  pattern: MovePattern;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDrop: (x: number, y: number) => void;
}

export function MoveCard({
  move,
  pattern,
  selected,
  disabled,
  onSelect,
  onDragStart,
  onDrop,
}: MoveCardProps) {
  const statusPresentation = move.statusEffect
    ? STATUS_EFFECT_PRESENTATION[move.statusEffect]
    : null;
  const statusChance = getMoveStatusChance(move);
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
          {statusPresentation ? (
            <ThemedText style={styles.statusPreviewLabel}>
              {statusPresentation.label.toUpperCase()} · {Math.round(statusChance)}%
            </ThemedText>
          ) : null}
          {Array.from({ length: pattern.footprintSize }, (_, row) => (
            <View key={row} style={styles.patternRow}>
              {Array.from({ length: pattern.footprintSize }, (_, column) => {
                const isHitCell = pattern.hitCells.some(
                  (cell) => cell.row === row && cell.column === column
                );
                return (
                  <View
                    key={column}
                    style={[
                      styles.patternCell,
                      isHitCell && styles.patternHitCell,
                      isHitCell && statusPresentation
                        ? { backgroundColor: statusPresentation.color }
                        : null,
                    ]}>
                    {isHitCell && statusPresentation ? (
                    <Image
                      contentFit="contain"
                      source={statusPresentation.icon}
                      style={styles.patternStatusIcon}
                    />
                  ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${getMoveLabel(move.name)}, ${pattern.hitCells.length} hit cells in a ${pattern.footprintSize} by ${pattern.footprintSize} pattern${statusPresentation ? `, may apply ${statusPresentation.label} at ${Math.round(statusChance)} percent` : ''}`}
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
          {pattern.hitCells.length} hits ·{' '}
          {pattern.effectivePower === null ? 'fails until hit' : `${pattern.effectivePower} power`}
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
  statusPreviewLabel: {
    color: '#fffaf0',
    fontSize: 8,
    fontWeight: '800',
  },
  patternRow: {
    flexDirection: 'row',
    gap: 2,
  },
  patternCell: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patternHitCell: {
    backgroundColor: '#efb34f',
    borderColor: '#ffd787',
  },
  patternStatusIcon: {
    width: 12,
    height: 12,
  },
});
