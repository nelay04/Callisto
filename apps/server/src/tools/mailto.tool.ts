import { Type, type FunctionDeclaration } from '@google/genai';

/**
 * Build a `mailto:` URL addressed to the owner.
 *
 * The recipient is never model-supplied — it always comes from
 * `MAILTO_ADDRESS` — so the model can draft a message *to the owner* and
 * nothing else. `address` is a parameter only so this stays testable without
 * reaching into the environment.
 */
export function buildMailtoUrl(
  subject?: string,
  body?: string,
  address: string = process.env.MAILTO_ADDRESS ?? '',
): string {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body)    params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${address}${params.length ? `?${params.join('&')}` : ''}`;
}

/**
 * Gemini function declaration for the `send_mailto` tool.
 *
 * Opens the user's default mail client to compose an email to the owner.
 * Only call when the user explicitly asks to send, write, or compose an email.
 */
export const sendMailtoDeclaration: FunctionDeclaration = {
  name: 'send_mailto',
  description:
    "Opens the user's default mail client pre-filled to compose an email to the owner. " +
    'Call this ONLY when the user explicitly asks to send, write, or compose an email. ' +
    'You may suggest a subject and body based on the conversation context and ask if the user wants to send it.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      subject: {
        type: Type.STRING,
        description: 'Email subject line (optional).',
      },
      body: {
        type: Type.STRING,
        description: 'Email body text (optional). Keep it concise.',
      },
    },
  },
};
