/**
 * Shared Haversine distance SQL for nearby-deals queries.
 * Uses parameterized placeholders $1=lat, $2=lng, $3=radius_km.
 * All callers must use d.status = 'active' (deals table has status, not is_active).
 */

const HAVERSINE_DISTANCE_METERS =
  '(6371 * acos(cos(radians($1)) * cos(radians(m.latitude)) * cos(radians(m.longitude) - radians($2)) + sin(radians($1)) * sin(radians(m.latitude)))) * 1000 as distance_meters';

const HAVERSINE_WITHIN_KM =
  '(6371 * acos(cos(radians($1)) * cos(radians(m.latitude)) * cos(radians(m.longitude) - radians($2)) + sin(radians($1)) * sin(radians(m.latitude)))) <= $3';

/** Use in WHERE for active, non-expired deals. */
const ACTIVE_DEALS_CONDITION =
  "d.status = 'active' AND (d.end_date IS NULL OR d.end_date > NOW())";

module.exports = {
  HAVERSINE_DISTANCE_METERS,
  HAVERSINE_WITHIN_KM,
  ACTIVE_DEALS_CONDITION,
};
