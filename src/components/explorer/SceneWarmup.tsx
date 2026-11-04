/**
 * Pre-compiles every material in the scene before the terrain is revealed.
 *
 * Mount it (inside the Canvas) once the terrain meshes are in the scene graph
 * but still hidden. `compileAsync` uses KHR_parallel_shader_compile where
 * available, so the loading overlay keeps animating instead of the first
 * visible frame freezing on shader compilation. Without that extension any
 * remaining link happens on the first revealed frame, which is still drawn
 * before the overlay disappears from screen.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/** Reveal anyway if compilation never reports completion (e.g. context loss). */
const WARMUP_TIMEOUT_MS = 10_000;

interface SceneWarmupProps {
  onReady: () => void;
}

export default function SceneWarmup({ onReady }: SceneWarmupProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onReady();
    };
    const timer = window.setTimeout(finish, WARMUP_TIMEOUT_MS);

    gl.compileAsync(scene, camera)
      .catch((error: unknown) => console.warn('[explorer] shader warm-up failed:', error))
      .finally(finish);

    return () => {
      done = true;
      window.clearTimeout(timer);
    };
  }, [gl, scene, camera, onReady]);

  return null;
}
