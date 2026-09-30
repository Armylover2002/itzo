import { useState, useEffect, useCallback } from 'react';

/**
 * Cycles through a list of hero video URLs: advances to the next clip when the
 * current one ends, and loops back to the first after the last. Resets to the
 * first video whenever the playlist itself changes (e.g. admin updates it).
 */
export function useVideoPlaylist(videoUrls = []) {
  const [index, setIndex] = useState(0);
  const count = videoUrls.length;
  const playlistKey = videoUrls.join('|');

  useEffect(() => {
    setIndex(0);
  }, [playlistKey]);

  const handleEnded = useCallback(() => {
    setIndex((prev) => (count ? (prev + 1) % count : 0));
  }, [count]);

  return {
    currentUrl: count ? videoUrls[Math.min(index, count - 1)] : '',
    currentIndex: index,
    handleEnded,
  };
}
