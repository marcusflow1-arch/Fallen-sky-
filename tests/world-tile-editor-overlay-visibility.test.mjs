import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The editor overlay is intentionally not visible in normal Game 3D play.
// A selected tile may stay in review state without painting cyan polygons
// over the live world's ground.
test('tile inspection highlights require active edit mode', () => {
  const src = readFileSync(
    new URL('../src/components/worldTileEditor/WorldTileEditor.jsx', import.meta.url),
    'utf8'
  );
  assert.match(src, /const highlighted\s*=\s*active\s*\?\s*mergeTileIds\(grid, selected, preview, true\)\s*:\s*\[\]/);
  assert.match(src, /group\.userData\.editorOnly\s*=\s*true/);
  assert.match(src, /if \(active\) \{/);
});
