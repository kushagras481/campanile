import * as THREE from 'three';

// Berkeley, CA. Hardcoded for now — the report only cares about one location.
const LAT = 37.8719;
const LON = -122.2585;

const LAT_RAD = THREE.MathUtils.degToRad(LAT);

// Returns a unit vector pointing FROM the ground TO the sun, in a Y-up world
// where +X = east, +Z = south. Inputs are local civil time in hours [0..24]
// (no equation-of-time correction) and day-of-year [1..365].
export function getSunDirection(dayOfYear, timeOfDay) {
  // Declination: tilt of the Earth-Sun axis relative to the equator, in radians.
  const decl = THREE.MathUtils.degToRad(
    23.45 * Math.sin(THREE.MathUtils.degToRad((360 * (284 + dayOfYear)) / 365))
  );

  // Hour angle: 0 at solar noon, +15°/hr afternoon, −15°/hr morning.
  const hour = THREE.MathUtils.degToRad(15 * (timeOfDay - 12));

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

  const summerNoon = getSunDirection(172, 12);
  console.log(`[solar] summer solstice noon: alt=${altDeg(summerNoon).toFixed(2)}°, dir=${fmt(summerNoon)}`);
  console.assert(
    Math.abs(altDeg(summerNoon) - 75) < 2,
    `summer solstice noon altitude expected ~75°, got ${altDeg(summerNoon).toFixed(2)}°`
  );

  const winterNoon = getSunDirection(355, 12);
  console.log(`[solar] winter solstice noon: alt=${altDeg(winterNoon).toFixed(2)}°, dir=${fmt(winterNoon)}`);
  console.assert(
    Math.abs(altDeg(winterNoon) - 28) < 2,
    `winter solstice noon altitude expected ~28°, got ${altDeg(winterNoon).toFixed(2)}°`
  );

  const equinoxDawn = getSunDirection(80, 6);
  console.log(`[solar] equinox 6am: alt=${altDeg(equinoxDawn).toFixed(2)}°, dir=${fmt(equinoxDawn)}`);
  console.assert(
    Math.abs(altDeg(equinoxDawn)) < 3,
    `equinox 6am altitude expected near 0°, got ${altDeg(equinoxDawn).toFixed(2)}°`
  );
  console.assert(
    equinoxDawn.x > 0.9,
    `equinox 6am should point east (x > 0.9), got x=${equinoxDawn.x.toFixed(3)}`
  );
}
