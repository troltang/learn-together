
import React, { useRef, useEffect, useState } from 'react';
import { blobToBase64 } from '../utils/audioUtils';

// Declare global HanziWriter
declare const HanziWriter: any;

interface WritingPadProps {
  target: string;
  isChinese: boolean; // True for Tian Zi Ge, False for 4-line grid
  strokeGuideUrl?: string | null; // URL for SVG overlay (Chinese) or font (English)
  onGrade: (base64: string) => void;
  isGrading: boolean;
}

const WritingPad: React.FC<WritingPadProps> = ({ target, isChinese, strokeGuideUrl, onGrade, isGrading }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundWriterRef = useRef<HTMLDivElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const isDrawingRef = useRef(false);

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
        const rect = container.getBoundingClientRect();
        // Set actual canvas size to match display size for 1:1 mapping
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#2d2d2d'; 
            ctx.lineWidth = 6;
        }
    };

    // Initial resize
    resizeCanvas();
    
    // Optional: Resize observer if container changes size
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [isChinese, target]);

  // Initialize Background HanziWriter
  useEffect(() => {
    if (isChinese && backgroundWriterRef.current) {
        backgroundWriterRef.current.innerHTML = ''; // Clear previous
        const char = target.charAt(0);
        
        if (/[\u4e00-\u9fa5]/.test(char)) {
            try {
                const writer = HanziWriter.create(backgroundWriterRef.current, char, {
                    width: 280,
                    height: 280,
                    padding: 5,
                    showOutline: true,
                    strokeAnimationSpeed: 1,
                    delayBetweenLoops: 1000,
                    strokeColor: '#d1d5db', // Light gray for guide
                    radicalColor: '#d1d5db', 
                    outlineColor: '#e5e7eb',
                    onLoadCharDataSuccess: () => {
                        writer.loopCharacterAnimation();
                    }
                });
            } catch (e) {
                console.error("BG HanziWriter error", e);
            }
        }
    }
  }, [isChinese, target]);

  // Event Handlers
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const getCoordinates = (e: MouseEvent | TouchEvent) => {
          const rect = canvas.getBoundingClientRect();
          let clientX, clientY;
          
          if ('touches' in e) {
              clientX = e.touches[0].clientX;
              clientY = e.touches[0].clientY;
          } else {
              clientX = (e as MouseEvent).clientX;
              clientY = (e as MouseEvent).clientY;
          }
          
          return {
              x: clientX - rect.left,
              y: clientY - rect.top
          };
      };

      const startDrawing = (e: MouseEvent | TouchEvent) => {
          // Important: prevent scrolling on touch devices
          if (e.cancelable) e.preventDefault();
          
          isDrawingRef.current = true;
          setHasDrawn(true);
          
          const { x, y } = getCoordinates(e);
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.beginPath();
              ctx.moveTo(x, y);
          }
      };

      const draw = (e: MouseEvent | TouchEvent) => {
          if (!isDrawingRef.current) return;
          if (e.cancelable) e.preventDefault();

          const { x, y } = getCoordinates(e);
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.lineTo(x, y);
              ctx.stroke();
          }
      };

      const stopDrawing = (e: MouseEvent | TouchEvent) => {
          if (e.cancelable) e.preventDefault();
          isDrawingRef.current = false;
      };

      // Passive: false is crucial for touch events to allow preventDefault
      const opts = { passive: false };

      canvas.addEventListener('mousedown', startDrawing);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stopDrawing);
      canvas.addEventListener('mouseleave', stopDrawing);

      canvas.addEventListener('touchstart', startDrawing, opts);
      canvas.addEventListener('touchmove', draw, opts);
      canvas.addEventListener('touchend', stopDrawing, opts);

      return () => {
          canvas.removeEventListener('mousedown', startDrawing);
          canvas.removeEventListener('mousemove', draw);
          canvas.removeEventListener('mouseup', stopDrawing);
          canvas.removeEventListener('mouseleave', stopDrawing);

          canvas.removeEventListener('touchstart', startDrawing);
          canvas.removeEventListener('touchmove', draw);
          canvas.removeEventListener('touchend', stopDrawing);
      };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSubmit = async () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(async (blob) => {
      if (blob) {
        const base64 = await blobToBase64(blob);
        onGrade(base64);
      }
    }, 'image/png');
  };

  const getEnglishFontSize = () => {
    if (target.length <= 3) return '120px';
    if (target.length <= 6) return '80px';
    if (target.length <= 10) return '50px';
    return '36px';
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full touch-none">
      <div 
        ref={containerRef}
        className={`relative border-4 border-kid-blue rounded-xl overflow-hidden bg-white shadow-inner ${
          isChinese ? 'w-[280px] h-[280px]' : 'w-full max-w-lg h-[200px]'
        }`}
      >
        {/* Background Grid */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20 select-none">
            {isChinese ? (
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                 <rect x="0" y="0" width="100" height="100" fill="none" stroke="red" strokeWidth="1" />
                 <line x1="50" y1="0" x2="50" y2="100" stroke="red" strokeWidth="0.5" strokeDasharray="5,5" />
                 <line x1="0" y1="50" x2="100" y2="50" stroke="red" strokeWidth="0.5" strokeDasharray="5,5" />
                 <line x1="0" y1="0" x2="100" y2="100" stroke="red" strokeWidth="0.5" strokeDasharray="5,5" />
                 <line x1="100" y1="0" x2="0" y2="100" stroke="red" strokeWidth="0.5" strokeDasharray="5,5" />
              </svg>
            ) : (
              <div className="flex flex-col h-full justify-center space-y-10 p-4">
                 <div className="border-b-2 border-red-300"></div>
                 <div className="border-b border-blue-200 border-dashed"></div>
                 <div className="border-b border-blue-200 border-dashed"></div>
                 <div className="border-b-2 border-red-300"></div>
              </div>
            )}
        </div>

        {/* Reference Layer (Hanzi Animation or English Text) */}
        <div className="absolute inset-0 z-1 pointer-events-none flex items-center justify-center select-none">
           {isChinese ? (
             <div ref={backgroundWriterRef} className="opacity-60"></div>
           ) : (
             <span 
              className="font-mono text-gray-200 tracking-widest font-sans" 
              style={{ 
                fontFamily: '"Fredoka", sans-serif', 
                fontSize: getEnglishFontSize() 
              }}
             >
               {target}
             </span>
           )}
        </div>

        {/* Canvas - Force touch-action none */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-20 w-full h-full cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
        />
      </div>

      <div className="flex gap-4">
        <button 
          onClick={clearCanvas}
          className="px-4 py-2 rounded-full bg-gray-200 text-gray-600 font-bold hover:bg-gray-300 text-sm"
        >
          🗑️ 清除 (Clear)
        </button>
        <button 
          onClick={handleSubmit}
          disabled={!hasDrawn || isGrading}
          className="px-6 py-2 rounded-full bg-green-500 text-white font-bold hover:bg-green-600 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isGrading ? '📝 评分中...' : '✅ 评分 (Grade)'}
        </button>
      </div>
    </div>
  );
};

export default WritingPad;
