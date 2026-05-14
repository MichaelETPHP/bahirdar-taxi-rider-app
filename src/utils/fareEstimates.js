function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export function buildFareEstimateLookup(fareEstimates = []) {
  const lookup = new Map();

  fareEstimates.forEach((estimate, index) => {
    if (!estimate) return;

    const fareValue = estimate.confirmed_fare ?? estimate.estimated_fare_etb ?? null;
    const fareData = {
      fare: fareValue,
      breakdown: estimate.fare_breakdown ?? null,
      eta: estimate.arrival_eta_min ?? null,
      raw: estimate,
    };

    const keys = [
      estimate.vehicle_category_id,
      estimate.vehicle_category,
      estimate.category_id,
      estimate.name,
      estimate.label,
    ];

    keys.forEach((key) => {
      const normalized = normalizeKey(key);
      if (normalized) {
        lookup.set(normalized, fareData);
      }
    });

    lookup.set(`index:${index}`, fareData);

    const displayOrder = estimate.display_order ?? estimate.displayOrder;
    if (displayOrder != null) {
      lookup.set(`order:${displayOrder}`, fareData);
    }
  });

  return lookup;
}

export function getFareEstimateForCategory(fareEstimates, category, index = null) {
  const lookup = buildFareEstimateLookup(fareEstimates);

  const directKeys = [
    category?.id,
    category?.vehicle_category_id,
    category?.name,
    category?.label,
  ];

  for (const key of directKeys) {
    const normalized = normalizeKey(key);
    if (normalized && lookup.has(normalized)) {
      return lookup.get(normalized);
    }
  }

  if (index != null && lookup.has(`index:${index}`)) {
    return lookup.get(`index:${index}`);
  }

  const displayOrder = category?.display_order ?? category?.displayOrder;
  if (displayOrder != null && lookup.has(`order:${displayOrder}`)) {
    return lookup.get(`order:${displayOrder}`);
  }

  return null;
}
