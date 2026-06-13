// Headless SVG→PNG backend (Node-only) for the export CLI. Implements the same
// Rasterizer interface the browser's CanvasRasterizer does, but rendered with
// resvg-js instead of a <canvas>. Imported ONLY by scripts/export.ts, never by
// the browser bundle — it pulls native/Node deps (@resvg/resvg-js, pngjs).
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';

import type { PngBytes, RasterCell, Rasterizer, SheetDesc } from './exporter';

/**
 * Reposition one cell into the combined sheet with a group transform: strip the
 * cell's <svg> wrapper, then translate to (dx,dy) and scale its design units
 * (the cell's viewBox) to the target dw×dh pixel box. We deliberately avoid a
 * nested <svg> here — resvg panics computing the bounding box of some nested
 * viewports (e.g. the quiet-carpet floor), whereas a plain group + transform
 * renders identically to the cell rendered on its own.
 */
function placeCell(cell: RasterCell): string {
  const vb = cell.svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const vbW = vb ? Number(vb[1]) : cell.dw;
  const vbH = vb ? Number(vb[2]) : cell.dh;
  const inner = cell.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<g transform="translate(${cell.dx} ${cell.dy}) scale(${cell.dw / vbW} ${cell.dh / vbH})">${inner}</g>`;
}

function combinedSvg(desc: SheetDesc): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${desc.width}" height="${desc.height}" ` +
    `viewBox="0 0 ${desc.width} ${desc.height}">${desc.cells.map(placeCell).join('')}</svg>`
  );
}

function renderToWidth(svg: string, width: number) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.max(1, Math.round(width)) },
    background: 'rgba(0,0,0,0)',
  }).render();
}

/** Nearest-neighbor upscale a small RGBA buffer to width×height, encode as PNG. */
function pixelateUpscale(
  pixels: Buffer | Uint8Array,
  sw: number,
  sh: number,
  width: number,
  height: number,
): Buffer {
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / width));
      const si = (sy * sw + sx) * 4;
      const di = (y * width + x) * 4;
      out.data[di] = pixels[si];
      out.data[di + 1] = pixels[si + 1];
      out.data[di + 2] = pixels[si + 2];
      out.data[di + 3] = pixels[si + 3];
    }
  }
  return PNG.sync.write(out);
}

class ResvgRasterizer implements Rasterizer {
  async rasterizeSheet(desc: SheetDesc): Promise<PngBytes> {
    const svg = combinedSvg(desc);
    if (desc.pixelScale <= 1) {
      return renderToWidth(svg, desc.width).asPng();
    }
    // Pixelate: render small, then nearest-neighbor upscale (matches the canvas
    // backend's intent — sheet-wide here vs per-cell there; negligible at edges).
    const small = renderToWidth(svg, desc.width / desc.pixelScale);
    return pixelateUpscale(small.pixels, small.width, small.height, desc.width, desc.height);
  }
}

export function createResvgRasterizer(): Rasterizer {
  return new ResvgRasterizer();
}
