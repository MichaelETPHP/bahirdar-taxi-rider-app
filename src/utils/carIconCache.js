import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const CACHE_DIR = `${FileSystem.cacheDirectory}driver-car-icons/`;

// Source car icons come from driver/category uploads at whatever resolution
// they were saved at (often 300px+). react-native-maps' Marker `image` prop
// (used on both platforms now — see DriverMarker.js) hands the bitmap
// straight to the native marker at its raw pixel size — there is no style/
// width/height control like a child <Image> gets, so an un-resized source
// renders huge on the map. Resize once on download and cache the resized
// file at the actual on-map target size.
const ICON_TARGET_WIDTH = 60;

function localFileNameFor(remoteUrl) {
  try {
    const clean = String(remoteUrl).split('?')[0];
    const name = clean.substring(clean.lastIndexOf('/') + 1);
    return name || `${Date.now()}.img`;
  } catch {
    return `${Date.now()}.img`;
  }
}

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

// Same category icon is shared by every driver of that vehicle type, so
// concurrent DriverMarker mounts commonly request the exact same URL —
// dedupe in-flight downloads instead of fetching it once per marker.
const inFlight = new Map();

/**
 * Resolves a remote car icon URL to a local file:// URI, downloading and
 * caching it on first use. react-native-maps' Marker `image` prop only
 * accepts local files (unlike a plain <Image> child, which streams from
 * the network directly) — this is what lets the car icon render through
 * that prop on iOS, where custom Marker children silently fail to render
 * under this project's react-native-maps + New Architecture setup.
 */
export async function getCachedCarIconUri(remoteUrl) {
  if (!remoteUrl) return null;

  const fileName   = localFileNameFor(remoteUrl);
  const rawUri      = `${CACHE_DIR}raw-${fileName}`;
  const resizedName = fileName.replace(/\.[a-z0-9]+$/i, '') || fileName;
  // Width baked into the cache filename so changing ICON_TARGET_WIDTH (like
  // just now, 110 -> 60) naturally busts old cached files instead of every
  // device silently keeping whatever oversized icon it already downloaded.
  const resizedUri  = `${CACHE_DIR}${resizedName}-w${ICON_TARGET_WIDTH}.png`;

  const existing = await FileSystem.getInfoAsync(resizedUri).catch(() => null);
  if (existing?.exists) return resizedUri;

  if (inFlight.has(resizedUri)) return inFlight.get(resizedUri);

  const task = (async () => {
    try {
      await ensureCacheDir();
      await FileSystem.downloadAsync(remoteUrl, rawUri);
      const manipulated = await manipulateAsync(
        rawUri,
        [{ resize: { width: ICON_TARGET_WIDTH } }],
        { compress: 1, format: SaveFormat.PNG }
      );
      await FileSystem.copyAsync({ from: manipulated.uri, to: resizedUri });
      FileSystem.deleteAsync(rawUri, { idempotent: true }).catch(() => {});
      const info = await FileSystem.getInfoAsync(resizedUri).catch(() => null);
      return info?.exists ? resizedUri : manipulated.uri;
    } catch {
      // Resize failed for some reason (corrupt download, unsupported format) —
      // fall back to the raw file rather than showing no icon at all.
      const rawInfo = await FileSystem.getInfoAsync(rawUri).catch(() => null);
      return rawInfo?.exists ? rawUri : null;
    } finally {
      inFlight.delete(resizedUri);
    }
  })();

  inFlight.set(resizedUri, task);
  return task;
}
