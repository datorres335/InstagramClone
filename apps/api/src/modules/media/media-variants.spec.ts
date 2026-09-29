import sharp from 'sharp';

import { generateMediaVariants } from './media-variants';

/** A synthetic, non-square test image — exercises the thumbnail's center-crop path. */
async function fakeUpload(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
}

describe('generateMediaVariants', () => {
  it('produces a square 150x150 thumbnail regardless of the input aspect ratio', async () => {
    const original = await fakeUpload(800, 400);

    const { thumbnail } = await generateMediaVariants(original);
    const metadata = await sharp(thumbnail).metadata();

    expect(metadata.width).toBe(150);
    expect(metadata.height).toBe(150);
    expect(metadata.format).toBe('webp');
  });

  it("caps the feed variant to 1080px on its longest side, keeping the original's aspect ratio", async () => {
    const original = await fakeUpload(2000, 1000);

    const { feed } = await generateMediaVariants(original);
    const metadata = await sharp(feed).metadata();

    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(540);
    expect(metadata.format).toBe('webp');
  });

  it('never upscales a feed variant smaller than the cap', async () => {
    const original = await fakeUpload(300, 200);

    const { feed } = await generateMediaVariants(original);
    const metadata = await sharp(feed).metadata();

    expect(metadata.width).toBe(300);
    expect(metadata.height).toBe(200);
  });

  it("reports the original image's width/height", async () => {
    const original = await fakeUpload(640, 480);

    const { width, height } = await generateMediaVariants(original);

    expect(width).toBe(640);
    expect(height).toBe(480);
  });

  it('produces a non-empty blurhash string', async () => {
    const original = await fakeUpload(400, 400);

    const { blurhash } = await generateMediaVariants(original);

    expect(typeof blurhash).toBe('string');
    expect(blurhash.length).toBeGreaterThan(0);
  });
});
