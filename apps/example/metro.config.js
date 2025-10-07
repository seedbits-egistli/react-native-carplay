const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');
const nm = ['node', 'modules'].join('_');
const config = getDefaultConfig(__dirname);

module.exports = mergeConfig(config, {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, nm),
      path.resolve(__dirname, '../../', nm),
    ],
    disableHierarchicalLookup: true,
  },
  watchFolders: [
    path.resolve(__dirname, '../../', nm),
    path.resolve(__dirname, '../../packages/react-native-carplay'),
  ]
}); // Merge with any custom configurations
