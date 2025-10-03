import { ConfigPlugin } from 'expo/config-plugins';
import { withAndroidCarPlay } from './withAndroid';
import { withIosCarPlay } from './withIos';

export interface ReactNativeCarPlayPluginProps {
  android?: boolean;
  ios?: boolean;
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
    config = withIosCarPlay(config);
  }

  return config;
};

export default withReactNativeCarPlay;