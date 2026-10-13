"""
The foundation: reinforcement and formwork, built onto the finished excavation.

WHAT THIS IS NOT ALLOWED TO TOUCH

Nothing the excavation owns. Not the chunks, not GROUND_BASE, not
FOUNDATION_CUTS, not the site, the roads, the fencing or the survey kit. This
script adds objects and deletes only its own; run it twice and you get the same
scene twice.

WHERE THE GEOMETRY COMES FROM

Not from a tape measure held up to a screenshot. `build_excavation.py` already
describes the foundation cuts exactly -- a perimeter strip footing as a band of
constant distance from the pit rim, six pad footings, five ground beams and a
deeper service pit, each with its own depth below formation -- and this file
imports that description and reads the same functions the excavation was cut
with:

    floor(x, y)  = top_z(x, y) - general_depth(x, y, top_z(x, y))
    bottom(x, y) = floor(x, y) - trench_extra(x, y)

So every bar is planted on the surface the excavation actually left, and if
the excavation is ever rebuilt with different numbers the reinforcement moves
with it. There is not one hard-coded coordinate in the layout.

WHY THE STEEL SITS ON A LEVEL AND THE GROUND DOES NOT

The pit floor rolls by up to 27 cm, and each trench bottom rolls with it. Real
reinforcement is set to a level, not draped over the ground, so each cage is
planted at the DEEPEST point of its own trench and built flat from there. At
the shallow end of a run the bottom few centimetres of the bars are buried,
which is invisible; the alternative -- following the ground -- would leave the
tops waving about, which is not.

HOW IT IS BUILT FOR ANIMATION

Every group is one object, its origin AT THE POINT IT GROWS FROM, and its
geometry extending from that origin along exactly one axis. A vertical cage has
its origin on the trench bottom and its geometry above it; a run of bars has
its origin at one end and its geometry along the run. Nothing else is needed:
the React side measures each object's local bounding box, finds the one axis
whose near end is the origin, and scales along it. No naming convention to keep
in step, no table of axes to get out of date -- the geometry says which way it
grows, because that is a fact about the geometry.

The GLB is static. There is not a keyframe in this file.
"""

import bpy
import bmesh
import math
from mathutils import Vector

# ----------------------------------------------------------------- setup ---

SRC = r'D:\Hassan\threejs-test\assets\source\construction\build_excavation.py'

ROOT = 'FOUNDATION'
STAGES = 5

#: Main reinforcement. Deliberately fat: the site is 35 m across and a real
#: 16 mm bar would be a third of a pixel. 110 mm reads as steel at this scale
#: and still looks like a bar rather than a pipe.
MAIN_R = 0.055
GRID_R = 0.055

#: How far the slab mesh sits over the ground it is laid on: the depth of a
#: spacer, and no more. It used to be measured from the high corner of the
#: whole floor, which is not a height above anything the reader can see.
MESH_LIFT = 0.05

#: The vertical steel is a heavier bar than the ties and the mats, and is now
#: modelled as one. Raising MAIN_R for everything was tried first and thickened
#: the slab mesh with it, which made the interior read as a grille rather than
#: as reinforcement lying on the ground.
VERT_R = 0.078
SIDES = 6

#: How far the vertical steel stands out of its own trench.
#:
#: These were 1.50 / 2.40 / 1.05 / 1.05 / 1.55, and they were wrong in a way
#: that only showed once there was concrete to compare them with. A bar is
#: measured from the bottom of ITS OWN trench, and the trenches are between
#: 0.6 and 1.4 m deep, so what the reader actually sees is the length MINUS
#: the depth. The pad perimeter uprights came out at 1.05 in a 1.42 m trench:
#: 290 mm of steel buried under its own pour, visible for exactly as long as
#: the pad took to fill and then gone.
#:
#: Set from the other end now — how far each family should stand PROUD of the
#: concrete that will cover it, which is what a reader judges:
#:
#:     perimeter dowels    1.39 m proud     the ring reads from across the site
#:     pad column starters 1.76 m proud     the tallest thing in the pit
#:     pad uprights        0.76 m proud     shorter than the starters, as built
#:     beam links          1.42 m proud
#:     pit wall starters   1.51 m proud
#:
#: Nothing else moved: same layout, same spacing, same positions, same cages.
#: The bars are longer and thicker, and that is all.
STRIP_BAR = 2.55
PAD_COLUMN = 3.10
PAD_UPRIGHT = 2.10
BEAM_BAR = 1.95
PIT_BAR = 2.35

#: Concrete cover, and how far a cage is held off the bottom of its trench.
COVER = 0.07

#: Timber.
BOARD_T = 0.055
BOARD_H = 0.30
BOARD_GAP = 0.035


def fields():
    """The excavation's own description of the ground, imported not copied."""
    g = {'__name__': 'bx_fields', '__file__': SRC}
    exec(compile(open(SRC).read(), SRC, 'exec'), g)
    ground = [bpy.data.objects[n] for n in
              ('site_ground_earth', 'site_ground_haul_route', 'site_ground_pad')
              if n in bpy.data.objects]
    # Fills the rim tables `top_z` needs. It builds nothing.
    g['build_rim_tables'](ground)
    return g


# ------------------------------------------------------------- materials ---

def rgb(hexv):
    def s(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (s((hexv >> 16) & 255), s((hexv >> 8) & 255), s(hexv & 255), 1.0)


def ensure_material(name, colour, metallic, roughness):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    if b:
        b.inputs['Base Color'].default_value = rgb(colour)
        b.inputs['Metallic'].default_value = metallic
        b.inputs['Roughness'].default_value = roughness
    m.diffuse_color = rgb(colour)
    m.metallic = metallic
    m.roughness = roughness
    return m


def materials():
    return (
        # Dark steel. Metallic but rough: bar is mill-finished, not polished,
        # and a shiny one under this sun turns into a row of white lines.
        ensure_material('mat_rebar', 0x44474d, 0.85, 0.46),
        # Warm formwork timber, close to the site's own material family so the
        # boards read as part of the same drawing rather than as an import.
        ensure_material('mat_formwork', 0x8a6a45, 0.0, 0.82),
    )


# ---------------------------------------------------------------- meshes ---

class Parts:
    """Somewhere to accumulate one group's geometry before it becomes a mesh."""

    def __init__(self):
        self.v = []
        self.f = []

    def prism(self, a, b, r, sides=SIDES):
        """A capped prism from a to b. The cheapest thing that reads as a bar."""
        a, b = Vector(a), Vector(b)
        axis = b - a
        length = axis.length
        if length < 1e-6:
            return
        axis = axis / length
        up = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
        u = axis.cross(up).normalized()
        w = axis.cross(u)
        base = len(self.v)
        for end in (a, b):
            for k in range(sides):
                t = 2 * math.pi * k / sides
                self.v.append(end + u * (math.cos(t) * r) + w * (math.sin(t) * r))
        for k in range(sides):
            n = (k + 1) % sides
            self.f.append((base + k, base + n, base + sides + n, base + sides + k))
        self.f.append(tuple(base + k for k in range(sides - 1, -1, -1)))
        self.f.append(tuple(base + sides + k for k in range(sides)))

    def box(self, centre, size):
        """An axis-aligned board."""
        cx, cy, cz = centre
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        base = len(self.v)
        for sx in (-1, 1):
            for sy in (-1, 1):
                for sz in (-1, 1):
                    self.v.append(Vector((cx + sx * hx, cy + sy * hy, cz + sz * hz)))
        # 000 001 010 011 100 101 110 111  ->  (sx, sy, sz) in that order
        q = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4),
             (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        for face in q:
            self.f.append(tuple(base + i for i in face))

    def empty(self):
        return not self.f


def emit(name, parts, origin, material, parent, collection):
    """
    One group, one object, origin at the point it grows from.

    The vertices are written relative to `origin`, so the object's own
    transform puts it in the world and scaling it about its origin is the
    growth. Getting this right here is what keeps the React side down to one
    line per group.
    """
    if parts.empty():
        return None
    o = Vector(origin)
    me = bpy.data.meshes.new(name + '_mesh')
    me.from_pydata([v - o for v in parts.v], [], [f for f in parts.f])
    me.validate(clean_customdata=False)
    me.update()
    for p in me.polygons:
        p.use_smooth = False
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    ob.location = o
    collection.objects.link(ob)
    ob.parent = parent
    return ob


def collection(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def empty_node(name, coll, parent=None, size=1.0):
    o = bpy.data.objects.get(name)
    if o is None:
        o = bpy.data.objects.new(name, None)
        coll.objects.link(o)
    o.empty_display_size = size
    o.empty_display_type = 'PLAIN_AXES'
    o.parent = parent
    return o


def clear_old():
    """Only ever this script's own output."""
    gone = 0
    coll = bpy.data.collections.get(ROOT + '_COLL')
    if coll:
        for ob in list(coll.objects):
            data = ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            if data and data.users == 0 and isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
            gone += 1
    return gone


# ----------------------------------------------------------- the layout ----

def layout(g):
    """
    The foundation, read out of the excavation rather than described again.

    Everything below is derived: the strip footing is the RING band, the pads
    and beams and the service pit are the same rectangles the cuts were made
    from, and every level comes from sampling the surface the dig left.
    """
    top_z, gdep, tex = g['top_z'], g['general_depth'], g['trench_extra']
    RX, RY = g['RX'], g['RY']

    def floor_at(x, y):
        z = top_z(x, y)
        return z - gdep(x, y, z)

    def bottom_at(x, y):
        return floor_at(x, y) - tex(x, y)

    L = {'floor_at': floor_at, 'bottom_at': bottom_at}

    # -- the perimeter strip footing ----------------------------------------
    # RING is (inner distance, outer distance, depth) measured from the pit
    # rim, so its centre-line is a rectangle inset by the mean of the two.
    r0, r1, rdep = g['RING']
    inset = (r0 + r1) / 2
    L['strip'] = {
        'x': RX - inset,
        'y': RY - inset,
        'depth': rdep,
        # The band is 1.9 m wide but only the middle 0.66 m of it is at full
        # depth -- the sides ramp over TRENCH_RAMP. The cage goes in the flat.
        'half': (r1 - r0) / 2 - g['TRENCH_RAMP'] - 0.06,
    }
    L['pads'] = [{'x0': a, 'x1': b, 'y0': c, 'y1': d, 'depth': e,
                  'cx': (a + b) / 2, 'cy': (c + d) / 2}
                 for a, b, c, d, e in g['PADS']]
    L['beams'] = [{'x0': a, 'x1': b, 'y0': c, 'y1': d, 'depth': e,
                   'along': 'x' if (b - a) > (d - c) else 'y',
                   'cx': (a + b) / 2, 'cy': (c + d) / 2}
                  for a, b, c, d, e in g['BEAMS']]
    a, b, c, d, e = g['DEEP'][0]
    L['pit'] = {'x0': a, 'x1': b, 'y0': c, 'y1': d, 'depth': e,
                'cx': (a + b) / 2, 'cy': (c + d) / 2}
    L['ramp'] = g['in_ramp']
    return L


def deepest(fn, pts):
    """The level a cage is set to: the lowest its trench gets along the run."""
    return min(fn(x, y) for x, y in pts)


def strip_runs(s):
    """The four sides of the perimeter footing, each as a straight run."""
    x, y = s['x'], s['y']
    return [
        ('N', (-x, y), (x, y), 'x', (0, 1)),
        ('S', (-x, -y), (x, -y), 'x', (0, -1)),
        ('E', (x, -y), (x, y), 'y', (1, 0)),
        ('W', (-x, -y), (-x, y), 'y', (-1, 0)),
    ]


def spaced(a, b, step):
    """Positions along [a, b] at about `step`, always including both ends."""
    n = max(1, int(round(abs(b - a) / step)))
    return [a + (b - a) * i / n for i in range(n + 1)]


def segments(p0, p1, ok, step=0.35):
    """
    Split a run into the pieces where `ok` holds.

    Used to keep the slab mesh out of the haul ramp: the ramp is a real slope
    cut into the pit and a mat of steel running up it would be the one thing
    in this scene that is obviously not buildable.
    """
    (x0, y0), (x1, y1) = p0, p1
    n = max(2, int(math.hypot(x1 - x0, y1 - y0) / step))
    keep, out, start = None, [], None
    for i in range(n + 1):
        t = i / n
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        good = ok(x, y)
        if good and start is None:
            start = (x, y)
        elif not good and start is not None:
            if math.hypot(x - start[0], y - start[1]) > 0.8:
                out.append((start, (x, y)))
            start = None
    if start is not None and math.hypot(x1 - start[0], y1 - start[1]) > 0.8:
        out.append((start, (x1, y1)))
    return out


# ------------------------------------------ stage 1: the starter bars -----

def stage_vertical(L, stage, mat, coll):
    """
    Vertical reinforcement, growing up out of each trench.

    Six kinds of cage in sixteen groups, and the grouping is the point: a
    stage is not a queue of bars, it is a reinforcement system arriving. Each
    group's origin sits on its own trench bottom, so scaling it in Z is a set
    of bars growing out of the ground rather than an object getting bigger.
    """
    made = []
    bot, s = L['bottom_at'], L['strip']

    # -- perimeter footing: two rows of dowels the length of each run --------
    for tag, a, b, axis, _ in strip_runs(s):
        along = spaced(a[0] if axis == 'x' else a[1],
                       b[0] if axis == 'x' else b[1], 1.45)
        pts = [(v, a[1]) if axis == 'x' else (a[0], v) for v in along]
        base = deepest(bot, pts) + COVER
        p = Parts()
        for (x, y) in pts:
            for off in (-s['half'] + 0.10, s['half'] - 0.10):
                px, py = (x, y + off) if axis == 'x' else (x + off, y)
                p.prism((px, py, base), (px, py, base + STRIP_BAR), VERT_R)
        made.append(emit('REBAR_V_STRIP_' + tag, p, (0, 0, base), mat, stage, coll))

    # -- pads: a column starter cage standing tall, and the pad's own uprights
    for i, pad in enumerate(L['pads']):
        cx, cy = pad['cx'], pad['cy']
        pts = [(cx + dx, cy + dy) for dx in (-0.6, 0, 0.6) for dy in (-0.6, 0, 0.6)]
        base = deepest(bot, pts) + COVER
        p = Parts()
        # The column starters: eight bars on a one metre square, standing a
        # metre clear of formation. These are the tall bundles that make the
        # pads read from across the site.
        for dx, dy in ((-.5, -.5), (0, -.5), (.5, -.5), (.5, 0),
                       (.5, .5), (0, .5), (-.5, .5), (-.5, 0)):
            p.prism((cx + dx, cy + dy, base), (cx + dx, cy + dy, base + PAD_COLUMN), VERT_R)
        # and the pad's own perimeter uprights, short.
        for dx, dy in ((-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0),
                       (0, -1.0), (0, 1.0), (-1.0, 0), (1.0, 0)):
            p.prism((cx + dx, cy + dy, base), (cx + dx, cy + dy, base + PAD_UPRIGHT), VERT_R)
        made.append(emit('REBAR_V_PAD_%02d' % (i + 1), p, (0, 0, base), mat, stage, coll))

    # -- ground beams: links standing along each beam, clear of the pads -----
    for i, beam in enumerate(L['beams']):
        ax = beam['along']
        lo, hi = (beam['x0'], beam['x1']) if ax == 'x' else (beam['y0'], beam['y1'])
        fixed = beam['cy'] if ax == 'x' else beam['cx']
        pts = [(v, fixed) if ax == 'x' else (fixed, v) for v in spaced(lo, hi, 1.0)]
        # The beams run THROUGH the pads, where the trench is a metre deeper.
        # Setting the cage to that would bury it, so the level comes from the
        # beam's own depth below the floor, not from the bottom it shares.
        base = min(L['floor_at'](x, y) for x, y in pts) - beam['depth'] + COVER
        p = Parts()
        for v in spaced(lo, hi, 1.55):
            near_pad = any(abs(v - (pad['cx'] if ax == 'x' else pad['cy'])) < 1.7
                           and abs(fixed - (pad['cy'] if ax == 'x' else pad['cx'])) < 1.7
                           for pad in L['pads'])
            if near_pad:
                continue
            for off in (-0.32, 0.32):
                px, py = (v, fixed + off) if ax == 'x' else (fixed + off, v)
                p.prism((px, py, base), (px, py, base + BEAM_BAR), VERT_R)
        made.append(emit('REBAR_V_BEAM_%02d' % (i + 1), p, (0, 0, base), mat, stage, coll))

    # -- the service pit: wall starters round its edge -----------------------
    pit = L['pit']
    pts = [(pit['x0'] + 0.7, pit['y0'] + 0.7), (pit['x1'] - 0.7, pit['y1'] - 0.7),
           (pit['cx'], pit['cy'])]
    base = deepest(bot, pts) + COVER
    p = Parts()
    for x in spaced(pit['x0'] + 0.45, pit['x1'] - 0.45, 1.05):
        for y in (pit['y0'] + 0.45, pit['y1'] - 0.45):
            p.prism((x, y, base), (x, y, base + PIT_BAR), VERT_R)
    for y in spaced(pit['y0'] + 0.45, pit['y1'] - 0.45, 1.05)[1:-1]:
        for x in (pit['x0'] + 0.45, pit['x1'] - 0.45):
            p.prism((x, y, base), (x, y, base + PIT_BAR), VERT_R)
    made.append(emit('REBAR_V_PIT', p, (0, 0, base), mat, stage, coll))
    return [m for m in made if m]


# --------------------------------------- stage 2: the longitudinal bars ---

def stage_horizontal(L, stage, mat, coll):
    """
    The bars that tie the dowels together, each growing along its own run.

    Every group here extends from its origin along ONE axis, which is what
    lets a run of steel grow out from one end instead of inflating about its
    middle. A bar that inflates reads as an object being revealed; a bar that
    extends reads as a bar being placed.
    """
    made = []
    bot, s = L['bottom_at'], L['strip']

    for tag, a, b, axis, _ in strip_runs(s):
        lo = a[0] if axis == 'x' else a[1]
        hi = b[0] if axis == 'x' else b[1]
        pts = [(v, a[1]) if axis == 'x' else (a[0], v) for v in spaced(lo, hi, 1.0)]
        base = deepest(bot, pts) + COVER
        p = Parts()
        for lift in (0.10, 1.30):
            for off in (-s['half'] + 0.10, s['half'] - 0.10):
                if axis == 'x':
                    p.prism((lo, a[1] + off, base + lift), (hi, a[1] + off, base + lift), MAIN_R)
                else:
                    p.prism((a[0] + off, lo, base + lift), (a[0] + off, hi, base + lift), MAIN_R)
        origin = (lo, a[1], 0) if axis == 'x' else (a[0], lo, 0)
        made.append(emit('REBAR_H_STRIP_' + tag, p, origin, mat, stage, coll))

    for i, beam in enumerate(L['beams']):
        ax = beam['along']
        lo, hi = (beam['x0'], beam['x1']) if ax == 'x' else (beam['y0'], beam['y1'])
        fixed = beam['cy'] if ax == 'x' else beam['cx']
        pts = [(v, fixed) if ax == 'x' else (fixed, v) for v in spaced(lo, hi, 1.0)]
        base = min(L['floor_at'](x, y) for x, y in pts) - beam['depth'] + COVER
        p = Parts()
        for lift in (0.10, 0.88):
            for off in (-0.32, 0.32):
                if ax == 'x':
                    p.prism((lo, fixed + off, base + lift), (hi, fixed + off, base + lift), MAIN_R)
                else:
                    p.prism((fixed + off, lo, base + lift), (fixed + off, hi, base + lift), MAIN_R)
        origin = (lo, fixed, 0) if ax == 'x' else (fixed, lo, 0)
        made.append(emit('REBAR_H_BEAM_%02d' % (i + 1), p, origin, mat, stage, coll))

    pit = L['pit']
    base = deepest(bot, [(pit['cx'], pit['cy'])]) + COVER
    for ax, name in (('x', 'X'), ('y', 'Y')):
        p = Parts()
        for lift in (0.15, 1.20):
            if ax == 'x':
                for y in (pit['y0'] + 0.45, pit['y1'] - 0.45):
                    p.prism((pit['x0'] + 0.45, y, base + lift), (pit['x1'] - 0.45, y, base + lift), GRID_R)
            else:
                for x in (pit['x0'] + 0.45, pit['x1'] - 0.45):
                    p.prism((x, pit['y0'] + 0.45, base + lift), (x, pit['y1'] - 0.45, base + lift), GRID_R)
        origin = ((pit['x0'] + 0.45, pit['cy'], 0) if ax == 'x'
                  else (pit['cx'], pit['y0'] + 0.45, 0))
        made.append(emit('REBAR_H_PIT_' + name, p, origin, mat, stage, coll))
    return [m for m in made if m]


# ------------------------------------------------ stage 3: the grid ------

def stage_grid(L, stage, mat, coll):
    """
    The mats: the pad grids, the ties across the footing, and the slab mesh.

    This is the stage that turns a set of cages into something that reads as
    reinforced concrete, so it is also the stage most at risk of becoming
    visual noise. The spacings below are chosen to be legible at the camera's
    distance rather than to be correct: 1.4 m on the slab and 0.55 m in the
    pads, where a real mat would be 200 mm and would render as grey felt.
    """
    made = []
    floor, bot, s = L['floor_at'], L['bottom_at'], L['strip']
    in_ramp = L['ramp']

    # -- the slab mesh over the open floor ----------------------------------
    #
    # Laid ON the ground, not across it. This was one flat level for the whole
    # mat -- the highest point of the floor plus 50 mm -- on the reasoning that
    # mesh sits on spacers and floating a little is right. It is, by 50 mm. But
    # the formation inside the ring falls about a quarter of a metre from one
    # corner to the other, so a flat mat touched down at exactly one corner and
    # hung 280 mm over bare dirt everywhere else: 23 m of steel visibly
    # suspended in mid-air over the one part of the site with nothing else in
    # it. Each run now follows the ground beneath it, sampled every 3 m, which
    # holds the cover to within a few centimetres the whole way across.
    x_lim, y_lim = s['x'] - 1.35, s['y'] - 1.35
    ok = lambda x, y: not in_ramp(x, y)

    def lay(p, lo, hi, fixed, axis, step=3.0):
        n = max(1, int(round(abs(hi - lo) / step)))
        for k in range(n):
            u0 = lo + (hi - lo) * k / n
            u1 = lo + (hi - lo) * (k + 1) / n
            if axis == 'x':
                p.prism((u0, fixed, floor(u0, fixed) + MESH_LIFT),
                        (u1, fixed, floor(u1, fixed) + MESH_LIFT), GRID_R)
            else:
                p.prism((fixed, u0, floor(fixed, u0) + MESH_LIFT),
                        (fixed, u1, floor(fixed, u1) + MESH_LIFT), GRID_R)

    p = Parts()
    for y in spaced(-y_lim, y_lim, 1.40):
        for (a, b) in segments((-x_lim, y), (x_lim, y), ok):
            lay(p, a[0], b[0], y, 'x')
    made.append(emit('REBAR_G_SLAB_X', p, (-x_lim, 0, floor(-x_lim, 0) + MESH_LIFT),
                     mat, stage, coll))

    p = Parts()
    for x in spaced(-x_lim, x_lim, 1.40):
        for (a, b) in segments((x, -y_lim), (x, y_lim), ok):
            lay(p, a[1], b[1], x, 'y')
    made.append(emit('REBAR_G_SLAB_Y', p, (0, -y_lim, floor(0, -y_lim) + MESH_LIFT),
                     mat, stage, coll))

    # -- the pad mats, one object per pad per direction ---------------------
    # Split by direction because a group can only grow along the axis its
    # bars run on: scaling a mixed group would stretch half of it lengthwise
    # and squash the other half across its own diameter.
    for i, pad in enumerate(L['pads']):
        base = deepest(bot, [(pad['cx'], pad['cy'])]) + COVER + 0.03
        x0, x1 = pad['cx'] - 1.15, pad['cx'] + 1.15
        y0, y1 = pad['cy'] - 1.15, pad['cy'] + 1.15
        p = Parts()
        for y in spaced(y0, y1, 0.55):
            p.prism((x0, y, base), (x1, y, base), GRID_R)
        made.append(emit('REBAR_G_PAD_%02d_X' % (i + 1), p, (x0, pad['cy'], base), mat, stage, coll))
        p = Parts()
        for x in spaced(x0, x1, 0.55):
            p.prism((x, y0, base + 0.09), (x, y1, base + 0.09), GRID_R)
        made.append(emit('REBAR_G_PAD_%02d_Y' % (i + 1), p, (pad['cx'], y0, base + 0.09), mat, stage, coll))

    # -- ties across the strip footing --------------------------------------
    for tag, a, b, axis, _ in strip_runs(s):
        lo = a[0] if axis == 'x' else a[1]
        hi = b[0] if axis == 'x' else b[1]
        pts = [(v, a[1]) if axis == 'x' else (a[0], v) for v in spaced(lo, hi, 1.0)]
        base = deepest(bot, pts) + COVER
        w = s['half'] - 0.06
        p = Parts()
        for v in spaced(lo, hi, 0.95):
            for lift in (0.10, 1.30):
                if axis == 'x':
                    p.prism((v, a[1] - w, base + lift), (v, a[1] + w, base + lift), GRID_R)
                else:
                    p.prism((a[0] - w, v, base + lift), (a[0] + w, v, base + lift), GRID_R)
        # Anchored at the START OF THE RUN, not across the strip. A tie run is
        # tied on working along the footing, so the growth axis has to be the
        # long one; anchoring it across the 0.42 m width would have left the
        # rig deriving a growth direction that thickens a plane of steel
        # instead of laying one out.
        origin = (lo, 0, 0) if axis == 'x' else (0, lo, 0)
        made.append(emit('REBAR_G_TIE_' + tag, p, origin, mat, stage, coll))
    return [m for m in made if m]


# ------------------------------------------- stages 4 and 5: formwork ----

def wall(p, a, b, base, height, thickness, plank=2.4):
    """
    A run of boarding from a to b, built as stacked planks.

    Planks rather than one slab, because the gap between boards is the only
    thing that says timber at this distance — and they cost twelve triangles
    each, so there is no reason not to.
    """
    ax, ay = a
    bx, by = b
    length = math.hypot(bx - ax, by - ay)
    if length < 0.2:
        return
    horiz = abs(bx - ax) >= abs(by - ay)
    n = max(1, int(round(length / plank)))
    rows = max(1, int(height / (BOARD_H + BOARD_GAP)))
    for r in range(rows):
        z = base + BOARD_H / 2 + r * (BOARD_H + BOARD_GAP)
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            cx = ax + (bx - ax) * (t0 + t1) / 2
            cy = ay + (by - ay) * (t0 + t1) / 2
            seg = length / n - 0.04
            size = (seg, thickness, BOARD_H) if horiz else (thickness, seg, BOARD_H)
            p.box((cx, cy, z), size)


def stage_formwork_perimeter(L, stage, mat, coll):
    """The boarding round the outside of the job: eight runs, each rising."""
    made = []
    bot, s = L['bottom_at'], L['strip']
    x, y, w = s['x'], s['y'], s['half'] + 0.14
    for tag, a, b, axis, _ in strip_runs(s):
        lo = a[0] if axis == 'x' else a[1]
        hi = b[0] if axis == 'x' else b[1]
        pts = [(v, a[1]) if axis == 'x' else (a[0], v) for v in spaced(lo, hi, 1.0)]
        base = deepest(bot, pts)
        height = (min(L['floor_at'](px, py) for px, py in pts) - base) + 0.46
        for side, off in (('OUT', w), ('IN', -w)):
            # OUT is the face away from the middle of the site on every run,
            # so the sign follows the run rather than the axis.
            sign = 1 if (a[1] > 0 if axis == 'x' else a[0] > 0) else -1
            d = off * sign
            p = Parts()
            if axis == 'x':
                wall(p, (lo, a[1] + d), (hi, a[1] + d), base, height, BOARD_T)
            else:
                wall(p, (a[0] + d, lo), (a[0] + d, hi), base, height, BOARD_T)
            made.append(emit('FORMWORK_P_%s_%s' % (tag, side), p, (0, 0, base), mat, stage, coll))
    return [m for m in made if m]


def stage_formwork_internal(L, stage, mat, coll):
    """The boxes round the pads, the sides of the beams, and the pit."""
    made = []
    bot, floor = L['bottom_at'], L['floor_at']

    for i, pad in enumerate(L['pads']):
        base = deepest(bot, [(pad['cx'], pad['cy'])])
        height = (floor(pad['cx'], pad['cy']) - base) + 0.38
        hx, hy = 1.55, 1.55
        p = Parts()
        wall(p, (pad['cx'] - hx, pad['cy'] - hy), (pad['cx'] + hx, pad['cy'] - hy), base, height, BOARD_T, 1.6)
        wall(p, (pad['cx'] - hx, pad['cy'] + hy), (pad['cx'] + hx, pad['cy'] + hy), base, height, BOARD_T, 1.6)
        wall(p, (pad['cx'] - hx, pad['cy'] - hy), (pad['cx'] - hx, pad['cy'] + hy), base, height, BOARD_T, 1.6)
        wall(p, (pad['cx'] + hx, pad['cy'] - hy), (pad['cx'] + hx, pad['cy'] + hy), base, height, BOARD_T, 1.6)
        made.append(emit('FORMWORK_I_PAD_%02d' % (i + 1), p, (0, 0, base), mat, stage, coll))

    for i, beam in enumerate(L['beams']):
        ax = beam['along']
        lo, hi = (beam['x0'], beam['x1']) if ax == 'x' else (beam['y0'], beam['y1'])
        fixed = beam['cy'] if ax == 'x' else beam['cx']
        pts = [(v, fixed) if ax == 'x' else (fixed, v) for v in spaced(lo, hi, 1.0)]
        base = min(floor(px, py) for px, py in pts) - beam['depth']
        height = beam['depth'] + 0.30
        # Stop short of the pads: the pad boxes own those corners, and two
        # sets of boards through each other is the sort of detail that makes
        # a clean drawing look like a mistake.
        cuts = sorted((pad['cx'] if ax == 'x' else pad['cy']) for pad in L['pads']
                      if abs((pad['cy'] if ax == 'x' else pad['cx']) - fixed) < 1.7)
        spans, v = [], lo
        for c in cuts:
            if c - 1.7 > v:
                spans.append((v, c - 1.7))
            v = max(v, c + 1.7)
        if hi > v:
            spans.append((v, hi))
        p = Parts()
        for (a, b) in spans:
            for off in (-1.0, 1.0):
                if ax == 'x':
                    wall(p, (a, fixed + off), (b, fixed + off), base, height, BOARD_T, 2.0)
                else:
                    wall(p, (fixed + off, a), (fixed + off, b), base, height, BOARD_T, 2.0)
        made.append(emit('FORMWORK_I_BEAM_%02d' % (i + 1), p, (0, 0, base), mat, stage, coll))

    pit = L['pit']
    base = deepest(bot, [(pit['cx'], pit['cy'])])
    height = (floor(pit['cx'], pit['cy']) - base) + 0.34
    p = Parts()
    wall(p, (pit['x0'], pit['y0']), (pit['x1'], pit['y0']), base, height, BOARD_T, 1.8)
    wall(p, (pit['x0'], pit['y1']), (pit['x1'], pit['y1']), base, height, BOARD_T, 1.8)
    wall(p, (pit['x0'], pit['y0']), (pit['x0'], pit['y1']), base, height, BOARD_T, 1.8)
    wall(p, (pit['x1'], pit['y0']), (pit['x1'], pit['y1']), base, height, BOARD_T, 1.8)
    made.append(emit('FORMWORK_I_PIT', p, (0, 0, base), mat, stage, coll))
    return [m for m in made if m]


# -------------------------------------------------------------- driver ----

def run():
    g = fields()
    L = layout(g)
    gone = clear_old()
    rebar, timber = materials()
    coll = collection(ROOT + '_COLL')
    root = empty_node(ROOT, coll, None, 2.0)
    stages = [empty_node('FOUNDATION_STAGE_%02d' % k, coll, root) for k in range(1, STAGES + 1)]

    made = {
        1: stage_vertical(L, stages[0], rebar, coll),
        2: stage_horizontal(L, stages[1], rebar, coll),
        3: stage_grid(L, stages[2], rebar, coll),
        4: stage_formwork_perimeter(L, stages[3], timber, coll),
        5: stage_formwork_internal(L, stages[4], timber, coll),
    }

    report = {}
    total = 0
    for k, obs in made.items():
        tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in obs)
        total += tris
        report[k] = (len(obs), tris)
    return {'removed': gone, 'stages': report, 'tris': total,
            'objects': sum(len(o) for o in made.values()), 'made': made}
