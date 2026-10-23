/** Локальные демо-сцены (public/demo) — работают без Unsplash и офлайн. */
export const DEMO_IMAGES = [
  '/demo/scene1.jpg',
  '/demo/scene2.jpg',
  '/demo/scene3.jpg',
  '/demo/scene4.jpg',
  '/demo/scene5.jpg',
  '/demo/scene6.jpg',
  '/demo/scene7.jpg',
  '/demo/scene8.jpg',
] as const;

export const DEMO_IMAGE_FALLBACK = DEMO_IMAGES[0];

export function getRandomDemoImage(): string {
  return DEMO_IMAGES[Math.floor(Math.random() * DEMO_IMAGES.length)];
}
