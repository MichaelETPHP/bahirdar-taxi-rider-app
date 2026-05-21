import { normalizeAvatarUrl } from './avatarUrl';

export function normalizeDriverCarIconUrl(rawUrl) {
  return normalizeAvatarUrl(rawUrl);
}

function normalizeCategoryKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export function resolveCategoryIconFromCategories(rawPayload, categories = []) {
  if (!Array.isArray(categories) || categories.length === 0) return null;

  const raw = rawPayload?.driver ?? rawPayload?.data ?? rawPayload ?? {};
  const directKeys = [
    raw?.vehicle_category_id,
    raw?.vehicleCategoryId,
    raw?.category_id,
    raw?.categoryId,
    raw?.driver_category_id,
    raw?.driverCategoryId,
    raw?.vehicle?.category_id,
    raw?.vehicle?.categoryId,
    raw?.vehicle?.category?.id,
    raw?.category?.id,
    raw?.driver_category?.id,
    raw?.driverCategory?.id,
    raw?.vehicle_category,
    raw?.vehicleCategory,
    raw?.vehicle_type,
    raw?.vehicleType,
    raw?.car_type,
    raw?.carType,
    raw?.vehicle?.type,
    raw?.vehicle?.model,
    raw?.vehicle_model,
    raw?.vehicle?.category?.name,
    raw?.category?.name,
    raw?.driver_category?.name,
    raw?.driverCategory?.name,
  ];

  const normalizedKeys = directKeys
    .map(normalizeCategoryKey)
    .filter(Boolean);

  const match = categories.find((category) => {
    const categoryKeys = [
      category?.id,
      category?.vehicle_category_id,
      category?.name,
      category?.label,
      category?.slug,
    ]
      .map(normalizeCategoryKey)
      .filter(Boolean);

    return normalizedKeys.some((key) => categoryKeys.includes(key));
  });

  return normalizeDriverCarIconUrl(
    match?.car_icon_url ??
    match?.carIconUrl ??
    match?.image_url ??
    match?.imageUrl ??
    null
  );
}

export function extractDriverMarkerMeta(rawPayload) {
  const raw = rawPayload?.driver ?? rawPayload?.data ?? rawPayload ?? {};

  const fullName =
    raw?.full_name ??
    raw?.fullName ??
    raw?.name ??
    raw?.driver_name ??
    raw?.driverName ??
    raw?.user?.full_name ??
    raw?.user?.fullName ??
    raw?.user?.name ??
    '';

  const carLabel =
    raw?.vehicle_category ??
    raw?.vehicleType ??
    raw?.car_type ??
    raw?.carType ??
    raw?.vehicle?.type ??
    raw?.vehicle?.model ??
    raw?.vehicle_model ??
    raw?.vehicle?.category?.name ??
    raw?.category?.name ??
    '';

  const rawCarIconUrl =
    raw?.car_icon_url ??
    raw?.carIconUrl ??
    raw?.vehicle?.car_icon_url ??
    raw?.vehicle?.carIconUrl ??
    raw?.vehicle?.category?.car_icon_url ??
    raw?.vehicle?.category?.carIconUrl ??
    raw?.vehicle_category?.car_icon_url ??
    raw?.vehicle_category?.carIconUrl ??
    raw?.category?.car_icon_url ??
    raw?.category?.carIconUrl ??
    raw?.driver_category?.car_icon_url ??
    raw?.driver_category?.carIconUrl ??
    raw?.driverCategory?.car_icon_url ??
    raw?.driverCategory?.carIconUrl ??
    null;

  return {
    fullName: String(fullName).trim(),
    carLabel: String(carLabel).trim(),
    carIconUrl: normalizeDriverCarIconUrl(rawCarIconUrl),
  };
}
