import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TEST_VERSION_WARNING, TestVersionBanner } from '../TestVersionBanner';

describe('TestVersionBanner', () => {
  it('shows the warning for the test version', () => {
    render(<TestVersionBanner />);

    expect(screen.getByText(TEST_VERSION_WARNING)).toBeInTheDocument();
  });
});
