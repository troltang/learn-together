import React, { useEffect, useState } from 'react';

const Celebration: React.FC<{ trigger: number }> = ({ trigger }) => {
  const [particles, setParticles] = useState<{id: number, left: string, bg: string, delay: string}[]>([]);

  useEffect(() => {
    if (trigger === 0) return;

    const colors = ['#F72585', '#4CC9F0', '#FDC500', '#7209B7', '#06D6A0'];
    const newParticles = Array.from({ length: 50 }).map((_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100 + 'vw',
      bg: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5 + 's'
    }));

    setParticles(newParticles);

    const timer = setTimeout(() => {
      setParticles([]);
    }, 3000);

    return () => clearTimeout(timer);
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="confetti"
          style={{
            left: p.left,
            backgroundColor: p.bg,
            animationDelay: p.delay,
            borderRadius: Math.random() > 0.5 ? '50%' : '0'
          }}
        />
      ))}
    </div>
  );
};

export default Celebration;