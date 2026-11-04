import * as Haptics from 'expo-haptics';

export function rumble() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch((error: unknown) => {
    console.warn('Haptic feedback could not be played.', error);
  });
}
