import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EducationResource } from '../../../domain/resources/types';
import { useEducationResourceSelection } from '../useEducationResourceSelection';

const resource = (id: string): EducationResource => ({
  id,
  title: id,
  source: '',
  description: '',
  tags: [],
  audience: 'general',
  review: { status: 'approved', reviewedBy: 'test', reviewedAt: '2026-01-01T00:00:00.000Z', notes: '' },
});

describe('useEducationResourceSelection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the selected resource by ID when array indexes shift', () => {
    const first = resource('first');
    const second = resource('second');
    const third = resource('third');
    const { result, rerender } = renderHook(
      ({ resources }: { resources: EducationResource[] }) =>
        useEducationResourceSelection({ resources, onResourceAdd: vi.fn(() => 'new') }),
      { initialProps: { resources: [first, second, third] } },
    );

    act(() => {
      result.current.selectResource(1);
    });
    expect(result.current.selection).toEqual({ index: 1, id: 'second' });

    rerender({ resources: [third, first, second] });

    expect(result.current.selectedIndex).toBe(2);
    expect(result.current.effectiveIndex).toBe(2);
    expect(result.current.selectedResource?.id).toBe('second');
  });

  it('falls back to the first resource when the selected ID disappears', () => {
    const first = resource('first');
    const second = resource('second');
    const { result, rerender } = renderHook(
      ({ resources }: { resources: EducationResource[] }) =>
        useEducationResourceSelection({ resources, onResourceAdd: vi.fn(() => 'new') }),
      { initialProps: { resources: [first, second] } },
    );

    act(() => {
      result.current.selectResource(1);
    });
    rerender({ resources: [first] });

    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.effectiveIndex).toBe(0);
    expect(result.current.selectedResource?.id).toBe('first');
  });

  it('focuses a resource selected by an external request and uses its default title path', () => {
    const scheduleFocus = vi.fn();
    const { result } = renderHook(() =>
      useEducationResourceSelection({
        resources: [resource('first'), resource('target')],
        externalFocus: { id: 'target', requestId: 1 },
        onResourceAdd: vi.fn(() => 'new'),
        scheduleFocus,
      }),
    );

    expect(result.current.selectedIndex).toBe(1);
    vi.advanceTimersByTime(120);
    expect(scheduleFocus).toHaveBeenCalledWith('target.title');
  });

  it('uses an explicit external focus path and ignores unknown resource IDs', () => {
    const scheduleFocus = vi.fn();
    const { result, rerender } = renderHook(
      ({ externalFocus }: { externalFocus: { id: string; requestId: number; path?: string } }) =>
        useEducationResourceSelection({
          resources: [resource('first'), resource('target')],
          externalFocus,
          onResourceAdd: vi.fn(() => 'new'),
          scheduleFocus,
        }),
      { initialProps: { externalFocus: { id: 'target', requestId: 1, path: 'target.body.block-1' } } },
    );

    vi.advanceTimersByTime(120);
    expect(scheduleFocus).toHaveBeenCalledWith('target.body.block-1');

    rerender({ externalFocus: { id: 'missing', requestId: 2, path: 'missing.title' } });
    vi.advanceTimersByTime(120);
    expect(result.current.selectedResource?.id).toBe('target');
    expect(scheduleFocus).toHaveBeenCalledTimes(1);
  });

  it('selects the next neighbor, then the previous neighbor, after removal', () => {
    const onResourceRemove = vi.fn();
    const first = resource('first');
    const second = resource('second');
    const third = resource('third');
    const { result, rerender } = renderHook(
      ({ resources }: { resources: EducationResource[] }) =>
        useEducationResourceSelection({
          resources,
          onResourceAdd: vi.fn(() => 'new'),
          onResourceRemove,
        }),
      { initialProps: { resources: [first, second, third] } },
    );

    act(() => {
      result.current.selectResource(1);
    });
    act(() => {
      result.current.removeResource();
    });
    expect(onResourceRemove).toHaveBeenCalledWith(1, 'second');
    expect(result.current.selection).toEqual({ index: 2, id: 'third' });

    rerender({ resources: [first, third] });
    act(() => {
      result.current.removeResource();
    });
    expect(onResourceRemove).toHaveBeenLastCalledWith(1, 'third');
    expect(result.current.selection).toEqual({ index: 0, id: 'first' });
  });

  it('selects a newly added resource using the returned ID', () => {
    const onResourceAdd = vi.fn(() => 'new-resource');
    const first = resource('first');
    const { result, rerender } = renderHook(
      ({ resources }: { resources: EducationResource[] }) =>
        useEducationResourceSelection({ resources, onResourceAdd }),
      { initialProps: { resources: [first] } },
    );

    act(() => {
      expect(result.current.addResource()).toBe('new-resource');
    });
    expect(onResourceAdd).toHaveBeenCalledOnce();
    expect(result.current.selection).toEqual({ index: 1, id: 'new-resource' });

    rerender({ resources: [first, resource('new-resource')] });
    expect(result.current.selectedIndex).toBe(1);
    expect(result.current.selectedResource?.id).toBe('new-resource');
  });
});
