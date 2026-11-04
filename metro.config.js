const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const spriteDirectory = path.join(__dirname, 'assets', 'images', 'sprites');
const spriteRegistryPath = path.join(__dirname, 'src', 'services', 'sprite-registry.ts');
const spriteFiles = fs
  .readdirSync(spriteDirectory)
  .filter((file) => /^\d{4}\.(?:png|jpg)$/.test(file))
  .sort();
const spriteIds = new Set();
const spriteEntries = spriteFiles.map((file) => {
  const id = Number.parseInt(file.slice(0, 4), 10);
  if (spriteIds.has(id)) {
    throw new Error(`Only one local sprite is allowed for Pokémon ${id}: ${file}`);
  }
  spriteIds.add(id);
  return `  ${id}: require('../../assets/images/sprites/${file}'),`;
});
const spriteRegistry = `export const pokemonSpriteSources: Record<number, number> = {\n${spriteEntries.join('\n')}\n};\n`;

if (!fs.existsSync(spriteRegistryPath) || fs.readFileSync(spriteRegistryPath, 'utf8') !== spriteRegistry) {
  fs.writeFileSync(spriteRegistryPath, spriteRegistry);
}

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

module.exports = config;
