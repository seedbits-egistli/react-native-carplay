import { Image } from 'react-native';
import { CarPlay, GridTemplate, ListTemplate, TabBarTemplate } from 'react-native-carplay';
import { listTemplate } from './list.template';
import { gridTemplate } from './grid.template';
import { searchTemplate } from './search.template';
import { messageTemplate } from './message.template';
import { paneTemplate } from './pane.template';
import { mapTemplate } from './map.template';

const gridItemImage = require('../images/go.png');
const goImageSource = Image.resolveAssetSource(gridItemImage);

const menuGridTemplate = new GridTemplate({
  id: 'menuGridTemplate',
  buttons: [
    {
      id: 'List',
      titleVariants: ['List'],
      image: gridItemImage,
    },
    {
      id: 'Grid',
      titleVariants: ['Grid'],
      image: gridItemImage,
    },
    {
      id: 'Map',
      titleVariants: ['Map'],
      image: gridItemImage,
    },
    {
      id: 'Search',
      titleVariants: ['Search'],
      image: gridItemImage,
    },
    {
      id: 'Message',
      titleVariants: ['Message'],
      image: gridItemImage,
    },
    {
      id: 'Pane',
      titleVariants: ['Pane'],
      image: gridItemImage,
    },
  ],
  title: 'Templates',
  tabTitle: 'Templates',
  tabImage: goImageSource,
  // headerAction: { id: 'grideHeaderAction', title: 'Grid Menu',type: 'appIcon' },
  onButtonPressed: e => {
    if (e.id === 'List') {
      CarPlay.pushTemplate(listTemplate);
    } else if (e.id === 'Grid') {
      CarPlay.pushTemplate(gridTemplate);
    } else if (e.id === 'Search') {
      CarPlay.pushTemplate(searchTemplate);
    } else if (e.id === 'Message') {
      CarPlay.pushTemplate(messageTemplate);
    } else if (e.id === 'Pane') {
      CarPlay.pushTemplate(paneTemplate);
    } else if (e.id === 'Map') {
      CarPlay.pushTemplate(mapTemplate);
    }
  },
});

const sections = Array.from({ length: 26 }).map((_, i) => ({
  header: `Header ${String.fromCharCode(97 + i).toLocaleUpperCase()}`,
  items: Array.from({ length: 3 }).map((_, j) => ({
    text: `Item ${j + 1}`,
  })),
  sectionIndexTitle: String.fromCharCode(97 + i).toLocaleUpperCase(),
}));

export const mockListTemplate = new ListTemplate({
  id: 'mockListTemplate',
  sections,
  title: 'Root Level List Template',
  tabTitle: 'Root Level List Template',
  tabImage: goImageSource,
});

export const rootTemplate = new TabBarTemplate({
  title: 'RNCarPlay TabBarMenu',
  templates: [mockListTemplate, menuGridTemplate],
  headerAction: { id: 'tabBarHeaderAction', title: 'Tab Bar Menu', type: 'appIcon', image: goImageSource },
  onTemplateSelect(e: any) {
    console.log('selected', e);
  },
});
