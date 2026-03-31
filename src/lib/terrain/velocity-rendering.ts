import * as THREE from 'three';
import type { VelocityMeshArrays } from './mesh-builder';
import {
  VELOCITY_KNEE,
  VELOCITY_MAX,
  VELOCITY_SURFACE_OPACITY,
} from './constants';

function getVelocityTextureType(
  renderer: THREE.WebGLRenderer,
  nx: number,
  ny: number,
): THREE.TextureDataType | null {
  const maxDimension = Math.max(0, nx, ny);
  const maxTextureSize = Number(renderer.capabilities?.maxTextureSize || 0);

  if (maxDimension > 0 && maxTextureSize > 0 && maxDimension > maxTextureSize) {
    return null;
  }

  if (renderer.capabilities.isWebGL2 || renderer.extensions.get('OES_texture_float')) {
    return THREE.FloatType;
  }

  if (renderer.capabilities.isWebGL2 || renderer.extensions.get('OES_texture_half_float')) {
    return THREE.HalfFloatType;
  }

  return null;
}

export function createVelocityDataTexture(
  velocityArrays: VelocityMeshArrays,
  nx: number,
  ny: number,
  renderer: THREE.WebGLRenderer,
): THREE.DataTexture | null {
  const textureType = getVelocityTextureType(renderer, nx, ny);
  if (!textureType) return null;

  const cellCount = nx * ny;
  if (
    velocityArrays.velocityX.length !== cellCount ||
    velocityArrays.velocityY.length !== cellCount ||
    velocityArrays.velocityValid.length !== cellCount
  ) {
    return null;
  }

  let textureData: Float32Array | Uint16Array;

  if (textureType === THREE.FloatType) {
    textureData = new Float32Array(cellCount * 4);
    for (let i = 0; i < cellCount; i += 1) {
      const base = i * 4;
      const isValid = velocityArrays.velocityValid[i] > 0;
      textureData[base] = isValid ? velocityArrays.velocityX[i] : 0;
      textureData[base + 1] = isValid ? velocityArrays.velocityY[i] : 0;
      textureData[base + 2] = isValid ? 1 : 0;
      textureData[base + 3] = 0;
    }
  } else {
    const toHalfFloat = THREE.DataUtils?.toHalfFloat;
    if (typeof toHalfFloat !== 'function') return null;

    textureData = new Uint16Array(cellCount * 4);
    for (let i = 0; i < cellCount; i += 1) {
      const base = i * 4;
      const isValid = velocityArrays.velocityValid[i] > 0;
      textureData[base] = toHalfFloat(isValid ? velocityArrays.velocityX[i] : 0);
      textureData[base + 1] = toHalfFloat(isValid ? velocityArrays.velocityY[i] : 0);
      textureData[base + 2] = toHalfFloat(isValid ? 1 : 0);
      textureData[base + 3] = toHalfFloat(0);
    }
  }

  const texture = new THREE.DataTexture(textureData, nx, ny, THREE.RGBAFormat, textureType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.unpackAlignment = 1;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createVelocitySurfaceShaderMaterial(
  texture: THREE.DataTexture,
  nx: number,
  ny: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL1,
    uniforms: {
      uVelocityTex: { value: texture },
      uVelocityTexSize: { value: new THREE.Vector2(nx, ny) },
      uVelocityMax: { value: VELOCITY_MAX },
      uVelocityKnee: { value: VELOCITY_KNEE },
      uOpacity: { value: VELOCITY_SURFACE_OPACITY },
    },
    vertexShader: `
      precision highp float;

      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform sampler2D uVelocityTex;
      uniform vec2 uVelocityTexSize;
      uniform float uVelocityMax;
      uniform float uVelocityKnee;
      uniform float uOpacity;

      varying vec2 vUv;

      vec3 velocityPalette(float t) {
        const vec3 c0 = vec3(0.06, 0.20, 0.50);
        const vec3 c1 = vec3(0.08, 0.62, 0.86);
        const vec3 c2 = vec3(0.95, 0.90, 0.27);
        const vec3 c3 = vec3(0.90, 0.20, 0.12);

        float clamped = clamp(t, 0.0, 1.0);
        if (clamped <= 0.35) {
          return mix(c0, c1, clamped / 0.35);
        }
        if (clamped <= 0.65) {
          return mix(c1, c2, (clamped - 0.35) / 0.30);
        }
        return mix(c2, c3, (clamped - 0.65) / 0.35);
      }

      float velocityScaleT(float speed) {
        float clamped = clamp(speed, 0.0, uVelocityMax);
        return clamp(
          log(1.0 + clamped / uVelocityKnee) / log(1.0 + uVelocityMax / uVelocityKnee),
          0.0,
          1.0
        );
      }

      void main() {
        vec2 texSize = max(uVelocityTexSize, vec2(1.0));
        vec2 texelPos = clamp(vUv, vec2(0.0), vec2(1.0)) * (texSize - 1.0);
        vec2 maxBase = max(texSize - 2.0, vec2(0.0));
        vec2 base = clamp(floor(texelPos), vec2(0.0), maxBase);
        vec2 frac = clamp(texelPos - base, vec2(0.0), vec2(1.0));
        vec2 texelSize = 1.0 / texSize;

        vec4 s00 = texture2D(uVelocityTex, (base + vec2(0.5, 0.5)) * texelSize);
        vec4 s10 = texture2D(uVelocityTex, (base + vec2(1.5, 0.5)) * texelSize);
        vec4 s01 = texture2D(uVelocityTex, (base + vec2(0.5, 1.5)) * texelSize);
        vec4 s11 = texture2D(uVelocityTex, (base + vec2(1.5, 1.5)) * texelSize);

        if (s00.b < 0.5 || s10.b < 0.5 || s01.b < 0.5 || s11.b < 0.5) {
          discard;
        }

        vec2 v0 = mix(s00.rg, s10.rg, frac.x);
        vec2 v1 = mix(s01.rg, s11.rg, frac.x);
        vec2 velocity = mix(v0, v1, frac.y);
        float speed = length(velocity);
        vec3 color = velocityPalette(velocityScaleT(speed));

        gl_FragColor = vec4(color, uOpacity);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}
