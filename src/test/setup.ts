import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import type {} from '@testing-library/jest-dom/vitest';

expect.extend(matchers);

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = () => 'blob:mock-url';
}

if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = () => {};
}
