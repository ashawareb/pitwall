import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Sentence } from '../src/api/types.js';
import SentenceHighlight from '../src/components/SentenceHighlight.js';

afterEach(() => {
  cleanup();
});

function makeSentence(text: string, startChar: number, endChar: number): Sentence {
  return { index: 0, text: text.slice(startChar, endChar), startChar, endChar };
}

describe('SentenceHighlight', () => {
  it('highlights a sentence at the start of the text', () => {
    const text = 'Hello world. Goodbye world.';
    const sentence = makeSentence(text, 0, 12); // "Hello world."
    const { getByTestId, container } = render(
      <SentenceHighlight text={text} sentence={sentence} />,
    );

    const hl = getByTestId('sentence-highlight');
    expect(hl.textContent).toBe('Hello world.');
    // The three slice-spans render in order; the highlight is the middle one.
    const spans = container.querySelectorAll('span');
    expect(spans[0]?.textContent).toBe('');
    expect(spans[1]?.textContent).toBe('Hello world.');
    expect(spans[2]?.textContent).toBe(' Goodbye world.');
  });

  it('highlights a sentence in the middle of the text', () => {
    const text = 'A. B. C.';
    const sentence = makeSentence(text, 3, 5); // "B."
    const { getByTestId, container } = render(
      <SentenceHighlight text={text} sentence={sentence} />,
    );

    expect(getByTestId('sentence-highlight').textContent).toBe('B.');
    const spans = container.querySelectorAll('span');
    expect(spans[0]?.textContent).toBe('A. ');
    expect(spans[1]?.textContent).toBe('B.');
    expect(spans[2]?.textContent).toBe(' C.');
  });

  it('highlights a sentence at the end of the text', () => {
    const text = 'Start. End.';
    const sentence = makeSentence(text, 7, text.length); // "End."
    const { getByTestId, container } = render(
      <SentenceHighlight text={text} sentence={sentence} />,
    );

    expect(getByTestId('sentence-highlight').textContent).toBe('End.');
    const spans = container.querySelectorAll('span');
    expect(spans[0]?.textContent).toBe('Start. ');
    expect(spans[1]?.textContent).toBe('End.');
    expect(spans[2]?.textContent).toBe('');
  });

  it('renders the full text plus a fallback note when sentence is null', () => {
    const text = 'No mapping made it through.';
    const { queryByTestId, getByText } = render(
      <SentenceHighlight text={text} sentence={null} />,
    );

    expect(queryByTestId('sentence-highlight')).toBeNull();
    expect(getByText(text)).toBeTruthy();
    expect(getByText('(no sentence match — review full prompt)')).toBeTruthy();
  });

  it('preserves newlines via whitespace: pre-wrap on the wrapper', () => {
    const text = 'Line one.\nLine two.';
    const sentence = makeSentence(text, 0, 9); // "Line one."
    const { container } = render(
      <SentenceHighlight text={text} sentence={sentence} />,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('whitespace-pre-wrap');
    expect(wrapper?.textContent).toContain('\n');
  });
});
