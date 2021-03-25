import { Font, parse, Glyph, Path } from "opentype.js";

declare let window: any;

export interface HBGlyph {
  g: number;
  cl: number;
  offset: number;
  dx?: number;
  dy?: number;
  ax?: number;
  ay?: number;
}

export class MyFont {
  fontFace?: string;
  hbFont?: any;
  otFont?: Font;
  supportedScripts: Set<string>;
  supportedLanguages: Set<string>;
  supportedCodepoints: Set<number>;

  constructor(fontBlob: ArrayBuffer, faceIdx: number = 0) {
    this.supportedLanguages = new Set();
    this.supportedScripts = new Set();
    const { hbjs } = window;
    const blob = hbjs.createBlob(fontBlob);
    const face = hbjs.createFace(blob, faceIdx);
    this.hbFont = hbjs.createFont(face);
    this.otFont = parse(fontBlob);

    var gids = [...Array(this.otFont.glyphs.length).keys()];
    this.supportedCodepoints = new Set(
      gids.flatMap((g) => this.otFont.glyphs.get(g).unicodes)
    );
  }

  shape(s: string): HBGlyph[] {
    const { hbjs } = window;
    const buffer = hbjs.createBuffer();
    buffer.addText(s);
    buffer.guessSegmentProperties();
    hbjs.shape(this.hbFont, buffer);
    var json = buffer.json(this.hbFont) as HBGlyph[];
    buffer.destroy();
    return json;
  }

  hasCodepointsFor(s: string): boolean {
    return Array.from(s).every((c) =>
      this.supportedCodepoints.has(c.codePointAt(0))
    );
  }

  canShape(s: string): boolean {
    if (!this.hasCodepointsFor(s)) return false;
    var shaped = this.shape(s);
    if (shaped.some((g) => g.g == 0)) return false;
    for (var g of shaped) {
      var glyph = this.otFont.glyphs.get(g.g);
      if (glyph.unicode == 32) {
        continue;
      }
    }
    return true;
  }

  shapedWidth(s: string, pointSize: number): number {
    var units = this.shape(s).reduce((acc, val) => acc + val.ax, 0);
    return (units / this.otFont.unitsPerEm) * pointSize;
  }

  fits(s: string, pointSize: number, target: number, tolerance = 5): boolean {
    target = Math.trunc(target / tolerance);
    return target == Math.trunc(this.shapedWidth(s, pointSize) / tolerance);
  }
}
