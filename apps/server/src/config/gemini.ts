import {
  EndSensitivity,
  Modality,
  StartSensitivity,
  type LiveConnectConfig,
} from '@google/genai';
import { getSystemPrompt } from '../prompts/callisto.prompt';
import { renderArchitectureBriefing } from '../prompts/architecture.prompt';
import { renderLanguagePolicy } from '../prompts/language.prompt';
import { renderLinksForPrompt } from './links';
import { getOpenUrlDeclaration } from '../tools/openUrl.tool';
import { sendMailtoDeclaration } from '../tools/mailto.tool';
import { checkPopupDeclaration } from '../tools/checkPopup.tool';
import { scatterOrbDeclaration } from '../tools/scatterOrb.tool';

/** Gemini model that supports native audio I/O via the Live API */
export const GEMINI_MODEL: string =
  process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-native-audio-preview-12-2025';

/**
 * Prebuilt Gemini voice. `Leda` is the youthful one, which is the register
 * Callisto is written for; `Aoede` is breezier, `Zephyr` brighter, `Kore`
 * firmer. Changing it needs a new session, not a rebuild.
 */
export const GEMINI_VOICE: string = process.env.GEMINI_VOICE ?? 'Leda';


/**
 * Config object passed to ai.live.connect().
 *
 * A function rather than a const because the system prompt now comes from the
 * environment: building it per session keeps a missing prompt from throwing at
 * import time, where it would break unrelated routes that only want
 * GEMINI_MODEL.
 */
export function getGeminiLiveConfig(): LiveConnectConfig {
  // open_url is omitted entirely when CALLISTO_LINKS is empty — offering a tool
  // with nothing to open invites the model to promise a link it cannot produce.
  const openUrl = getOpenUrlDeclaration();

  return {
    responseModalities: [Modality.AUDIO],
    // The link catalogue and the self-description briefing are appended rather
    // than folded into the persona, so CALLISTO_SYSTEM_PROMPT stays purely the
    // operator's own text. Both render to '' when unconfigured.
    systemInstruction:
      getSystemPrompt() +
      renderLanguagePolicy() +
      renderLinksForPrompt() +
      renderArchitectureBriefing(),

    // The voice is fixed rather than left to the model's default, so every
    // visitor hears the same Callisto.
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } },
    },

    // Both left empty deliberately. AudioTranscriptionConfig.languageCodes
    // exists in the SDK types but is a Vertex AI field: the Gemini Developer
    // API rejects it outright with "languageCodes parameter is not supported",
    // and the rejection fails the whole connect rather than being ignored.
    //
    // So transcription language is auto-detected per utterance, and the
    // transcript can flicker when a visitor's speech is ambiguous. The
    // language *spoken* is governed by the policy in the system instruction,
    // which is unaffected.
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    tools: [
      {
        functionDeclarations: [
          ...(openUrl ? [openUrl] : []),
          sendMailtoDeclaration,
          checkPopupDeclaration,
          scatterOrbDeclaration,
        ],
      },
    ],
    realtimeInputConfig: {
      // Tighten voice-activity detection: high sensitivity on both ends plus a
      // short silence window makes Callisto answer noticeably sooner after the
      // user stops speaking, at the cost of occasionally cutting in early.
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
        prefixPaddingMs: 20,
        silenceDurationMs: 600,
      },
    },
  };
}
