import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  focusValidationPath,
  scheduleValidationFocus,
  scrollToValidationSummary,
  scheduleValidationSummaryScroll,
} from '../validationNavigation';

describe('validationNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('focusValidationPath', () => {
    it('finds and focuses an input inside the matched data-validation-path element', () => {
      const container = document.createElement('div');
      container.dataset.validationPath = 'material-1.title';
      const input = document.createElement('input');
      container.appendChild(input);
      document.body.appendChild(container);

      const scrollSpy = vi.fn();
      container.scrollIntoView = scrollSpy;

      const result = focusValidationPath('material-1.title');
      expect(result).toBe(true);
      expect(container.getAttribute('data-validation-active')).toBe('true');
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
      expect(document.activeElement).toBe(input);

      vi.advanceTimersByTime(2500);
      expect(container.hasAttribute('data-validation-active')).toBe(false);
    });

    it('returns false when no matching element is found', () => {
      expect(focusValidationPath('unknown.path')).toBe(false);
    });

    it('schedules focus asynchronously via scheduleValidationFocus', () => {
      const container = document.createElement('div');
      container.dataset.validationPath = 'contact.name';
      const input = document.createElement('input');
      container.appendChild(input);
      document.body.appendChild(container);
      container.scrollIntoView = vi.fn();

      scheduleValidationFocus('contact.name');
      expect(container.getAttribute('data-validation-active')).toBeNull();

      vi.advanceTimersByTime(1);
      expect(container.getAttribute('data-validation-active')).toBe('true');
      expect(document.activeElement).toBe(input);
    });
  });

  describe('scrollToValidationSummary', () => {
    it('finds the validation summary section, scrolls into view and focuses its first button', () => {
      const section = document.createElement('section');
      section.id = 'validation-summary';
      section.dataset.validationSummary = 'true';
      section.tabIndex = -1;

      const button = document.createElement('button');
      button.textContent = 'Ir ao material';
      section.appendChild(button);
      document.body.appendChild(section);

      const scrollSpy = vi.fn();
      section.scrollIntoView = scrollSpy;

      const result = scrollToValidationSummary();
      expect(result).toBe(true);
      expect(section.getAttribute('data-validation-active')).toBe('true');
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(document.activeElement).toBe(button);

      vi.advanceTimersByTime(2500);
      expect(section.hasAttribute('data-validation-active')).toBe(false);
    });

    it('prioritizes data-validation-errors container when present', () => {
      const section = document.createElement('section');
      section.dataset.validationSummary = 'true';

      const errorGroup = document.createElement('div');
      errorGroup.dataset.validationErrors = 'true';
      const errorButton = document.createElement('button');
      errorButton.textContent = 'Corrigir erro';
      errorGroup.appendChild(errorButton);

      section.appendChild(errorGroup);
      document.body.appendChild(section);

      const scrollSpy = vi.fn();
      errorGroup.scrollIntoView = scrollSpy;

      const result = scrollToValidationSummary();
      expect(result).toBe(true);
      expect(errorGroup.getAttribute('data-validation-active')).toBe('true');
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(document.activeElement).toBe(errorButton);
    });

    it('returns false when no validation summary is present', () => {
      expect(scrollToValidationSummary()).toBe(false);
    });

    it('schedules summary scroll asynchronously via scheduleValidationSummaryScroll', () => {
      const section = document.createElement('section');
      section.dataset.validationSummary = 'true';
      section.tabIndex = -1;
      section.scrollIntoView = vi.fn();
      document.body.appendChild(section);

      scheduleValidationSummaryScroll();
      expect(section.getAttribute('data-validation-active')).toBeNull();

      vi.advanceTimersByTime(1);
      expect(section.getAttribute('data-validation-active')).toBe('true');
      expect(section.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });
  });
});
