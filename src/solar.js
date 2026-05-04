import * as THREE from 'three';

// Berkeley, CA. Hardcoded for now — the report only cares about one location.
const LAT = 37.8719;
const LON = -122.2585;

const LAT_RAD = THREE.MathUtils.degToRad(LAT);

// Pacific Time Zone standard meridian (120°W). Berkeley sits 2.26° west of it,
// so the sun crosses Berkeley ~9 min after the meridian's solar noon. Without
// this correction, "5 pm" at Berkeley reads as if it were solar 5 pm — i.e.
// pinned ~50 minutes too late and rendered as a much lower sun.
const PST_MERIDIAN = -120;
const LON_OFFSET_HR = ((LON - PST_MERIDIAN) * 4) / 60; // ≈ -0.151 hr (-9 min)

// US daylight-saving: 2nd Sunday of March → 1st Sunday of November. Day-of-year
// approximation is within ~2 days of the real transitions, which is fine for
// solar-position purposes (the sun moves ~0.4°/day in declination, far below
// the visual difference DST itself causes).
function isDST(dayOfYear) {
  return dayOfYear >= 70 && dayOfYear <= 308;
}

// Returns a unit vector pointing FROM the ground TO the sun, in a Y-up world
// where +X = east, +Z = south. Inputs are Berkeley local clock time in hours
// [0..24] (PDT during DST, PST otherwise) and day-of-year [1..365]. Equation
// of time (±15 min seasonal drift) is still ignored.
export function getSunDirection(dayOfYear, timeOfDay) {
  // Clock time → solar time via DST + longitude correction.
  const standardTime = isDST(dayOfYear) ? timeOfDay - 1 : timeOfDay;
  const solarTime = standardTime + LON_OFFSET_HR;

  // Declination: tilt of the Earth-Sun axis relative to the equator, in radians.
  const decl = THREE.MathUtils.degToRad(
    23.45 * Math.sin(THREE.MathUtils.degToRad((360 * (284 + dayOfYear)) / 365))
  );

  // Hour angle: 0 at solar noon, +15°/hr afternoon, −15°/hr morning.
  const hour = THREE.MathUtils.degToRad(15 * (solarTime - 12));

  const sinLat = Math.sin(LAT_RAD);
  const cosLat = Math.cos(LAT_RAD);
  const sinDecl = Math.sin(decl);
  const cosDecl = Math.cos(decl);
  const sinHour = Math.sin(hour);
  const cosHour = Math.cos(hour);

  // Standard altitude / azimuth equations. Azimuth is measured from south,
  // positive toward west (so morning sun gives a negative azimuth, i.e. east).
  const sinAlt = sinLat * sinDecl + cosLat * cosDecl * cosHour;
  const altitude = Math.asin(THREE.MathUtils.clamp(sinAlt, -1, 1));
  const azimuth = Math.atan2(
    sinHour,
    cosHour * sinLat - Math.tan(decl) * cosLat
  );

  const cosAlt = Math.cos(altitude);

  // East-North-Up with Y up: x = east, z = south. Azimuth-from-south positive
  // west means a positive azimuth points west (−x), so we flip the x sign.
  return new THREE.Vector3(
    -cosAlt * Math.sin(azimuth),
    Math.sin(altitude),
    cosAlt * Math.cos(azimuth)
  );
}

if (import.meta.env.DEV) {
  const fmt = (v) => `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;
  const altDeg = (v) => THREE.MathUtils.radToDeg(Math.asin(v.y));

  // Solar noon at Berkeley = 12:09 PST = 13:09 PDT. Inputs below are clock time.
  const summerNoon = getSunDirection(172, 13.151);
  console.log(`[solar] summer solstice solar noon (13:09 PDT): alt=${altDeg(summerNoon).toFixed(2)}°, dir=${fmt(summerNoon)}`);
  console.assert(
    Math.abs(altDeg(summerNoon) - 75.6) < 1,
    `summer solstice noon altitude expected ~75.6°, got ${altDeg(summerNoon).toFixed(2)}°`
  );

  const winterNoon = getSunDirection(355, 12.151);
  console.log(`[solar] winter solstice solar noon (12:09 PST): alt=${altDeg(winterNoon).toFixed(2)}°, dir=${fmt(winterNoon)}`);
  console.assert(
    Math.abs(altDeg(winterNoon) - 28.7) < 1,
    `winter solstice noon altitude expected ~28.7°, got ${altDeg(winterNoon).toFixed(2)}°`
  );

  // Vernal equinox sunrise: solar 06:00 = standard 06:09 = clock 07:09 PDT.
  const equinoxDawn = getSunDirection(80, 7.151);
  console.log(`[solar] equinox sunrise (7:09 PDT): alt=${altDeg(equinoxDawn).toFixed(2)}°, dir=${fmt(equinoxDawn)}`);
  console.assert(
    Math.abs(altDeg(equinoxDawn)) < 3,
    `equinox sunrise altitude expected near 0°, got ${altDeg(equinoxDawn).toFixed(2)}°`
  );
  console.assert(
    equinoxDawn.x > 0.9,
    `equinox sunrise should point east (x > 0.9), got x=${equinoxDawn.x.toFixed(3)}`
  );

  // The original concern: May 3 (day 123) at 17:29 PDT should be afternoon
  // (≈31°), not the ~18° the pre-correction formula was returning.
  const may3pm = getSunDirection(123, 17.29);
  console.log(`[solar] May 3 17:29 PDT: alt=${altDeg(may3pm).toFixed(2)}°, dir=${fmt(may3pm)}`);
}
