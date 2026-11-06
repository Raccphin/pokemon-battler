import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { pokemonSpriteSources } from '@/services/sprite-registry';
import type { Pokemon } from '@/types/game';

interface PokemonSpriteProps {
  pokemon: Pick<Pokemon, 'id' | 'spriteUrl'>;
  mirrored?: boolean;
  size?: number;
}

export function PokemonSprite({ pokemon, mirrored = false, size = 112 }: PokemonSpriteProps) {
  const localSource = pokemonSpriteSources[pokemon.id];
  const [failedLocalId, setFailedLocalId] = useState<number | null>(null);
  const [failedRemoteId, setFailedRemoteId] = useState<number | null>(null);
  const useLocal = localSource !== undefined && failedLocalId !== pokemon.id;
  const source = useLocal
    ? localSource
    : pokemon.spriteUrl && failedRemoteId !== pokemon.id
      ? { uri: pokemon.spriteUrl }
      : undefined;

  if (!source) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.fallbackText, { fontSize: size * 0.36 }]}>✦</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={source}
        contentFit="contain"
        onError={() => {
          if (useLocal) setFailedLocalId(pokemon.id);
          else setFailedRemoteId(pokemon.id);
        }}
        style={[styles.image, mirrored && styles.mirrored]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
  fallback: {
    backgroundColor: '#f2d8af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#e65d43',
    fontWeight: '800',
  },
});
