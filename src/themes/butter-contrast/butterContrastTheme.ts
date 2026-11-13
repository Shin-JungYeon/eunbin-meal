import {defineTheme} from '@astryxdesign/core/theme';
import {butterTheme} from '@astryxdesign/theme-butter';

/**
 * Butter, with the light-mode page background pulled one step darker
 * so cards (`--color-background-card`) read as a distinct surface
 * instead of blending into the page, matching dark mode's contrast.
 */
export const butterContrastTheme = defineTheme({
  name: 'butter-contrast',
  extends: butterTheme,
  tokens: {
    '--color-background-body': ['#f3f2e2', '#261a13'],
  },
});
