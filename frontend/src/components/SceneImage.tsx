import { useEffect, useState } from 'react';
import { DEMO_IMAGE_FALLBACK } from '../demoImages';

type SceneImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export function SceneImage({ src, alt, className }: SceneImageProps) {
  const [resolved, setResolved] = useState(src);

  useEffect(() => {
    setResolved(src);
  }, [src]);

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (resolved !== DEMO_IMAGE_FALLBACK) {
          setResolved(DEMO_IMAGE_FALLBACK);
        }
      }}
    />
  );
}
