"""
05 — the columns.

    excavation  ->  rebar  ->  formwork  ->  concrete  ->  COLUMNS

The first moment the thing being built stops being a hole and starts being a
building. Four storeys of frame, growing out of the finished slab.

WHERE THE COLUMNS ARE IS NOT A DECISION

It is read out of the foundation, which already answered it. Six pad footings
were cast at (-9.6, 0, +9.6) x (-4.6, +4.6); the ground beams run between
exactly those points; and each pad carries a cage of nine 3.1 m starter bars on
a 0.5 m grid about its own centre, standing 0.86 m clear of the finished floor.
A starter bar is a column that has not been poured yet. So this file asks
`build_concrete.py` for the same `layout()` the pads were cast from and stands
a column on each of them — there is not one coordinate in here that was chosen
by eye, and moving a pad in `build_foundation.py` moves its column.

The section follows from the same place. The starter cage is 1.0 m across plus
78 mm of bar, so anything under 1.16 m square would leave steel sticking out of
its own column. 1.30 m gives 72 mm of cover, which is what a column of this
size would actually have.

The base is the top of the ground slab, taken from `ring_level()` rather than
written down: every column starts on the floor, and the floor is where the
concrete phase left it.

NO ANIMATION IS BAKED HERE

Four empties, twenty-four boxes, and every box's origin on the middle of its
own base with its geometry running 0..H upward from there. That is the whole
of the contract with the browser: scaling the node in its own vertical axis
grows the column from the floor, and there is no keyframe, driver or shape key
in the file to disagree with it.
"""

import bpy
from mathutils import Vector

SRC = r'D:\Hassan\threejs-test\assets\source\construction\build_concrete.py'

ROOT = 'COLUMNS'
COLL_NAME = 'COLUMNS_COLL'

#: Levels, and how tall each one is. Four, because four is where a frame stops
#: reading as "some columns" and starts reading as a building.
LEVELS = 4
STOREY = 3.60

#: The column section. Square, and the same all the way up — a frame that
#: changes section every storey is a different kind of drawing.
COL = 1.30
#: The chamfer on each vertical arrow. Small enough to be a chamfer and not a
#: taper; it exists to catch a highlight down the corner so a 1.3 m box reads
#: as a cast column rather than as a slab on end.
CHAMFER = 0.05


def source():
    """The concrete build, for its layout and its finished floor level."""
    ns = {}
    exec(open(SRC).read(), ns)
    return ns


def collection(name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def clear_old(coll):
    """Everything this file made last time, and nothing else."""
    gone = 0
    for ob in list(coll.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
        gone += 1
    root = bpy.data.objects.get(ROOT)
    if root is not None:
        bpy.data.objects.remove(root, do_unlink=True)
        gone += 1
    return gone


def empty_node(name, coll, parent=None):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = 0.5
    coll.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def ensure_material(name, rgb, metallic, roughness):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    r = ((rgb >> 16) & 255) / 255
    g = ((rgb >> 8) & 255) / 255
    b = (rgb & 255) / 255
    bsdf.inputs['Base Color'].default_value = (r, g, b, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def section(half, chamfer):
    """
    The cross-section, as an octagon.

    Built as a polygon and extruded rather than as a box run through a bevel
    operator, because the operator's result depends on which edges happen to be
    selected and on the Blender version, and this does not. Eight points, in
    order, counter-clockwise from the south-east.
    """
    h = half
    c = chamfer
    return [
        (h - c, -h), (h, -h + c), (h, h - c), (h - c, h),
        (-h + c, h), (-h, h - c), (-h, -h + c), (-h + c, -h),
    ]


def column(name, cx, cy, base, height, mat, parent, coll):
    """
    One column, standing on its own origin.

    The origin goes at the middle of the base: local x and y run about zero
    because a column is symmetrical about its own centre line, and local z runs
    0..height because that is the axis it grows along. The browser measures
    exactly this and needs no naming convention to do it.
    """
    ring = section(COL / 2, CHAMFER)
    n = len(ring)
    verts = [Vector((x, y, 0.0)) for x, y in ring]
    verts += [Vector((x, y, height)) for x, y in ring]
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    faces.append(tuple(range(n - 1, -1, -1)))          # base cap
    faces.append(tuple(range(n, 2 * n)))               # head cap

    me = bpy.data.meshes.new(name + '_mesh')
    me.from_pydata(verts, [], faces)
    me.validate(clean_customdata=False)
    me.update()
    for p in me.polygons:
        p.use_smooth = False
    me.materials.append(mat)

    ob = bpy.data.objects.new(name, me)
    ob.location = Vector((cx, cy, base))
    coll.objects.link(ob)
    ob.parent = parent
    return ob


def run():
    ns = source()
    g, L = ns['foundation']()
    floor = ns['ring_level'](g, L)      # the top of the ground slab

    coll = collection(COLL_NAME)
    removed = clear_old(coll)
    mat = ensure_material('mat_concrete_column', 0xa5a099, 0.0, 0.72)

    root = empty_node(ROOT, coll)
    levels = [empty_node('COLUMN_LEVEL_%02d' % (k + 1), coll, root)
              for k in range(LEVELS)]

    # West to east, and south before north within a bay — the order a frame is
    # actually poured in, and the order the browser will sweep them in. The
    # sort is here as well as in the rig so the export reads in build order.
    grid = sorted(((p['cx'], p['cy']) for p in L['pads']))

    made = []
    for k in range(LEVELS):
        base = floor + k * STOREY
        row = []
        for i, (cx, cy) in enumerate(grid):
            # Names are unique across the file on purpose: glTF has one flat
            # namespace, so a COLUMN_01 under each of four levels would come
            # back as COLUMN_01.001 and the levels would stop being legible in
            # the export. The level is in the name instead.
            row.append(column('COLUMN_L%d_%02d' % (k + 1, i + 1),
                              cx, cy, base, STOREY, mat, levels[k], coll))
        made.append(row)

    return {
        'removed': removed,
        'floor': round(floor, 4),
        'levels': LEVELS,
        'storey': STOREY,
        'section': COL,
        'grid': [[round(v, 3) for v in p] for p in grid],
        'per_level': [len(r) for r in made],
        'head': round(floor + LEVELS * STOREY, 3),
        'tris': sum(sum(len(p.vertices) - 2 for p in ob.data.polygons)
                    for r in made for ob in r),
    }
