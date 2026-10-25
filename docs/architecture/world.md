# Island world

The world areas a homework task can belong to, and how each is drawn as a floating island. Module: `src/modules/world`. Art direction and the picture workflow: [below](#art-direction-and-pictures).

## Product fit

The islands are the visual home of the child's **own** homework, never a place with learning content of its own ([vision](../product/vision.md): no exercises, no learning paths, no pressure gamification). The map shows every island; an island shows its places, and a place says in one sentence which homework belongs there. The only way on is "start a homework task". There is no progress, unlocking or completion per island or place: nothing in the backend records it, and adding it would need a product decision first.

## Data

| Source                                          | What it holds                                                                                                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/models/world-areas.ts`                  | `WORLD_AREAS`: the single source of every area (stable id, German name, subject, topics, grades, `mvp`, `sensitive`, `fallback`); `resolveArea`, `isAreaId`    |
| `presentation/catalog/islands.json`             | One island per area id: biome, signature landmark, 2 to 4 places (stable id, German name and sentence, topics of the area, glyph, position), its asset package |
| `presentation/schemas/island-catalog-schema.ts` | The catalog's contract, parsed at import: unknown area, second island, foreign topic, duplicate id, position outside the picture or no base picture fail       |
| `presentation/dto/world-layout-dto.ts`          | Where every island stands in the map's world: one honeycomb archipelago per subject around the starting islands; `subjectRegion` gives its centre and banner   |

`resolveArea(aiId, confidence)` is how a classifier's answer is used: an unknown id or a confidence below 0.7 gives the fallback area (`ueberraschungsinsel`), never an error. No classifier calls it yet (#10, #12).

An area without a catalog entry is still drawn (its subject's biome, no places), so a new entry in `WORLD_AREAS` never breaks the map; the catalog test fails CI until it has an island.

## Pictures

An asset has a stable id (`<areaId>/<assetId>`), a category, a status (`planned` or `ready`), a version and an English generation brief. A `ready` asset is served from the public container as `world/<areaId>/<assetId>-{512,1024}.webp?v=<version>` (`islandPicture`, chosen through `srcSet`). While it is `planned`, when `STORAGE_PUBLIC_BASE_URL` is unset, and when the file fails to load, `IslandPicture` draws `IslandArt`: a placeholder built from the area id (seeded outline, `presentation/art/island-geometry.ts`), the biome palette (`--hortai-island-*` and `[data-biome]` in `globals.css`) and simple glyphs for the landmark and places, in the same 4:3 canvas as the pictures. Only the `island` category is drawn today. Whether a picture is uploaded is never shown to the child: a missing or failed one quietly shows the drawn island, and only `aria-busy` says a picture is still loading.

## Screens

- `/world` (`src/app/[locale]/(app)/world/page.tsx`): `WorldMap`, a spatial world the child drags around (`useWorldCamera`: pointer, wheel and arrow keys within the same bounds). Each subject is an archipelago with its name and icon floating above it; a test keeps any two islands from crowding each other. A row of labelled subject buttons (and "Start") glides the camera there, so nothing needs a drag or a precise gesture. `--world-spread` (`world-map.module.css`) spaces the world closer on a phone while the islands keep a readable size. Every island is a link named by its island alone; the name is interface text, never part of the art.
- `/world/[areaId]`: `IslandView`, the island with its places as real buttons (`aria-pressed`, hit areas of at least 44 px): a pin floating a little above the place's ground point (`x`/`y`) so it never hides it, with the name beside it (on a phone only the chosen place shows its name; the others keep it as their accessible name). A polite live region gives the chosen place's sentence, then the link to the task entry. The segment is read inside Suspense (cache components with partial prefetching), so an id that is not an area renders the not-found panel in the stream rather than answering with a 404 status.
- The home's world card (`src/app/[locale]/(app)/home/_components/world-card.tsx`) shows the starting islands in a row, in the map's left-to-right order.

Both pages need a signed-in parent with a finished onboarding, like the home. Texts live in the `app` namespace (`world.*`) and reach the module's components as props; the module has no namespace of its own because it has no error codes. Motion is a small lift on hover or focus, the camera's glide to a subject and the drag's inertia; calm mode and reduced motion turn the glide into a jump and drop the inertia.

**Open product question:** `IslandPicture` can veil an island in mist (`discovery: 'unrevealed'`). The designer brief rules out locked paths and the vision any pressure, so whether islands may be fogged at all needs a team decision. `unknown` (no discovery record, today's state everywhere but the home preview) draws no mist.

## Art direction and pictures

No island picture is generated yet; every island is drawn as its placeholder. The pictures are made outside the repository; only the delivered WebP files go to the public container.

| Aspect        | Rule                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Look          | Cozy, handcrafted miniature 3D diorama; matte clay and painted-wood materials; rounded, simplified geometry; readable as a thumbnail             |
| Camera        | Fixed three-quarter front view, about 35° from above, near-orthographic; identical for every island                                              |
| Framing       | 4:3; island centred; top surface about 80% of the width; tallest landmark ends about 5% below the top; rock tip about 92% down; nothing at edges |
| Island        | Biome top surface, thin soil band, layered rounded rock tapering to one soft point; irregular, characterful outline                              |
| Hierarchy     | One signature landmark at the back centre (largest), 2 to 4 places left, right and front, 2 to 3 footpaths to the landmark, few small details    |
| Light         | Soft warm key light from the top left, gentle ambient occlusion, soft contact shadows; no rim light, no harsh or dark shadows                    |
| Palette       | Warm, slightly muted, creamy base; brand anchors chestnut `#7b421f`, amber `#ffae2b`, terracotta `#e4a17b`, book blue `#d1e5ef`, cream `#fff8f0` |
| Background    | Fully transparent; no sky, ground, frame or vignette                                                                                             |
| Never         | Text, letters, numbers, writing-like symbols, logos, real flags, religious symbols, watermarks, people; nothing copied from games or films       |
| Sensitive     | Areas marked `sensitive` stay neutral, inclusive and calm (the prompt says so)                                                                   |
| Differentiate | Biome, outline, landmark and the places' scenery tell islands apart, never a different camera, light or material                                 |

The binding wording is `STYLE_PROMPT` in `scripts/lib/world-assets.ts`, the first part of every prompt; each island adds its `brief` from the catalog.

1. **Prompts:** `npm run world:assets -- --dir <folder>` writes `<folder>/<areaId>/island.prompt.txt` for every island and lists them in generation order.
2. **Cohesion test first:** generate `zahlenwald`, `federsee` and `himmelsturm` (deliberately different) and compare them side by side and as thumbnails: same camera, light, shadows and material, clearly different outlines and landmarks, no text anywhere.
3. **Reference:** save the approved one as `<folder>/reference.png` and attach it as the style reference to every later generation; a seed alone is not enough. A drifting island is regenerated, never the reference.
4. **Masters:** save each picture as `<folder>/<areaId>/island.png` (transparent, ideally 2048 × 1536) and run the script again. It refuses an opaque or too small master, pads another aspect ratio to 4:3 and writes `island-512.webp` and `island-1024.webp`.
5. **Upload** both to `world/<areaId>/` in the public container (`STORAGE_PUBLIC_BASE_URL`).
6. **Switch on:** set the asset's `status` to `ready` and a new `version` in `islands.json`, then move any place pin that does not stand on its place (`x`/`y`, fractions of the picture).

A new area needs an entry in `WORLD_AREAS` and an island in `islands.json`. More pictures for an island are further assets with another `category` and their own brief; only `island` is drawn today, so a new category also needs the code that shows it.

## Tests

`__tests__/src/modules/world`: area integrity and `resolveArea`; catalog coverage of every area and every schema rule; storage keys, versioned addresses and the fallback for an unknown area; the outline (deterministic, distinct, inside the picture); the layout (positions stable and inside the world, no two islands crowding, a region per subject); the camera (drag, spread, bounds, cancel, swallowed click); the map (subject buttons fly there, links named by island alone), the picture fallback on a load error and choosing a place. `__tests__/scripts/world-assets.test.ts`: the style prompt, generation order, prompts and the master check.
