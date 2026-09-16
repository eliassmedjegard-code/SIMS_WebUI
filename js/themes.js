// Named color themes for the appearance picker, in the style of Slack's
// sidebar theme switcher. Each theme's actual colors live in css/styles.css
// as a `:root[data-theme="<id>"]` block — this registry only drives the
// picker UI (label + preview swatches). "system" is special-cased: it clears
// the data-theme attribute so the OS-level prefers-color-scheme block in
// styles.css takes over instead of a fixed palette.
export const themes = [
  { id: 'light', label: 'Light', swatches: ['#f6f7f9', '#ffffff', '#2f5fd6'] },
  { id: 'dark', label: 'Dark', swatches: ['#16181d', '#1d2027', '#5b86e8'] },
  { id: 'midnight-purple', label: 'Midnight Purple', swatches: ['#181229', '#221a3a', '#a389f4'] },
  { id: 'ocean', label: 'Ocean', swatches: ['#0c2028', '#123243', '#3fc6d8'] },
  { id: 'forest', label: 'Forest', swatches: ['#11201a', '#17291f', '#4caf7d'] },
  { id: 'system', label: 'System', swatches: ['#f6f7f9', '#16181d', '#2f5fd6'] },
];
