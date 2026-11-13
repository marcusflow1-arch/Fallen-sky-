// Hairline category glyphs for the creator rail: one 24px grid, 1.25px strokes,
// round caps, no fills, so the rail reads as fine engraving over the 3D scene.
const Svg = ({ children, size = 20, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>{children}</svg>
);
export const FaceGlyph = (p) => <Svg {...p}><path d="M12 3.2c-3.6 0-6 2.9-6 7 0 4.6 2.7 8.6 6 8.6s6-4 6-8.6c0-4.1-2.4-7-6-7Z"/><path d="M9.2 10.4h1.4M13.4 10.4h1.4M11.9 11.6l-.5 2.4h1.1M10.2 16c1.1.6 2.5.6 3.6 0"/><path d="M8 20.8c1.1-.7 2.5-1.2 4-1.2s2.9.5 4 1.2"/></Svg>;
export const SkinGlyph = (p) => <Svg {...p}><path d="M12 3.5c3 3.6 5.5 6.7 5.5 10a5.5 5.5 0 0 1-11 0c0-3.3 2.5-6.4 5.5-10Z"/><path d="M9.4 14.2a2.8 2.8 0 0 0 2.1 2.7"/><circle cx="18.6" cy="5.2" r="1.2"/><circle cx="5.6" cy="7" r=".7"/></Svg>;
export const HairGlyph = (p) => <Svg {...p}><path d="M6.5 19.5c-1.6-3.9-1.8-8.3.4-11.4C8.6 5.6 11 4.5 13.3 4.6c3.2.2 5.4 2.8 5.2 6.5-.1 2.7-.9 5.6-1.9 8.4"/><path d="M9.2 20c-1-3.4-1-7 .8-9.6M12.3 20.2c-.6-3.1-.4-6.4 1.2-8.9M15 19.8c.3-2.6.8-5.4 2.3-7.7"/><path d="M7 8.1c2.7.3 6.3-.7 8.4-3"/></Svg>;
export const BodyGlyph = (p) => <Svg {...p}><circle cx="12" cy="4.2" r="1.7"/><path d="M8.2 7.8c2.4-.8 5.2-.8 7.6 0l-1 6.2h-5.6l-1-6.2ZM9.2 14l.6 6.6M14.8 14l-.6 6.6M8.2 7.8 6.4 13.4M15.8 7.8l1.8 5.6"/></Svg>;
export const HeightGlyph = (p) => <Svg {...p}><path d="M8 3.5v17M5.8 5.6 8 3.4l2.2 2.2M5.8 18.4 8 20.6l2.2-2.2"/><path d="M13 4h5M13 8h3M13 12h5M13 16h3M13 20h5"/></Svg>;
export const ChestGlyph = (p) => <Svg {...p}><path d="M6.2 4.5c.4 2.5.2 5.4-.6 8.3M17.8 4.5c-.4 2.5-.2 5.4.6 8.3"/><path d="M6.6 9.6c.8 2.6 2.7 3.9 5.4 2.8 2.7 1.1 4.6-.2 5.4-2.8"/><path d="M8.5 16.5c2.3 1 4.7 1 7 0M7.4 20c3 1 6.2 1 9.2 0"/><path d="M9.4 4.2c.8.7 1.6 1 2.6 1s1.8-.3 2.6-1"/></Svg>;
export const GlutesGlyph = (p) => <Svg {...p}><path d="M6.4 4.2c-.6 3.4-.8 6.4.1 9.4M17.6 4.2c.6 3.4.8 6.4-.1 9.4"/><path d="M6.5 13.6c.6 2.3 2.4 3.6 4.4 3.3.6-.1 1-.6 1.1-1.3.1.7.5 1.2 1.1 1.3 2 .3 3.8-1 4.4-3.3"/><path d="M12 7.6v8M8.2 20.2l.4-2.8M15.8 20.2l-.4-2.8"/></Svg>;
export const ExpressionGlyph = (p) => <Svg {...p}><circle cx="12" cy="12" r="8.4"/><path d="M8.2 9.2c.7-.6 1.6-.6 2.3 0M13.5 9.2c.7-.6 1.6-.6 2.3 0"/><path d="M8.3 13.6c1.9 2.6 5.5 2.6 7.4 0"/></Svg>;
export const TattooGlyph = (p) => <Svg {...p}><path d="M12 3.2 20.8 12 12 20.8 3.2 12Z"/><path d="M12 7.6 16.4 12 12 16.4 7.6 12Z"/><path d="M12 3.2v4.4M12 16.4v4.4M3.2 12h4.4M16.4 12h4.4"/></Svg>;
export const GlossGlyph = (p) => <Svg {...p}><path d="M12 3.4c.5 3.6 1.9 5.2 5.4 5.6-3.5.5-4.9 2-5.4 5.6-.5-3.6-1.9-5.1-5.4-5.6 3.5-.4 4.9-2 5.4-5.6Z"/><path d="M18 14.6c.3 1.8 1 2.6 2.7 2.8-1.7.3-2.4 1-2.7 2.8-.3-1.8-1-2.5-2.7-2.8 1.7-.2 2.4-1 2.7-2.8Z"/><path d="M5.2 15.4c.2 1.2.7 1.7 1.8 1.9-1.1.1-1.6.7-1.8 1.8-.2-1.1-.7-1.7-1.8-1.8 1.1-.2 1.6-.7 1.8-1.9Z"/></Svg>;
export const OutfitGlyph = (p) => <Svg {...p}><path d="M9 3.8 12 6l3-2.2 4.8 2.4 1.4 4.6-3 1.1V20.2H5.8v-8.3l-3-1.1 1.4-4.6Z"/><path d="M9 3.8c.4 1.6 1.4 2.4 3 2.4s2.6-.8 3-2.4M12 6v14.2"/></Svg>;
export const InfluenceGlyph = (p) => <Svg {...p}><circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c2.4 2.4 3.6 5.2 3.6 8.4S14.4 18 12 20.4C9.6 18 8.4 15.2 8.4 12S9.6 6 12 3.6Z"/></Svg>;
export const StyleGlyph = (p) => <Svg {...p}><path d="M14.6 4.2 19.8 9.4 11 18.2l-5.2-5.2Z"/><path d="M5.8 13 4.2 19.8 11 18.2M12.6 6.2l5.2 5.2"/></Svg>;
