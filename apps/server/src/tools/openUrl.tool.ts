import { Type, type FunctionDeclaration } from '@google/genai';

/** Mapping of known contact names → their URLs */
export const CONTACT_URLS: Record<string, string> = {
  linkedin: process.env.LINKEDIN_URL ?? 'https://www.linkedin.com/in/your-profile',
  github:   process.env.GITHUB_URL   ?? 'https://github.com/your-username',
};

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
        enum: ['linkedin', 'github'],
      },
    },
    required: ['contact'],
  },
};
