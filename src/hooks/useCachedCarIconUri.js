import { useEffect, useRef, useState } from 'react';
import { getCachedCarIconUri } from '../utils/carIconCache';

/** Resolves a remote car icon URL to a locally-cached file:// URI (or null
 * while pending / on failure) — see carIconCache.js for why this exists. */
export default function useCachedCarIconUri(remoteUrl) {
  const [localUri, setLocalUri] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLocalUri(null);
    if (!remoteUrl) return undefined;
    getCachedCarIconUri(remoteUrl).then((uri) => {
      if (mountedRef.current) setLocalUri(uri);
    });
    return () => {
      mountedRef.current = false;
    };
  }, [remoteUrl]);

  return localUri;
}
