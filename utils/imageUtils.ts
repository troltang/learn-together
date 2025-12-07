
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve();
    img.onerror = () => {
        console.warn(`Failed to preload image: ${url}`);
        // Resolve anyway to not block the flow
        resolve();
    };
  });
};
