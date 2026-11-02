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

/** The shop floor: 60 cm vinyl tiles, four by four per repeat, each a slightly different shade, with fine speckle and grout */
export function floorTexture() {
  const { texture } = canvasTexture(512, 512, (ctx, w) => {
    const t = w / 4;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = 0; x < 4; x++)
      for (let y = 0; y < 4; y++) {
        const v = 228 + Math.round(rand() * 10);
        ctx.fillStyle = `rgb(${v},${v + 1},${v - 4})`;
        ctx.fillRect(x * t, y * t, t, t);
      }
    for (let i = 0; i < 2600; i++) {
      const g = 150 + Math.round(rand() * 80);
      ctx.fillStyle = `rgba(${g},${g},${g - 6},${0.25 + rand() * 0.3})`;
      ctx.fillRect(rand() * w, rand() * w, 1.6, 1.6);
    }
    ctx.strokeStyle = "#C3C6BF";
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * t, 0);
      ctx.lineTo(i * t, w);
      ctx.moveTo(0, i * t);
      ctx.lineTo(w, i * t);
      ctx.stroke();
    }
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

export const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
