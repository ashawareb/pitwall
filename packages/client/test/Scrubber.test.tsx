import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Scrubber from '../src/components/Scrubber.js';

afterEach(() => {
  cleanup();
});

// The track is 120×4 in production; JSDOM returns zero-sized rects by default
// so we stub getBoundingClientRect on the track element to match. clientX
// values are then interpreted relative to a track at x=[0, 120].
const TRACK_RECT = {
  left: 0,
  top: 0,
  right: 120,
  bottom: 4,
  width: 120,
  height: 4,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as const;

function stubTrackRect(track: HTMLElement): void {
  track.getBoundingClientRect = () => TRACK_RECT as DOMRect;
}

describe('Scrubber', () => {
  it('live state: fill and thumb at 100%, LIVE button pressed', () => {
    const { getByTestId } = render(
      <Scrubber
        tMs={null}
        durationMs={10_000}
        editTMsList={[]}
        onSeek={() => {}}
        onLive={() => {}}
      />,
    );
    const track = getByTestId('scrubber-track');
    const fill = getByTestId('scrubber-fill') as HTMLElement;
    const thumb = getByTestId('scrubber-thumb') as HTMLElement;
    const live = getByTestId('scrubber-live') as HTMLButtonElement;

    expect(track.getAttribute('data-live')).toBe('true');
    expect(track.getAttribute('aria-valuenow')).toBe('10000');
    expect(fill.style.width).toBe('100%');
    // Thumb is centered on the fill's right edge; at 100% that's `calc(100% - 1px)`.
    expect(thumb.style.left).toBe('calc(100% - 1px)');
    expect(live.getAttribute('aria-pressed')).toBe('true');
    expect(live.className).toContain('bg-pw-accent-soft');
  });

  it('non-live state: fill at 50%, LIVE button not pressed', () => {
    const { getByTestId } = render(
      <Scrubber
        tMs={5_000}
        durationMs={10_000}
        editTMsList={[]}
        onSeek={() => {}}
        onLive={() => {}}
      />,
    );
    const track = getByTestId('scrubber-track');
    const fill = getByTestId('scrubber-fill') as HTMLElement;
    const live = getByTestId('scrubber-live') as HTMLButtonElement;

    expect(track.getAttribute('data-live')).toBe('false');
    expect(track.getAttribute('aria-valuenow')).toBe('5000');
    expect(fill.style.width).toBe('50%');
    expect(live.getAttribute('aria-pressed')).toBe('false');
    expect(live.className).not.toContain('bg-pw-accent-soft');
  });

  it('click on track without movement emits onSeek with mode="click"', () => {
    const onSeek = vi.fn();
    const { getByTestId } = render(
      <Scrubber
        tMs={0}
        durationMs={10_000}
        editTMsList={[]}
        onSeek={onSeek}
        onLive={() => {}}
      />,
    );
    const track = getByTestId('scrubber-track');
    stubTrackRect(track);

    // mousedown at clientX=60 → 50% of 120 track → 5000ms. No move → click emit on up.
    fireEvent.mouseDown(track, { button: 0, clientX: 60 });
    fireEvent.mouseUp(window);

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(5_000, 'click');
  });

  it('drag emits onSeek with mode="drag" on every mousemove; no extra emit on up', () => {
    const onSeek = vi.fn();
    const { getByTestId } = render(
      <Scrubber
        tMs={0}
        durationMs={10_000}
        editTMsList={[]}
        onSeek={onSeek}
        onLive={() => {}}
      />,
    );
    const track = getByTestId('scrubber-track');
    stubTrackRect(track);

    fireEvent.mouseDown(track, { button: 0, clientX: 30 });
    fireEvent.mouseMove(window, { clientX: 60 });
    fireEvent.mouseMove(window, { clientX: 90 });
    fireEvent.mouseUp(window);

    expect(onSeek).toHaveBeenCalledTimes(2);
    expect(onSeek).toHaveBeenNthCalledWith(1, 5_000, 'drag');
    expect(onSeek).toHaveBeenNthCalledWith(2, 7_500, 'drag');
  });

  it('keyboard: ←/→ step between edit boundaries; Home → 0; End → onLive; inputs are ignored', () => {
    const onSeek = vi.fn();
    const onLive = vi.fn();
    const editTMsList = [1_000, 3_000, 7_000];
    const { container } = render(
      <>
        <Scrubber
          tMs={5_000}
          durationMs={10_000}
          editTMsList={editTMsList}
          onSeek={onSeek}
          onLive={onLive}
        />
        <input data-testid="decoy-input" />
      </>,
    );

    // ArrowRight from 5000 → next edit (7000).
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenLastCalledWith(7_000, 'keyboard');

    // ArrowLeft from 5000 → previous edit (3000).
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(onSeek).toHaveBeenLastCalledWith(3_000, 'keyboard');

    // Home → 0.
    fireEvent.keyDown(document, { key: 'Home' });
    expect(onSeek).toHaveBeenLastCalledWith(0, 'keyboard');

    // End → onLive; no additional onSeek.
    const seekCalls = onSeek.mock.calls.length;
    fireEvent.keyDown(document, { key: 'End' });
    expect(onLive).toHaveBeenCalledTimes(1);
    expect(onSeek.mock.calls.length).toBe(seekCalls);

    // INPUT focus gates all arrow keys.
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="decoy-input"]',
    );
    expect(input).not.toBeNull();
    if (input) {
      input.focus();
      const before = onSeek.mock.calls.length;
      fireEvent.keyDown(input, { key: 'ArrowLeft' });
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      expect(onSeek.mock.calls.length).toBe(before);
      input.blur();
    }
  });

  it('LIVE button click invokes onLive', () => {
    const onLive = vi.fn();
    const { getByTestId } = render(
      <Scrubber
        tMs={2_000}
        durationMs={10_000}
        editTMsList={[]}
        onSeek={() => {}}
        onLive={onLive}
      />,
    );
    fireEvent.click(getByTestId('scrubber-live'));
    expect(onLive).toHaveBeenCalledTimes(1);
  });
});
