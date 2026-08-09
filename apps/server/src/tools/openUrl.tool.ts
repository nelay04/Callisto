import { Type, type FunctionDeclaration } from '@google/genai';
import { getLinks, resolveLinkUrl } from '../config/links';

export { resolveLinkUrl };

/**
 * Gemini function declaration for the `open_url` tool.
 *
 * Built per session rather than exported as a const, because the destinations
 * come from `CALLISTO_LINKS` — the enum has to reflect whatever the operator
 * configured, and constraining it to the real ids is what stops the model
 * inventing a link that was never published.
 *
 * Returns `undefined` when nothing is configured: a function declaration whose
 * enum is empty gives the model a parameter it cannot legally fill.
 */
export function getOpenUrlDeclaration(): FunctionDeclaration | undefined {
  const links = getLinks();

  if (links.length === 0) return undefined;

  const ids = links.map((l) => l.id);
  const catalogue = links.map((l) => `"${l.id}" (${l.name}: ${l.description})`).join('; ');

  return {
    name: 'open_url',
    description:
      'Opens one of the configured links in a new browser tab on the ' +
      "user's device. Only call this tool when the user explicitly asks to " +
      'open, visit, or navigate to a link. ' +
      'If the user asks about links without specifying one, ask which ' +
      'they want before calling this tool. ' +
      `Available: ${catalogue}. ` +
      'Before calling this tool, call check_popup to ensure popups are allowed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: `Which link to open. Must be one of: ${ids.map((i) => `"${i}"`).join(', ')}.`,
          enum: ids,
        },
      },
      required: ['name'],
    },
  };
}
