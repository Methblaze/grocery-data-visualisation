import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

/** A texture drawn with the 2D canvas, so signs use the page's own fonts and no font file is fetched */
export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const redraw = (fn = draw) => {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    fn(ctx, width, height);
    texture.needsUpdate = true;
  };
  redraw();
  return { texture, redraw };
}

/** The shop floor: pale tiles with fine grout lines */
export function floorTexture() {
  const { texture } = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#E7E8E3";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#EEEFEA";
    ctx.fillRect(4, 4, w / 2 - 8, h / 2 - 8);
    ctx.fillRect(w / 2 + 4, h / 2 + 4, w / 2 - 8, h / 2 - 8);
    ctx.strokeStyle = "#CDD0C9";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

export const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
