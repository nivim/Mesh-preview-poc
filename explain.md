# Design2Print: Client-Side Model Filling Approaches

## Overview

Approaches for approximate client-side visualization of filled IFC models in Three.js, targeting:

- Internal cavity filling (building interiors)
- Base/ground plane filling for uneven models (Z-axis normalization)

-----

## Approach 1: Convex Hull

Wrap the entire model geometry in a convex hull.

**Pros:**

- Fast and trivial to implement
- Handles base filling automatically
- Minimal code required

**Cons:**

- Loses all concave details
- Courtyards and L-shapes become solid blobs
- Not suitable for complex architectural forms

-----

## Approach 2: Projected Base + Depth Fill

Create a filled base by projecting the model footprint onto a ground plane and extruding upward.

**Pros:**

- Preserves original model shape
- Shows realistic base plate fill
- Works well with Three.js ExtrudeGeometry

**Cons:**

- Doesn’t fill internal cavities
- Courtyards still visible from top-down view

-----

## Approach 3: Layered Depth Buffer (“Solid from Outside”)

Render the model from 6 directions into depth textures, then use a custom shader to treat anything inside the bounding box as filled.

**Pros:**

- Handles any shape accurately
- Internal voids appear filled visually
- No geometry modification needed

**Cons:**

- More complex implementation
- Shader-based (preview only, no exportable geometry)
- Requires understanding of render-to-texture workflows

-----

## Approach 4: Voxelization Preview

Convert the model to a low-resolution voxel grid, flood-fill from outside to identify air, render remaining voxels as solid.

**Pros:**

- Actually fills cavities properly
- Intuitive “solid block” preview
- Can visualize true printable volume

**Cons:**

- Loses detail at low resolution
- Can be slow for large/complex models
- May require web worker for performance

-----

## Recommendation

**Combine Approach 2 + Visual Trick:**

1. **Base fill:** Use projected footprint extruded to ground plane (real geometry)
1. **Cavity fill illusion:** Render model clone with `THREE.BackSide` material underneath the main model — makes internal faces visible, giving impression of solidity

This combination provides fast, effective preview without heavy computation or complex shader work.