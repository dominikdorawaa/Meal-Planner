import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { startSessionRenewal } from './lib/sessionRenewal';

const stopSessionRenewal = vi.fn();

vi.mock('./lib/sessionRenewal', () => ({
  startSessionRenewal: vi.fn(() => stopSessionRenewal),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('App', () => {
  it('renews the session while the app is open and stops when it closes', () => {
    const { unmount } = render(<App />);

    expect(startSessionRenewal).toHaveBeenCalledOnce();
    expect(stopSessionRenewal).not.toHaveBeenCalled();

    unmount();

    expect(stopSessionRenewal).toHaveBeenCalledOnce();
  });
});
