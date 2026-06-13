import type { StyleSheet } from '../core/types';

function pixelScale(style: StyleSheet): number {
  const value = style.render.pixelScale ?? 1;
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(8, Math.round(value)));
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function setPreviewSvg(container: HTMLElement, svg: string, style: StyleSheet, displayWidth: number): void {
  const scale = pixelScale(style);
  if (scale <= 1) {
    container.innerHTML = svg;
    return;
  }

  const img = document.createElement('img');
  img.src = svgDataUrl(svg);
  img.alt = '';
  img.width = Math.max(1, Math.round(displayWidth / scale));
  img.height = img.width;
  img.style.width = `${displayWidth}px`;
  img.style.height = `${displayWidth}px`;
  img.style.imageRendering = 'pixelated';
  container.replaceChildren(img);
}

export function setScenePreviewSvg(
  container: HTMLElement,
  svg: string,
  style: StyleSheet,
  displayWidth: number,
  displayHeight: number,
  fillContainer = false,
): void {
  const scale = pixelScale(style);
  if (scale <= 1) {
    container.innerHTML = svg;
    return;
  }

  const img = document.createElement('img');
  img.src = svgDataUrl(svg);
  img.alt = '';
  img.width = Math.max(1, Math.round(displayWidth / scale));
  img.height = Math.max(1, Math.round(displayHeight / scale));
  img.style.width = fillContainer ? '100%' : `${displayWidth}px`;
  img.style.height = fillContainer ? '100%' : `${displayHeight}px`;
  img.style.imageRendering = 'pixelated';
  container.replaceChildren(img);
}
