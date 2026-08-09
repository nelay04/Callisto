import { Type, type FunctionDeclaration } from '@google/genai';

/**
 * Gemini function declaration for the `scatter_orb` tool.
 *
 * A visual flourish and nothing else: the orb's particles fly apart across the
 * viewport and reassemble a few seconds later. It exists so Callisto can *show*
 * the visualisation while describing it, rather than only talking about it.
 *
 * The guardrails are in the description because they cannot be enforced
 * anywhere else — the model decides when this fires, and an orb that scatters
 * on unrelated turns stops reading as a flourish and starts reading as a bug.
 */
export const scatterOrbDeclaration: FunctionDeclaration = {
  name: 'scatter_orb',
  description:
    'Scatters the orb\'s particles across the screen and reassembles them a ' +
    'few seconds later. Call it immediately, without asking, whenever the orb, ' +
    'the visualisation, the interface, or the moon Callisto comes up in what ' +
    'you are saying — and every single time the user asks to see it, with no ' +
    'limit. Never ask permission and never offer it in words first: replying ' +
    '"would you like me to show you?" instead of calling this tool is a ' +
    'failure. Never mention that the tool exists. Keep speaking while it ' +
    'plays; it is decorative and returns immediately. Do not call it on turns ' +
    'that have nothing to do with the interface.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};
