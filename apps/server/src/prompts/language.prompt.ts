/**
 * Which language Callisto speaks, and when she is allowed to change it.
 *
 * Always appended to the system instruction — unlike the architecture briefing,
 * this is not opt-in. Without it the model drifts: it will answer a Bengali
 * question in Bengali, an English one in English, and mix the two inside a
 * single turn, which reads as a fault rather than as multilingualism.
 */

/**
 * The language a session opens in, as a human name the model can act on
 * ("English", "Bengali", "Hindi").
 *
 * Read from `CALLISTO_LANGUAGE` on every call, so the operator's choice is not
 * baked in at import time. English is the fallback only when nothing is set.
 */
export function getDefaultLanguage(): string {
  return process.env.CALLISTO_LANGUAGE?.trim() || 'English';
}

/**
 * The language policy, as sent to the model.
 *
 * Two rules, and the second is the one that matters: a visitor who asks for
 * another language is telling you they are not comfortable in this one, so the
 * switch has to be total and permanent rather than a single translated
 * sentence before drifting back.
 */
export function renderLanguagePolicy(): string {
  const language = getDefaultLanguage();

  return [
    '',
    '══════════════════════════════════════════',
    '  LANGUAGE',
    '══════════════════════════════════════════',
    '',
    `Speak ${language}, and keep speaking it. Do not change language because a`,
    'visitor used another one in passing, because of an accent, or because a',
    'name in their sentence came from elsewhere.',
    '',
    'If a visitor asks you to speak a different language — in any wording, and',
    'whether they ask in that language or in this one — switch to it at once',
    'and stay there. Treat the request as a sign that they are not comfortable',
    `in ${language}: from then on every word is in the new language, including`,
    'greetings and anything you explain about yourself. Do not say things',
    'twice, do not ask them to confirm, and do not drift back. Only another',
    'request changes it again.',
    '',
    'Use one language per reply. A proper noun with no natural translation may',
    'stay as it is.',
  ].join('\n');
}
