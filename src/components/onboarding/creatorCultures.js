/**
 * Original art-direction references, never nationality/ancestry/race selectors.
 * These choices cannot limit face/body sliders, complexion or gameplay stats.
 * Clothing & ornamental geometry require separately approved, original GLBs.
 */
export const CULTURAL_INSPIRATIONS = Object.freeze([
  { id: 'egyptian', label: 'Egyptian', description: 'Lapis blue, warm gold, linen and celestial ornament', accent: '#d6ae63', motifs: 'lotus · sun disk' },
  { id: 'greek', label: 'Greek', description: 'Marble, bronze, flowing drapery and laurel motifs', accent: '#b9d5db', motifs: 'laurel · meander' },
  { id: 'roman', label: 'Roman', description: 'Oxide red, imperial bronze, stone and layered armor', accent: '#cb9178', motifs: 'laurel · mosaic' },
  { id: 'american', label: 'American', description: 'Modern streetwear, frontier textiles and individual expression', accent: '#b4c8e2', motifs: 'modern · frontier' },
  { id: 'korean', label: 'Korean', description: 'Traditional textile colors, elegant folds and knotwork', accent: '#c6b5e9', motifs: 'textiles · knots' },
  { id: 'japanese', label: 'Japanese', description: 'Sumi-e brushwork, layered cloth and natural forms', accent: '#b1d0c1', motifs: 'ink · wind' },
  { id: 'spiritual', label: 'Spiritual fantasy', description: 'Blue-silver energy, halos and otherworldly adornment', accent: '#9bbdff', motifs: 'halo · aura' },
]);
export const GENRE_DIRECTIONS = Object.freeze([
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'historical', label: 'Historical' },
  { id: 'modern', label: 'Modern' },
  { id: 'science_fiction', label: 'Science fiction' },
  { id: 'mythic', label: 'Mythic / spiritual' },
]);
const ids = new Set(CULTURAL_INSPIRATIONS.map((item) => item.id));
const genres = new Set(GENRE_DIRECTIONS.map((item) => item.id));
export const MAX_CULTURAL_INSPIRATIONS = 7;
export function normalizeCulturalInspirations(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === 'string' && ids.has(id)))].slice(0, MAX_CULTURAL_INSPIRATIONS);
}
export function normalizeGenreDirection(value) {
  return genres.has(value) ? value : 'fantasy';
}
export function toggleCulturalInspiration(current, id) {
  const normalized = normalizeCulturalInspirations(current);
  if (!ids.has(id)) return normalized;
  return normalized.includes(id)
    ? normalized.filter((item) => item !== id)
    : normalizeCulturalInspirations([...normalized, id]);
}
export function creatorCultureAccent(value) {
  const selected = normalizeCulturalInspirations(value);
  return CULTURAL_INSPIRATIONS.find((item) => item.id === selected[0])?.accent || '#b7d2ed';
}
