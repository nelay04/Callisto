import { Type, type FunctionDeclaration } from '@google/genai';

/** Profile names the `open_url` tool understands. */
export const SUPPORTED_CONTACTS = ['linkedin', 'github'] as const;

/**
 * Resolve a contact name to its configured URL, or `undefined` when the profile
 * is unknown or simply not configured.
 *
 * The environment is read on every call rather than at import time, so the
 * result can't depend on whether `dotenv` happened to run before this module
 * was first loaded.
 */
export function resolveContactUrl(contact: string | undefined): string | undefined {
  switch (contact?.toLowerCase()) {
    case 'linkedin':
      return process.env.LINKEDIN_URL || undefined;
    case 'github':
      return process.env.GITHUB_URL || undefined;
    default:
      return undefined;
  }
}

/**
 * Gemini function declaration for the `open_url` tool.
 *
 * The model will invoke this ONLY when the user explicitly asks to open or
 * visit a profile link. It must NOT call this proactively.
 */
export const openUrlDeclaration: FunctionDeclaration = {
  name: 'open_url',
  description:
    'Opens a professional profile link in a new browser tab on the ' +
    "user's device. Only call this tool when the user explicitly asks to " +
    'open, visit, or navigate to a profile link. ' +
    'If the user asks about profiles without specifying one, ask which ' +
    'they want before calling this tool. ' +
    'Supported profiles: linkedin, github. ' +
    'Before calling this tool, call check_popup to ensure popups are allowed.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      contact: {
        type: Type.STRING,
        description: 'The profile to open. Must be one of: "linkedin", "github".',
        enum: [...SUPPORTED_CONTACTS],
      },
    },
    required: ['contact'],
  },
};
