import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBattleController } from '@/hooks/use-battle-controller';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { usePlayer } from '@/providers/player-provider';
import { SHOP_CONFIG, getShopItemLabel } from '@/services/shop';
import type { ShopItemKey } from '@/types/game';

const SHOP_ITEMS: ShopItemKey[] = ['potion', 'revive', 'pokeBall', 'greatBall', 'ultraBall'];

export default function ShopScreen() {
  const { state, operationError, retry, purchaseItem } = usePlayer();
  const battle = useBattleController();

  if (state.status === 'loading') {
    return <ScreenState title="Loading the shop" message="Restoring your coin pouch." loading />;
  }
  if (state.status === 'error') {
    return <ScreenState title="Save unavailable" message={state.message} onRetry={retry} />;
  }

  const { profile } = state;
  const shopDue =
    profile.encounterComplete &&
    profile.shopProgress >= SHOP_CONFIG.encountersPerShop;

  async function handlePurchase(item: ShopItemKey) {
    try {
      await purchaseItem(item);
    } catch {
      // The provider stores the failure message in operationError.
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.eyebrow}>SHOP</ThemedText>
          <ThemedText style={styles.title}>Marketplace</ThemedText>
          <ThemedText style={styles.subtitle}>Spend coins on recovery and battle items.</ThemedText>
        </View>

        <View style={styles.walletCard}>
          <ThemedText style={styles.walletLabel}>Coins</ThemedText>
          <ThemedText style={styles.walletValue}>{profile.money}</ThemedText>
        </View>

        {operationError ? (
          <View style={styles.errorCard}>
            <ThemedText style={styles.errorText}>{operationError}</ThemedText>
          </View>
        ) : null}

        <View style={styles.items}>
          {SHOP_ITEMS.map((item) => {
            const price = SHOP_CONFIG.prices[item];
            const canAfford = profile.money >= price;
            const unavailable = !canAfford;

            return (
              <Pressable
                accessibilityRole="button"
                disabled={unavailable}
                key={item}
                onPress={() => void handlePurchase(item)}
                style={[styles.item, unavailable && styles.disabled]}>
                <ThemedText style={styles.itemName}>{getShopItemLabel(item)}</ThemedText>
                <ThemedText style={styles.itemMeta}>{price} coins</ThemedText>
                <ThemedText style={styles.itemAction}>Tap to buy</ThemedText>
              </Pressable>
            );
          })}
        </View>

        {shopDue ? (
          <>
            <ThemedText style={styles.footerText}>
              Purchase items and heal before continuing your run.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              disabled={battle.busy}
              onPress={async () => {
                if (await battle.startNewEncounter(true)) {
                  router.replace('/');
                }
              }}
              style={({ pressed }) => [
                styles.continueButton,
                battle.busy && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <ThemedText style={styles.continueButtonText}>
                {battle.busy ? 'LOADING NEXT ENCOUNTER…' : 'CONTINUE TO NEXT ENCOUNTER'}
              </ThemedText>
            </Pressable>
            {battle.message && battle.message !== 'Choose a move to view its attack pattern.' ? (
              <ThemedText style={styles.footerText}>{battle.message}</ThemedText>
            ) : null}
          </>
        ) : (
          <ThemedText style={styles.footerText}>
            The shop will open automatically after {SHOP_CONFIG.encountersPerShop} encounters.
          </ThemedText>
        )}
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
    paddingTop: 18,
    paddingBottom: 24,
    gap: 14,
  },
  header: {
    gap: 4,
  },
  eyebrow: {
    color: '#b86d51',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#77736b',
    fontSize: 12,
  },
  walletCard: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#ebd4a8',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletLabel: {
    color: '#7a695e',
    fontWeight: '700',
  },
  walletValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#d39f34',
  },
  errorCard: {
    backgroundColor: '#fff0f0',
    borderColor: '#e6bbbc',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: '#a13a39',
    fontWeight: '700',
  },
  items: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  item: {
    width: '48%',
    minHeight: 88,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8dfd2',
  },
  itemName: {
    fontWeight: '800',
    marginBottom: 4,
  },
  itemMeta: {
    color: '#77736b',
    fontSize: 12,
  },
  itemAction: {
    marginTop: 8,
    color: '#b86d51',
    fontWeight: '800',
  },
  continueButton: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#e65d43',
    paddingHorizontal: 16,
  },
  continueButtonText: {
    color: '#fffaf0',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.45,
  },
  footer: {
    marginTop: 4,
  },
  footerText: {
    color: '#7a695e',
    fontSize: 12,
  },
});
