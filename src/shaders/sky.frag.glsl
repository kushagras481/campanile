// Preetham analytic daylight sky.
// Reference: Preetham, Shirley, Smits (1999) — "A Practical Analytic Model
// for Daylight". Single-scattering Rayleigh + Mie radiance toward the camera,
// attenuated by extinction along both the view ray and the sun ray. Output is
// linear radiance scaled to a tonemap-friendly range; the renderer's
// ACESFilmicToneMapping handles the final compression.

precision highp float;

uniform vec3 sunDirection;
uniform float turbidity;
uniform float rayleigh;
uniform float mieCoefficient;
uniform float mieDirectionalG;
uniform float exposure;
uniform float cloudCover;

varying vec3 vViewDir;

const float PI = 3.141592653589793;
const vec3 UP = vec3(0.0, 1.0, 0.0);

// Wavelength-dependent Rayleigh coefficients at sea level (RGB at 680/550/450 nm).
const vec3 BETA_R = vec3(5.804e-6, 1.3562e-5, 3.0265e-5);

// Mie wavelength dependence from Preetham appendix.
const vec3 MIE_K_LAMBDA = vec3(0.686, 0.678, 0.666);

// Effective atmospheric thicknesses (meters).
const float H_R = 8.4e3;
const float H_M = 1.25e3;

// Top-of-atmosphere solar irradiance (internal units; OUTPUT_SCALE brings the
// final radiance into ACES's sweet spot).
const float SUN_E0 = 1000.0;

// Soft horizon falloff for direct sun contribution. cutoffAngle is just past
// the geometric horizon so the sun fades smoothly as it sets rather than
// snapping off at y = 0.
const float SUN_FALLOFF = 1.5;
const float SUN_CUTOFF = 1.611;  // ~92.3° in radians

// Sun disc: 0.27° angular radius (real sun is ~0.265°). Tight smoothstep edge
// so the disc reads as a disc, not a glowing blob.
const float SUN_DISC_COS = 0.99996;
const float SUN_DISC_EDGE = 0.00002;

// Brings raw Preetham radiance (~10^3) into the [0, ~10] range ACES handles
// gracefully. Not a tonemap — just a unit conversion.
const float OUTPUT_SCALE = 0.04;

vec3 mieBeta(float T) {
  // Junge concentration scales linearly with turbidity. Constants from the
  // Preetham paper appendix.
  float c = (0.2 * T) * 1.0e-17;
  return 0.434 * c * PI * pow(2.0 * PI / vec3(680e-9, 550e-9, 450e-9), vec3(2.0)) * MIE_K_LAMBDA;
}

float phaseRayleigh(float cosT) {
  return (3.0 / (16.0 * PI)) * (1.0 + cosT * cosT);
}

float phaseMie(float cosT, float g) {
  // Henyey-Greenstein. g near 1 ⇒ strong forward peak (haze around sun).
  float g2 = g * g;
  return (1.0 / (4.0 * PI)) * ((1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cosT, 1.5));
}

float opticalDepth(float cosZ) {
  // Kasten-Young (1989) airmass — finite at the horizon, unlike sec(z).
  cosZ = max(cosZ, 0.0);
  float zDeg = degrees(acos(cosZ));
  return 1.0 / (cosZ + 0.15 * pow(max(0.001, 93.885 - zDeg), -1.253));
}

float sunIntensity(float cosSunZenith) {
  // Solar irradiance at the top of atmosphere, falling off as the sun
  // approaches the horizon and beyond. Independent of view direction.
  cosSunZenith = max(cosSunZenith, 0.0);
  float angle = acos(cosSunZenith);
  return SUN_E0 * max(0.0, 1.0 - exp(-((SUN_CUTOFF - angle) / SUN_FALLOFF)));
}

void main() {
  vec3 view = normalize(vViewDir);
  float cosViewZenith = view.y;
  float cosViewSun = dot(view, sunDirection);

  vec3 betaR = BETA_R * rayleigh;
  vec3 betaM = mieBeta(turbidity) * mieCoefficient;
  vec3 betaTotal = betaR * H_R + betaM * H_M;

  // Extinction along view ray (how much background survives the atmosphere).
  float pathView = opticalDepth(cosViewZenith);
  vec3 viewExt = exp(-betaTotal * pathView);

  // Extinction along sun ray. Crucial: this is what makes sunset red — the
  // long sun path strips blue and green, leaving the red end.
  float pathSun = opticalDepth(sunDirection.y);
  vec3 sunExt = exp(-betaTotal * pathSun);

  // Direct solar irradiance after horizon falloff but before atmospheric
  // extinction (extinction is applied per-channel below).
  float sunE = sunIntensity(sunDirection.y);

  // In-scattering: directional component of the single-scattering integral.
  // The phase functions weight which directions scatter light toward us;
  // (1 - viewExt) is the fraction of the column that scattered something.
  float pR = phaseRayleigh(cosViewSun);
  float pM = phaseMie(cosViewSun, mieDirectionalG);
  vec3 scatterRatio = (betaR * pR + betaM * pM) / max(betaR + betaM, vec3(1e-12));
  vec3 inScatter = sunE * sunExt * scatterRatio * (vec3(1.0) - viewExt);

  // Direct sun disc: full sun irradiance through atmospheric extinction,
  // gated by the angular disc mask.
  float disc = smoothstep(SUN_DISC_COS, SUN_DISC_COS + SUN_DISC_EDGE, cosViewSun);
  vec3 sunDisc = vec3(disc) * sunE * sunExt * 8.0;

  // Tiny ambient floor so the very bottom of the dome at deep night isn't
  // a perfect zero (helps fog blend in cleanly later).
  vec3 nightFloor = vec3(0.0, 0.0003, 0.00075);

  // Cloud cover affects the scattering result two ways:
  //   1. cloudAbsorb attenuates in-scattering (clouds occlude the column of
  //      sun-scattered atmosphere above us). Without this, the Mie forward
  //      peak persists as a giant near-sun blob at full cover.
  //   2. The sun disc fades behind the layer at the addition site (no
  //      double-application of the factor).
  float cloudAbsorb = 1.0 - cloudCover * 0.9;
  vec3 color = (inScatter * cloudAbsorb + sunDisc * (1.0 - cloudCover)) * OUTPUT_SCALE + nightFloor;
  color *= exposure;

  // Cloud bottom diffuse — uniform grey driven by sun HEIGHT, not view
  // direction. This replaces the underlying horizon-bright/zenith-dim
  // gradient with a flat overcast layer and provides a brightness floor so
  // pre-dawn overcast isn't pitch black. No procedural noise — flat only.
  if (cloudCover > 0.0) {
    float sunUp = sunDirection.y;
    float lit = smoothstep(-0.15, 0.25, sunUp);
    float cloudBright = mix(0.05, 0.7, lit);
    // Warm-bias only near the horizon for sunrise/sunset; neutral above.
    vec3 cloudTint = mix(vec3(1.0, 0.92, 0.78), vec3(1.0), smoothstep(0.0, 0.2, sunUp));
    // Soft view-dependent brightening near the sun (cloud is optically
    // thinner near the sun direction). Falls off fast — no disc.
    float halo = pow(max(0.0, cosViewSun), 4.0) * 0.3 * lit;
    vec3 cloudColor = (vec3(cloudBright) * cloudTint + vec3(halo)) * exposure;
    color = mix(color, cloudColor, cloudCover);
  }

  gl_FragColor = vec4(color, 1.0);
}
