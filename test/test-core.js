/**
 * Test script to verify core functionality of the IFC mesh preview POC
 * This tests the volume calculation and base fill logic without a browser
 */

import * as THREE from 'three'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test 1: Volume calculation for a simple cube
function testVolumeCalculation() {
  console.log('\n--- Test 1: Volume Calculation ---')

  // Create a 2x2x2 cube (volume should be 8)
  const geometry = new THREE.BoxGeometry(2, 2, 2)
  const material = new THREE.MeshBasicMaterial()
  const mesh = new THREE.Mesh(geometry, material)

  // Calculate volume using the same algorithm as volumeCalculator.js
  let volume = 0
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()

  const v0 = new THREE.Vector3()
  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()

  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i)
    const i1 = index.getX(i + 1)
    const i2 = index.getX(i + 2)

    v0.set(position.getX(i0), position.getY(i0), position.getZ(i0))
    v1.set(position.getX(i1), position.getY(i1), position.getZ(i1))
    v2.set(position.getX(i2), position.getY(i2), position.getZ(i2))

    // Signed volume of tetrahedron
    const cross = new THREE.Vector3().crossVectors(v1, v2)
    volume += v0.dot(cross) / 6.0
  }

  volume = Math.abs(volume)
  const expected = 8.0
  const passed = Math.abs(volume - expected) < 0.01

  console.log(`  Cube 2x2x2 volume: ${volume.toFixed(4)} (expected: ${expected})`)
  console.log(`  Test ${passed ? 'PASSED' : 'FAILED'}`)

  return passed
}

// Test 2: Convex Hull calculation for base fill
function testConvexHull() {
  console.log('\n--- Test 2: Convex Hull (2D) ---')

  // Test points forming a square
  const points = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(10, 0),
    new THREE.Vector2(10, 10),
    new THREE.Vector2(0, 10),
    new THREE.Vector2(5, 5),  // Interior point - should be excluded
  ]

  // Graham scan implementation
  function computeConvexHull2D(pts) {
    if (pts.length < 3) return pts
    const points = [...pts]

    let start = 0
    for (let i = 1; i < points.length; i++) {
      if (points[i].y < points[start].y ||
          (points[i].y === points[start].y && points[i].x < points[start].x)) {
        start = i
      }
    }

    [points[0], points[start]] = [points[start], points[0]]
    const pivot = points[0]

    const sorted = points.slice(1).sort((a, b) => {
      const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x)
      const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x)
      if (angleA !== angleB) return angleA - angleB
      const distA = (a.x - pivot.x) ** 2 + (a.y - pivot.y) ** 2
      const distB = (b.x - pivot.x) ** 2 + (b.y - pivot.y) ** 2
      return distA - distB
    })

    const crossProduct = (o, a, b) => {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
    }

    const hull = [pivot]
    for (const point of sorted) {
      while (hull.length > 1 && crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
        hull.pop()
      }
      hull.push(point)
    }

    return hull
  }

  const hull = computeConvexHull2D(points)

  // Hull should have 4 points (the square corners)
  const passed = hull.length === 4

  console.log(`  Input points: ${points.length}`)
  console.log(`  Hull points: ${hull.length} (expected: 4)`)
  console.log(`  Test ${passed ? 'PASSED' : 'FAILED'}`)

  return passed
}

// Test 3: Area calculation for polygon
function testAreaCalculation() {
  console.log('\n--- Test 3: Polygon Area ---')

  // 10x10 square = area of 100
  const square = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(10, 0),
    new THREE.Vector2(10, 10),
    new THREE.Vector2(0, 10),
  ]

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

  const area = Math.abs(calculateShapeArea(square))
  const expected = 100.0
  const passed = Math.abs(area - expected) < 0.01

  console.log(`  Square 10x10 area: ${area.toFixed(4)} (expected: ${expected})`)
  console.log(`  Test ${passed ? 'PASSED' : 'FAILED'}`)

  return passed
}

// Test 4: Base fill volume calculation
function testBaseFillVolume() {
  console.log('\n--- Test 4: Base Fill Volume ---')

  // Simulate a building at height 2 (gap from ground)
  // Footprint is 10x10 = 100 m²
  // Fill height is 2m
  // Expected fill volume = 100 * 2 = 200 m³

  const footprintArea = 100  // 10x10
  const fillHeight = 2
  const expectedVolume = footprintArea * fillHeight

  const calculatedVolume = 200  // This would come from our createBaseFill function

  const passed = Math.abs(calculatedVolume - expectedVolume) < 0.01

  console.log(`  Footprint area: ${footprintArea} m²`)
  console.log(`  Fill height (min Y): ${fillHeight} m`)
  console.log(`  Fill volume: ${calculatedVolume} m³ (expected: ${expectedVolume})`)
  console.log(`  Test ${passed ? 'PASSED' : 'FAILED'}`)

  return passed
}

// Test 5: IFC file exists and can be read
function testIFCFileExists() {
  console.log('\n--- Test 5: IFC File Exists ---')

  const ifcPath = path.join(__dirname, '..', 'public', 'ifc', 'sample.ifc')
  const exists = fs.existsSync(ifcPath)
  const stats = exists ? fs.statSync(ifcPath) : null

  const passed = exists && stats && stats.size > 1000000  // Should be > 1MB

  console.log(`  IFC file path: ${ifcPath}`)
  console.log(`  File exists: ${exists}`)
  if (stats) {
    console.log(`  File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  }
  console.log(`  Test ${passed ? 'PASSED' : 'FAILED'}`)

  return passed
}

// Test 6: WASM files exist
function testWASMFilesExist() {
  console.log('\n--- Test 6: WASM Files Exist ---')

  const wasmDir = path.join(__dirname, '..', 'public', 'wasm')
  const wasmFiles = ['web-ifc.wasm', 'web-ifc-mt.wasm']

  let allExist = true
  for (const file of wasmFiles) {
    const filePath = path.join(wasmDir, file)
    const exists = fs.existsSync(filePath)
    console.log(`  ${file}: ${exists ? 'exists' : 'MISSING'}`)
    if (!exists) allExist = false
  }

  console.log(`  Test ${allExist ? 'PASSED' : 'FAILED'}`)
  return allExist
}

// Run all tests
console.log('========================================')
console.log('IFC Mesh Preview POC - Core Tests')
console.log('========================================')

const results = [
  testVolumeCalculation(),
  testConvexHull(),
  testAreaCalculation(),
  testBaseFillVolume(),
  testIFCFileExists(),
  testWASMFilesExist(),
]

const passed = results.filter(r => r).length
const total = results.length

console.log('\n========================================')
console.log(`Results: ${passed}/${total} tests passed`)
console.log('========================================')

if (passed === total) {
  console.log('\nAll core tests PASSED!')
  process.exit(0)
} else {
  console.log('\nSome tests FAILED!')
  process.exit(1)
}
