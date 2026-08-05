import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CityFilter } from '../CityFilter';

const cities = ['Canoas - RS', 'Porto Alegre - RS'];

function renderStateful(citiesList: string[]) {
  let latestValue: string | null = null;
  const onChange = vi.fn((value: string | null) => {
    latestValue = value;
  });
  function Harness() {
    const [value, setValue] = useState<string | null>(null);
    return (
      <CityFilter
        cities={citiesList}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { onChange, getValue: () => latestValue };
}

function mockGeolocationSuccess(lat: number, lng: number) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback) =>
        success({
          coords: { latitude: lat, longitude: lng },
        } as unknown as GeolocationPosition),
    },
  });
}

function mockGeolocationError() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 1, message: 'Denied' } as GeolocationPositionError),
    },
  });
}

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).geolocation;
  vi.restoreAllMocks();
});

describe('CityFilter', () => {
  it('opens the listbox with all cities plus "Todas as cidades"', async () => {
    const user = userEvent.setup();
    render(<CityFilter cities={cities} value={null} onChange={() => undefined} />);

    await user.click(screen.getByRole('button', { name: /todas as cidades/i }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /todas as cidades/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /canoas - rs/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /porto alegre - rs/i })).toBeInTheDocument();
  });

  it('notifies the selected city and shows it on the trigger', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStateful(cities);

    await user.click(screen.getByRole('button', { name: /todas as cidades/i }));
    await user.click(screen.getByRole('option', { name: /porto alegre - rs/i }));

    expect(onChange).toHaveBeenCalledWith('Porto Alegre - RS');
    expect(screen.getByRole('button', { name: /porto alegre - rs/i })).toBeInTheDocument();
  });

  it('selecting "Todas as cidades" notifies null', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CityFilter cities={cities} value="Canoas - RS" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /canoas - rs/i }));
    await user.click(screen.getByRole('option', { name: /todas as cidades/i }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('filters the options while searching', async () => {
    const user = userEvent.setup();
    render(<CityFilter cities={cities} value={null} onChange={() => undefined} />);

    await user.click(screen.getByRole('button', { name: /todas as cidades/i }));
    await user.type(screen.getByRole('combobox'), 'porto');

    expect(screen.queryByRole('option', { name: /canoas - rs/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /porto alegre - rs/i })).toBeInTheDocument();
  });

  it('picks the nearest city from the device position and filters with it', async () => {
    mockGeolocationSuccess(-29.93, -51.18);
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CityFilter cities={cities} value={null} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /usar minha localização/i }));

    expect(await screen.findByText(/localização aproximada: canoas/i)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('Canoas - RS');
  });

  it('never persists the coordinates (no storage writes)', async () => {
    mockGeolocationSuccess(-29.93, -51.18);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    render(<CityFilter cities={cities} value={null} onChange={() => undefined} />);

    await user.click(screen.getByRole('button', { name: /usar minha localização/i }));
    await screen.findByText(/localização aproximada/i);

    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('shows an error message when geolocation is denied and does not change the filter', async () => {
    mockGeolocationError();
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CityFilter cities={cities} value={null} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /usar minha localização/i }));

    expect(await screen.findByText(/não foi possível obter sua localização/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a message when geolocation is unavailable and keeps all contacts visible', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CityFilter cities={cities} value={null} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /usar minha localização/i }));

    expect(await screen.findByText(/não foi possível obter sua localização/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
