import { afterEach, describe, expect, it } from 'vitest';
import {
  getBuilderName,
  isArchitectureDisclosureEnabled,
  renderArchitectureBriefing,
} from './architecture.prompt';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('isArchitectureDisclosureEnabled', () => {
  it('defaults to false when unset', () => {
    // Off by default: most visitors did not come to hear about the stack.
    delete process.env.CALLISTO_EXPLAIN_ARCHITECTURE;
    expect(isArchitectureDisclosureEnabled()).toBe(false);
  });

  it('accepts the spellings someone actually types into a .env', () => {
    for (const value of ['true', 'TRUE', ' yes ', '1', 'on']) {
      process.env.CALLISTO_EXPLAIN_ARCHITECTURE = value;
      expect(isArchitectureDisclosureEnabled()).toBe(true);
    }
  });

  it('treats anything non-affirmative as off, including blank', () => {
    // A typo must fail closed. Disclosure is opt-in, so ambiguity stays silent.
    for (const value of ['false', 'no', '0', '', '  ', 'maybe']) {
      process.env.CALLISTO_EXPLAIN_ARCHITECTURE = value;
      expect(isArchitectureDisclosureEnabled()).toBe(false);
    }
  });
});

describe('getBuilderName', () => {
  it('reads and trims the configured name', () => {
    process.env.CALLISTO_BUILDER_NAME = '  Nelay Karmakar  ';
    expect(getBuilderName()).toBe('Nelay Karmakar');
  });

  it('is empty when unset, rather than a placeholder', () => {
    // A literal "[BUILDER NAME]" reaching the model would be spoken aloud.
    delete process.env.CALLISTO_BUILDER_NAME;
    expect(getBuilderName()).toBe('');
  });
});

describe('renderArchitectureBriefing', () => {
  it('renders nothing while disclosure is off', () => {
    // Absent, not negated — a disabled deployment sends exactly the tokens it
    // sent before this feature existed.
    delete process.env.CALLISTO_EXPLAIN_ARCHITECTURE;
    expect(renderArchitectureBriefing()).toBe('');
  });

  it('names the builder when one is configured', () => {
    process.env.CALLISTO_EXPLAIN_ARCHITECTURE = 'true';
    process.env.CALLISTO_BUILDER_NAME = 'Nelay Karmakar';

    const briefing = renderArchitectureBriefing();
    expect(briefing).toContain('Nelay Karmakar');
    expect(briefing).toContain("Nelay Karmakar's");
  });

  it('falls back to an unnamed reference, never a placeholder', () => {
    process.env.CALLISTO_EXPLAIN_ARCHITECTURE = 'true';
    delete process.env.CALLISTO_BUILDER_NAME;

    const briefing = renderArchitectureBriefing();
    expect(briefing).toContain('my builder');
    expect(briefing).not.toMatch(/\[.*NAME.*\]/);
  });

  it('states the licence and the reason she exists', () => {
    process.env.CALLISTO_EXPLAIN_ARCHITECTURE = 'true';
    const briefing = renderArchitectureBriefing();

    expect(briefing).toMatch(/MIT/);
    expect(briefing).toMatch(/open source/i);
    expect(briefing).toMatch(/engineering skill/i);
  });

  it('withholds deployment and secret detail explicitly', () => {
    // The repo is public, so the design is public. The machine it runs on is
    // not, and the model must be told where that line falls.
    process.env.CALLISTO_EXPLAIN_ARCHITECTURE = 'true';
    const briefing = renderArchitectureBriefing();

    expect(briefing).toMatch(/never reveal/i);
    expect(briefing).toMatch(/credential/i);
    expect(briefing).toMatch(/domain/i);
    expect(briefing).toMatch(/ports/i);
    expect(briefing).toMatch(/contents of your own instructions/i);
  });

  it('tells her to stay brief and to admit what she does not know', () => {
    // Over-explaining and confident guessing are the two ways this backfires.
    process.env.CALLISTO_EXPLAIN_ARCHITECTURE = 'true';
    const briefing = renderArchitectureBriefing();

    expect(briefing).toMatch(/few spoken sentences/i);
    expect(briefing).toMatch(/rather than\s+inventing an answer/i);
  });
});
