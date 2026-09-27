export type ChatMode = 'dark' | 'light';

export type ChatTheme = {
  pageBackground: string;
  panelBackground: string;
  panelBorder: string;
  panelShadow: string;
  assistantBubbleBackground: string;
  assistantBubbleText: string;
  userBubbleBackground: string;
  userBubbleText: string;
  inputBackground: string;
  inputBackgroundFocused: string;
  inputBorder: string;
  inputBorderFocused: string;
  inputText: string;
  inputPlaceholder: string;
  buttonBackground: string;
  buttonGradient: string;
  buttonText: string;
  linkText: string;
};

export const chatThemes: Record<ChatMode, ChatTheme> = {
  dark: {
    pageBackground: '#111318',
    panelBackground: 'rgba(255, 255, 255, 0.2)',
    panelBorder: 'rgba(255, 255, 255, 0.22)',
    panelShadow: '0 20px 60px rgba(0, 0, 0, 0.28), 0 1px 0 rgba(255, 255, 255, 0.08) inset',
    assistantBubbleBackground: 'rgba(19, 19, 19, 0.8)',
    assistantBubbleText: '#ffffff',
    userBubbleBackground: '#a6efbb',
    userBubbleText: '#131313',
    inputBackground: 'rgba(255, 255, 255, 0.8)',
    inputBackgroundFocused: '#ffffff',
    inputBorder: '#d1d5db',
    inputBorderFocused: '#3b82f6',
    inputText: '#131313',
    inputPlaceholder: '#6b7280',
    buttonBackground: '#219a44',
    buttonGradient: 'linear-gradient(145deg, #238242 0%, #126531 100%)',
    buttonText: '#ffffff',
    linkText: '#a6efbb',
  },
  light: {
    pageBackground: '#ffffff',
    panelBackground: 'rgba(248, 250, 252, 0.92)',
    panelBorder: 'rgba(15, 23, 42, 0.10)',
    panelShadow: '0 20px 60px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
    assistantBubbleBackground: '#e9eef3',
    assistantBubbleText: '#1f2937',
    userBubbleBackground: '#c8f5d5',
    userBubbleText: '#15351f',
    inputBackground: '#ffffff',
    inputBackgroundFocused: '#ffffff',
    inputBorder: '#cbd5e1',
    inputBorderFocused: '#219a44',
    inputText: '#111827',
    inputPlaceholder: '#64748b',
    buttonBackground: '#187a36',
    buttonGradient: 'linear-gradient(145deg, #237b40 0%, #105c2a 100%)',
    buttonText: '#ffffff',
    linkText: '#166534',
  },
};

export function getChatMode(value?: string): ChatMode {
  return value === 'light' ? 'light' : 'dark';
}
