import { AndroidRenderTemplates } from '../../interfaces/AndroidRenderTemplates';
import { AndroidAction } from '../../interfaces/Action';
import {
  AndroidNavigationBaseTemplate,
  AndroidNavigationBaseTemplateConfig,
} from './AndroidNavigationBaseTemplate';
import { GridTemplateConfig } from '../GridTemplate';
import { AndroidGridButton } from 'src/interfaces/GridButton';

export type MapWithGridTemplateConfig = AndroidNavigationBaseTemplateConfig &
  Omit<GridTemplateConfig, 'actions' | 'onButtonPressed' | 'buttons'> & {
    /**
     * Sets an ActionStrip with a list of map-control related actions for this template, such as pan or zoom.
     * The host will draw the buttons in an area that is associated with map controls.
     * If the app does not include the PAN button in this ActionStrip, the app will not receive the user input for panning gestures from SurfaceCallback methods, and the host will exit any previously activated pan mode.
     * Requirements This template allows up to 4 Actions in its map ActionStrip. Only Actions with icons set via setIcon are allowed.
     */
    mapButtons?: Array<AndroidAction>;

    /**
     * Sets the ActionStrip for this template or null to not display any.
     * This template allows up to 2 Actions. Of the 2 allowed Actions, one of them can contain a title as set via setTitle. Otherwise, only Actions with icons are allowed.
     */
    actions?: [AndroidAction] | [AndroidAction, AndroidAction];

    buttons: Array<AndroidGridButton>;
    /**
     * Message to display when there are no items in the grid.
     * This message will be displayed in the list when there are no items.
     * If not set, the default message "No items available" will be used.
     */
    noItemsMessage?: string;
  };

/**
 * A template for showing a list on top of a map
 * recommended to use in conjunction with a NavigationTemplate
 */
export class MapWithGridTemplate extends AndroidNavigationBaseTemplate<MapWithGridTemplateConfig> {
  public get type(): string {
    return AndroidRenderTemplates.MapWithGrid;
  }
}
