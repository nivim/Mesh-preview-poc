import * as THREE from 'three'

/**
 * Calculate the signed volume of a mesh using the divergence theorem.
 * This works for closed meshes and gives an approximation for non-closed ones.
 */
export function calculateMeshVolume(mesh) {
  const geometry = mesh.geometry
  if (!geometry) return 0

  // Make sure we have the world matrix
  mesh.updateWorldMatrix(true, false)
  const worldMatrix = mesh.matrixWorld

  const position = geometry.getAttribute('position')
  if (!position) return 0

  const index = geometry.getIndex()
  let volume = 0

  const v0 = new THREE.Vector3()
  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()

  if (index) {
    // Indexed geometry
    for (let i = 0; i < index.count; i += 3) {
      const i0 = index.getX(i)
      const i1 = index.getX(i + 1)
      const i2 = index.getX(i + 2)

      v0.set(position.getX(i0), position.getY(i0), position.getZ(i0))
      v1.set(position.getX(i1), position.getY(i1), position.getZ(i1))
      v2.set(position.getX(i2), position.getY(i2), position.getZ(i2))

      // Transform to world space
      v0.applyMatrix4(worldMatrix)
      v1.applyMatrix4(worldMatrix)
      v2.applyMatrix4(worldMatrix)

      // Signed volume of tetrahedron with origin
      volume += signedVolumeOfTriangle(v0, v1, v2)
    }
  } else {
    // Non-indexed geometry
    for (let i = 0; i < position.count; i += 3) {
      v0.set(position.getX(i), position.getY(i), position.getZ(i))
      v1.set(position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1))
      v2.set(position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2))

      // Transform to world space
      v0.applyMatrix4(worldMatrix)
      v1.applyMatrix4(worldMatrix)
      v2.applyMatrix4(worldMatrix)

      volume += signedVolumeOfTriangle(v0, v1, v2)
    }
  }

  return volume
}

/**
 * Calculate signed volume of tetrahedron formed by triangle and origin
 * Using the formula: V = (1/6) * |v0 · (v1 × v2)|
 */
function signedVolumeOfTriangle(v0, v1, v2) {
  const cross = new THREE.Vector3().crossVectors(v1, v2)
  return v0.dot(cross) / 6.0
}

/**
 * Calculate the bounding box of a model
 */
export function calculateBoundingBox(model) {
  const bbox = new THREE.Box3().setFromObject(model)
  return {
    min: bbox.min.clone(),
    max: bbox.max.clone(),
    size: bbox.getSize(new THREE.Vector3()),
    center: bbox.getCenter(new THREE.Vector3())
  }
}

/**
 * Count vertices and triangles in geometry
 */
export function countGeometryStats(geometry) {
  const position = geometry.getAttribute('position')
  if (!position) return { vertices: 0, triangles: 0 }

  const vertices = position.count
  const index = geometry.getIndex()
  const triangles = index ? index.count / 3 : vertices / 3

  return { vertices, triangles: Math.floor(triangles) }
}
