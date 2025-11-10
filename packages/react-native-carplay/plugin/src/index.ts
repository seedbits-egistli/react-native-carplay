import { ConfigPlugin } from 'expo/config-plugins';
import { withAndroidCarPlay } from './withAndroid';
import { withIosCarPlay, IosCarPlayProps } from './withIos';

export interface ReactNativeCarPlayPluginProps {
  android?: boolean;
  ios?: boolean;
  iosEntitlements?: string[];
  iosPhoneModuleName?: string;
  iosSupportsMultipleScenes?: boolean;
}

const withReactNativeCarPlay: ConfigPlugin<ReactNativeCarPlayPluginProps> = (
  config,
  props = {}
) => {
  const { android = true, ios = false } = props;

  if (android) {
    config = withAndroidCarPlay(config);
  }

  if (ios) {
    const iosProps: IosCarPlayProps = {
      entitlements: props.iosEntitlements ?? [],
      phoneModuleName: props.iosPhoneModuleName ?? 'main',
      supportsMultipleScenes:
        props.iosSupportsMultipleScenes === undefined
          ? true
          : props.iosSupportsMultipleScenes,
    };
    if (!iosProps.entitlements || iosProps.entitlements.length === 0) {
      throw new Error(
        'react-native-carplay: iOS entitlements are required. Please provide iosEntitlements: string[] in the plugin options.'
      );
    }
    config = withIosCarPlay(config, iosProps);
  }

  return config;
};

export default withReactNativeCarPlay;