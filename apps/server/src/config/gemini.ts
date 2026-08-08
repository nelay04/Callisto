import { Modality, type LiveConnectConfig } from '@google/genai';
import { CALLISTO_SYSTEM_PROMPT } from '../prompts/callisto.prompt';
import { openUrlDeclaration } from '../tools/openUrl.tool';
import { sendMailtoDeclaration } from '../tools/mailto.tool';
import { checkPopupDeclaration } from '../tools/checkPopup.tool';

/** Gemini model that supports native audio I/O via the Live API */
export const GEMINI_MODEL: string = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-native-audio-preview-12-2025';

/** Config object passed to ai.live.connect() */
export const GEMINI_LIVE_CONFIG: LiveConnectConfig = {
  responseModalities: [Modality.AUDIO],
  systemInstruction: CALLISTO_SYSTEM_PROMPT,
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  tools: [{ functionDeclarations: [openUrlDeclaration, sendMailtoDeclaration, checkPopupDeclaration] }],
  // Reduce VAD silence window so the model responds faster after the user stops speaking.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  realtimeInputConfig: {
    automaticActivityDetection: {
      disabled: false,
      startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH' as any,
      endOfSpeechSensitivity:   'END_SENSITIVITY_HIGH'   as any,
      prefixPaddingMs:  20,
      silenceDurationMs: 600,
    },
  } as any,
};
