# Methodology — sources, simplifications, caveats

## Geographic data

### NZ island outlines (`data/nz-islands.geojson`)
Source: [Natural Earth 1:10m Cultural Vectors — Admin 0 Countries](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/),
filtered to the New Zealand admin polygon, of which the North Island and
South Island are the two largest constituent rings. Simplified with a
Douglas–Peucker tolerance of 0.005° (~500 m at NZ latitudes), reducing the
North Island from 1,848 → 974 vertices and the South Island from 1,739 →
887 vertices. Detail is preserved at the chapter's max zoom (~7).

### Settler-era town markers (`data/ni-places.geojson`)
Five reference points used in ch3 only: Auckland, Wellington, New Plymouth,
Napier, Whanganui. Coordinates are city-hall accurate (4 decimal places).
The set is deliberately limited — we are not labelling every Pākehā
settlement, only the ones the chapter narrative names.

### Auckland Pasifika anchors (`data/auckland-pasifika-anchors.geojson`)
Inner-city (Ponsonby/Grey Lynn) and southern suburbs (Ōtara, Māngere,
Manukau) used in the ch9 Auckland zoom. Single-point markers, not polygons —
the visual purpose is to label *where* migration concentrated, not to draw
neighbourhood boundaries.

## NZ Settlements Act 1863 confiscation zones (`data/confiscation-zones.geojson`)

These are **indicative** boundaries — hand-drawn rough rings, smoothed at
render time via Catmull–Rom interpolation into bezier-like blobs. The
runtime smoothing is intentional: real confiscation boundaries are jagged,
contested, and frequently re-litigated, and a hard pretend-precise outline
would misrepresent the cartographic certainty. The blob form signals
"approximate area".

Acreage figures from the [Waitangi Tribunal record](https://www.waitangitribunal.govt.nz/):

| Zone                   | Year(s)   | Acres confiscated |
|------------------------|-----------|-------------------|
| Waikato                | 1865      | ~1,200,000        |
| Taranaki               | 1865      | ~1,275,000        |
| Tauranga               | 1864      | ~290,000          |
| Eastern Bay of Plenty  | 1866      | ~448,000          |

Boundary descriptions used to draw the rings:
- **Waikato**: north along the Mangatāwhiri Stream south of Auckland; east
  to the Hauraki / Mt Te Aroha foothills; south to a line near Pirongia–
  Te Awamutu; west to the Tasman coast at Raglan.
- **Taranaki**: most of the western Taranaki province around Mt Taranaki,
  with the South Taranaki coastal strip added in subsequent confiscation
  proclamations.
- **Tauranga**: a coastal strip from Athenree through Tauranga harbour to
  Te Puke, ~10 km inland.
- **Eastern Bay of Plenty**: Whakatāne and Opotiki coast inland to the
  Te Urewera ranges.

## 1890 still-Māori-held areas (`data/maori-land-1890.geojson`)

Highly schematic. By 1890 Māori land tenure was fragmented and intermixed
with Pākehā title — drawing it accurately would require a parcel-by-parcel
overlay, which is beyond the scope of an explanatory overview. The five
indicative zones are documented strongholds where Māori retained large
contiguous blocks against the cumulative pressure of the Native Land Court
and Crown / private purchase:

- **Te Rohe Pōtae / King Country** — central western North Island, held by
  the Kīngitanga.
- **Te Urewera** — Tūhoe homeland in the eastern interior.
- **East Cape / Tairāwhiti hinterland** — Ngāti Porou rohe.
- **Tai Tokerau hinterland** — pockets of Far North / Northland.
- **Central plateau** — Ngāti Tūwharetoa and others.

## Polynesian voyaging routes (ch1)

The two arrows (Society Is. → Northland; Cook Is. → Otago) follow great-
circle paths sampled at 120 points each. Destinations are real
archaeological first-settlement zones rather than the strait between
islands, which is where the funnel polygons in earlier drafts were tipping
incorrectly.

Society Is. → Northland:
- Origin centroid: Tahiti area (-149.5, -17.5)
- Destination: Bay of Islands area (174.10, -35.30) — Houhora, Doubtless
  Bay, and other early sites cluster here.

Cook Is. → Otago:
- Origin centroid: Rarotonga area (-159.7, -21.2)
- Destination: Shag/Pleasant River mouths (170.70, -45.55) — well-attested
  southern moa-hunter sites with radiocarbon dates from the late 13th–early
  14th century.

These are *one* set of plausible vectors among several debated by NZ
archaeology; the chapter narrative is careful to call them "the most likely
vector", not the only one. The visual function is to dramatise that
voyagers came from East Polynesia and made landfall in distinct parts of
the country, not to argue for a specific origin or route.

## Pacific Rim gold-rush circuit (ch4)

Four pinned strikes along the Pacific Rim:
- California (Sacramento area), 1848
- Victoria, Australia (Bendigo), 1851
- Otago (Dunstan/Cromwell), 1861
- West Coast (Hokitika), 1865

Routes are great-circle paths with the long-way-around prevented by manual
longitude unwrapping (turf.js's `greatCircle` returns a `MultiLineString`
across the antimeridian, which broke an earlier draft's funnel polygons).

The Cornwall → Otago dashed line is shown faintly to acknowledge the
non-trivial direct UK miner stream (well documented in the Otago Daily
Times manifest records); we do not claim it accounts for the bulk of the
field population, which was overwhelmingly Victorian-via-California.

## Pasifika migration corridors (ch9)

Six arcs from Sāmoa, Tonga, Cook Islands, Niue, Tokelau, and Fiji
converging on Auckland. These are **not** literal flight or shipping
routes — they are visualisations of the migration relationships that
the chapter narrative describes. Auckland is the destination point because
it is where Pasifika migration concentrated, not because every migrant
arrived through Auckland Airport.

## Caveats

- **Scrolly maps are not GIS.** Boundaries and routes are illustrative.
  Where readers might want sources, the chapter dek and step-card prose
  cite them.
- **Smoothing introduces drift.** Catmull–Rom interpolation through a
  hand-drawn ring smooths corners outward by up to ~1 segment radius. For
  the confiscation zones at the chosen 12-sample resolution this is well
  inside the precision of the underlying historical record.
- **Indigenous place names are preferred where reasonable** — Aotearoa,
  Te Ika-a-Māui, Te Moana-nui-a-Kiwa — but the labels also use English
  exonyms in places to avoid pretending fluency the piece doesn't claim.
