# Game 3D — assembled player spawn town (2026-11-13)

- User source: `game3d.blend`; converted into a genuine ~8 MB GLB containing **104 separate mesh objects and 80 named tiles**.
- Asset in the corresponding Base44 media library: https://media.base44.com/files/public/6ab42219a52fd34656a53b37/461493b8c_game3d_town_assembled.glb
- Wolfveil local center: (0,-70); rendered game center: (0,0).
- Model uniformly expanded to **130 × 141 world meters**; ground Y 22.66m.
- Default new-player spawn: **(-12,12)** in the plaza, clear of the center trunk. Existing valid per-character checkpoint resumes still take priority.
- The SAME authoritative `wolfveilHeight` grade is used by the 1,100m terrain and server movement: a flat inner town footprint transitions to the natural terrain over 38m with no fake walkable plane.
- Game 3D-only old market fountain and paving are retired before adding the new town to prevent duplicates. The standalone Game 1 renderer retains those details.
- Fail-safe: if the public GLB does not load, Wolfveil's physical terrain continues to work.
- **Remaining QA:** in-engine screenshot and traversal validation, textured-material fidelity (Blender-specific packed textures were not transferred), and per-building wall/stair collision. The initial collision circle now protects the central town tree; not all architecture is yet server-collidable.
