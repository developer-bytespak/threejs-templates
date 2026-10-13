"""
The concrete pour, derived from the foundation rather than described again.

    excavation  ->  rebar  ->  formwork  ->  CONCRETE

Nothing in this file invents a coordinate. It execs `build_foundation.py`,
asks it for the same `layout()` the cages and the boards were built from, and
puts concrete in the cavities those boards make. So every pour sits inside its
own formwork by construction: if the foundation moves, this moves with it, and
if the boards change size the concrete changes size in the same pass.

It never calls the foundation's `run()`, and it never touches the excavation.
Running this rebuilds the CONCRETE collection and nothing else.

WHAT IS IN THE FILE AND WHAT IS NOT

Static geometry only, at its FINISHED level. No animation is baked: React
scales these in Z and nothing else, which is the whole of the effect — the
concrete level rises inside the form until it reaches the finished height.

So every origin is the MIDDLE OF ITS OWN BASE, without exception. That is the
one thing the geometry has to get right, because it is the thing an animation
cannot fix afterwards: an origin anywhere else and scaling in Z would move the
bottom of the pour instead of the top of it.

There is no pour stream, no pipe, no hose and no nozzle. There was, and it is
gone: the concrete has no visible source, because a source implies somebody
holding it. The foundation fills itself.

THE LEVEL

Solved, never chosen. Concrete goes to whichever is lower of

    the formation under it, plus a little, so it stands proud like a casting
    the top of its own boards, less the over-fill the settle takes back out

and the board top is computed the way `wall()` actually stacks planks rather
than from its nominal height — a 0.85 m run of 0.30 m boards on a 0.335 m
pitch tops out at 0.635 m, not 0.85, and a pour that trusted the nominal
figure would stand 200 mm over the shutter.

That is also why there is no single level for the whole job. The perimeter is
boarded 355 mm above formation and the ground beams only 85 mm, so one level
would either drown the beams or leave the footing underground. The four
perimeter runs and the four corners share ONE level, because they are one ring
and a step in it would be visible; everything else takes its own.

The beams are the one element whose top is not flat. Their trench follows a
formation that falls 200 mm along a 22 m run, and a flat fill would sit flush
at one end and 150 mm shy at the other, which reads as a pour that did not
reach. So their top face follows the ground above them — and because the base
is flat and the scaling is in Z from that base, the rising surface is still
exactly the finished profile at every height it passes through.
"""

import math

import bpy
from mathutils import Vector

SRC = r'D:\Hassan\threejs-test\assets\source\construction\build_foundation.py'

ROOT = 'CONCRETE'
COLL_NAME = 'CONCRETE'

#: Pour stages. The sixth event is the settle and has no geometry of its own.
STAGES = 5

#: How far inside a board face the concrete stops. Small enough to read as
#: filled, large enough that no face ever z-fights with a board.
#: How far the slab stands clear of the formation where the ground is high.
LIP = 0.025

CLEAR = 0.006

#: Headroom left under the top of the boards when the pour is at its fullest.
MARGIN = 0.02

#: How far a formed element stands proud of the ground around it, and how far
#: below the lip of its own trench a beam finishes. A pad cast in a box sits up;
#: a ground beam is cast flush, because the slab goes over it.
PROUD = 0.06
BEAM_PROUD = 0.02

#: The over-fill the settle takes back out. Must match OVERFILL in
#: `concreteEvent.js`: the geometry is modelled at the FINISHED level and the
#: animation scales past it during the pour, so this is what reserves the room.
OVER = 0.022


# ------------------------------------------------------------- scaffolding --

def foundation():
    """
    The foundation module, and the layout it built itself from.

    Exec'd rather than imported because Blender's Python has no notion of this
    directory as a package, and `run()` is deliberately not called: all that is
    wanted is the derivation.
    """
    g = {'__name__': 'build_concrete_host', '__file__': SRC}
    exec(compile(open(SRC).read(), SRC, 'exec'), g)
    return g, g['layout'](g['fields']())


def ensure_material(name, colour, metallic, roughness):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        r = ((colour >> 16) & 255) / 255
        gg = ((colour >> 8) & 255) / 255
        b = (colour & 255) / 255
        bsdf.inputs['Base Color'].default_value = (r, gg, b, 1)
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
    m.diffuse_color = (
        ((colour >> 16) & 255) / 255,
        ((colour >> 8) & 255) / 255,
        (colour & 255) / 255,
        1,
    )
    return m


def collection(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def clear_old(coll):
    """Only ever removes what this file made."""
    gone = 0
    for ob in list(coll.objects):
        data = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        if isinstance(data, bpy.types.Mesh) and data.users == 0:
            bpy.data.meshes.remove(data)
        gone += 1
    return gone


# ------------------------------------------------------------------ levels --

def board_top(g, base, height):
    """
    Where the top of a run of shuttering actually is.

    `wall()` stacks whole planks on a fixed pitch and stops, so the last one
    lands at or below the nominal height and the shortfall can be most of a
    board. Every containment check in this file goes through here rather than
    through `base + height`, because the nominal height is not a surface that
    exists.
    """
    pitch = g['BOARD_H'] + g['BOARD_GAP']
    rows = max(1, int(height / pitch))
    return base + g['BOARD_H'] + (rows - 1) * pitch


def capped(top, base, ceiling):
    """The pour level, held under the top of its own boards at full over-fill.

    level + OVER * (level - base) <= ceiling - MARGIN, rearranged.
    """
    return min(top, (ceiling - MARGIN + OVER * base) / (1 + OVER))


def ring_level(g, L):
    """One level for the whole perimeter: four runs and the four corners.

    A ring with a step in it is a ring somebody poured twice, so the runs are
    not allowed their own answers. The level stands PROUD of the HIGHEST
    formation anywhere on the ring — so no part of the footing is underground —
    and is then held under the LOWEST of the four board tops.
    """
    spaced, deepest, strip_runs = g['spaced'], g['deepest'], g['strip_runs']
    floor, bot = L['floor_at'], L['bottom_at']
    s = L['strip']
    highest, ceilings = -1e9, []
    for tag, a, b, axis, _ in strip_runs(s):
        lo = a[0] if axis == 'x' else a[1]
        hi = b[0] if axis == 'x' else b[1]
        pts = [(v, a[1]) if axis == 'x' else (a[0], v) for v in spaced(lo, hi, 1.0)]
        base = deepest(bot, pts)
        height = (min(floor(x, y) for x, y in pts) - base) + 0.46
        highest = max(highest, max(floor(x, y) for x, y in pts))
        ceilings.append(capped(1e9, base, board_top(g, base, height)))
    level = min(highest + PROUD, min(ceilings))
    assert level > highest - 1e-6, (
        'the ring level %.3f is under the formation it sits on (%.3f)' % (level, highest))
    return level

# ------------------------------------------------------------------ pieces --

class Parts:
    """Somewhere to accumulate one pour before it becomes a mesh."""

    def __init__(self):
        self.v = []
        self.f = []

    def box(self, x0, x1, y0, y1, z0, z1):
        base = len(self.v)
        for sx in (x0, x1):
            for sy in (y0, y1):
                for sz in (z0, z1):
                    self.v.append(Vector((sx, sy, sz)))
        for face in [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4),
                     (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]:
            self.f.append(tuple(base + i for i in face))

    def ribbon(self, pts, half, axis, base, tops):
        """
        A run whose top follows the ground and whose bottom does not.

        Four vertices per station, quads between stations, caps at the ends.
        The top is a function of position along the run and the bottom is flat,
        so scaling the finished object along its own axis from the anchored end
        still produces a closed solid with the right surface at the end of the
        fill — which a stack of separate boxes would not.
        """
        base_i = len(self.v)
        for (x, y), t in zip(pts, tops):
            if axis == 'x':
                self.v += [Vector((x, y - half, base)), Vector((x, y + half, base)),
                           Vector((x, y - half, t)), Vector((x, y + half, t))]
            else:
                self.v += [Vector((x - half, y, base)), Vector((x + half, y, base)),
                           Vector((x - half, y, t)), Vector((x + half, y, t))]
        n = len(pts)
        for i in range(n - 1):
            a, b = base_i + i * 4, base_i + (i + 1) * 4
            self.f.append((a + 0, b + 0, b + 1, a + 1))      # bottom
            self.f.append((a + 2, a + 3, b + 3, b + 2))      # top
            self.f.append((a + 0, a + 2, b + 2, b + 0))      # one side
            self.f.append((a + 1, b + 1, b + 3, a + 3))      # the other
        f = base_i
        l = base_i + (n - 1) * 4
        self.f.append((f + 0, f + 1, f + 3, f + 2))
        self.f.append((l + 0, l + 2, l + 3, l + 1))

    def empty(self):
        return not self.f


def emit(name, parts, origin, material, parent, coll):
    """One pour, one object, origin in the middle of its own base."""
    if parts.empty():
        return None
    o = Vector(origin)
    me = bpy.data.meshes.new(name + '_mesh')
    me.from_pydata([v - o for v in parts.v], [], list(parts.f))
    me.validate(clean_customdata=False)
    me.update()
    for p in me.polygons:
        p.use_smooth = False
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    ob.location = o
    coll.objects.link(ob)
    ob.parent = parent
    return ob


def empty_node(name, coll, parent=None, size=1.0):
    o = bpy.data.objects.get(name)
    if o is None:
        o = bpy.data.objects.new(name, None)
        coll.objects.link(o)
    elif o.name not in coll.objects:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
    o.empty_display_size = size
    o.empty_display_type = 'PLAIN_AXES'
    o.parent = parent
    return o


# ------------------------------------------------------------------ stages --

def stage_strip(g, L, level, stage, mat, coll):
    """
    The perimeter footing, as four runs that stop short of the corners.

    The corners are left for the last pour, which is both how a ring is closed
    on site and what gives stage four something to say: until those four
    blocks go in, the footing is four sticks rather than a ring.
    """
    spaced, deepest, strip_runs = g['spaced'], g['deepest'], g['strip_runs']
    floor, bot = L['floor_at'], L['bottom_at']
    s = L['strip']
    half = s['half'] + 0.14 - g['BOARD_T'] / 2 - CLEAR      # inside the boards

    made = []

    for tag, a, b, axis, _ in strip_runs(s):
        lo = a[0] if axis == 'x' else a[1]
        hi = b[0] if axis == 'x' else b[1]
        pts = [(v, a[1]) if axis == 'x' else (a[0], v) for v in spaced(lo, hi, 1.0)]
        base = deepest(bot, pts)
        p = Parts()
        if axis == 'x':
            # Stops half a band-width short at each end: those squares are the
            # corners, and they are stage four.
            x0, x1 = lo + half, hi - half
            p.box(x0, x1, a[1] - half, a[1] + half, base, level)
            origin = ((x0 + x1) / 2, a[1], base)
        else:
            y0, y1 = lo + half, hi - half
            p.box(a[0] - half, a[0] + half, y0, y1, base, level)
            origin = (a[0], (y0 + y1) / 2, base)
        made.append(emit('CONCRETE_STRIP_' + tag, p, origin, mat, stage, coll))
    return [m for m in made if m], half


def stage_pads(g, L, stage, mat, coll):
    """Six pad footings, each rising off its own base to its own level."""
    made, levels = [], []
    bot, floor = L['bottom_at'], L['floor_at']
    half = 1.55 - g['BOARD_T'] / 2 - CLEAR
    for i, pad in enumerate(L['pads']):
        base = bot(pad['cx'], pad['cy'])
        ceiling = board_top(g, base, (floor(pad['cx'], pad['cy']) - base) + 0.38)
        level = capped(floor(pad['cx'], pad['cy']) + PROUD, base, ceiling)
        p = Parts()
        p.box(pad['cx'] - half, pad['cx'] + half,
              pad['cy'] - half, pad['cy'] + half, base, level)
        made.append(emit('CONCRETE_PAD_%02d' % (i + 1), p, (pad['cx'], pad['cy'], base),
                         mat, stage, coll))
        levels.append(level)
    return [m for m in made if m], levels


def stage_beams(g, L, stage, mat, coll):
    """
    The ground beams: one continuous run each, top following the ground.

    Continuous on purpose. The boards stop short of every pad so two sets of
    shuttering do not run through each other, but the CONCRETE must not: a
    beam that stopped at each pad box would leave the finished foundation as
    six islands and five bridges with a gap at every junction. One run per beam
    is also what makes the travelling fill honest — scaling a single span puts
    the leading edge exactly where the concrete has got to, where a mesh made
    of several spans would slide the far ones backwards into open ground.
    """
    spaced = g['spaced']
    floor = L['floor_at']
    made, levels = [], []
    half = 1.0 - g['BOARD_T'] / 2 - CLEAR
    for i, beam in enumerate(L['beams']):
        ax = beam['along']
        lo, hi = (beam['x0'], beam['x1']) if ax == 'x' else (beam['y0'], beam['y1'])
        fixed = beam['cy'] if ax == 'x' else beam['cx']
        # Sampled fine enough that the straight top between two stations
        # never rides more than a few centimetres over a dip in the ground
        # between them.
        stations = spaced(lo, hi, 0.45)
        pts = [(v, fixed) if ax == 'x' else (fixed, v) for v in stations]
        base = min(floor(x, y) for x, y in pts) - beam['depth']
        ceiling = board_top(g, base, beam['depth'] + 0.30)
        tops = [capped(floor(x, y) + BEAM_PROUD, base, ceiling) for x, y in pts]
        p = Parts()
        p.ribbon(pts, half, ax, base, tops)
        mid = (lo + hi) / 2
        origin = (mid, fixed, base) if ax == 'x' else (fixed, mid, base)
        made.append(emit('CONCRETE_BEAM_%02d' % (i + 1), p, origin, mat, stage, coll))
        levels.append(max(tops))
    return [m for m in made if m], levels


def stage_close(g, L, level, half, stage, mat, coll):
    """What is left: the four corners that close the ring, and the pit."""
    made = []
    bot, floor = L['bottom_at'], L['floor_at']
    X, Y = L['strip']['x'], L['strip']['y']
    for tag, sx, sy in (('NE', 1, 1), ('NW', -1, 1), ('SE', 1, -1), ('SW', -1, -1)):
        cx, cy = sx * X, sy * Y
        base = bot(cx, cy)
        p = Parts()
        # The ring's level, not its own: a corner is the point at which two
        # runs become one pour, and it is the one place a step would show.
        p.box(cx - half, cx + half, cy - half, cy + half, base, level)
        made.append(emit('CONCRETE_CORNER_' + tag, p, (cx, cy, base), mat, stage, coll))

    pit = L['pit']
    t = g['BOARD_T'] / 2 + CLEAR
    base = bot(pit['cx'], pit['cy'])
    ceiling = board_top(g, base, (floor(pit['cx'], pit['cy']) - base) + 0.34)
    pit_level = capped(floor(pit['cx'], pit['cy']) + PROUD, base, ceiling)
    p = Parts()
    p.box(pit['x0'] + t, pit['x1'] - t, pit['y0'] + t, pit['y1'] - t, base, pit_level)
    made.append(emit('CONCRETE_PIT', p, (pit['cx'], pit['cy'], base), mat, stage, coll))
    return [m for m in made if m], pit_level


def stage_slab(g, L, level, stage, mat, coll):
    """
    The ground slab: the floor of the whole thing.

    Everything before this is a frame -- a ring, six pads and the beams between
    them -- with bare formation in the bays. This is what makes it a foundation
    rather than a skeleton.

    IT COVERS THE WHOLE INTERIOR. Every square metre inside the perimeter
    footing, corner to corner, with no bays left in earth and no notch cut out
    of it for the haul ramp. An earlier pass paved only where the formation was
    comfortably under the finished level and left the rest brown, which read --
    correctly -- as a floor that had not been finished. A floor slab that stops
    half way is not a floor.

    It finishes at the SAME level as the perimeter, so the footing and the slab
    are one continuous surface with no step in it. That there is room for it at
    all is a near thing: the formation inside the ring runs -4.193 to -3.893
    and the ring pours to -3.8915, so over almost all of the area the slab is
    40-300 mm thick, and over about three square metres by the ramp shoulder
    the ground comes up to within a few millimetres of the level. Those cells
    -- 28 of 2812 -- get their top lifted to LIP above the ground instead of
    being dropped, so the slab stays unbroken and nothing pokes through it. The
    lift is quantised to 5 mm so that neighbouring cells still merge into one
    box, and the largest of them stands 26 mm above the rest of the floor,
    which is a screed tolerance rather than a step.

    The underside is flat and buried, well below the lowest formation, because
    nobody can see the bottom of a slab and a surface that follows the ground
    down there costs triangles to hide in the earth. What it does mean is that
    the fill reads beautifully: rising from that buried base, the concrete
    surfaces first in the LOW corners and spreads across the bays as it comes
    up to level, which is exactly what a floor pour does.

    One hole in it, and it is a real one: the service pit is a pit. It has its
    own walls, poured at stage four, and paving over it would fill in the only
    piece of the foundation that is meant to stay open.
    """
    floor = L['floor_at']
    pit = L['pit']
    s = L['strip']
    half = s['half'] + 0.14 - g['BOARD_T'] / 2 - CLEAR
    # Out to the inner face of the perimeter pour, so the two butt together
    # and the finished foundation is one surface.
    X, Y = s['x'] - half, s['y'] - half

    step = 0.35
    rows = int(round(2 * Y / step))
    cols = int(round(2 * X / step))

    base = min(floor(-X + 2 * X * i / 40, -Y + 2 * Y * j / 24)
               for i in range(41) for j in range(25)) - 0.06

    def is_pit(x, y):
        return (pit['x0'] - 0.12 <= x <= pit['x1'] + 0.12 and
                pit['y0'] - 0.12 <= y <= pit['y1'] + 0.12)

    def top_of(x0, x1, y0, y1):
        """
        The finished level over one cell, which is the level everywhere the
        ground allows it and a hair above the ground where it does not.

        Read at the four corners and the middle rather than at the centre
        alone: a cell is 350 mm across and the formation can climb 20 mm in
        that distance, so a centre sample can say there is room when the corner
        says there is not.
        """
        hi = max(floor(x, y) for x in (x0, (x0 + x1) / 2, x1)
                 for y in (y0, (y0 + y1) / 2, y1))
        if hi <= level - LIP:
            return level
        return math.ceil((hi + LIP) / 0.005) * 0.005

    p = Parts()
    boxes = 0
    lifted = 0
    paved = 0
    for j in range(rows):
        y0 = -Y + 2 * Y * j / rows
        y1 = -Y + 2 * Y * (j + 1) / rows
        ym = (y0 + y1) / 2
        run = None      # where the current box starts
        run_top = None  # and the level it is being poured to
        for i in range(cols + 1):
            x0 = -X + 2 * X * i / cols
            x1 = -X + 2 * X * (i + 1) / cols
            if i < cols and not is_pit((x0 + x1) / 2, ym):
                t = top_of(x0, x1, y0, y1)
                paved += 1
                if t > level + 1e-9:
                    lifted += 1
            else:
                t = None
            if t is not None and run is not None and abs(t - run_top) < 1e-9:
                continue                      # same level: keep the box going
            if run is not None:
                # One box per unbroken run of a row, not one per cell: the
                # slab is a floor, not a mosaic, and the triangle count should
                # say so.
                p.box(run, x0, y0, y1, base, run_top)
                boxes += 1
                run, run_top = None, None
            if t is not None:
                run, run_top = x0, t
    made = [emit('CONCRETE_SLAB', p, (0, 0, base), mat, stage, coll)]
    return [m for m in made if m], {'boxes': boxes, 'cells': paved, 'lifted': lifted}


# -------------------------------------------------------------- the driver --

def run():
    g, L = foundation()

    coll = collection(COLL_NAME)
    removed = clear_old(coll)

    mat = ensure_material('mat_concrete_pour', 0x9d9892, 0.0, 0.74)

    # Under FOUNDATION, because that is what it is part of. Nothing resolves
    # the foundation by walking that node's children — the rig looks its five
    # stage groups up by name — so hanging another branch off it changes
    # nothing about the rebar or the boards.
    parent = bpy.data.objects.get('FOUNDATION')
    root = empty_node(ROOT, coll, parent)
    stages = [empty_node('CONCRETE_STAGE_%02d' % (i + 1), coll, root) for i in range(STAGES)]

    ring = ring_level(g, L)
    strip, half = stage_strip(g, L, ring, stages[0], mat, coll)
    pads, pad_levels = stage_pads(g, L, stages[1], mat, coll)
    beams, beam_levels = stage_beams(g, L, stages[2], mat, coll)
    close, pit_level = stage_close(g, L, ring, half, stages[3], mat, coll)
    slab, runs = stage_slab(g, L, ring, stages[4], mat, coll)

    groups = (strip, pads, beams, close, slab)
    tris = sum(sum(len(p.vertices) - 2 for p in ob.data.polygons)
               for group in groups for ob in group)

    return {
        'removed': removed,
        'ring_level': round(ring, 4),
        'pad_levels': [round(v, 3) for v in pad_levels],
        'beam_levels': [round(v, 3) for v in beam_levels],
        'pit_level': round(pit_level, 3),
        'objects': sum(len(x) for x in groups),
        'tris': tris,
        'stages': {i + 1: len(x) for i, x in enumerate(groups)},
        'slab': runs,
    }
