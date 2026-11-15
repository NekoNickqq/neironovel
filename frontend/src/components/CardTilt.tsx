import { useRef, useState, ReactNode, HTMLAttributes } from 'react';

// Наследуемся от HTMLAttributes, чтобы принимать onClick и другие стандартные пропсы
interface CardTiltProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardTilt({ children, className = '', ...props }: CardTiltProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -5; 
    const rotateY = ((x - centerX) / centerX) * 5;

    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`,
      transition: 'transform 0.1s ease-out',
      zIndex: 10,
    });
  };

  const handleMouseLeave = () => {
    setStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.4s ease-out',
      zIndex: 1,
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={`relative ${className}`}
      {...props} // <-- ПРОКИДЫВАЕМ ВСЕ ОСТАЛЬНЫЕ ПРОПСЫ (включая onClick) СЮДА
    >
      {children}
    </div>
  );
}