import type { ReactNode } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WORLD_AREAS } from '@modules/world/domain/models/world-areas';
import { IslandPicture } from '@modules/world/presentation/components/island-picture';
import { IslandView } from '@modules/world/presentation/components/island-view';
import { WorldMap } from '@modules/world/presentation/components/world-map';
import { islandTopic, worldIsland, worldIslands } from '@modules/world/presentation/dto/island-dto';
import { WORLD_HOME, subjectRegion } from '@modules/world/presentation/dto/world-layout-dto';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import app from '@/i18n/messages/en.json';

function renderInEnglish(ui: ReactNode) {
  return render(
    <I18nClientProvider locale="en" messages={{ app }} timeZone="Europe/Berlin" isDevelopment>
      {ui}
    </I18nClientProvider>,
  );
}

const SUBJECTS = {
  deutsch: app.world.subjects.deutsch,
  mathe: app.world.subjects.mathe,
  'sachunterricht-natur': app.world.subjects.natur,
  'sachunterricht-gesellschaft': app.world.subjects.gesellschaft,
  'sprachen-kunst': app.world.subjects.sprachenKunst,
  zusammenleben: app.world.subjects.zusammenleben,
  lernen: app.world.subjects.lernen,
};

const LABELS = {
  places: 'Places on Zahlenwald',
  pickPlace: app.world.island.pickPlace,
  noPlaces: app.world.island.noPlaces,
  start: app.world.island.start,
  inMist: app.world.island.inMist,
};

function islandOf(areaId: string) {
  const island = worldIsland(areaId, undefined);
  if (island === null) {
    throw new Error(`${areaId} is missing`);
  }
  return island;
}

describe('WorldMap', () => {
  it('flies to a subject archipelago from a labelled button and back to the start', () => {
    const { container } = renderInEnglish(
      <WorldMap islands={worldIslands(undefined)} subjects={SUBJECTS} labels={app.world.explore} />,
    );
    const plane = container.querySelector<HTMLElement>('[data-world-plane]');
    const jump = screen.getByRole('group', { name: app.world.explore.jump });
    fireEvent.click(within(jump).getByRole('button', { name: 'Maths' }));
    const maths = subjectRegion('mathe').center;
    expect(plane?.style.transform).toBe(`translate3d(${-maths.x}px, ${-maths.y}px, 0)`);
    fireEvent.click(within(jump).getByRole('button', { name: app.world.explore.home }));
    expect(plane?.style.transform).toBe(`translate3d(${-WORLD_HOME.x}px, ${-WORLD_HOME.y}px, 0)`);
  });

  it('gives every jump button a child-sized target, never the small 40px button', () => {
    renderInEnglish(
      <WorldMap islands={worldIslands(undefined)} subjects={SUBJECTS} labels={app.world.explore} />,
    );
    const jump = screen.getByRole('group', { name: app.world.explore.jump });
    for (const button of within(jump).getAllByRole('button')) {
      expect(button).toHaveAttribute('data-size', 'default');
    }
  });

  it('names each island by its name alone, with no picture status read out', () => {
    renderInEnglish(
      <WorldMap islands={worldIslands(undefined)} subjects={SUBJECTS} labels={app.world.explore} />,
    );
    expect(screen.getByRole('link', { name: 'Märchenwald' })).toBeVisible();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('links every island of the world by its name', () => {
    renderInEnglish(
      <WorldMap islands={worldIslands(undefined)} subjects={SUBJECTS} labels={app.world.explore} />,
    );
    expect(screen.getAllByRole('link').filter((link) => link.closest('li'))).toHaveLength(
      WORLD_AREAS.length,
    );
    expect(screen.getByRole('link', { name: 'Zahlenwald' })).toHaveAttribute(
      'href',
      '/en/world/zahlenwald',
    );
  });

  it('tells which islands are still in the mist and where the child already did homework', () => {
    renderInEnglish(
      <WorldMap
        islands={worldIslands(undefined, undefined, new Set(['zahlenwald']))}
        subjects={SUBJECTS}
        labels={app.world.explore}
      />,
    );
    expect(screen.getByRole('link', { name: 'Zahlenwald' })).toHaveAccessibleDescription(
      app.world.explore.homeworkHere,
    );
    expect(screen.queryByRole('link', { name: 'Märchenwald' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Märchenwald' })).toHaveAccessibleDescription(
      app.world.explore.inMist,
    );
  });

  it('keeps an island in the mist out of reach: no link, nothing to focus', () => {
    const { container } = renderInEnglish(
      <WorldMap
        islands={worldIslands(undefined, undefined, new Set())}
        subjects={SUBJECTS}
        labels={app.world.explore}
      />,
    );
    const misty = container.querySelector('li[data-area-id="maerchenwald"]');
    expect(misty?.querySelector('a, [tabindex]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Überraschungsinsel' })).toBeVisible();
  });

  it('says nothing about mist or homework while the record is unknown', () => {
    renderInEnglish(
      <WorldMap islands={worldIslands(undefined)} subjects={SUBJECTS} labels={app.world.explore} />,
    );
    expect(screen.getByRole('link', { name: 'Märchenwald' })).not.toHaveAccessibleDescription();
  });

  it('groups the islands by subject', () => {
    renderInEnglish(
      <WorldMap islands={worldIslands(undefined)} subjects={SUBJECTS} labels={app.world.explore} />,
    );
    const maths = screen.getByRole('region', { name: 'Maths' });
    expect(within(maths).getByRole('link', { name: 'Malmühle' })).toBeVisible();
    expect(within(maths).queryByRole('link', { name: 'Märchenwald' })).toBeNull();
  });
});

describe('IslandPicture', () => {
  const island = islandOf('federsee');
  const picture = {
    src: 'https://storage.test/world/federsee/island-1024.webp?v=1',
    srcSet: 'https://storage.test/world/federsee/island-512.webp?v=1 512w',
  };

  it('identifies missing art separately from an asset request that failed', () => {
    const { container, rerender } = render(
      <IslandPicture art={island.art} picture={null} sizes="100vw" />,
    );
    expect(container.querySelector('[data-asset-state="missing"]')).not.toBeNull();
    rerender(<IslandPicture art={island.art} picture={picture} sizes="100vw" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('[data-asset-state="failed"]')).not.toBeNull();
  });

  it('keeps the same image node and source when mist is lifted', () => {
    const { container, rerender } = render(
      <IslandPicture art={island.art} picture={picture} sizes="100vw" discovery="unrevealed" />,
    );
    const original = container.querySelector('img');
    expect(container.querySelector('[data-discovery="unrevealed"]')).not.toBeNull();
    rerender(
      <IslandPicture art={island.art} picture={picture} sizes="100vw" discovery="revealed" />,
    );
    expect(container.querySelector('img')).toBe(original);
    expect(original).toHaveAttribute('src', picture.src);
  });

  it('draws the placeholder while no picture is uploaded', () => {
    const { container } = render(<IslandPicture art={island.art} picture={null} sizes="100vw" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg[data-biome="lake"]')).not.toBeNull();
  });

  it('shows the uploaded picture, and the placeholder when it cannot be loaded', () => {
    const { container } = render(
      <IslandPicture art={island.art} picture={picture} sizes="100vw" />,
    );
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', picture.src);
    expect(image).toHaveAttribute('alt', '');
    fireEvent.error(image!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg[data-biome="lake"]')).not.toBeNull();
  });
});

describe('IslandView', () => {
  it('names every place and shows which homework belongs to the one tapped', () => {
    renderInEnglish(
      <IslandView island={islandOf('zahlenwald')} startHref="/start" labels={LABELS} />,
    );
    const bridge = screen.getByRole('button', { name: 'Zählbrücke' });
    expect(bridge).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Tap a place on the island/)).toBeVisible();

    fireEvent.click(bridge);

    expect(bridge).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Zählbrücke' })).toBeVisible();
    expect(screen.getByText('Für Aufgaben zum Zählen und Abzählen.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Start a homework task' })).toHaveAttribute(
      'href',
      '/en/start?area=zahlenwald&place=zaehlbruecke',
    );
  });

  it('starts homework on the island itself before a place is picked', () => {
    renderInEnglish(
      <IslandView island={islandOf('zahlenwald')} startHref="/start" labels={LABELS} />,
    );
    expect(screen.getByRole('link', { name: 'Start a homework task' })).toHaveAttribute(
      'href',
      '/en/start?area=zahlenwald',
    );
  });

  it('shows an island in the mist without its places or a way to start there', () => {
    const misty = worldIsland('zahlenwald', undefined, undefined, new Set());
    renderInEnglish(<IslandView island={misty!} startHref="/start" labels={LABELS} />);

    expect(screen.queryByRole('button', { name: 'Zählbrücke' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Start a homework task' })).toBeNull();
    expect(screen.getByText(LABELS.inMist)).toBeVisible();
  });

  it('keeps one place selected at a time', () => {
    renderInEnglish(
      <IslandView island={islandOf('zahlenwald')} startHref="/start" labels={LABELS} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zählbrücke' }));
    fireEvent.click(screen.getByRole('button', { name: 'Plus-Mulde' }));
    expect(screen.getByRole('button', { name: 'Zählbrücke' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('heading', { name: 'Plus-Mulde' })).toBeVisible();
  });
});

describe('island discovery and topics', () => {
  it('clears only the start and the islands of the own homework of the child', () => {
    const islands = worldIslands(undefined, undefined, new Set(['zahlenwald']));
    const byId = new Map(islands.map((island) => [island.areaId, island]));
    expect(byId.get('zahlenwald')).toMatchObject({ discovery: 'revealed', hadHomework: true });
    expect(byId.get('maerchenwald')).toMatchObject({ discovery: 'unrevealed', hadHomework: false });
    expect(byId.get('ueberraschungsinsel')).toMatchObject({
      discovery: 'revealed',
      hadHomework: false,
    });
  });

  it('keeps every island unknown without a record', () => {
    expect(worldIslands(undefined).every((island) => island.discovery === 'unknown')).toBe(true);
  });

  it('accepts an island and one of its own places as a homework topic', () => {
    expect(islandTopic('zahlenwald', 'plus-mulde')).toEqual({
      areaId: 'zahlenwald',
      placeId: 'plus-mulde',
      subject: 'math',
    });
    expect(islandTopic('zahlenwald', undefined)).toEqual({
      areaId: 'zahlenwald',
      placeId: null,
      subject: 'math',
    });
  });

  it('refuses an unknown island or a place of another island', () => {
    expect(islandTopic('atlantis', undefined)).toBeNull();
    expect(islandTopic('__proto__', undefined)).toBeNull();
    expect(islandTopic(undefined, 'plus-mulde')).toBeNull();
    expect(islandTopic('maerchenwald', 'plus-mulde')).toBeNull();
  });
});
