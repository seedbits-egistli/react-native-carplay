import { ImageSourcePropType } from 'react-native/Libraries/Image/Image';
import { CarPlay } from '../CarPlay';
import { Template, TemplateConfig } from './Template';

export interface PointOfInterestItem {
  id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  title: string;
  subtitle?: string;
  summary?: string;
  detailTitle?: string;
  detailSubtitle?: string;
  detailSummary?: string;
  primaryButton?: PointOfInterestButton;
  secondaryButton?: PointOfInterestButton;
  pinImage?: ImageSourcePropType;
}

export interface PointOfInterestButton {
  id: string;
  title: string;
  style?: 'normal' | 'confirm' | 'cancel';
}

export interface PointOfInterestTemplateConfig extends TemplateConfig {
  title: string;
  items: PointOfInterestItem[];
  onPointOfInterestSelect?(e: PointOfInterestItem): void;
  onChangeMapRegion(e: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }): void;
  /**
   * Fired when the back button is pressed
   */
  onBackButtonPressed?(): void;

  /**
   * Option to hide back button
   * @default false
   */
  backButtonHidden?: boolean;

  /**
   * Title to be shown on the back button, defaults to no text so only the < icon is shown
   */
  backButtonTitle?: string;

  /**
   * Fired when the primary button is pressed on any POI item
   */
  onPrimaryButtonPressed?(e: { id: string; templateId: string; poiId: string }): void;

  /**
   * Fired when the secondary button is pressed on any POI item
   */
  onSecondaryButtonPressed?(e: { id: string; templateId: string; poiId: string }): void;
}

export class PointOfInterestTemplate extends Template<PointOfInterestTemplateConfig> {
  public get type(): string {
    return 'poi';
  }

  get eventMap() {
    return {
      didSelectPointOfInterest: 'onPointOfInterestSelect',
      didChangeMapRegion: 'onChangeMapRegion',
      backButtonPressed: 'onBackButtonPressed',
      primaryButtonPressed: 'onPrimaryButtonPressed',
      secondaryButtonPressed: 'onSecondaryButtonPressed',
    };
  }

  public updatePointsOfInterest = (items: PointOfInterestItem[]) => {
    this.config = { ...this.config, items };
    return CarPlay.bridge.updatePointOfInterestTemplate(this.id, super.parseConfig({ items }));
  };
}
