import { useState } from 'react';

type SceneImageProps = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Показывает сгенерированное изображение. Заглушек больше нет:
 * если картинка не загрузилась — показываем текстовое сообщение об ошибке.
 */
export function SceneImage({ src, alt, className }: SceneImageProps) {
  const [failed, setFailed] = useState(false);

  // Сбрасываем ошибку при смене источника (например, после перегенерации)
  const [lastSrc, setLastSrc] = useState(src);
  if (lastSrc !== src) {
    setLastSrc(src);
    setFailed(false);
  }

  if (failed) {
    return (
      <div
        className={`grid place-items-center rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-center text-xs text-red-300 ${className ?? ''}`}
      >
        Не удалось отобразить изображение
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
