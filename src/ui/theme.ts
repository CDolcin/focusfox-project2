/** Palette copied from Project I (ui/theme/Theme.kt). Project I is light-only; the dark variant is used for Settings > Appearance > Dark. */
export const colors = {
  purple: '#6C5CE7', purpleDark: '#5643D6', purpleLight: '#E3DEFB',
  background: '#F4F2FC', surface: '#FFFFFF', text: '#1B1B2E', textSecondary: '#6B7280', border: '#E7E4F5',
  high: '#E0607A', medium: '#E8A33D', low: '#4CAF7D',
  onlineBg: '#DDF3E4', onlineText: '#2F9E5C', streak: '#FF8A3D', blue: '#5B8DEF', green: '#4CAF7D',
  danger: '#E0607A', cameraBg: '#14101F', cameraPanel: '#241B3A',
};
export const darkColors: Palette = { ...colors, background: '#14131F', surface: '#1F1D2E', text: '#F2F0FF', textSecondary: '#A4A1BA', border: '#34314A', purpleLight: '#34305E', onlineBg: '#1E3B2A' };
export type Palette = typeof colors;
export const priorityColor = { HIGH: colors.high, MEDIUM: colors.medium, LOW: colors.low } as const;
/** Note accent stripe colours (Project I NotesScreen). */
export const noteAccentColors = ['#6C5CE7', '#5B8DEF', '#4CAF7D', '#E8A33D'];
/** Focus screen backgrounds (Project I FocusScreen). Index 5 is the dark focus mode. */
export const FOCUS_BACKGROUNDS = ['#F4F2FC', '#FFF4E6', '#E8F5E9', '#E3F2FD', '#FCE4EC', '#1B1B2E'];
export const flowerEmoji = { daisy: '🌼', tulip: '🌷', sunflower: '🌻', poppy: '🌺', rose: '🌹', lotus: '🪷' } as const;
