"""
The excavation as a solid soil mass, removed in chunks.

Inside the site's 17.6 x 12.6 opening there is a closed body of soil. The
removable pieces are the soil itself, not lids over a finished pit: show them
all and the ground is flat, with no pit anywhere in the file to be uncovered.

The pieces are CHUNKS -- separate regions of ground, not slices off one
advancing face. Each one is a lobed area that goes down to its own depth, and
each is applied to the surface the earlier chunks left, so a chunk laid over
an earlier one deepens that hole instead of overlapping it. Several chunks
belong to each stage, in different parts of the site, so a stage reads as
work happening in several places at once.

    SOIL_MASS                    container
      GROUND_BASE                the soil that is never removed
      EXCAVATION_STAGE_01        CHUNK_01..03   first cuts, three places
      EXCAVATION_STAGE_02        CHUNK_04..07   two deepen, two open
      EXCAVATION_STAGE_03        CHUNK_08..13   the areas grow together
      EXCAVATION_STAGE_04        CHUNK_14..18   the haul ramp, then the
                                                leftover ridges and islands
      EXCAVATION_STAGE_05        FOUNDATION_CUTS
    SPOIL
      SPOIL_STAGE_01..05         each a cluster of two to four tipped lobes

Geometry conventions: Blender is Z-up, metres. The rim is FIXED on the
existing hole in site_ground_earth. Nothing outside it moves.
"""
import bpy, bmesh, math
from mathutils import Vector

RX, RY  = 17.6, 12.6
FORM_Z  = -4.05
BASE_Z  = -6.70
NX, NY  = 56, 40
RIM_BAND = (0.20, 0.50, 0.90, 1.40, 2.00)
JITTER  = 0.17              # in-plane warp, as a fraction of the local cell

MAT_TOPSOIL = 'mat_soil_topsoil'
MAT_SUBSOIL = 'mat_exposed_soil'
MAT_CLAY    = 'mat_soil_clay'
MAT_FLOOR   = 'mat_excavation_floor'
MAT_TOP     = 'mat_ground_patch'
MAT_PAD     = 'mat_ground_patch_pad'
MAT_SPOIL   = 'mat_spoil_heap'
SLOTS = (MAT_TOPSOIL, MAT_SUBSOIL, MAT_CLAY, MAT_FLOOR, MAT_TOP, MAT_PAD)
M_TOPSOIL, M_SUBSOIL, M_CLAY, M_FLOOR, M_TOP, M_PAD = range(6)

SOIL_COLOURS = {
    MAT_TOPSOIL: (0.062, 0.044, 0.028),
    MAT_SUBSOIL: (0.115, 0.086, 0.058),
    MAT_CLAY:    (0.138, 0.104, 0.064),
    MAT_FLOOR:   (0.100, 0.076, 0.050),
}
TAU = math.pi * 2


def hashn(a, b, s):
    return (math.sin(a * 912.9898 + b * 78.233 + s * 43.7) * 43758.5453) % 1.0 * 2.0 - 1.0


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def ensure_materials():
    src = bpy.data.materials.get(MAT_SUBSOIL)
    for name, col in SOIL_COLOURS.items():
        m = bpy.data.materials.get(name)
        if m is None:
            m = src.copy() if src is not None else bpy.data.materials.new(name)
            m.name = name
        m.diffuse_color = (col[0], col[1], col[2], 1.0)
        if m.use_nodes:
            for n in m.node_tree.nodes:
                if 'Base Color' in n.inputs:
                    n.inputs['Base Color'].default_value = (col[0], col[1], col[2], 1.0)


# --------------------------------------------------------------- ground ----
EW = [None, None]
NS = [None, None]
PAD = None
RIM_STEP = 0.10
STEP_Y, STEP_X = [], []


def _ray(ground, x, y):
    best = None
    for g in ground:
        mi = g.matrix_world.inverted()
        d = (mi.to_3x3() @ Vector((0, 0, -1))).normalized()
        hit, loc, _, _ = g.ray_cast(mi @ Vector((x, y, 14.0)), d)
        if hit:
            z = (g.matrix_world @ loc).z
            best = z if best is None else max(best, z)
    return best


def _steps(table, tol=0.025):
    ax, av = table
    return [(ax[k] + ax[k + 1]) / 2 for k in range(len(ax) - 1)
            if abs(av[k + 1] - av[k]) > tol]


def build_rim_tables(ground):
    ny = int(2 * RY / RIM_STEP) + 1
    nx = int(2 * RX / RIM_STEP) + 1
    ys = [-RY + 2 * RY * j / (ny - 1) for j in range(ny)]
    xs = [-RX + 2 * RX * i / (nx - 1) for i in range(nx)]
    for s, sx in ((0, RX + 0.08), (1, -RX - 0.08)):
        EW[s] = (ys, [_ray(ground, sx, y) for y in ys])
    for s, sy in ((0, RY + 0.08), (1, -RY - 0.08)):
        NS[s] = (xs, [_ray(ground, x, sy) for x in xs])
    fill = [v for t in (EW + NS) for v in t[1] if v is not None]
    mean = sum(fill) / len(fill) if fill else 0.06
    for t in EW + NS:
        t[1][:] = [mean if v is None else v for v in t[1]]
    STEP_Y[:] = sorted(set(_steps(EW[0]) + _steps(EW[1])))
    STEP_X[:] = sorted(set(_steps(NS[0]) + _steps(NS[1])))
    global PAD
    p = bpy.data.objects.get('site_ground_pad')
    if p:
        bb = [p.matrix_world @ Vector(c) for c in p.bound_box]
        x0, x1 = min(b.x for b in bb), max(b.x for b in bb)
        y0, y1 = min(b.y for b in bb), max(b.y for b in bb)
        pr = [_ray([p], x0 + (x1 - x0) * u, y0 + (y1 - y0) * v)
              for u, v in ((0.2, 0.3), (0.5, 0.6), (0.8, 0.45), (0.35, 0.8))]
        pr = [z for z in pr if z is not None]
        if pr and max(pr) - min(pr) < 0.006:
            PAD = (x0, x1, y0, y1, sum(pr) / len(pr))


def _lerp(table, u):
    ax, av = table
    if u <= ax[0]: return av[0]
    if u >= ax[-1]: return av[-1]
    step = ax[1] - ax[0]
    k = max(0, min(len(ax) - 2, int((u - ax[0]) / step)))
    f = (u - ax[k]) / step
    if abs(av[k + 1] - av[k]) > 0.025:
        return av[k] if f < 0.5 else av[k + 1]
    return av[k] * (1 - f) + av[k + 1] * f


def in_pad(x, y):
    return PAD is not None and PAD[0] <= x <= PAD[1] and PAD[2] <= y <= PAD[3]


def top_z(x, y):
    """
    The original ground surface inside the excavation footprint, rebuilt from
    the four rim profiles that were measured just outside it.

    All four rims are blended together, weighted by one over the distance to
    each. The earlier version picked ONE east/west profile and ONE north/south
    profile according to the sign of x and y, which meant the surface jumped
    from the east rim's profile to the west rim's the instant x crossed zero,
    and from the north's to the south's the instant y did. The two profiles do
    not agree -- the site falls about 90 mm east to west and 110 mm south to
    north -- so the ground carried a step of roughly 35 mm along the whole
    line x = 0 and 60 mm along the whole line y = 0: a crease in the shape of
    a cross, stamped across the middle of the site, present in no other part
    of the ground and visible at 0% as two long seams.

    Weighting all four and summing is continuous everywhere, still lands on
    each rim's own profile at that rim (its weight runs away to 1/0.04 there
    while the other three stay near 1/17), and introduces no preferred
    direction for the surface to break along.
    """
    xc = -RX if x < -RX else (RX if x > RX else x)
    yc = -RY if y < -RY else (RY if y > RY else y)
    ze = _lerp(EW[0], yc)          # east  rim, x = +RX
    zw = _lerp(EW[1], yc)          # west  rim, x = -RX
    zn = _lerp(NS[0], xc)          # north rim, y = +RY
    zs = _lerp(NS[1], xc)          # south rim, y = -RY
    we = 1.0 / max(RX - xc, 0.04)
    ww = 1.0 / max(RX + xc, 0.04)
    wn = 1.0 / max(RY - yc, 0.04)
    ws = 1.0 / max(RY + yc, 0.04)
    z = (ze * we + zw * ww + zn * wn + zs * ws) / (we + ww + wn + ws)
    return max(z, PAD[4]) if in_pad(x, y) else z


# ------------------------------------------------------------ the slope ----
def batter_width(x, y):
    """
    How far in the cut reaches before it bottoms out: 1.55 to 4.20 m over six
    harmonics, so the toe line wanders and the floor outline is not a rectangle.
    """
    w = (2.65
         + 0.72 * math.sin(x * 0.19 + 1.1)
         + 0.46 * math.sin(y * 0.26 + 2.4)
         + 0.31 * math.sin(x * 0.44 + y * 0.31 + 0.6)
         + 0.19 * math.sin(y * 0.83 + x * 0.12 + 3.1)
         + 0.11 * math.sin(x * 1.61 + 0.4)
         + 0.08 * math.sin(y * 2.13 + 1.9))
    return max(1.55, min(4.20, w))


def batter(t):
    """Rim to toe: steep lifts with a short bench between, not one ramp."""
    if t < 0.30: return 0.46 * (t / 0.30) ** 1.18
    if t < 0.38: return 0.46 + 0.04 * (t - 0.30) / 0.08
    if t < 0.72: return 0.50 + 0.36 * ((t - 0.38) / 0.34) ** 0.88
    if t < 0.80: return 0.86 + 0.03 * (t - 0.72) / 0.08
    return 0.89 + 0.11 * ((t - 0.80) / 0.20) ** 0.90


def floor_relief(x, y):
    a = math.radians(31.0)
    ca, sa = math.cos(a), math.sin(a)
    u = x * ca + y * sa
    v = -x * sa + y * ca
    return (0.075 * math.sin(u * 0.29) * math.sin(v * 0.37 + 0.7)
            + 0.050 * math.sin(u * 0.61 + 2.1)
            + 0.038 * math.sin(v * 0.73 + 0.4)
            + 0.027 * math.sin(u * 1.23 + 1.1) * math.cos(v * 0.91)
            + 0.019 * math.sin((u + v) * 1.87 + 2.6))


def general_depth(x, y, gz):
    """
    The general excavation, down to formation. No foundation cuts.

    Three things are layered onto the batter, all masked to nothing at the
    crest and the toe so the surface still lands on the ground above and the
    floor below:

      scour   - broad vertical washes and bucket tracks down the face, driven
                by the coordinate ALONG the wall rather than across it
      cuts    - irregular passes across the face
      bedding - ripples at constant world Z, so the layers line up right round
                the excavation the way real strata do

    Every wavelength here is deliberately longer than about 1.3 m on the
    ground. The batter is only six or seven cells wide, so anything finer does
    not survive sampling -- it aliases, and the wall turns into shattered rock
    instead of soil. Fine detail is carried by the four soil tones instead,
    which cost no resolution at all.
    """
    d = min(RX - abs(x), RY - abs(y))
    if d <= 0.0:
        return 0.0
    w = batter_width(x, y)
    t = min(1.0, d / w)
    edge = 4.0 * t * (1.0 - t)
    tang = y if (RX - abs(x)) < (RY - abs(y)) else x
    # These are deliberately small. t is a fraction of the batter width, and
    # the batter drops about 0.6 m per cell, so 0.1 of t is already a third of
    # a metre of height between neighbouring vertices -- enough to turn the
    # wall into shattered rock. The texture lives in the bedding and in the
    # four soil tones instead.
    t += (0.023 * math.sin(t * 8.0 + x * 0.26 + y * 0.21)
          + 0.010 * math.sin(t * 13.0 + y * 0.44 + 1.3)
          + 0.018 * math.sin(tang * 1.55 + 0.7)
          + 0.009 * math.sin(tang * 3.10 + 2.1)
          + 0.004 * math.sin(tang * 5.20 + 0.3)) * edge
    t = max(0.0, min(1.0, t))
    z0 = gz + (FORM_Z - gz) * batter(t)
    z0 += (0.070 * math.sin(z0 * 4.6 + 0.5 * math.sin(tang * 0.4))
           + 0.022 * math.sin(z0 * 9.1 + 1.2)) * edge
    dep = gz - z0
    dep += floor_relief(x, y) * smooth((d - w) / 1.9)
    return max(0.0, dep)


# ------------------------------------------------------- foundation cuts ----
RING = (4.00, 5.90, 0.95)
PADS = [(cx - 1.45, cx + 1.45, cy - 1.45, cy + 1.45, 1.35)
        for cx in (-9.6, 0.0, 9.6) for cy in (-4.6, 4.6)]
BEAMS = ([(-11.2, 11.2, cy - 0.95, cy + 0.95, 0.55) for cy in (-4.6, 4.6)]
         + [(cx - 0.95, cx + 0.95, -6.2, 6.2, 0.55) for cx in (-9.6, 0.0, 9.6)])
DEEP = [(-7.8, -2.5, 0.4, 3.0, 0.85)]
TRENCH_RAMP = 0.62


def trench_extra(x, y):
    d = min(RX - abs(x), RY - abs(y))
    if d <= 0.0:
        return 0.0
    gate = smooth((d - batter_width(x, y) - 0.55) / 0.95)
    if gate <= 0.0:
        return 0.0
    e = 0.0
    r0, r1, rd = RING
    if r0 < d < r1:
        e = max(e, rd * smooth(min(d - r0, r1 - d) / TRENCH_RAMP))
    for group in (PADS, BEAMS, DEEP):
        for (x0, x1, y0, y1, dep) in group:
            if x0 < x < x1 and y0 < y < y1:
                m = min(x - x0, x1 - x, y - y0, y1 - y)
                e = max(e, dep * smooth(m / TRENCH_RAMP))
    return e * gate



# ------------------------------------------------------------- the chunks ---
"""
The removal order, as regions rather than slices.

Each entry below is one independently removable body of soil. A chunk is
defined by WHERE it is -- a lobed, slightly boxy blob -- and by HOW DEEP it
goes: an absolute cap for the early passes, or straight to formation for the
later ones. They are applied in order, and each one's top is the ground as
every earlier chunk left it, so a chunk laid over an earlier one deepens the
same hole rather than overlapping it.

    name, stage, cx, cy, rx, ry, yaw, lobes, seed, feather, depth
    depth: metres below original ground, capped at formation
           None = straight to formation
"""
CHUNKS = [
    # -- stage 1: the first cuts. Three places at once, none of them touching.
    ('01', 1,  10.6, -2.2,  5.8, 4.6,  0.15, 5, 0.31, 0.34, 2.90),
    ('02', 1, -11.2,  4.6,  3.6, 2.9, -0.30, 6, 1.07, 0.38, 2.00),
    ('03', 1,   1.6,  6.4,  7.2, 2.6,  0.34, 7, 2.13, 0.32, 1.90),
    # -- stage 2: two of those deepen, two new areas open somewhere else ----
    ('04', 2,   9.2, -1.2,  7.2, 5.6,  0.10, 6, 0.77, 0.30, 4.40),
    ('05', 2,  -8.2, -6.4,  5.8, 3.9, -0.25, 5, 1.63, 0.34, 3.00),
    ('06', 2,  -3.0,  7.4,  5.2, 3.5,  0.20, 7, 2.41, 0.36, 3.10),
    ('07', 2,  13.4, -7.6,  4.0, 3.0,  0.40, 6, 0.19, 0.38, 2.60),
    # -- stage 3: the areas grow into each other, and reach formation -------
    ('08', 3,   5.2,  0.8,  8.8, 6.2,  0.18, 6, 2.88, 0.26, None),
    ('09', 3, -11.6,  0.6,  6.8, 7.2, -0.12, 7, 0.53, 0.28, None),
    ('10', 3,  -0.6, -8.6,  9.6, 4.2, -0.08, 6, 1.95, 0.30, None),
    ('11', 3,  12.6,  7.2,  5.8, 5.2,  0.22, 5, 1.31, 0.32, None),
    ('12', 3,  -6.0,  8.4,  5.4, 4.1, -0.20, 6, 0.89, 0.30, None),
    ('13', 3,  11.0, -8.0,  6.0, 4.0,  0.30, 6, 2.55, 0.30, None),
    # -- stage 4 is not blobs. It is the ramp, and then whatever is left,
    #    split four ways. See RAMP and SEEDS below.
]

STAGE_OF = {c[0]: c[1] for c in CHUNKS}
BLOB_STAGES = 3
RAMP_NAME = '14'
LEFT_NAMES = ('15', '16', '17', '18')

# Where the leftovers get split. The metric is deliberately wavy, so the
# boundaries between the four bodies wander instead of being straight.
SEEDS = [(-13.2, 5.6), (-5.4, -3.4), (4.2, 6.8), (12.6, -3.0)]


# How the ground falls away at the edge of a chunk.
#
# This is the single most important number in the file. The first version
# feathered over a fixed fraction of the blob's radius, which on a five metre
# blob three metres deep meant a metre and a half of run for three metres of
# fall: two cells, a metre and a half of height between neighbouring nodes,
# and with the grid warped in plane the edge came out as a crown of triangular
# teeth rather than as a face of soil.
#
# So the edge is built in METRES, as a batter: the run is a fixed multiple of
# the depth, which is what sets the angle. 1.35 is about 36 degrees, which is
# what a machine leaves in a firm soil that has to stand for a few days. On a
# small chunk the run is capped against the chunk's own size, or a shallow
# scrape would be nothing but slope.
EDGE_RUN = 1.35
EDGE_CAP = 0.62


def blob_q(spec, x, y):
    """Where (x, y) stands relative to the chunk's boundary; 1 is on it."""
    _, _, cx, cy, rx, ry, yaw, lobes, seed, _, _ = spec
    ca, sa = math.cos(yaw), math.sin(yaw)
    dx, dy = x - cx, y - cy
    u = dx * ca + dy * sa
    v = -dx * sa + dy * ca
    # The angle is measured in real space, not in the normalised ellipse: in
    # normalised space an elongated blob spends as much angle on its ends as
    # on its flanks, and the lobes there come out as long fingers.
    a = math.atan2(v, u)
    # Amplitudes deliberately small. Above about a fifth the lobes meet in
    # cusps and the boundary reads as decoration rather than as an area a
    # machine worked over.
    lob = (1.0
           + 0.095 * math.sin(a * lobes + seed * 3.0)
           + 0.055 * math.sin(a * (lobes + 3) + seed * 5.0)
           + 0.040 * math.cos(2 * a - seed * 1.7))
    # A superellipse rather than an ellipse. A dug area has corners -- the
    # machine works in passes and stops on a line -- so the boundary wants to
    # be a rounded rectangle pulled about, not a puddle.
    q = (abs(u / rx) ** 2.5 + abs(v / ry) ** 2.5) ** 0.4 / lob
    return q, math.hypot(u, v)


def blob(spec, x, y, depth=1.0):
    """
    How much of `depth` this chunk takes at (x, y); zero outside it.

    The fall-off is a distance in metres from the boundary rather than a
    fraction of the chunk, so a deep chunk gets a long batter and a shallow
    one a short batter, both at the same angle.
    """
    q, rad = blob_q(spec, x, y)
    if q >= 1.0:
        return 0.0
    reff = rad / q if q > 1e-6 else max(spec[4], spec[5])
    inside = (1.0 - q) * reff                      # metres in from the edge
    run = min(EDGE_RUN * max(depth, 0.35), EDGE_CAP * reff)
    if run <= 1e-6:
        return 1.0
    t = inside / run
    if t >= 1.0:
        return 1.0
    # A crest is a BREAK, not a lip. Easing the top of the face into the
    # ground -- which is what a smoothstep does -- spreads the change of slope
    # over three or four cells, and then the line where the material changes
    # from ground to exposed soil falls in the middle of that curve and has to
    # zigzag from cell to cell to follow it. Starting the fall at once puts a
    # real edge there for the material change to sit on, and for the shading
    # to break on. The toe still eases, because a toe does.
    return t ** 0.80


def cap_depth(spec, x, y):
    cap, seed = spec[10], spec[8]
    return cap * (1.0
                  + 0.11 * math.sin(x * 0.21 + seed * 2.0)
                  + 0.08 * math.sin(y * 0.29 + seed * 3.3)
                  + 0.05 * math.sin((x + y) * 0.16 + seed))


def seed_of(x, y):
    best, bi = 1e9, 0
    for i, (sx, sy) in enumerate(SEEDS):
        d = math.hypot(x - sx, y - sy) * (
            1.0 + 0.13 * math.sin(x * 0.27 + y * 0.23 + i * 2.1)
            + 0.07 * math.sin(y * 0.41 - x * 0.18 + i * 1.3))
        if d < best:
            best, bi = d, i
    return bi


# --------------------------------------------------------------- the ramp ---
# A haul ramp down into the cut from the east rim. It is not a chunk in the
# blob sense: it is a LIMIT on how deep the first three stages may dig inside
# its corridor, so the ramp is what is left standing rather than what is
# taken. It comes out in stage 4 as its own body, which is what happens on
# site -- the ramp is the last thing to go, because everything drove down it.
RAMP_SLOPE = 0.25           # down the ramp: 1 in 4
RAMP_HALF = 2.6             # half width of the running surface at the rim
RAMP_FLARE = 0.9            # extra half width at the bottom
RAMP_SIDE = 1.05            # off the side of the ramp: about 46 degrees
RAMP_RUN = 4.2 / RAMP_SLOPE
RAMP_MAX = 4.60             # deeper than the general excavation ever goes


def ramp_centre(x):
    return -6.2 + 2.4 * math.sin((RX - x) * 0.105)


def ramp_limit(x, y):
    """
    Greatest depth stages 1-3 may cut here.

    The sideways term used to be a blend to a huge number, which made the
    shoulder a wall: the limit went from one metre to nine over two thirds of
    a metre, so the chunks either side of it stepped three metres between
    neighbouring nodes and the whole edge came out as a row of teeth. It is a
    slope now, at about 46 degrees, which is a batter rather than a cliff and
    is what the side of a ramp actually looks like.
    """
    run = RX - x
    if run < 0.0:
        return RAMP_MAX * 4
    s = min(1.0, run / RAMP_RUN)
    dy = abs(y - ramp_centre(x))
    over = dy - (RAMP_HALF + RAMP_FLARE * s)
    return RAMP_SLOPE * run + (over * RAMP_SIDE if over > 0.0 else 0.0)


def in_ramp(x, y):
    """The ramp body: exactly where the limit above was the binding one."""
    return ramp_limit(x, y) < RAMP_MAX


# ------------------------------------------------------------- plumbing ----

def grid_axis(n, half, band, steps):
    vs = [-half + 2 * half * i / n for i in range(n + 1)]
    for b in band:
        vs += [-half + b, half - b]
    for s in steps:
        for d in (-0.015, 0.015):
            v = s + d
            if -half + 0.06 < v < half - 0.06:
                vs.append(v)
    return sorted(set(round(v, 4) for v in vs))


def warp(XS, YS):
    """
    Push every interior node off the lattice.

    A perfectly regular grid is what makes a low-poly surface read as a mesh
    rather than as ground: the eye picks up the repeating triangle pairs long
    before it picks up the shape.

    The warp fades out towards the rim. Up there the batter is close to
    vertical and the rows are only 0.2 m apart, so sliding a node 8 cm changes
    its distance from the rim by nearly half and throws it a quarter of a metre
    up or down -- which is exactly what turned the crest into a row of spikes.
    Out on the floor the surface is nearly flat and the warp costs nothing.
    """
    nx, ny = len(XS) - 1, len(YS) - 1
    PX = [[XS[i] for j in range(ny + 1)] for i in range(nx + 1)]
    PY = [[YS[j] for j in range(ny + 1)] for i in range(nx + 1)]
    for i in range(1, nx):
        dx = JITTER * min(XS[i] - XS[i - 1], XS[i + 1] - XS[i])
        for j in range(1, ny):
            dy = JITTER * min(YS[j] - YS[j - 1], YS[j + 1] - YS[j])
            x, y = XS[i], YS[j]
            s = smooth((min(RX - abs(x), RY - abs(y)) - 0.40) / 2.60)
            # ...and off the foundation cuts, whose walls are one cell wide
            te = trench_extra(x, y)
            var = max(abs(trench_extra(x + o, y + p) - te)
                      for o, p in ((0.40, 0), (-0.40, 0), (0, 0.40), (0, -0.40)))
            s *= 1.0 - smooth((var - 0.05) / 0.35)
            PX[i][j] = XS[i] + dx * s * hashn(i * 1.7, j * 2.3, 3.1)
            PY[i][j] = YS[j] + dy * s * hashn(i * 2.9, j * 1.3, 7.7)
    return PX, PY


def new_mesh(name, verts, faces, mat_index, collection):
    me = bpy.data.meshes.new(name + '_mesh')
    me.from_pydata([list(v) for v in verts], [], faces)
    me.validate()
    for s in SLOTS:
        m = bpy.data.materials.get(s)
        if m: me.materials.append(m)
    for f, mi in mat_index.items():
        if f < len(me.polygons):
            me.polygons[f].material_index = mi
    for p in me.polygons:
        p.use_smooth = False
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    return ob


def shade(ob, angle=0.70):
    """
    Smooth the soil, but keep the creases.

    Flat shading on a 0.6 metre grid turns a batter into crystal: every facet
    catches the light differently and the eye reads faceting rather than
    ground. Smoothing the lot instead rounds off the crest of a cut, which is
    the one edge that has to stay sharp. So: smooth everywhere, and sharp on
    any edge where the surface genuinely turns a corner. 40 degrees keeps the
    crest, the toe and the bench noses and softens everything between them.
    """
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    bm = bmesh.new(); bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    sharp = [e.index for e in bm.edges
             if len(e.link_faces) == 2
             and e.link_faces[0].normal.angle(e.link_faces[1].normal) > angle]
    bm.free()
    for i in sharp:
        me.edges[i].use_edge_sharp = True
    me.update()


def ground_normals(PX, PY, G):
    """
    The original ground's own normal at every grid node.

    One field, computed once, from the ground and the grid and nothing else.
    Every body that draws a lid at grade takes its normals from here, so two
    bodies whose lids land in the same place land there with the same normal
    as well -- which is the whole point. See `apply_ground_normals`.
    """
    nx, ny = len(PX) - 1, len(PX[0]) - 1
    N = [[None] * (ny + 1) for _ in range(nx + 1)]
    def P(i, j):
        return Vector((PX[i][j], PY[i][j], G[i][j]))
    for i in range(nx + 1):
        for j in range(ny + 1):
            i0, i1 = max(i - 1, 0), min(i + 1, nx)
            j0, j1 = max(j - 1, 0), min(j + 1, ny)
            n = (P(i1, j) - P(i0, j)).cross(P(i, j1) - P(i, j0))
            if n.length < 1e-12:
                n = Vector((0.0, 0.0, 1.0))
            n.normalize()
            if n.z < 0:
                n = -n
            N[i][j] = n
    return N


def apply_ground_normals(ob, tops, N):
    """
    Give every face still standing on the original ground the ground's normal.

    At 0% the visible surface of the site is not one mesh. It is eighteen
    lids, each the top of a chunk, each drawn at exactly grade, meeting edge
    to edge -- and, on the one-cell ring where a chunk's soil has feathered
    away to nothing, lying exactly on top of one another. Position, material
    and triangulation all agree there. The normals did not: each mesh
    averaged its own faces, and a mesh whose lid dives away under its
    neighbour a cell further in averages a normal a degree or so off level.

    A degree is nothing to look at and a great deal to a low sun: brightness
    at grazing incidence changes by a couple of per cent per degree, so the
    chunk outlines came back as a faint dotted tracery over an untouched
    site. Reading the normal off the ground itself instead makes the eighteen
    lids agree exactly, and whichever of two coincident faces wins a pixel,
    the pixel is the same.

    Only lid faces are touched, and within a lid face only the corners still
    standing at grade. A face with one corner already dug tips down into the
    dug ground; its dug corner keeps the normal that tip earns it, and its
    corners at grade keep the ground's -- which is what the body next to it
    gives those same corners. Walls, undersides, batters, floors and the lids
    of chunks that start part-way down are left entirely alone.
    """
    lid, grade = tops
    me = ob.data
    loops = [Vector(c.vector) for c in me.corner_normals]
    touched = False
    for poly in me.polygons:
        vs = list(poly.vertices)
        on_lid = [v in lid for v in vs]
        if not all(on_lid):
            # A wall, or the underside. The walls that matter here are the
            # ones round the feather edge of a lens, a couple of centimetres
            # tall, whose top edge sits exactly on the lid of the body
            # underneath: they win a scattering of pixels along every chunk
            # outline, and being walls they are painted dark. Their top edge
            # is at grade, so it is given the ground's normal and the pixels
            # it wins stop being visible. A wall with any height to it -- the
            # side of a real cut -- is left alone, and stays a wall.
            if not any(on_lid):
                continue
            zs = [me.vertices[v].co.z for v in vs]
            if max(zs) - min(zs) > 0.05:
                continue
        for li, v in zip(poly.loop_indices, vs):
            n = grade.get(v)
            if n is not None:
                loops[li] = N[n[0]][n[1]]
                touched = True
    if touched:
        me.normals_split_custom_set(loops)
        me.update()


def weld_and_orient(ob, dist=1e-4):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bm.calc_volume(signed=True) < 0.0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    ob.data.update()


DITHER = 0.30


def above(z, b, x, y):
    """
    Is z above the boundary b -- with the answer scrambled either side of it.

    A material boundary on a low-polygon surface is a contour, and a contour
    can only be drawn by choosing a side for each cell, which steps. Where the
    contour runs near a grid direction those steps line up into a row of
    teeth, and no amount of wandering the boundary hides that completely.

    So within thirty centimetres of it the side is chosen partly at random.
    The two materials interleave in a band instead of meeting on a line, which
    at any distance reads as a boundary that is breaking up -- which is what
    the edge between two beds of soil does -- and never as a saw.
    """
    d = z - b
    if -DITHER < d < DITHER:
        return d / DITHER + 0.95 * hashn(x * 2.73, y * 3.11, 5.5) > 0.0
    return d > 0.0


def strata(z, x, y):
    """
    Four beds: dark organic topsoil, mid subsoil, a pale clay band, then
    damper subsoil below it. The boundaries wander with position, so they read
    as bedding planes rather than as a striped texture, and the alternation is
    what carries the layering at this polygon count.
    """
    # The wander is what stops the boundaries reading as a saw. A material
    # boundary is a contour, and a contour drawn on a sloping low-polygon
    # surface has to step from cell to cell; if the contour is nearly straight
    # those steps line up into regular teeth. Wandering it over the better
    # part of a metre, at wavelengths of several metres, turns the same steps
    # into a ragged bedding plane -- which is what a bedding plane looks like.
    b1 = (-1.05 + 0.52 * math.sin(x * 0.31 + y * 0.27) + 0.30 * math.sin(x * 0.90 + 1.4)
          + 0.16 * math.sin(y * 0.55 - x * 0.21 + 2.2))
    b2 = (-2.15 + 0.48 * math.sin(x * 0.24 + y * 0.33 + 1.7) + 0.28 * math.sin(y * 0.81)
          + 0.15 * math.sin(x * 0.47 + y * 0.29 + 0.6))
    b3 = (-3.30 + 0.44 * math.sin(x * 0.29 + y * 0.19 + 3.1) + 0.26 * math.sin(x * 0.63)
          + 0.14 * math.sin(y * 0.71 + 1.1))
    if above(z, b1, x, y): return M_TOPSOIL
    if above(z, b2, x, y): return M_SUBSOIL
    if above(z, b3, x, y): return M_CLAY
    return M_SUBSOIL


def face_material(c, n, at_surface=False):
    """
    What a face is made of, decided by where it is rather than by which body
    it belongs to.

    Flat and low is formation. Everything else is ground down to a wandering
    lip and exposed soil below it.

    Both thresholds were wrong the first time. The floor one counted anything
    flatter than 44 degrees, which is most of a batter, so a slope came out as
    floor wherever a facet happened to lie back and as bedded soil wherever it
    stood up -- a diamond check across the whole face. 21 degrees is the
    formation and the benches, and nothing else.

    And the ground one was a fixed depth, which is a contour: drawn across
    sloping low-polygon cells it steps from one to the next, and where the
    contour runs near a grid direction those steps line up into a row of
    teeth along the top of every cut. Letting the lip wander by most of a
    metre, over several metres, turns the same steps into an edge that has
    slumped unevenly, which is what the top of a cut in soil does.
    """
    gz = top_z(c.x, c.y)
    if n.z > 0.93 and gz - c.z >= 0.30:
        return M_FLOOR
    # How far the ground reaches down over the crest, wandering by the better
    # part of a metre so the line where it gives way to exposed soil is ragged
    # rather than a row of teeth stepping along a contour.
    lip = 0.70 + 0.45 * (0.52 * math.sin(c.x * 0.62 + c.y * 0.41)
                         + 0.33 * math.sin(c.y * 0.83 - c.x * 0.29 + 1.9)
                         + 0.19 * math.sin((c.x + c.y) * 1.15 + 0.7))
    if gz - c.z < lip:
        return M_PAD if in_pad(c.x, c.y) else M_TOP
    # Bedding shows on a face, not on a slope. A batter that lies back is
    # covered in what has run down it, so it takes one tone; the steep faces
    # -- the rim, the sides of a fresh cut, the trench walls -- are where the
    # beds are actually exposed, and they are also where the mesh rows run
    # along the contours rather than across them, so the bands land cleanly.
    if n.z > 0.62:
        return M_SUBSOIL
    return strata(c.z, c.x, c.y)


def depinch(inside, nx, ny, grow=True, thick=None):
    """
    Close the corner pinches in a cell mask.

    Two cells meeting only at a corner make that corner a place where the
    solid touches itself. The four walls that meet there share one vertical
    edge once the duplicate nodes are welded, and an edge with four faces is
    not a manifold edge -- which is the one property every one of these bodies
    is supposed to have.

    A body that owns its footprint outright fixes it by GROWING: filling the
    corner costs one cell, and that cell arrives at no thickness to speak of,
    but `Sheet.advance` gives every node of a built cell its full clearance
    whether the soil was there or not, so the filled cell is still a proper
    lid over the body below rather than a sheet lying on top of it. A body
    whose cells are a share of a partition cannot grow without overlapping its
    neighbour, so it SHRINKS instead, dropping the thinner of the two cells.
    The soil in that cell -- a couple of centimetres of it, at a corner --
    then belongs to nobody and simply stays where it is, buried under the body
    below.
    """
    def depth(i, j):
        if thick is None:
            return 1.0
        return max(thick[a][b] for a, b in
                   ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)))

    touched = 0
    changed = True
    while changed:
        changed = False
        for i in range(nx - 1):
            for j in range(ny - 1):
                a, b = inside[i][j], inside[i + 1][j]
                c, d = inside[i + 1][j + 1], inside[i][j + 1]
                if a and c and not b and not d:
                    pair, fill = ((i, j), (i + 1, j + 1)), (i + 1, j)
                elif b and d and not a and not c:
                    pair, fill = ((i + 1, j), (i, j + 1)), (i, j)
                else:
                    continue
                if grow:
                    inside[fill[0]][fill[1]] = True
                else:
                    lo = min(pair, key=lambda p: depth(*p))
                    inside[lo[0]][lo[1]] = False
                touched += 1
                changed = True
    return touched


class Sheet:
    """
    Two height fields over the warped grid, meshed as one closed lens.

    `tol` is the thickness at which the lens gives up, and `eps` the least
    thickness it will carry inside that boundary. Both matter more than they
    look: a chunk's top surface IS the surface underneath it wherever the
    chunk thins to nothing, so letting the lens feather all the way to zero
    puts two coincident, co-oriented sheets in the same place and the surface
    dissolves into z-fighting.

    Two earlier attempts moved the TOP to settle that, and both of them are
    what the crater outlines were. Sinking the thin part of the lens clear put
    a five centimetre dent in the ground round every chunk. Lifting it four
    millimetres put a raised welt there instead, a metre wide in places, since
    every node thinner than `eps` was lifted and not just the boundary. At 0%
    the top of a chunk IS the ground, so any offset at all, in either
    direction, is a line drawn round that chunk on an untouched site.

    A lens's top sits exactly on the surface it starts from, and the running
    surface behind it drops by exactly what was taken. Two rules keep that
    from drawing a line on the ground.

    The first is `reached`: the surface drops at every node the body drew
    over, including the rim, where the drop is under two millimetres. Not
    dropping it there -- which is what an earlier version did, to keep the
    ground perfectly level -- left every later body bringing its lid up to
    exactly grade round every chunk, a dozen sheets in one place with nothing
    to separate them. The depth test and the shadow map cannot choose between
    sheets that are in the same place, and what they do instead is speckle.

    The second is `RIM_PINCH`: on that rim the lens closes to half a
    millimetre instead of carrying its full thickness out to a vertical WALL.
    The wall is painted in the dark soil colour, and a wall standing at
    exactly the height of the ground puts a sliver of itself across the pixels
    along the edge -- a fraction of a pixel wide, which does not draw a line
    but draws a dotted one, wherever the sliver happens to cover a sample.
    Dotted lines round every chunk are what the crater outlines were. Pinched
    to half a millimetre the sliver is a two-hundredth of a pixel, and the
    lens still closes, still holds a positive volume, and still has not moved
    its lid by so much as a micron.

    Sinking that rim under the body below was tried as a third measure and
    rejected. It takes about a quarter of the remaining speckle out of the
    rendered frame, and it pays for that with a two-millimetre groove
    wherever two lids merely abut -- because there both sides are rim and both
    sink. Two millimetres is a fifth of a degree of slope across a half-metre
    cell and nothing can see it; but it is still a dip in the finished ground
    following the outline of a chunk, which is the one thing this surface is
    not allowed to have. Nothing moves the lid.
    """

    SINK = 0.003        # how far a lid's outer edge tucks under the lid below

    RIM_PINCH = 0.0005  # what is left of the wall where the lens closes

    def __init__(self, name, PX, PY, ztop, zbot, thick, coll, tol=0.002, eps=0.003,
                 cells=None, prev=None, gnorm=None, room=None):  # room: unused, kept for callers
        self.nx, self.ny = len(PX) - 1, len(PX[0]) - 1
        self.PX, self.PY = PX, PY
        self.ztop, self.zbot, self.thick = ztop, zbot, thick
        self.name, self.coll = name, coll
        self.tol, self.eps = tol, eps
        # An explicit cell mask, for bodies whose extent is decided by where
        # they are rather than by how thick they are. Two bodies that share a
        # boundary must not both claim the cells along it: their tops would be
        # coincident and co-oriented, which is z-fighting. Cells are the unit
        # of ownership precisely so that they cannot overlap.
        self.cells = cells
        # How far the ground under this body has already been dropped, per
        # node, and the original ground's normal field. Together they say
        # which of this body's lid vertices are still standing on untouched
        # ground -- see `apply_ground_normals`.
        self.prev = prev
        self.gnorm = gnorm

    def build(self, surface_test):
        nx, ny, PX, PY = self.nx, self.ny, self.PX, self.PY
        tol, eps = self.tol, self.eps
        inside = [[max(self.thick[a][b] for a, b in
                       ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))) >= tol
                   and (self.cells is None or self.cells[i][j])
                   for j in range(ny)] for i in range(nx)]
        self.pinches = depinch(inside, nx, ny, grow=self.cells is None,
                               thick=self.thick)

        # A node is on the rim when one of the cells beside it was not built
        # -- because the soil ran out there, or because the cell belongs to a
        # neighbouring body. Either way the lid stops and its wall begins.
        rim = [[(i == 0 or i == nx or j == 0 or j == ny) for j in range(ny + 1)]
               for i in range(nx + 1)]
        for i in range(nx):
            for j in range(ny):
                if not inside[i][j]:
                    for a, b in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)):
                        rim[a][b] = True

        verts, faces, mat = [], [], {}
        iT, iB = {}, {}

        def vT(i, j):
            if (i, j) not in iT:
                iT[(i, j)] = len(verts)
                verts.append(Vector((PX[i][j], PY[i][j],
                                     self.ztop[i][j])))
            return iT[(i, j)]

        def vB(i, j):
            # `eps` is a floor on the LENS THICKNESS, and it pushes the
            # underside DOWN, never the top up, so a thin body still has
            # somewhere to put its walls without lifting a surface anybody can
            # see.
            #
            # On the thin rim it does the opposite and pinches the lens shut
            # instead, to half a millimetre. The rim is where the lid ends and
            # the WALL begins, and the wall is a vertical face in the dark
            # colour soil faces are painted, standing at the exact height the
            # ground is at. However carefully the lid is tucked under its
            # neighbour, a vertical face still puts a sliver of itself across
            # the pixels along that edge -- a fraction of a pixel wide, which
            # is not a line but a dotted one, and dotted lines round every
            # chunk are what the crater outlines are. A wall half a millimetre
            # tall has a sliver a two-hundredth of a pixel wide. There is
            # nothing left to catch.
            if (i, j) not in iB:
                d = self.RIM_PINCH if rim[i][j] else max(self.thick[i][j], eps)
                iB[(i, j)] = len(verts)
                verts.append(Vector((PX[i][j], PY[i][j], self.ztop[i][j] - d)))
            return iB[(i, j)]

        def add(f, m):
            faces.append(f); mat[len(faces) - 1] = m

        for i in range(nx):
            for j in range(ny):
                if not inside[i][j]:
                    continue
                cs = ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))
                t = [vT(a, b) for a, b in cs]
                bq = [vB(a, b) for a, b in cs]
                ct = sum((verts[v] for v in t), Vector()) / 4
                n = (verts[t[1]] - verts[t[0]]).cross(verts[t[3]] - verts[t[0]])
                n = n.normalized() if n.length > 1e-9 else Vector((0, 0, 1))
                if n.z < 0: n = -n
                m = face_material(ct, n, surface_test(cs))
                # The diagonal follows the surface rather than a direction.
                # Splitting a steep cell the wrong way puts a crease across
                # it, and a field of creases at cell spacing is what makes a
                # soil face read as shattered rock. Where the cell is near
                # flat the two are equal and a hash breaks the tie, so the
                # triangulation still does not run one way across the floor.
                d02 = abs(verts[t[0]].z - verts[t[2]].z)
                d13 = abs(verts[t[1]].z - verts[t[3]].z)
                if (d02 < d13 - 0.02 or
                        (abs(d02 - d13) <= 0.02 and hashn(i * 3.7, j * 5.1, 1.9) > 0.0)):
                    add((t[0], t[1], t[2]), m); add((t[0], t[2], t[3]), m)
                    add((bq[0], bq[2], bq[1]), M_CLAY); add((bq[0], bq[3], bq[2]), M_CLAY)
                else:
                    add((t[1], t[2], t[3]), m); add((t[1], t[3], t[0]), m)
                    add((bq[1], bq[3], bq[2]), M_CLAY); add((bq[1], bq[0], bq[3]), M_CLAY)
                sides = (((i, j), (i + 1, j), (i, j - 1)),
                         ((i + 1, j), (i + 1, j + 1), (i + 1, j)),
                         ((i + 1, j + 1), (i, j + 1), (i, j + 1)),
                         ((i, j + 1), (i, j), (i - 1, j)))
                for (a, b, nb) in sides:
                    ni, nj = nb
                    if 0 <= ni < nx and 0 <= nj < ny and inside[ni][nj]:
                        continue
                    ta, tb = vT(*a), vT(*b)
                    ba, bb = vB(*a), vB(*b)
                    c = (verts[ta] + verts[tb] + verts[ba] + verts[bb]) / 4
                    add((ta, tb, bb, ba), strata(c.z, c.x, c.y))

        self.inside = inside

        ob = new_mesh(self.name, verts, faces, mat, self.coll)
        weld_and_orient(ob, dist=1e-5)
        shade(ob)

        # Which of this body's vertices are its lid, still standing on ground
        # nobody has taken yet. Matched by position, because welding is free to
        # renumber. See `apply_ground_normals`.
        if self.gnorm is not None and self.prev is not None:
            key = lambda v: (round(v.x, 5), round(v.y, 5), round(v.z, 5))
            every, at_grade = set(), {}
            for (i, j), vi in iT.items():
                k = key(verts[vi])
                every.add(k)
                if self.prev[i][j] <= 0.01:
                    at_grade[k] = (i, j)
            lid, grade = set(), {}
            for v in ob.data.vertices:
                k = key(v.co)
                if k in every:
                    lid.add(v.index)
                    n = at_grade.get(k)
                    if n is not None:
                        grade[v.index] = n
            apply_ground_normals(ob, (lid, grade), self.gnorm)
        return ob

    def reached(self):
        """
        Which grid nodes this body drew geometry over.

        Every node of every built cell, and no others. The surface drops by
        what was taken at each of them -- which on the rim is under two
        millimetres, because a node next to an unbuilt cell is a node the
        cell next door found too thin to draw.

        The earlier rule was stricter: a node counted only when EVERY cell
        around it was built, so the surface did not drop at all on the rim.
        That kept the ground perfectly flat and had a cost that turned out to
        be the whole problem. If the surface never drops on a chunk's rim then
        every later body, right down to the last, brings its lid up to exactly
        grade there -- a dozen sheets in the same place, round every chunk,
        arguing over the depth test and the shadow map. Letting the surface
        drop by the two millimetres that were actually taken separates all of
        them, and two millimetres of ground is a fifth of a degree of slope
        across a cell: nothing to look at, and the tuck above hides the edge
        that would otherwise show.
        """
        bv = [[False] * (self.ny + 1) for _ in range(self.nx + 1)]
        for i in range(self.nx):
            for j in range(self.ny):
                if self.inside[i][j]:
                    for a, b in ((i, j), (i+1, j), (i+1, j+1), (i, j+1)):
                        bv[a][b] = True
        return bv


def verts_of(inside, nx, ny):
    """`reached` for a mask that several bodies share."""
    bv = [[False] * (ny + 1) for _ in range(nx + 1)]
    for i in range(nx):
        for j in range(ny):
            if inside[i][j]:
                for a, b in ((i, j), (i+1, j), (i+1, j+1), (i, j+1)):
                    bv[a][b] = True
    return bv


def build_base(PX, PY, G, TD, coll):
    nx, ny = len(PX) - 1, len(PX[0]) - 1
    verts, faces, mat = [], [], {}
    idx = [[0] * (ny + 1) for _ in range(nx + 1)]
    for i in range(nx + 1):
        for j in range(ny + 1):
            idx[i][j] = len(verts)
            verts.append(Vector((PX[i][j], PY[i][j], G[i][j] - TD[i][j])))

    def add(f, m):
        faces.append(f); mat[len(faces) - 1] = m

    for i in range(nx):
        for j in range(ny):
            cs = ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))
            q = [idx[a][b] for a, b in cs]
            c = sum((verts[v] for v in q), Vector()) / 4
            n = (verts[q[1]] - verts[q[0]]).cross(verts[q[3]] - verts[q[0]])
            n = n.normalized() if n.length > 1e-9 else Vector((0, 0, 1))
            if n.z < 0: n = -n
            m = face_material(c, n, max(TD[a][b] for a, b in cs) < 0.05)
            if hashn(i * 3.7, j * 5.1, 1.9) > 0.0:
                add((q[0], q[1], q[2]), m); add((q[0], q[2], q[3]), m)
            else:
                add((q[1], q[2], q[3]), m); add((q[1], q[3], q[0]), m)

    ring = ([(i, 0) for i in range(nx + 1)]
            + [(nx, j) for j in range(1, ny + 1)]
            + [(i, ny) for i in range(nx - 1, -1, -1)]
            + [(0, j) for j in range(ny - 1, 0, -1)])
    low = {}
    for (i, j) in ring:
        low[(i, j)] = len(verts)
        verts.append(Vector((PX[i][j], PY[i][j], BASE_Z)))
    for a in range(len(ring)):
        p, q = ring[a], ring[(a + 1) % len(ring)]
        add((idx[p[0]][p[1]], low[p], low[q], idx[q[0]][q[1]]), M_CLAY)
    add(tuple(low[k] for k in ring), M_CLAY)

    ob = new_mesh('GROUND_BASE', verts, faces, mat, coll)
    weld_and_orient(ob)
    shade(ob)
    return ob



# --------------------------------------------------------------- spoil -----
"""
Dumped soil, in clusters rather than mounds.

Each stage tips its earth in a different place along the bank north of the
site, and each cluster is two to four overlapping lobes, each its own object,
so the animation can grow them one at a time rather than inflating a single
dome. The bank runs east to west across the stages, which is roughly the
order the chunks come out in.

The bank runs along the north edge of the site, east to west across the
stages, in the corridor left between the excavation rim and the storage bays.

The sizes are not the real thing and cannot be: the general excavation is
about 3200 cubic metres, and bulked up that is a bank twenty-five metres
high. What IS honest here is the proportion -- each stage's cluster is scaled
so its volume is that stage's share of the total, against a visible total
that keeps the heaps at working scale, and the scale is capped so a big
stage cannot grow into the storage bays behind it.
"""
#            x,     y,   rx,   ry, height, lobes, yaw, seed
SPOIL = {
    1: [( 21.0, 15.9, 2.5, 1.35, 0.78, 7,  0.10, 0.31),
        ( 18.4, 16.5, 2.0, 1.15, 0.62, 6, -0.08, 1.11)],
    2: [( 15.6, 15.8, 2.8, 1.45, 1.00, 8, -0.06, 1.27),
        ( 13.0, 16.4, 2.4, 1.30, 0.86, 7,  0.12, 2.31),
        ( 17.6, 17.2, 2.0, 1.20, 0.66, 6,  0.05, 0.77)],
    3: [(  9.6, 15.8, 3.2, 1.60, 1.30, 8,  0.09, 2.05),
        (  6.2, 16.3, 3.0, 1.50, 1.18, 7, -0.11, 1.63),
        ( 12.2, 17.1, 2.5, 1.35, 0.94, 6,  0.14, 0.41),
        (  2.8, 15.9, 2.8, 1.45, 1.06, 9,  0.02, 2.88)],
    4: [( -0.8, 16.0, 3.1, 1.55, 1.26, 8, -0.10, 0.83),
        ( -4.4, 15.8, 2.9, 1.40, 1.15, 7,  0.08, 1.49),
        ( -7.6, 15.6, 2.5, 1.25, 0.98, 6, -0.05, 2.62),
        ( -2.6, 17.4, 2.2, 1.25, 0.80, 7,  0.13, 0.19)],
    5: [( 19.8, 18.8, 1.9, 1.15, 0.62, 6,  0.06, 1.95),
        ( 22.6, 19.3, 1.7, 1.05, 0.52, 7, -0.09, 0.57)],
}
SPOIL_RINGS = [0.12, 0.34, 0.58, 0.80, 1.00]
SPOIL_PHASE = [0.00, 0.41, 0.73, 0.22, 0.58]
SPOIL_JITTER = [0.10, 0.15, 0.15, 0.10, 0.04]
SPOIL_SPOKES = 14
SPOIL_VISIBLE = 170.0        # cubic metres of heap for 3400 of excavation
SPOIL_SCALE_LIMIT = (0.70, 1.18)


def lobe_mesh(cx, cy, rx, ry, hgt, lobes, yaw, seed, bz, scale):
    verts, faces, mat = [], [], {}
    rx, ry, hgt = rx * scale, ry * scale, hgt * scale
    spill = seed * 2.3
    ca, sa = math.cos(yaw), math.sin(yaw)
    crest = []
    for ri, fr in enumerate(SPOIL_RINGS):
        for k in range(SPOIL_SPOKES):
            a = TAU * (k + SPOIL_PHASE[ri]) / SPOIL_SPOKES
            lob = (1.0
                   + 0.17 * math.sin(a * lobes + seed * 4.0)
                   + 0.10 * math.sin(a * (lobes * 2 + 1) + seed * 2.0)
                   + 0.14 * math.cos(a - spill))
            jr = SPOIL_JITTER[ri] * hashn(a * 3.1 + ri * 1.7, fr * 7.7, seed)
            u = math.cos(a) * rx * fr * (lob + jr)
            v = math.sin(a) * ry * fr * (lob + jr)
            z = (hgt * (1.0 - fr ** 1.8) ** 0.70
                 + hgt * (0.13 if ri < 3 else 0.05)
                 * hashn(a * 5.3 + ri * 2.3, fr * 2.9, seed + 1.4))
            if ri == len(SPOIL_RINGS) - 1: z = -0.02
            if ri == 0: crest.append(z)
            verts.append(Vector((u * ca - v * sa, u * sa + v * ca, z)))
    ctr = len(verts)
    verts.append(Vector((0.0, 0.0, sum(crest) / len(crest) * 0.97)))

    def vid(r, k): return r * SPOIL_SPOKES + (k % SPOIL_SPOKES)

    def push(f):
        faces.append(f)
        c = sum((verts[v] for v in f), Vector()) / len(f)
        mat[len(faces) - 1] = M_TOPSOIL if c.z > hgt * 0.55 else M_SUBSOIL

    for k in range(SPOIL_SPOKES):
        push((ctr, vid(0, k), vid(0, k + 1)))
    for r in range(len(SPOIL_RINGS) - 1):
        for k in range(SPOIL_SPOKES):
            push((vid(r, k), vid(r + 1, k), vid(r + 1, k + 1), vid(r, k + 1)))
    last = len(SPOIL_RINGS) - 1
    push(tuple(vid(last, k) for k in range(SPOIL_SPOKES - 1, -1, -1)))
    return verts, faces, mat


def mesh_volume(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    v = abs(bm.calc_volume(signed=True)); bm.free()
    return v


def build_spoil(ground, coll, shares):
    """
    Built twice. The first pass measures the cluster at its nominal size; the
    second rebuilds it scaled so the cluster carries its stage's share of the
    spoil. The scale is baked into the vertices, so every spoil object leaves
    Blender with an identity transform apart from its own position, and the
    animation can own the scale outright.
    """
    made, groups, vols = [], {}, {}
    for n in sorted(SPOIL):
        want = SPOIL_VISIBLE * shares.get(n, 0.0)
        grp = bpy.data.objects.new('SPOIL_STAGE_%02d' % n, None)
        grp.empty_display_size = 1.2
        coll.objects.link(grp)
        cs = SPOIL[n]
        grp.location = (sum(c[0] for c in cs) / len(cs),
                        sum(c[1] for c in cs) / len(cs), 0.0)
        groups[n] = grp

        def cluster(scale):
            out = []
            for k, spec in enumerate(cs):
                cx, cy = spec[0], spec[1]
                bz = _ray(ground, cx, cy)
                if bz is None: bz = 0.06
                verts, faces, mat = lobe_mesh(*spec, bz=bz, scale=scale)
                ob = new_mesh('SPOIL_%02d_%s' % (n, 'ABCDEF'[k]),
                              verts, faces, mat, coll)
                ob.location = (cx, cy, bz)
                ob.parent = grp
                ob.matrix_parent_inverse = grp.matrix_world.inverted()
                weld_and_orient(ob)
                shade(ob, 0.95)
                out.append(ob)
            return out

        objs = cluster(1.0)
        got = sum(mesh_volume(o) for o in objs)
        if want > 0 and got > 0:
            s = max(SPOIL_SCALE_LIMIT[0],
                    min(SPOIL_SCALE_LIMIT[1], (want / got) ** (1.0 / 3.0)))
            if abs(s - 1.0) > 0.01:
                for o in objs:
                    bpy.data.objects.remove(o, do_unlink=True)
                objs = cluster(s)
        vols[n] = sum(mesh_volume(o) for o in objs)
        made += objs
    return made, groups, vols



# ----------------------------------------------------------------- run -----
OLD = ('FLOOR_', 'WALL_', 'SPOIL_', 'CUT_STAGE_', 'REMOVE_VOLUME_',
       'EXCAVATION_CHUNK_', 'EXCAVATION_STAGE_', 'GROUND_BASE', 'SOIL_VOLUME',
       'SOIL_MASS', 'FOUNDATION_CUTS', 'HAUL_RAMP')
OLD_EXACT = ('GROUND_PATCH', 'EXCAVATION_FLOOR', 'EXCAVATION_SIDES', 'SPOIL')


def clear_old():
    gone = 0
    for ob in list(bpy.data.objects):
        if ob.name.startswith(OLD) or ob.name in OLD_EXACT:
            bpy.data.objects.remove(ob, do_unlink=True); gone += 1
    for me in list(bpy.data.meshes):
        if me.users == 0: bpy.data.meshes.remove(me)
    return gone


def coll(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    return c


def empty(name, coll_, size=1.5):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = size
    coll_.objects.link(ob)
    return ob


def parent_to(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


def run():
    ground = [bpy.data.objects[n] for n in
              ('site_ground_earth', 'site_ground_haul_route', 'site_ground_pad')
              if n in bpy.data.objects]
    gone = clear_old()
    ensure_materials()
    build_rim_tables(ground)

    XS = grid_axis(NX, RX, RIM_BAND, STEP_X)
    YS = grid_axis(NY, RY, RIM_BAND, STEP_Y)
    PX, PY = warp(XS, YS)
    nx, ny = len(XS) - 1, len(YS) - 1
    R = range(nx + 1)

    G = [[top_z(PX[i][j], PY[i][j]) for j in range(ny + 1)] for i in R]
    GD = [[general_depth(PX[i][j], PY[i][j], G[i][j]) for j in range(ny + 1)] for i in R]
    TE = [[trench_extra(PX[i][j], PY[i][j]) for j in range(ny + 1)] for i in R]
    TD = [[GD[i][j] + TE[i][j] for j in range(ny + 1)] for i in R]
    RL = [[ramp_limit(PX[i][j], PY[i][j]) for j in range(ny + 1)] for i in R]

    def centre(i, j):
        xs = (PX[i][j] + PX[i + 1][j] + PX[i + 1][j + 1] + PX[i][j + 1]) / 4
        ys = (PY[i][j] + PY[i + 1][j] + PY[i + 1][j + 1] + PY[i][j + 1]) / 4
        return xs, ys

    soil = coll('SOIL_MASS_COLL')
    sp = coll('SPOIL')

    mass = empty('SOIL_MASS', soil, 2.0)
    stages = {k: empty('EXCAVATION_STAGE_%02d' % k, soil) for k in range(1, 6)}
    for k in stages:
        parent_to(stages[k], mass)

    GN = ground_normals(PX, PY, G)
    cur = [[0.0] * (ny + 1) for _ in R]
    chunks, vols, pinch = [], {}, 0

    def surface_test(c):
        return lambda cs: max(c[a][b] for a, b in cs) < 0.05

    # -- stages 1 to 3: the blobs, in order -------------------------------
    for spec in CHUNKS:
        name, stage = spec[0], spec[1]
        new = [[0.0] * (ny + 1) for _ in R]
        thick = [[0.0] * (ny + 1) for _ in R]
        for i in R:
            for j in range(ny + 1):
                x, y = PX[i][j], PY[i][j]
                d = GD[i][j] if spec[10] is None else min(GD[i][j], cap_depth(spec, x, y))
                d = min(d, RL[i][j])
                take = max(0.0, d - cur[i][j])
                n = cur[i][j] + blob(spec, x, y, take) * take
                new[i][j] = n
                thick[i][j] = n - cur[i][j]
        ztop = [[G[i][j] - cur[i][j] for j in range(ny + 1)] for i in R]
        sh = Sheet('EXCAVATION_CHUNK_%s' % name, PX, PY, ztop, None, thick, soil,
                   prev=cur, gnorm=GN,
                   room=[[TD[a][b] - cur[a][b] for b in range(ny + 1)] for a in R])
        ob = sh.build(surface_test(cur))
        pinch += sh.pinches
        parent_to(ob, stages[stage])
        chunks.append((name, stage, ob))
        vols[name] = mesh_volume(ob)
        bv = sh.reached()
        cur = [[new[i][j] if bv[i][j] else cur[i][j] for j in range(ny + 1)]
               for i in R]

    # -- stage 4: the ramp, then the leftovers, split four ways -----------
    # Every stage-4 body measures its thickness from the SAME surface, the one
    # stage 3 left. They divide the ground between them by cells, so nothing
    # is claimed twice and nothing is missed.
    base_surface = [row[:] for row in cur]
    left = [[max(0.0, GD[i][j] - base_surface[i][j]) for j in range(ny + 1)]
            for i in R]
    ztop4 = [[G[i][j] - base_surface[i][j] for j in range(ny + 1)] for i in R]
    ramp_cells = [[in_ramp(*centre(i, j)) for j in range(ny)] for i in range(nx)]
    own = [[(-1 if ramp_cells[i][j] else seed_of(*centre(i, j)))
            for j in range(ny)] for i in range(nx)]

    # The five of them are siblings, not a sequence: one surface, one
    # thickness field, the ground between them divided by cells. So the
    # running surface is advanced once, from the UNION of what they built,
    # and not five times over. Taken one at a time each would stop short at
    # its own partition line -- the line is the edge of its footprint -- and
    # the surface would keep a ridge along every one of those lines, with the
    # foundation lids standing on top of the ridges.
    def grown(mask):
        """
        One cell of overlap onto the neighbours.

        The five stage-4 bodies divide the ground between them, and a shared
        boundary is a rim like any other: the lid stops, and a wall in the
        dark soil colour starts, at exactly the height the body next door
        brings its own lid up to. On a partition line that wall is not a
        couple of centimetres tall but the full depth of the dig, and a
        sliver of it a fraction of a pixel wide shows along the line.

        Overlapping by one cell puts each body's tucked rim under a
        neighbour's lid that is definitely drawn there. The two lids are cut
        from the same surface, carry the same material and take their normals
        from the same field, so where they coincide there is nothing to tell
        them apart and nothing for the depth test to get wrong.
        """
        out = [[mask[i][j] for j in range(ny)] for i in range(nx)]
        for i in range(nx):
            for j in range(ny):
                if not mask[i][j]:
                    continue
                for a in range(max(i - 1, 0), min(i + 2, nx)):
                    for b in range(max(j - 1, 0), min(j + 2, ny)):
                        out[a][b] = True
        return out

    covered = [[False] * ny for _ in range(nx)]
    for name, cells in ([(RAMP_NAME, grown(ramp_cells))]
                        + [(LEFT_NAMES[k],
                            grown([[own[i][j] == k for j in range(ny)]
                                   for i in range(nx)]))
                           for k in range(len(SEEDS))]):
        sh = Sheet('EXCAVATION_CHUNK_%s' % name, PX, PY, ztop4, None, left,
                   soil, cells=cells, prev=base_surface, gnorm=GN,
                   room=[[TD[a][b] - base_surface[a][b] for b in range(ny + 1)]
                         for a in R])
        ob = sh.build(surface_test(base_surface))
        parent_to(ob, stages[4])
        chunks.append((name, 4, ob))
        vols[name] = mesh_volume(ob)
        for i in range(nx):
            for j in range(ny):
                if sh.inside[i][j]:
                    covered[i][j] = True
    bv = verts_of(covered, nx, ny)
    cur = [[(base_surface[i][j] + left[i][j]) if bv[i][j] else cur[i][j]
            for j in range(ny + 1)] for i in R]

    # -- stage 5: the foundations ----------------------------------------
    # Measured from the surface stage 4 actually left, not from the nominal
    # formation level. The two differ by a couple of millimetres at the
    # feather edges, and starting the trenches from the nominal level would
    # stand their lids that couple of millimetres proud of the floor -- which
    # is the same raised outline, drawn round the foundation cuts this time.
    ztop5 = [[G[i][j] - cur[i][j] for j in range(ny + 1)] for i in R]
    left5 = [[max(0.0, TD[i][j] - cur[i][j]) for j in range(ny + 1)] for i in R]
    cuts_sheet = Sheet('FOUNDATION_CUTS', PX, PY, ztop5, None, left5, soil,
                       prev=cur, gnorm=GN, room=left5)
    cuts = cuts_sheet.build(lambda cs: False)
    parent_to(cuts, stages[5])
    vols['FOUNDATION_CUTS'] = mesh_volume(cuts)
    bv = cuts_sheet.reached()
    cur = [[(cur[i][j] + left5[i][j]) if bv[i][j] else cur[i][j]
            for j in range(ny + 1)] for i in R]

    # -- what is never removed -------------------------------------------
    # The deeper of the design depth and the surface the last body actually
    # left. They agree everywhere the bodies reached; where a body stopped
    # short the running surface is the higher of the two, and the base has to
    # be under it, not through it.
    base_drop = [[max(TD[i][j], cur[i][j]) for j in range(ny + 1)] for i in R]
    base = build_base(PX, PY, G, base_drop, soil)
    parent_to(base, mass)

    # -- spoil, in proportion --------------------------------------------
    per_stage = {k: 0.0 for k in range(1, 6)}
    for name, stage, _ in chunks:
        per_stage[stage] += vols[name]
    per_stage[5] += vols['FOUNDATION_CUTS']
    tot = sum(per_stage.values())
    shares = {k: v / tot for k, v in per_stage.items()}

    heaps, groups, svols = build_spoil(ground, sp, shares)
    spoil_root = empty('SPOIL', sp, 2.0)
    for g in groups.values():
        parent_to(g, spoil_root)

    bodies = [ob for _, _, ob in chunks] + [cuts, base]
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in bodies + heaps)
    return dict(gone=gone, chunks=chunks, cuts=cuts, base=base, heaps=heaps,
                groups=groups, vols=vols, svols=svols, per_stage=per_stage,
                shares=shares, tris=tris, pinch=pinch, mass=mass,
                stages=stages, spoil_root=spoil_root,
                fields=(PX, PY, G, GD, TE, TD, RL))
