import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { SimpleIFCLoader } from '../utils/ifcLoader'
import { createBaseFill } from '../utils/baseFill'
import { createCavityFill } from '../utils/cavityFill'
import { calculateMeshVolume, countGeometryStats } from '../utils/volumeCalculator'

const IFC_FILE_PATH = '/ifc/sample.ifc'

// Demo mode: raise model to demonstrate base fill if it sits at/below ground
const DEMO_RAISE_HEIGHT = 2.0  // meters to raise model for demo

function IFCViewer({ onStatsUpdate, onLoadingChange }) {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const animationIdRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize Three.js scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.set(30, 30, 30)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(50, 50, 50)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
    directionalLight2.position.set(-50, 30, -50)
    scene.add(directionalLight2)

    // Grid helper
    const gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x333333)
    scene.add(gridHelper)

    // Ground plane (visual reference)
    const groundGeometry = new THREE.PlaneGeometry(100, 100)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a3e,
      roughness: 0.8,
      metalness: 0.2
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.01
    ground.receiveShadow = true
    scene.add(ground)

    // Load IFC
    loadIFC(scene, camera, controls)

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement)
      }
      renderer.dispose()
    }
  }, [])

  const loadIFC = async (scene, camera, controls) => {
    onLoadingChange(true, 'Initializing IFC loader...')

    try {
      const loader = new SimpleIFCLoader()
      await loader.init('/wasm/')

      onLoadingChange(true, 'Loading IFC model...')

      const ifcModel = await loader.load(IFC_FILE_PATH)

      onLoadingChange(true, 'Processing model...')

      // Center the model and get its bounds
      const bbox = new THREE.Box3().setFromObject(ifcModel)
      const center = bbox.getCenter(new THREE.Vector3())
      const size = bbox.getSize(new THREE.Vector3())

      // Store original minY (this is the ground gap)
      const originalMinY = bbox.min.y

      // Move model so its center XZ is at origin
      ifcModel.position.x -= center.x
      ifcModel.position.z -= center.z

      // DEMO: If model is at or below ground, raise it to demonstrate base fill
      let demoRaise = 0
      if (originalMinY <= 0.01) {
        demoRaise = DEMO_RAISE_HEIGHT - originalMinY  // Raise so minY becomes DEMO_RAISE_HEIGHT
        ifcModel.position.y += demoRaise
        console.log(`Demo mode: Raised model by ${demoRaise.toFixed(2)}m to demonstrate base fill`)
      }

      // Apply a consistent material to the IFC model (override individual materials)
      ifcModel.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x88aacc,
            roughness: 0.5,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9,
            side: THREE.FrontSide
          })
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      scene.add(ifcModel)

      onLoadingChange(true, 'Calculating volumes...')

      // Calculate original model volume
      let originalVolume = 0
      let vertexCount = 0
      let triangleCount = 0

      ifcModel.traverse((child) => {
        if (child.isMesh && child.geometry) {
          originalVolume += calculateMeshVolume(child)
          const geoStats = countGeometryStats(child.geometry)
          vertexCount += geoStats.vertices
          triangleCount += geoStats.triangles
        }
      })

      onLoadingChange(true, 'Creating base fill...')

      // Recalculate bbox after repositioning
      const newBbox = new THREE.Box3().setFromObject(ifcModel)

      // Create base fill geometry (projected footprint extruded to ground)
      const baseFillResult = createBaseFill(ifcModel, newBbox)
      if (baseFillResult.mesh) {
        scene.add(baseFillResult.mesh)
        console.log('Base fill added to scene:', baseFillResult.volume.toFixed(2), 'm³')
      } else {
        console.log('No base fill needed (model sits on ground)')
      }

      onLoadingChange(true, 'Creating cavity fill...')

      // Create cavity fill (BackSide material clone)
      const cavityFill = createCavityFill(ifcModel)
      if (cavityFill) {
        scene.add(cavityFill)
        console.log('Cavity fill added to scene')
      }

      // Calculate total stats
      const effectiveMinY = newBbox.min.y
      const totalVolume = Math.abs(originalVolume) + baseFillResult.volume
      const volumeIncrease = Math.abs(originalVolume) > 0
        ? ((baseFillResult.volume / Math.abs(originalVolume)) * 100)
        : 0

      // Update camera to frame the model nicely
      const maxDim = Math.max(size.x, size.y, size.z)
      camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.5)
      controls.target.set(0, newBbox.min.y + size.y / 2, 0)
      controls.update()

      // Report stats
      onStatsUpdate({
        originalBBox: { x: size.x, y: size.y, z: size.z },
        minZ: effectiveMinY,
        originalVolume: Math.abs(originalVolume),
        baseFillVolume: baseFillResult.volume,
        totalVolume: totalVolume,
        volumeIncrease: volumeIncrease,
        vertexCount,
        triangleCount,
        demoMode: demoRaise > 0
      })

      onLoadingChange(false)
      console.log('IFC model loaded successfully')

    } catch (error) {
      console.error('Error loading IFC:', error)
      onLoadingChange(true, `Error: ${error.message}`)
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}

export default IFCViewer
