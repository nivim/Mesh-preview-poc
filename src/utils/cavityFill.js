import * as THREE from 'three'

/**
 * Creates a cavity fill illusion by cloning the model and rendering it with
 * BackSide material. This makes internal faces visible, giving the impression
 * of solidity inside the model.
 */
export function createCavityFill(model) {
  const cavityGroup = new THREE.Group()
  cavityGroup.name = 'CavityFill'

  model.traverse((child) => {
    if (child.isMesh && child.geometry) {
      // Clone the geometry
      const clonedGeometry = child.geometry.clone()

      // Create a material that renders BackSide
      const cavityMaterial = new THREE.MeshStandardMaterial({
        color: 0x5d6d7e,  // Darker gray-blue for interior
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.BackSide,  // Key: render back faces only
        transparent: true,
        opacity: 0.85
      })

      const cavityMesh = new THREE.Mesh(clonedGeometry, cavityMaterial)

      // Copy transforms from original
      cavityMesh.position.copy(child.position)
      cavityMesh.rotation.copy(child.rotation)
      cavityMesh.scale.copy(child.scale)

      // Apply parent transforms
      child.updateWorldMatrix(true, false)
      cavityMesh.applyMatrix4(child.matrixWorld)

      // Reset local transforms since we applied world matrix
      cavityMesh.position.set(0, 0, 0)
      cavityMesh.rotation.set(0, 0, 0)
      cavityMesh.scale.set(1, 1, 1)

      // Slightly scale down to avoid z-fighting
      // cavityMesh.scale.multiplyScalar(0.999)

      cavityGroup.add(cavityMesh)
    }
  })

  // Position the cavity group to match the model
  cavityGroup.position.copy(model.position)

  console.log(`Cavity fill created with ${cavityGroup.children.length} meshes`)

  return cavityGroup
}
