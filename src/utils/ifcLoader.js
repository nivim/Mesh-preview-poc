import * as THREE from 'three'
import * as WebIFC from 'web-ifc'

/**
 * Custom IFC Loader using web-ifc directly
 * This provides better compatibility with modern Three.js versions
 */
export class SimpleIFCLoader {
  constructor() {
    this.ifcAPI = null
  }

  async init(wasmPath = '/wasm/') {
    this.ifcAPI = new WebIFC.IfcAPI()
    this.ifcAPI.SetWasmPath(wasmPath)
    await this.ifcAPI.Init()
  }

  async load(url) {
    if (!this.ifcAPI) {
      throw new Error('IFC API not initialized. Call init() first.')
    }

    // Fetch the IFC file
    const response = await fetch(url)
    const buffer = await response.arrayBuffer()
    const data = new Uint8Array(buffer)

    // Open the model
    const modelID = this.ifcAPI.OpenModel(data)

    // Create a group to hold all meshes
    const group = new THREE.Group()

    // Get all meshes from the model
    this.ifcAPI.StreamAllMeshes(modelID, (mesh) => {
      const placedGeometries = mesh.geometries

      for (let i = 0; i < placedGeometries.size(); i++) {
        const placedGeometry = placedGeometries.get(i)
        const geometry = this.getGeometry(modelID, placedGeometry.geometryExpressID)

        if (geometry) {
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(
              placedGeometry.color.x,
              placedGeometry.color.y,
              placedGeometry.color.z
            ),
            transparent: placedGeometry.color.w < 1,
            opacity: placedGeometry.color.w,
            side: THREE.DoubleSide
          })

          const threeMesh = new THREE.Mesh(geometry, material)

          // Apply transformation matrix
          const matrix = new THREE.Matrix4()
          matrix.fromArray(placedGeometry.flatTransformation)
          threeMesh.applyMatrix4(matrix)

          group.add(threeMesh)
        }
      }
    })

    // Close the model to free memory
    this.ifcAPI.CloseModel(modelID)

    return group
  }

  getGeometry(modelID, geometryExpressID) {
    const geometry = this.ifcAPI.GetGeometry(modelID, geometryExpressID)

    const vertices = this.ifcAPI.GetVertexArray(
      geometry.GetVertexData(),
      geometry.GetVertexDataSize()
    )

    const indices = this.ifcAPI.GetIndexArray(
      geometry.GetIndexData(),
      geometry.GetIndexDataSize()
    )

    if (vertices.length === 0 || indices.length === 0) {
      geometry.delete()
      return null
    }

    const bufferGeometry = new THREE.BufferGeometry()

    // Vertices are packed as: x, y, z, nx, ny, nz (position + normal)
    const positionArray = new Float32Array(vertices.length / 2)
    const normalArray = new Float32Array(vertices.length / 2)

    for (let i = 0; i < vertices.length; i += 6) {
      const idx = i / 2
      // Position
      positionArray[idx] = vertices[i]
      positionArray[idx + 1] = vertices[i + 1]
      positionArray[idx + 2] = vertices[i + 2]
      // Normal
      normalArray[idx] = vertices[i + 3]
      normalArray[idx + 1] = vertices[i + 4]
      normalArray[idx + 2] = vertices[i + 5]
    }

    bufferGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positionArray, 3)
    )
    bufferGeometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(normalArray, 3)
    )
    bufferGeometry.setIndex(new THREE.BufferAttribute(indices, 1))

    geometry.delete()

    return bufferGeometry
  }
}
