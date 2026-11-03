import {describe, expect, test} from 'vitest';
// @ts-expect-error plain ESM script without type declarations (scripts/ is not part of the package)
import {classify, sentenceStart} from '../scripts/sentence_starts.mjs';

describe('sentence starts', () => {
  test('the start runs from the first word to the end of the second; the key ignores case and punctuation', () => {
    expect(sentenceStart('“Ons het nou 4-maand oue muise', 'af')).toEqual({start: 'Ons het', key: 'ons het', words: 2});
    expect(sentenceStart('Ja, das ist gut.', 'de')).toEqual({start: 'Ja, das', key: 'ja das', words: 2});
    expect(sentenceStart('Hallo!', 'de')).toEqual({start: 'Hallo', key: 'hallo', words: 1});
    expect(sentenceStart('?! …', 'de')).toBeUndefined();
  });
});

describe('root cause of a wrong answer', () => {
  const base = {truth: 'ms', prediction: 'id', sharedWith: [], wordsWith: [], benchmarked: new Set(['ms', 'id']),
    support: new Map([['ms', 1], ['id', 1]]), referenceCorrect: false};

  test('ambiguity first, then alphabet, compression, unseen languages and the model', () => {
    expect(classify({...base, prediction: 'ms'})).toBe('correct');
    expect(classify({...base, prediction: undefined})).toBe('abstain');
    // Shared words outrank a worse alphabet fit and a correct reference: a right answer there would be luck.
    const ambiguous = {...base, support: new Map([['ms', 1], ['id', 0.5]]), referenceCorrect: true};
    expect(classify({...ambiguous, sharedWith: ['id']})).toBe('shared');
    expect(classify({...ambiguous, wordsWith: ['id']})).toBe('words');
    expect(classify(ambiguous)).toBe('alphabet');
    expect(classify({...base, referenceCorrect: true})).toBe('compression');
    expect(classify({...base, prediction: 'fy', support: new Map([['ms', 1], ['fy', 1]])})).toBe('unseen');
    expect(classify(base)).toBe('model');
  });
});
