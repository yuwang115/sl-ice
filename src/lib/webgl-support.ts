/**
 * Feature detection for the 3D explorer.
 */

let cachedSupport: boolean | null = null;

/**
 * True when the browser can create a WebGL (2 or 1) context. The probe
 * context is released immediately; the result is cached for the session.
 */
export function isWebGLAvailable(): boolean {
  if (cachedSupport !== null) return cachedSupport;
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    cachedSupport = gl !== null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedSupport = false;
  }
  return cachedSupport;
}
