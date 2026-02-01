import * as THREE from 'three'

/**
 * Creates a base fill by projecting the model's footprint onto the ground plane
 * and extruding it upward to fill the gap between the model and ground.
 */
export function createBaseFill(model, bbox) {
  // Collect all vertices from the model projected onto XZ plane
  const projectedPoints = []

  model.traverse((child) => {
    if (child.isMesh && child.geometry) {
      const geometry = child.geometry
      const position = geometry.getAttribute('position')

      if (!position) return

      // Get world matrix to transform vertices
      child.updateWorldMatrix(true, false)
      const worldMatrix = child.matrixWorld

      for (let i = 0; i < position.count; i++) {
        const vertex = new THREE.Vector3(
          position.getX(i),
          position.getY(i),
          position.getZ(i)
        )

        // Transform to world space
        vertex.applyMatrix4(worldMatrix)

        // Project onto XZ plane (y = 0)
        projectedPoints.push(new THREE.Vector2(vertex.x, vertex.z))
      }
    }
  })

  if (projectedPoints.length < 3) {
    console.warn('Not enough points for base fill')
    return { mesh: null, volume: 0 }
  }

  // Calculate convex hull of projected points for the base shape
  const hull = computeConvexHull2D(projectedPoints)

  if (hull.length < 3) {
    console.warn('Convex hull failed')
    return { mesh: null, volume: 0 }
  }

  // Create a shape from the convex hull
  const shape = new THREE.Shape()
  shape.moveTo(hull[0].x, hull[0].y)
  for (let i = 1; i < hull.length; i++) {
    shape.lineTo(hull[i].x, hull[i].y)
  }
  shape.closePath()

  // The fill height is from ground (y=0) to the minimum Y of the model
  const fillHeight = Math.max(0, bbox.min.y)

  if (fillHeight <= 0.001) {
    // Model already sits on ground, no base fill needed
    return { mesh: null, volume: 0 }
  }

  // Extrude the shape upward
  const extrudeSettings = {
    depth: fillHeight,
    bevelEnabled: false
  }

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)

  // Rotate so the extrusion goes up in Y direction
  // ExtrudeGeometry extrudes in +Z, we need +Y
  geometry.rotateX(-Math.PI / 2)

  // Create a semi-transparent material for the fill
  const material = new THREE.MeshStandardMaterial({
    color: 0x4caf50,  // Green to show fill
    roughness: 0.7,
    metalness: 0.1,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  mesh.name = 'BaseFill'

  // Calculate volume of the extruded shape
  const area = Math.abs(calculateShapeArea(hull))
  const volume = area * fillHeight

  console.log(`Base fill created: area=${area.toFixed(2)}m², height=${fillHeight.toFixed(2)}m, volume=${volume.toFixed(2)}m³`)

  return { mesh, volume }
}

/**
 * Compute 2D convex hull using Graham scan algorithm
 */
function computeConvexHull2D(points) {
  if (points.length < 3) return points

  // Find the point with lowest Y (and leftmost if tie)
  let start = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < points[start].y ||
        (points[i].y === points[start].y && points[i].x < points[start].x)) {
      start = i
    }
  }

  // Swap start to position 0
  [points[0], points[start]] = [points[start], points[0]]
  const pivot = points[0]

  // Sort points by polar angle with respect to pivot
  const sorted = points.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x)
    const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x)
    if (angleA !== angleB) return angleA - angleB
    // If same angle, closer point first
    const distA = (a.x - pivot.x) ** 2 + (a.y - pivot.y) ** 2
    const distB = (b.x - pivot.x) ** 2 + (b.y - pivot.y) ** 2
    return distA - distB
  })

  // Build hull
  const hull = [pivot]
  for (const point of sorted) {
    while (hull.length > 1 && crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop()
    }
    hull.push(point)
  }

  return hull
}

function crossProduct(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/**
 * Calculate the area of a polygon defined by points
 */
function calculateShapeArea(points) {
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return area / 2
}
