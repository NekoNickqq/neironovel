// frontend/src/utils.ts
export function getDisplayName(name: string): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  let count = Math.min(4, words.length);
  let display = words.slice(0, count).join(' ');
  let truncated = count < words.length;

  while (display.length > 40 && count > 1) {
    count--;
    display = words.slice(0, count).join(' ');
    truncated = true;
  }

  return truncated ? `${display}...` : display;
}