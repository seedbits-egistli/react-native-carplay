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
   * Primary button displayed on the template
   */
  primaryButton?: PointOfInterestButton;

  /**
   * Secondary button displayed on the template
   */
  secondaryButton?: PointOfInterestButton;

  /**
   * Fired when the primary button is pressed
   */
  onPrimaryButtonPressed?(e: { id: string; templateId: string }): void;

  /**
   * Fired when the secondary button is pressed
   */
  onSecondaryButtonPressed?(e: { id: string; templateId: string }): void;
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
}
