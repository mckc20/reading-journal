import type { Preview } from '@storybook/react-vite';
import '../src/index.css';
import '../src/components/redesign/redesign.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    options: { storySort: { order: ['Redesign', ['PDF Reference', 'Home', 'Foundations', 'Components']] } },
    a11y: { test: 'todo' },
  },
  decorators: [(Story) => <div className="rj-redesign"><Story /></div>],
};

export default preview;
