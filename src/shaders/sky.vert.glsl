// Preetham sky vertex stage. We render onto a giant inverted sphere centered
// at the world origin, so the model-space position (normalized in the fragment
// stage) doubles as the view direction. The sphere is large enough relative to
// the camera's orbit radius that ignoring the camera offset is invisible.

varying vec3 vViewDir;

void main() {
  vViewDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
