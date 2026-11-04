/**
 * Bedrock surface mesh — GMT Relief colored terrain.
 */

import { useExplorerStore } from '../../store/explorer-store';
import { useTerrainGeometry } from './useTerrainGeometry';

export default function BedrockMesh() {
  const bedArrays = useExplorerStore((s) => s.terrain?.bed);
  const geometry = useTerrainGeometry(bedArrays);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshStandardMaterial
        vertexColors
        roughness={0.92}
        metalness={0.02}
        flatShading={false}
      />
    </mesh>
  );
}
