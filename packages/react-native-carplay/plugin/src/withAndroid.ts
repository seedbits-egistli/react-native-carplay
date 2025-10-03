import {
    AndroidConfig,
    ConfigPlugin,
    withAndroidManifest,
    withDangerousMod,
} from 'expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';
  
  export const withAndroidCarPlay: ConfigPlugin = (config) => {
    // Add meta-data to AndroidManifest.xml
    config = withAndroidManifest(config, (config) => {
      const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
        config.modResults
      );
  
      // Add the meta-data for Android Auto
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        'com.google.android.gms.car.application',
        '@xml/automotive_app_desc'
      );
  
      return config;
    });
  
    // Create automotive_app_desc.xml
    config = withDangerousMod(config, [
      'android',
      async (config) => {
        const projectRoot = config.modRequest.projectRoot;
        const xmlDir = path.join(
          projectRoot,
          'android',
          'app',
          'src',
          'main',
          'res',
          'xml'
        );
        const xmlFilePath = path.join(xmlDir, 'automotive_app_desc.xml');
  
        // Create xml directory if it doesn't exist
        if (!fs.existsSync(xmlDir)) {
          fs.mkdirSync(xmlDir, { recursive: true });
        }
  
        // Create automotive_app_desc.xml
        const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
  <automotiveApp>
      <uses name="template" />
  </automotiveApp>
  `;
  
        fs.writeFileSync(xmlFilePath, xmlContent, 'utf-8');
  
        return config;
      },
    ]);
  
    return config;
  };