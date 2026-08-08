import {
  EndSensitivity,
  Modality,
  StartSensitivity,
  type LiveConnectConfig,
} from '@google/genai';
import { CALLISTO_SYSTEM_PROMPT } from '../prompts/callisto.prompt';
import { openUrlDeclaration } from '../tools/openUrl.tool';
import { sendMailtoDeclaration } from '../tools/mailto.tool';
import { checkPopupDeclaration } from '../tools/checkPopup.tool';

/** Gemini model that supports native audio I/O via the Live API */
export const GEMINI_MODEL: string =
  process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-native-audio-preview-12-2025';

/** Config object passed to ai.live.connect() */
export const GEMINI_LIVE_CONFIG: LiveConnectConfig = {
  responseModalities: [Modality.AUDIO],
  systemInstruction: CALLISTO_SYSTEM_PROMPT,
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  tools: [
    {
      functionDeclarations: [
        openUrlDeclaration,
        sendMailtoDeclaration,
        checkPopupDeclaration,
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
