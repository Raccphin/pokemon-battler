import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PokemonSprite } from '@/components/pokemon-sprite';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { getMoveLabel } from '@/services/battle-rules';
import { usePartyController } from '@/hooks/use-party-controller';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function PartyScreen() {
  const party = usePartyController();

  if (party.state.status === 'loading') {
    return (
      <ScreenState
        title="Loading your party"
        message="Restoring your Pokémon and save data."
        loading
      />
    );
  }
  if (party.state.status === 'error') {
    return (
      <ScreenState
        title="Save unavailable"
        message={party.state.message}
        onRetry={party.retry}
      />
    );
  }
  if (party.loading) {
    return (
      <ScreenState
        title="Loading your Pokémon"
        message="Fetching party data from PokéAPI."
        loading
      />
    );
  }
  if (party.error) {
    return (
      <ScreenState
        title="Party data unavailable"
        message={
          party.error instanceof Error
            ? party.error.message
            : 'PokéAPI could not be reached.'
        }
        onRetry={party.retryPokemonData}
      />
    );
  }

  const profile = party.state.profile;
  const { members, selectedMember } = party;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.eyebrow}>YOUR JOURNEY</ThemedText>
          <ThemedText style={styles.title}>Pokémon party</ThemedText>
          <ThemedText style={styles.subtitle}>
            Choose a teammate to preview its moves or switch it into battle.
          </ThemedText>
        </View>

        {party.operationError ? (
          <View style={styles.errorCard}>
            <ThemedText style={styles.errorText}>{party.operationError}</ThemedText>
          </View>
        ) : null}

        <View style={styles.partyList}>
          {members.map((member) => {
            const active = member.slot === profile.activeSlot;
            const selected = member.slot === selectedMember?.slot;
            return (
              <Pressable
                accessibilityRole="button"
                key={member.slot}
                onPress={() => party.selectMember(member.slot)}
                style={[
                  styles.memberCard,
                  selected && styles.memberSelected,
                  active && styles.memberActive,
                ]}>
                <View style={styles.memberSprite}>
                  {member.pokemon ? <PokemonSprite pokemon={member.pokemon} /> : null}
                </View>
                <View style={styles.memberInfo}>
                  <ThemedText numberOfLines={1} style={styles.memberName}>
                    {member.pokemon ? capitalize(member.pokemon.name) : 'Pokémon'}
                  </ThemedText>
                  <ThemedText style={styles.memberMeta}>
                    {member.currentHp}/{member.maxHp} HP · Lv. {member.level}
                  </ThemedText>
                  <View style={styles.memberHealth}>
                    <View
                      style={[
                        styles.memberHealthFill,
                        { width: `${(member.currentHp / member.maxHp) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
                {active ? (
                  <View style={styles.activePill}>
                    <Text style={styles.activeText}>ACTIVE</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {members.length === 0 ? (
            <View style={styles.emptyCard}>
              <ThemedText style={styles.memberName}>Your party is empty</ThemedText>
              <ThemedText style={styles.memberMeta}>
                Catch a Pokémon in battle to add it to your team.
              </ThemedText>
            </View>
          ) : null}
        </View>

        {selectedMember?.pokemon ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View style={styles.detailSprite}>
                <PokemonSprite pokemon={selectedMember.pokemon} />
              </View>
              <View style={styles.detailInfo}>
                <ThemedText style={styles.detailName}>
                  {capitalize(selectedMember.pokemon.name)}
                </ThemedText>
                <ThemedText style={styles.memberMeta}>
                  {selectedMember.pokemon.types.join(' · ')}
                </ThemedText>
                <ThemedText style={styles.memberMeta}>
                  ATK {selectedMember.pokemon.stats.attack} · DEF {selectedMember.pokemon.stats.defense}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.sectionTitle}>MOVE PREVIEW</ThemedText>
            <View style={styles.moves}>
              {selectedMember.pokemon.moves.map((move, index) => (
                <View key={`${move.name}-${index}`} style={styles.moveCard}>
                  <ThemedText style={styles.moveName}>{getMoveLabel(move.name)}</ThemedText>
                  <ThemedText style={styles.memberMeta}>
                    {move.patternSize}×{move.patternSize} · {move.type} · {move.power} power
                  </ThemedText>
                </View>
              ))}
            </View>

            {selectedMember.slot !== profile.activeSlot ? (
              <Pressable
                accessibilityRole="button"
                disabled={selectedMember.currentHp <= 0}
                onPress={() => void party.switchSelected()}
                style={({ pressed }) => [
                  styles.switchButton,
                  selectedMember.currentHp <= 0 && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.switchText}>
                  {selectedMember.currentHp <= 0
                    ? 'FAINTED · REVIVE FIRST'
                    : `SWITCH TO ${selectedMember.pokemon.name.toUpperCase()}`}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.currentBadge}>
                <ThemedText style={styles.currentText}>Currently in battle</ThemedText>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.inventoryCard}>
          <ThemedText style={styles.sectionTitle}>BAG INVENTORY</ThemedText>
          <ThemedText style={styles.inventoryText}>
            Poké Balls {profile.inventory.pokeBall} · Great Balls {profile.inventory.greatBall} ·
            Ultra Balls {profile.inventory.ultraBall}
          </ThemedText>
          <ThemedText style={styles.inventoryText}>
            Potions {profile.inventory.potion} · Revives {profile.inventory.revive}
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f1e7',
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    gap: 3,
  },
  eyebrow: {
    color: '#b86d51',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#77736b',
    fontSize: 13,
    lineHeight: 18,
  },
  partyList: {
    gap: 9,
  },
  memberCard: {
    minHeight: 84,
    padding: 10,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberSelected: {
    borderColor: '#e65d43',
  },
  memberActive: {
    backgroundColor: '#f0f5eb',
  },
  memberSprite: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#e8e1d2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  memberMeta: {
    color: '#77736b',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  memberHealth: {
    height: 5,
    marginTop: 3,
    borderRadius: 4,
    backgroundColor: '#e9e9e3',
    overflow: 'hidden',
  },
  memberHealthFill: {
    height: '100%',
    backgroundColor: '#57a76f',
  },
  activePill: {
    position: 'absolute',
    top: 8,
    right: 9,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#dcebd7',
  },
  activeText: {
    color: '#47744e',
    fontSize: 8,
    fontWeight: '900',
  },
  detailCard: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    gap: 13,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailSprite: {
    width: 82,
    height: 82,
    borderRadius: 20,
    backgroundColor: '#e8e1d2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  detailInfo: {
    flex: 1,
    gap: 5,
  },
  detailName: {
    fontSize: 23,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    color: '#39424a',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  moves: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  moveCard: {
    width: '48%',
    minHeight: 60,
    padding: 10,
    borderRadius: 13,
    backgroundColor: '#f6f3eb',
    justifyContent: 'center',
  },
  moveName: {
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 15,
    backgroundColor: '#25394a',
  },
  switchText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
  currentBadge: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 15,
    backgroundColor: '#e6f0df',
  },
  currentText: {
    color: '#47744e',
    fontWeight: '800',
  },
  inventoryCard: {
    gap: 6,
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#e8e1d2',
  },
  inventoryText: {
    color: '#56534d',
    fontSize: 12,
  },
  emptyCard: {
    padding: 20,
    gap: 5,
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  errorCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#ffe5df',
  },
  errorText: {
    color: '#9e4439',
    fontSize: 12,
    fontWeight: '700',
  },
});
