import { Type, type FunctionDeclaration } from '@google/genai';

/**
 * Gemini function declaration for the `check_popup` tool.
 *
 * Asks the frontend whether the browser currently allows popups / new tabs.
 * The model should call this BEFORE open_url to avoid silently blocked windows.
 * If popups are blocked, the model must guide the user to enable them.
 */
export const checkPopupDeclaration: FunctionDeclaration = {
  name: 'check_popup',
  description:
    "Checks whether the user's browser currently allows new-tab popups. " +
    'Call this tool BEFORE calling open_url so you know whether the window will open. ' +
    'If the result shows popups are blocked, do NOT call open_url. Instead, firmly tell ' +
    'the user that popups are blocked and guide them step-by-step to enable them: ' +
    'Chrome: Settings → Privacy and Security → Site Settings → Pop-ups and redirects → Allow; ' +
    'Firefox: Preferences → Privacy & Security → uncheck "Block pop-up windows" or add an exception; ' +
    'Safari: Preferences → Websites → Pop-up Windows → set to Allow. ' +
    'After guiding them, suggest they try again.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};
