import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useReplayPosition } from '../src/hooks/useReplayPosition.js';

afterEach(() => {
  cleanup();
});

// Probe: mirrors Timeline.test.tsx — exposes the post-action URL so
// assertions can read pathname+search without reaching into router
// internals.
function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}

// Harness renders the hook's derived state as testids and exposes every
// write variant as a button click. One button per scenario keeps each test
// driving a single render tick — which is exactly what we need to assert
// that setPosition writes ?tMs and ?edit atomically (one setSearchParams
// call, one render).
interface HarnessProps {
  durationMs: number;
}

function Harness({ durationMs }: HarnessProps) {
  const { tMs, isLive, setPosition, setLive } = useReplayPosition(durationMs);
  return (
    <>
      <span data-testid="tMs">{tMs === null ? 'null' : String(tMs)}</span>
      <span data-testid="isLive">{String(isLive)}</span>
      <button
        data-testid="set-with-edit"
        onClick={() =>
          setPosition(5_000, { mode: 'push', editId: 'e3' })
        }
      />
      <button
        data-testid="set-delete-edit"
        onClick={() => setPosition(100, { mode: 'push', editId: null })}
      />
      <button
        data-testid="set-preserve-edit"
        onClick={() => setPosition(5_000, { mode: 'push' })}
      />
      <button
        data-testid="go-live"
        onClick={() => setLive({ mode: 'push' })}
      />
      <LocationProbe />
    </>
  );
}

function renderHarness(initialEntry: string, durationMs = 10_000) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Harness durationMs={durationMs} />
    </MemoryRouter>,
  );
}

describe('useReplayPosition', () => {
  it('setPosition writes ?tMs and ?edit atomically in one render tick', () => {
    const { getByTestId } = renderHarness('/');
    fireEvent.click(getByTestId('set-with-edit'));
    // Both params visible after a single setState — same render tick.
    expect(getByTestId('location').textContent).toBe('/?tMs=5000&edit=e3');
  });

  it('setPosition with editId:null removes ?edit (pre-first-edit seek)', () => {
    const { getByTestId } = renderHarness('/?tMs=2000&edit=e2');
    fireEvent.click(getByTestId('set-delete-edit'));
    expect(getByTestId('location').textContent).toBe('/?tMs=100');
  });

  it('setPosition without editId preserves any existing ?edit', () => {
    const { getByTestId } = renderHarness('/?tMs=1000&edit=e2');
    fireEvent.click(getByTestId('set-preserve-edit'));
    expect(getByTestId('location').textContent).toBe('/?tMs=5000&edit=e2');
  });

  it('setLive drops ?tMs from the URL', () => {
    const { getByTestId } = renderHarness('/?tMs=5000&edit=e2');
    fireEvent.click(getByTestId('go-live'));
    // ?edit stays — setLive only owns ?tMs.
    expect(getByTestId('location').textContent).toBe('/?edit=e2');
  });

  it('isLive and tMs derive from ?tMs presence', () => {
    // Case A: no ?tMs → live.
    const liveView = renderHarness('/');
    expect(liveView.getByTestId('tMs').textContent).toBe('null');
    expect(liveView.getByTestId('isLive').textContent).toBe('true');
    cleanup();

    // Case B: ?tMs=3000 within [0, durationMs] → not live.
    const scrubbedView = renderHarness('/?tMs=3000');
    expect(scrubbedView.getByTestId('tMs').textContent).toBe('3000');
    expect(scrubbedView.getByTestId('isLive').textContent).toBe('false');
  });
});
