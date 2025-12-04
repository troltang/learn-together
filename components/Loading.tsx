import React from 'react';

const Loading: React.FC<{ text?: string }> = ({ text = "正在思考中..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative w-20 h-20">
        <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-kid-blue opacity-25 animate-ping"></div>
        <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-t-kid-pink border-r-kid-yellow border-b-kid-green border-l-kid-blue animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-2xl animate-bounce">
          🤔
        </div>
      </div>
      <p className="text-kid-purple font-medium text-lg animate-pulse">{text}</p>
    </div>
  );
};

export default Loading;