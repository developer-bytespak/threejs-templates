import * as THREE from 'three'

/**
 * Construction dust.
 *
 * One `THREE.Points`, one draw call, a fixed pool and no allocation after
 * construction. A burst does not create anything: it wakes dead particles and
 * gives them a position, a velocity and a size. When the pool is empty a burst
 * is simply smaller, which is the right way to fail — the alternative gets more
 * expensive exactly when the scene is busiest.
 *
 * WHAT WENT WRONG THE FIRST TIME
 *
 * Thirty particles at a fifth of an alpha, thrown upward. Correct, invisible,
 * and therefore pointless. Dry earth dropping does not drift upward: it punches
 * outward along the ground, swells as it goes, and thins. So a burst is now
 * three puffs at different points over the body's footprint, each throwing
 * particles OUT with only a little lift; they start small and dense, grow by
 * half again over their life, and there are enough of them at enough opacity
 * to read at fifty metres, which is where the camera usually is.
 */

const vertexShader = /* glsl */ `
  uniform float uProjScale;
  attribute float aAlpha;
  attribute float aSize;
  attribute float aSpin;
  varying float vAlpha;
  varying float vSpin;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float depth = -viewPosition.z;
    vAlpha = aAlpha;
    vSpin = aSpin;
    gl_PointSize = clamp(aSize * uProjScale / max(depth, 0.8), 3.0, 140.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColour;
  varying float vAlpha;
  varying float vSpin;

  void main() {
    if (vAlpha <= 0.003) discard;
    // A little rotation per particle, so a hundred round sprites do not read as
    // a hundred copies of one round sprite.
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vSpin), s = sin(vSpin);
    uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    float d = length(uv);
    if (d > 0.5) discard;
    // Soft, and softer still at the edge: dust has no edge.
    float core = smoothstep(0.5, 0.02, d);
    // A off-centre lobe breaks the symmetry without a texture.
    float lobe = smoothstep(0.42, 0.0, length(uv - vec2(0.09, 0.07)));
    float a = (core * 0.62 + core * lobe * 0.38) * vAlpha;
    gl_FragColor = vec4(uColour, a);
  }
`

/** Deterministic, so two loads of the page throw the same dust. */
function makeRandom(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEFAULTS = {
  count: 460,
  /** Puffs per region, and particles per puff, at full strength. */
  puffs: 3,
  perPuff: 18,
  life: [0.7, 1.3],
  /** Metres per second. Outward hard, upward a little. */
  out: [2.2, 5.4],
  rise: [0.35, 1.15],
  /** Point size in the vertex shader's units, and how much it grows by. */
  size: [80, 190],
  growth: 1.5,
  /** Dust is mostly drag: it throws, then stalls, then hangs. */
  drag: 2.7,
  gravity: 0.55,
  /** How much the air moves it about. Cheap, and only while it is moving. */
  swirl: 0.55,
  opacity: 0.40,
  colour: 0x9d8b73,
}

export function createDustField(options = {}) {
  const config = { ...DEFAULTS, ...options }
  const count = config.count
  const random = makeRandom(0x5eed)

  const positions = new Float32Array(count * 3)
  const alphas = new Float32Array(count)
  const sizes = new Float32Array(count)
  const spins = new Float32Array(count)
  const velocity = new Float32Array(count * 3)
  const age = new Float32Array(count)
  const life = new Float32Array(count)
  const peak = new Float32Array(count)
  const base = new Float32Array(count)
  const seed = new Float32Array(count)
  const spinRate = new Float32Array(count)
  // A ring cursor, so a burst that cannot find a dead particle overwrites the
  // oldest rather than scanning the pool twice.
  let cursor = 0
  let live = 0

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aSpin', new THREE.BufferAttribute(spins, 1))
  // Never culled: the bounding sphere of a pool that moves every frame is a
  // lie, and recomputing it every frame costs more than the draw.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColour: { value: new THREE.Color(config.colour) },
      uProjScale: { value: 300 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    // Dust in daylight is not a light source. Additive blending makes it glow,
    // which is the tell of every particle system that was never looked at
    // outdoors.
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
  })

  const points = new THREE.Points(geometry, material)
  points.name = 'EXCAVATION_DUST'
  points.frustumCulled = false
  points.renderOrder = 4
  points.matrixAutoUpdate = false
  points.updateMatrix()

  function wake(x, y, z, strength) {
    const i = cursor
    cursor = (cursor + 1) % count
    if (age[i] >= life[i]) live += 1
    const i3 = i * 3
    const a = random() * Math.PI * 2
    const speed = config.out[0] + random() * (config.out[1] - config.out[0])
    positions[i3] = x
    positions[i3 + 1] = y
    positions[i3 + 2] = z
    velocity[i3] = Math.cos(a) * speed
    velocity[i3 + 1] = config.rise[0] + random() * (config.rise[1] - config.rise[0])
    velocity[i3 + 2] = Math.sin(a) * speed
    age[i] = 0
    life[i] = config.life[0] + random() * (config.life[1] - config.life[0])
    peak[i] = config.opacity * (0.6 + 0.6 * random()) * (0.45 + 0.55 * strength)
    base[i] = config.size[0] + random() * (config.size[1] - config.size[0])
    sizes[i] = base[i]
    spins[i] = random() * Math.PI * 2
    spinRate[i] = (random() - 0.5) * 1.6
    seed[i] = random() * 100
    alphas[i] = 0
  }

  return {
    object: points,

    /** How many particles are alive. Zero means `update` is free. */
    active: () => live,

    /**
     * Throw dust at a set of regions.
     *
     * `regions` is reused by the caller between calls, so everything needed is
     * read out here and nothing is kept.
     */
    burst(regions) {
      for (let i = 0; i < regions.length; i += 1) {
        const r = regions[i]
        const strength = r.strength ?? 1
        const puffs = Math.max(2, Math.round(config.puffs * (0.6 + 0.4 * strength)))
        for (let p = 0; p < puffs; p += 1) {
          // Spread the puffs over the body's footprint rather than putting one
          // ring round its middle: a chunk fifteen metres across does not throw
          // its dust from a single point.
          const a = random() * Math.PI * 2
          const d = r.radius * 0.72 * Math.sqrt(random())
          const px = r.x + Math.cos(a) * d
          const pz = r.z + Math.sin(a) * d
          const n = Math.max(6, Math.round(config.perPuff * (0.5 + 0.5 * strength)))
          for (let k = 0; k < n; k += 1) {
            // Dense at the ground: most of a burst starts within half a metre
            // of the surface that just gave way.
            wake(px, r.y - 0.1 + random() * random() * 0.9, pz, strength)
          }
        }
      }
    },

    /** Point size is in device pixels, or dust is grit on a phone. */
    /** How many particles are in the air. Zero means the last burst is spent. */
    live: () => live,

    resize(height) {
      material.uniforms.uProjScale.value = Math.max(140, height * 0.42)
    },

    update(delta) {
      if (!live) return false
      let alive = 0
      for (let i = 0; i < count; i += 1) {
        if (age[i] >= life[i]) continue
        age[i] += delta
        if (age[i] >= life[i]) { alphas[i] = 0; continue }
        alive += 1
        const i3 = i * 3
        const u = age[i] / life[i]
        const drag = Math.max(0, 1 - config.drag * delta)
        velocity[i3] *= drag
        velocity[i3 + 2] *= drag
        velocity[i3 + 1] = velocity[i3 + 1] * drag - config.gravity * delta
        // A little air movement once the throw has spent itself, so a cloud
        // that has stopped travelling is not a cloud that has stopped moving.
        const s = seed[i]
        const t = age[i]
        positions[i3] += (velocity[i3] + Math.sin(t * 2.3 + s) * config.swirl * u) * delta
        positions[i3 + 1] += velocity[i3 + 1] * delta
        positions[i3 + 2] += (velocity[i3 + 2] + Math.cos(t * 1.9 + s * 1.7) * config.swirl * u) * delta
        spins[i] += spinRate[i] * delta
        // Dust swells as it thins.
        sizes[i] = base[i] * (1 + (config.growth - 1) * u)
        // Up over the first tenth, then away for the rest of it.
        const rise = u < 0.1 ? u / 0.1 : 1
        const fall = 1 - (u - 0.1) / 0.9
        alphas[i] = peak[i] * rise * Math.max(0, fall) * Math.max(0, fall)
      }
      live = alive
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.aAlpha.needsUpdate = true
      geometry.attributes.aSize.needsUpdate = true
      geometry.attributes.aSpin.needsUpdate = true
      return true
    },

    /** Kill everything now, without waiting for it to fade. */
    clear() {
      for (let i = 0; i < count; i += 1) { age[i] = life[i] = 0; alphas[i] = 0 }
      live = 0
      geometry.attributes.aAlpha.needsUpdate = true
    },

    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
