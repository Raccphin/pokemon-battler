import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const areaBackgrounds: Record<string, number> = {
  'ancient-ruins': require('../../../assets/images/backgrounds/AncientRuins.png'),
  beach: require('../../../assets/images/backgrounds/Beach.png'),
  cave: require('../../../assets/images/backgrounds/Cave.png'),
  city: require('../../../assets/images/backgrounds/City.png'),
  desert: require('../../../assets/images/backgrounds/Desert.jpg'),
  dojo: require('../../../assets/images/backgrounds/Dojo.png'),
  'dragon-cave': require('../../../assets/images/backgrounds/DragonCave.png'),
  'fairy-grove': require('../../../assets/images/backgrounds/FairyGrove.png'),
  forest: require('../../../assets/images/backgrounds/Forest.png'),
  graveyard: require('../../../assets/images/backgrounds/Graveyard.webp'),
  jungle: require('../../../assets/images/backgrounds/Jungle.png'),
  laboratory: require('../../../assets/images/backgrounds/Laboratory.png'),
  mountain: require('../../../assets/images/backgrounds/Mountain.png'),
  ocean: require('../../../assets/images/backgrounds/Ocean.png'),
  'power-plant': require('../../../assets/images/backgrounds/Powerplant.png'),
  river: require('../../../assets/images/backgrounds/River.png'),
  ruins: require('../../../assets/images/backgrounds/Ruins.png'),
  snowfield: require('../../../assets/images/backgrounds/Snowy.png'),
  space: require('../../../assets/images/backgrounds/Space.jpg'),
  swamp: require('../../../assets/images/backgrounds/Swamp.png'),
  volcano: require('../../../assets/images/backgrounds/Volcano.png'),
};

interface AreaBackgroundProps {
  areaId: string;
}

export function AreaBackground({ areaId }: AreaBackgroundProps) {
  const source = areaBackgrounds[areaId];
  if (!source) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        accessibilityElementsHidden
        accessible={false}
        blurRadius={6}
        contentFit="cover"
        source={source}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(245, 241, 231, 0.3)',
  },
});
