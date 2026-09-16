"""
EMPTY CONSTRUCTION SITE — generator for the /construction route.

Run headless:      python3 build_empty_site.py
Run inside Blender: Scripting tab -> open -> Run

WHY A SCRIPT AND NOT A HAND-MODELLED FILE
The site has to stay editable by numbers. Every stage that follows — survey,
excavation, foundation, structure — has to land on the same grid as this, and a
grid you can re-read off a variable is one you can match. Change PLOT or CLEAR
below and the fence, the road, the sidewalk and the context all re-fit.

CONVENTIONS, taken from building_exploded_assembly.glb so the two files agree:
  units      metres
  up         Blender +Z  (exports to glTF +Y)
  ground     top surface of the site sits at Z = 0
             the building's raft bottoms out at GROUND_Y = -1.5 in the scene,
             so the site drops in at position [0, -1.5, 0]
  naming     snake_case; group empties named for their collection
  materials  mat_<thing>_<finish>
"""

import math
import bpy
import bmesh
from mathutils import Vector

# --------------------------------------------------------------------- scale
# The building that arrives later is 24 m x 16 m in plan and 30 m tall.
BUILDING = (24.0, 16.0)
# The fenced plot. Sized so the establishing camera at ~80 m reads the whole
# site with air around it, and the 3/4 shot at ~46 m still contains the fence.
PLOT_X, PLOT_Y = 72.0, 52.0
HX, HY = PLOT_X / 2, PLOT_Y / 2
# Nothing is built inside this. Every later stage lands here, so it has to stay
# clear by construction rather than by care.
CLEAR_X, CLEAR_Y = 19.0, 14.0

ROAD_W = 12.0          # carriageway, on the -Y side: the site fronts the street
WALK_W = 2.6           # sidewalk between fence line and kerb
KERB_H = 0.14

random_seed = 7


# ---------------------------------------------------------------- materials
def mat(name, rgb, rough=0.85, metal=0.0, alpha=1.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = 'BLEND'
    m.diffuse_color = (*rgb, alpha)
    return m


def build_materials():
    """Restrained and few. The palette answers the existing route: very dark
    ground, concrete greys, charcoal metal, blue-grey glass, one warm note in
    the timber so the site is not entirely cool."""
    return {
        'soil':      mat('mat_site_soil',        (0.106, 0.094, 0.082), 0.98),
        'gravel':    mat('mat_site_gravel',      (0.152, 0.150, 0.147), 0.95),
        'hardcore':  mat('mat_site_hardcore',    (0.128, 0.124, 0.118), 0.96),
        'concrete':  mat('mat_concrete_pale',    (0.232, 0.230, 0.223), 0.86),
        'kerb':      mat('mat_concrete_kerb',    (0.160, 0.160, 0.157), 0.90),
        'asphalt':   mat('mat_road_asphalt',     (0.052, 0.054, 0.058), 0.93),
        'marking':   mat('mat_road_marking',     (0.400, 0.392, 0.360), 0.80),
        'hoarding':  mat('mat_fence_hoarding',   (0.068, 0.076, 0.086), 0.74, 0.22),
        'mesh':      mat('mat_fence_mesh',       (0.105, 0.113, 0.122), 0.60, 0.52),
        'post':      mat('mat_metal_dark',       (0.072, 0.078, 0.086), 0.62, 0.55),
        'galv':      mat('mat_metal_galv',       (0.198, 0.205, 0.214), 0.46, 0.78),
        'accent':    mat('mat_accent_amber',     (0.520, 0.300, 0.110), 0.70, 0.10),
        'timber':    mat('mat_timber_pallet',    (0.230, 0.160, 0.092), 0.90),
        'board':     mat('mat_sign_board',       (0.258, 0.260, 0.258), 0.82),
        'container': mat('mat_container_shell',  (0.150, 0.162, 0.170), 0.66, 0.30),
        'glass':     mat('mat_glass_blue_gray',  (0.062, 0.084, 0.110), 0.16, 0.55),
        'ctx':       mat('mat_context_facade',   (0.058, 0.061, 0.067), 0.90),
        'ctx_dark':  mat('mat_context_recess',   (0.030, 0.032, 0.036), 0.93),
        'veg':       mat('mat_vegetation',       (0.036, 0.050, 0.032), 0.96),
        'trunk':     mat('mat_vegetation_trunk', (0.098, 0.082, 0.068), 0.94),
    }


# ------------------------------------------------------------------ helpers
def new_mesh_obj(name, bm, material, coll, origin=(0, 0, 0)):
    """bmesh -> object, with the origin placed deliberately.

    Geometry is authored in world space and then shifted back by the origin, so
    every object ends up with an origin you can animate from — the base of a
    post, the centre of a stack — and a transform of exactly (loc, identity,
    identity). Nothing needs 'apply transform' afterwards because nothing was
    ever scaled or rotated at object level."""
    me = bpy.data.meshes.new(name)
    ox, oy, oz = origin
    if origin != (0, 0, 0):
        for v in bm.verts:
            v.co.x -= ox
            v.co.y -= oy
            v.co.z -= oz
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    ob.location = origin
    coll.objects.link(ob)
    return ob


def bm_box(bm, cx, cy, cz, sx, sy, sz):
    """Axis-aligned box by centre + size, added into an existing bmesh."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    vs = [bm.verts.new((cx + x * hx, cy + y * hy, cz + z * hz))
          for x, y, z in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                          (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))]
    for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1),
              (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([vs[i] for i in f])
    return bm


def bm_cyl(bm, cx, cy, cz, r, h, seg=12, axis='Z', inner=0.0):
    """A prism. `inner` hollows it out, which is what makes a concrete pipe
    read as a pipe rather than as a log at any distance you can see the end."""
    rings = []
    radii = [r] if inner <= 0 else [r, inner]
    for rad in radii:
        for end in (-h / 2, h / 2):
            ring = []
            for i in range(seg):
                a = 2 * math.pi * i / seg
                u, v = math.cos(a) * rad, math.sin(a) * rad
                if axis == 'Z':
                    ring.append(bm.verts.new((cx + u, cy + v, cz + end)))
                elif axis == 'Y':
                    ring.append(bm.verts.new((cx + u, cy + end, cz + v)))
                else:
                    ring.append(bm.verts.new((cx + end, cy + u, cz + v)))
            rings.append(ring)
    def tube(a, b):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new([a[i], a[j], b[j], b[i]])
    tube(rings[0], rings[1])
    if inner > 0:
        tube(rings[3], rings[2])
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new([rings[0][i], rings[2][i], rings[2][j], rings[0][j]])
            bm.faces.new([rings[1][j], rings[3][j], rings[3][i], rings[1][i]])
    else:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[1])
    return bm


def bm_sphere(bm, cx, cy, cz, r, seg=10, rings=5, squash=1.0, dome=False):
    """A low-poly sphere. Canopies and aggregate heaps were built from prisms,
    and at ground level a flat-topped green drum is what you got — the facets
    were larger than the fence panels behind them. Round things have to be
    round."""
    grid = []
    # A dome stops at the equator and caps flat, so a heap of aggregate does not
    # bury an unseen lower hemisphere under the site. Hidden geometry is still
    # geometry: it ships, it renders, and it drags the bounding box below ground.
    arc = math.pi / 2 if dome else math.pi
    for i in range(rings + 1):
        phi = arc * i / rings
        z = math.cos(phi) * r * squash
        rr = math.sin(phi) * r
        if i == 0 or (i == rings and not dome):
            grid.append([bm.verts.new((cx, cy, cz + z))])
            continue
        row = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            row.append(bm.verts.new((cx + math.cos(a) * rr, cy + math.sin(a) * rr, cz + z)))
        grid.append(row)
    for i in range(rings):
        a, b = grid[i], grid[i + 1]
        if len(a) == 1:
            for j in range(seg):
                bm.faces.new([a[0], b[j], b[(j + 1) % seg]])
        elif len(b) == 1:
            for j in range(seg):
                bm.faces.new([a[j], a[(j + 1) % seg], b[0]])
        else:
            for j in range(seg):
                k = (j + 1) % seg
                bm.faces.new([a[j], a[k], b[k], b[j]])
    if dome:
        bm.faces.new(list(reversed(grid[-1])))
    return bm


def box_obj(name, centre, size, material, coll, origin=None):
    bm = bmesh.new()
    bm_box(bm, *centre, *size)
    return new_mesh_obj(name, bm, material, coll, origin or tuple(centre))


# ------------------------------------------------------------------- ground
def ground_z(x, y):
    """Compacted earth: graded flat, not landscaped.

    Three low-frequency terms and nothing else. Noise here would be a mistake —
    a construction plot has been driven over by a roller, so it wants long soft
    undulations and a shallow dish where the plant turns, not the fractal
    lumpiness of open ground. Amplitude stays inside +/-0.13 m so the survey and
    excavation stages have a level datum to work against."""
    z = (0.085 * math.sin(x * 0.055 + 0.7) * math.cos(y * 0.062)
         + 0.055 * math.sin(x * 0.021 - y * 0.030 + 2.1))
    # The turning circle, worn a little lower than the rest.
    d = math.hypot(x * 0.55, y * 0.75)
    z -= 0.075 * math.exp(-(d / 15.0) ** 2)
    # The plot is graded to fall very slightly toward the street.
    z += y * 0.0035
    return z


def build_ground(M, colls):
    c = colls['SITE_GROUND']
    NX, NY = 48, 34
    bm = bmesh.new()
    grid = []
    for iy in range(NY + 1):
        row = []
        y = -HY + PLOT_Y * iy / NY
        for ix in range(NX + 1):
            x = -HX + PLOT_X * ix / NX
            row.append(bm.verts.new((x, y, ground_z(x, y))))
        grid.append(row)
    for iy in range(NY):
        for ix in range(NX):
            bm.faces.new([grid[iy][ix], grid[iy][ix + 1],
                          grid[iy + 1][ix + 1], grid[iy + 1][ix]])
    ground = new_mesh_obj('site_ground_earth', bm, M['soil'], c, (0, 0, 0))

    # A gravel haul route: the loop the plant actually drives, laid as a flat
    # ribbon just above the earth so it reads as a surface laid ON the site
    # rather than as a stripe painted into it.
    bm = bmesh.new()
    inner_x, inner_y = CLEAR_X + 4.2, CLEAR_Y + 4.0
    outer_x, outer_y = inner_x + 6.0, inner_y + 6.0
    ring = [(-outer_x, -outer_y), (outer_x, -outer_y), (outer_x, outer_y), (-outer_x, outer_y)]
    hole = [(-inner_x, -inner_y), (inner_x, -inner_y), (inner_x, inner_y), (-inner_x, inner_y)]
    seg = 26
    def edge_loop(pts, n):
        out = []
        for i in range(len(pts)):
            ax, ay = pts[i]
            bx, by = pts[(i + 1) % len(pts)]
            for k in range(n):
                t = k / n
                out.append((ax + (bx - ax) * t, ay + (by - ay) * t))
        return out
    o = edge_loop(ring, seg)
    h = edge_loop(hole, seg)
    ov = [bm.verts.new((x, y, ground_z(x, y) + 0.055)) for x, y in o]
    hv = [bm.verts.new((x, y, ground_z(x, y) + 0.055)) for x, y in h]
    n = len(ov)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([ov[i], ov[j], hv[j], hv[i]])
    haul = new_mesh_obj('site_ground_haul_route', bm, M['gravel'], c, (0, 0, 0))

    # The pad the office and the material laydown stand on. Flat, so nothing
    # placed on it has to chase the terrain.
    pad = box_obj('site_ground_pad', (-24.0, 13.5, 0.03), (20.0, 15.0, 0.10),
                  M['hardcore'], c)
    return ground, haul, pad


def build_boundary(M, colls):
    """The edge of the plot as a built thing: a low kerb the fence stands on.
    It is what stops the site from dissolving into the ground plane at the
    establishing distance, where the fence itself is only a few pixels tall."""
    c = colls['SITE_BOUNDARY']
    out = []
    t, h = 0.36, 0.22
    for name, cx, cy, sx, sy in (
        ('site_boundary_north', 0.0,  HY, PLOT_X + t, t),
        ('site_boundary_south', 0.0, -HY, PLOT_X + t, t),
        ('site_boundary_east',   HX, 0.0, t, PLOT_Y),
        ('site_boundary_west',  -HX, 0.0, t, PLOT_Y)):
        out.append(box_obj(name, (cx, cy, h / 2 - 0.04), (sx, sy, h), M['kerb'], c))
    return out


# -------------------------------------------------------------- fence, gate
PANEL = 3.0        # modular panel, and therefore the post spacing
FENCE_H = 2.10
GATE_W = 9.0       # wide enough for plant to turn in off the street


def fence_run(name, M, coll, ax, a, b, fixed, solid_ratio=0.42,
              skip_start=False, skip_end=False):
    """One straight run of hoarding, built as a single mesh.

    Panels and posts are modelled together on purpose. They are one element to
    the eye and one element to the animation — a reveal wants to bring in a RUN,
    not eighty-three individual panels — and merging them keeps the whole
    perimeter to five draw calls instead of a hundred and sixty.

    Each panel is a low solid kick plate with two open rails above it. The first
    version put the sheet at 62% of the fence height, and from the ground-level
    shot the result was a pale wall with a construction site hidden somewhere
    behind it. At 42% the eye reads an enclosed site from the establishing
    distance and still sees straight into it from the street, which is what the
    brief means by minimal.

    `skip_start` / `skip_end` drop the post at one end of the run. Corners and
    gate jambs are shared between two runs, and without this both runs put a
    post in the same place — two coincident boxes, which is exactly the
    accidental duplicate geometry the brief rules out."""
    bm = bmesh.new()
    length = b - a
    n = max(1, int(round(length / PANEL)))
    step = length / n
    sheet_h = FENCE_H * solid_ratio
    for i in range(n + 1):
        if (i == 0 and skip_start) or (i == n and skip_end):
            continue
        p = a + step * i
        cx, cy = (p, fixed) if ax == 'x' else (fixed, p)
        bm_box(bm, cx, cy, FENCE_H / 2, 0.13, 0.13, FENCE_H)          # post
    for i in range(n):
        p = a + step * (i + 0.5)
        cx, cy = (p, fixed) if ax == 'x' else (fixed, p)
        sx, sy = (step - 0.14, 0.055) if ax == 'x' else (0.055, step - 0.14)
        bm_box(bm, cx, cy, 0.10 + sheet_h / 2, sx, sy, sheet_h)        # sheet
        bm_box(bm, cx, cy, FENCE_H - 0.11, sx, sy, 0.09)               # top rail
        bm_box(bm, cx, cy, sheet_h + 0.52, sx, sy, 0.06)               # mid rail
    mid = ((a + b) / 2, fixed) if ax == 'x' else (fixed, (a + b) / 2)
    return new_mesh_obj(name, bm, M['hoarding'], coll, (mid[0], mid[1], 0.0))


def build_fence(M, colls):
    c = colls['FENCE']
    g = GATE_W / 2
    runs = [
        fence_run('fence_run_north', M, c, 'x', -HX, HX, HY),
        # North owns all four corner posts; east and west drop both ends.
        fence_run('fence_run_east',  M, c, 'y', -HY, HY, HX,
                  skip_start=True, skip_end=True),
        fence_run('fence_run_west',  M, c, 'y', -HY, HY, -HX,
                  skip_start=True, skip_end=True),
        # The street side is split by the gate opening, and the gate owns its
        # own jamb posts, so each half drops the end that meets them.
        fence_run('fence_run_south_west', M, c, 'x', -HX, -g, -HY, skip_end=True),
        fence_run('fence_run_south_east', M, c, 'x', g, HX, -HY, skip_start=True),
    ]
    return runs


def build_gate(M, colls):
    """Two leaves and a pair of heavier posts, shown closed.

    Separate objects with their hinge at the origin, so opening them later is a
    rotation on Z and nothing else."""
    c = colls['GATE']
    g = GATE_W / 2
    out = []
    for side, x in (('west', -g), ('east', g)):
        bm = bmesh.new()
        bm_box(bm, x, -HY, 1.35, 0.22, 0.22, 2.70)
        out.append(new_mesh_obj(f'gate_post_{side}', bm, M['post'], c, (x, -HY, 0.0)))

    leaf = GATE_W / 2 - 0.12
    for side, hinge, direction in (('west', -g, 1), ('east', g, -1)):
        bm = bmesh.new()
        x0 = hinge + 0.10 * direction
        x1 = hinge + leaf * direction
        lo, hi = min(x0, x1), max(x0, x1)
        bm_box(bm, (lo + hi) / 2, -HY, 0.10 + FENCE_H * 0.21, hi - lo, 0.06, FENCE_H * 0.42)
        bm_box(bm, (lo + hi) / 2, -HY, FENCE_H - 0.11, hi - lo, 0.07, 0.09)
        bm_box(bm, (lo + hi) / 2, -HY, FENCE_H * 0.42 + 0.52, hi - lo, 0.05, 0.06)
        for k in (0.34, 0.68):
            bx = lo + (hi - lo) * k
            bm_box(bm, bx, -HY, FENCE_H / 2, 0.07, 0.05, FENCE_H - 0.20)
        out.append(new_mesh_obj(f'gate_leaf_{side}', bm, M['mesh'], c, (hinge, -HY, 0.0)))
    return out


def build_sign(M, colls):
    """Information board beside the gate. Two legs, a board, a header band.
    No text: at this scale lettering would be a texture pretending to be
    information, and the silhouette already says 'site notice'."""
    c = colls['SITE_SIGN']
    x, y = GATE_W / 2 + 3.4, -HY + 0.9
    out = []
    bm = bmesh.new()
    for dx in (-1.05, 1.05):
        bm_box(bm, x + dx, y, 0.95, 0.10, 0.10, 1.90)
    out.append(new_mesh_obj('site_sign_frame', bm, M['post'], c, (x, y, 0.0)))
    out.append(box_obj('site_sign_board', (x, y, 2.20), (2.60, 0.07, 1.55), M['board'], c))
    out.append(box_obj('site_sign_header', (x, y - 0.045, 2.84), (2.60, 0.05, 0.28), M['accent'], c))
    return out


# ------------------------------------------------------- laydown and plant
def build_storage(M, colls):
    """The material laydown, pushed into the north-west corner and kept low.

    Everything here sits on the hardcore pad, off the haul route and well
    outside the clear zone. It exists to say the site is staffed and stocked —
    not to be looked at, which is why nothing in it stands taller than the
    fence."""
    c = colls['MATERIAL_STORAGE']
    out = []
    # Racking: two low steel frames with a couple of shelves.
    for i, (x, y) in enumerate(((-30.0, 18.0), (-30.0, 12.4))):
        bm = bmesh.new()
        for dx in (-3.1, -1.0, 1.0, 3.1):
            for dy in (-0.62, 0.62):
                bm_box(bm, x + dx, y + dy, 0.62, 0.09, 0.09, 1.24)
        for z in (0.34, 0.86, 1.22):
            bm_box(bm, x, y, z, 6.6, 1.42, 0.07)
        out.append(new_mesh_obj(f'storage_rack_{i+1:02d}', bm, M['galv'], c, (x, y, 0.0)))

    # Aggregate bays: three-sided concrete blocks with a heap in each.
    for i, (x, y, fill) in enumerate(((-18.6, 19.4, 0.95), (-13.4, 19.4, 0.62))):
        bm = bmesh.new()
        w, d, h = 4.4, 3.4, 1.05
        bm_box(bm, x, y + d / 2, h / 2, w, 0.26, h)
        bm_box(bm, x - w / 2, y, h / 2, 0.26, d, h)
        bm_box(bm, x + w / 2, y, h / 2, 0.26, d, h)
        out.append(new_mesh_obj(f'storage_bay_{i+1:02d}', bm, M['concrete'], c, (x, y, 0.0)))
        bm = bmesh.new()
        bm_sphere(bm, x, y - 0.2, 0.02, 1.62, seg=12, rings=4,
                  squash=fill / 1.62, dome=True)
        out.append(new_mesh_obj(f'storage_aggregate_{i+1:02d}', bm, M['gravel'], c, (x, y, 0.0)))
    return out


def build_pipes(M, colls):
    """Two stacked pyramids of concrete pipe, and a bundle of rebar.

    One object per stack. A stack is a thing you place, and later a thing you
    take away one pipe at a time if you want to — but not today, and eighteen
    loose cylinders would be eighteen draw calls for a prop in the corner."""
    c = colls['PIPES']
    out = []
    for i, (bx, by, r, rows) in enumerate(((-28.4, 6.0, 0.62, 3), (-22.0, 5.4, 0.44, 3))):
        bm = bmesh.new()
        L = 4.2 if i == 0 else 3.4
        for row in range(rows):
            count = rows - row
            z = r + row * (r * 1.74)
            for k in range(count):
                x = bx + (k - (count - 1) / 2) * (r * 2.06)
                bm_cyl(bm, x, by, z, r, L, seg=14, axis='Y', inner=r * 0.74)
        out.append(new_mesh_obj(f'pipe_stack_{i+1:02d}', bm, M['concrete'], c, (bx, by, 0.0)))

    # Rebar, bundled on bearers. Thin, bright-ish, and the only fine geometry
    # on the site — it gives the laydown one point of detail to reward a close
    # camera without adding clutter anywhere else.
    # North strip, clear of the laydown and — the audit caught this — clear of
    # the central zone: at x = -16 the 6.2 m bars reached to x = -12.9, which is
    # inside it. Nothing may sit in the middle of this site.
    bx, by = -17.0, 23.0
    bm = bmesh.new()
    for dx in (-2.4, 2.4):
        bm_box(bm, bx + dx, by, 0.09, 0.30, 1.30, 0.18)
    for row in range(3):
        for k in range(7):
            bm_cyl(bm, bx, by - 0.52 + k * 0.175, 0.24 + row * 0.16,
                   0.035, 6.2, seg=6, axis='X')
    out.append(new_mesh_obj('pipe_rebar_bundle', bm, M['galv'], c, (bx, by, 0.0)))
    return out


def build_pallets(M, colls):
    """Four pallets: two stacked with block, two empty and leaning flat."""
    c = colls['PALLETS']
    out = []
    spec = ((-24.6, 16.6, 3), (-21.4, 16.2, 2), (-24.2, 9.6, 0), (-20.6, 9.2, 1))
    for i, (x, y, load) in enumerate(spec):
        bm = bmesh.new()
        for dy in (-0.55, 0.0, 0.55):
            bm_box(bm, x, y + dy, 0.07, 1.20, 0.14, 0.14)
        for dx in (-0.48, 0.0, 0.48):
            bm_box(bm, x + dx, y, 0.17, 0.16, 1.20, 0.05)
        out.append(new_mesh_obj(f'pallet_{i+1:02d}', bm, M['timber'], c, (x, y, 0.0)))
        if load:
            bm = bmesh.new()
            h = 0.22 * load
            bm_box(bm, x, y, 0.20 + h / 2, 1.05, 1.05, h)
            out.append(new_mesh_obj(f'pallet_load_{i+1:02d}', bm, M['board'], c, (x, y, 0.0)))
    return out


def build_office(M, colls):
    """One site container on the pad, raised on bearers, with a step.

    Placed at the plot edge and turned to face the gate, so the establishing
    shot reads a small occupied corner against a large empty middle — which is
    the whole point of the frame."""
    c = colls['SITE_OFFICE']
    # Shifted east off the corner: the perimeter mast light owns that corner,
    # and the clash audit found the container sitting straight through it.
    x, y, z0 = -26.0, 24.0, 0.08
    L, W, H = 9.0, 3.0, 2.85
    out = []
    bm = bmesh.new()
    for dx in (-3.6, 0.0, 3.6):
        bm_box(bm, x + dx, y, z0 + 0.14, 0.5, W, 0.28)
    out.append(new_mesh_obj('site_office_bearers', bm, M['post'], c, (x, y, 0.0)))

    base = z0 + 0.28
    bm = bmesh.new()
    bm_box(bm, x, y, base + H / 2, L, W, H)
    # Corrugation, as a few shallow ribs rather than a texture.
    for k in range(9):
        rx = x - L / 2 + L * (k + 0.5) / 9
        bm_box(bm, rx, y - W / 2 - 0.02, base + H / 2, 0.10, 0.05, H - 0.30)
        bm_box(bm, rx, y + W / 2 + 0.02, base + H / 2, 0.10, 0.05, H - 0.30)
    bm_box(bm, x, y, base + H + 0.06, L + 0.20, W + 0.20, 0.12)
    out.append(new_mesh_obj('site_office_body', bm, M['container'], c, (x, y, 0.0)))

    bm = bmesh.new()
    for dx in (-2.6, 0.9):
        bm_box(bm, x + dx, y - W / 2 - 0.03, base + 1.62, 1.35, 0.06, 0.95)
    out.append(new_mesh_obj('site_office_glazing', bm, M['glass'], c, (x, y, 0.0)))

    bm = bmesh.new()
    bm_box(bm, x + 3.4, y - W / 2 - 0.03, base + 1.05, 0.90, 0.07, 2.10)
    out.append(new_mesh_obj('site_office_door', bm, M['post'], c, (x, y, 0.0)))

    bm = bmesh.new()
    for k, zz in enumerate((0.10, 0.24)):
        bm_box(bm, x + 3.4, y - W / 2 - 0.40 + k * 0.22, zz, 1.20, 0.44, 0.06)
    out.append(new_mesh_obj('site_office_step', bm, M['galv'], c, (x, y, 0.0)))
    return out


def build_lights(M, colls):
    """Four mast lights on the perimeter and two on the pad. Simple poles with
    a head — no lens detail, because the route lights its own scene and these
    only have to read as infrastructure in silhouette."""
    c = colls['SITE_LIGHTS']
    out = []
    spots = [(-HX + 3.0, -HY + 3.0), (HX - 3.0, -HY + 3.0),
             (HX - 3.0, HY - 3.0), (-HX + 3.0, HY - 3.0),
             (-22.5, 17.0), (-33.0, 8.0)]
    for i, (x, y) in enumerate(spots):
        h = 7.4 if i < 4 else 6.0
        bm = bmesh.new()
        bm_cyl(bm, x, y, 0.09, 0.40, 0.18, seg=10)
        bm_cyl(bm, x, y, h / 2 + 0.18, 0.085, h, seg=10)
        bm_box(bm, x, y, h + 0.22, 0.32, 0.86, 0.22)
        bm_box(bm, x, y, h + 0.10, 0.26, 0.74, 0.06)
        out.append(new_mesh_obj(f'site_light_{i+1:02d}', bm, M['galv'], c, (x, y, 0.0)))
    return out


# ----------------------------------------------------------------- context
def build_road(M, colls):
    """Carriageway on the street side, running past the gate and off frame both
    ways. It is longer than the plot so it reads as a road the site is on
    rather than as a rectangle parked next to it."""
    c = colls['ROAD']
    y0 = -HY - WALK_W - KERB_H * 0
    y_far = y0 - ROAD_W
    span = PLOT_X + 96.0
    out = []
    out.append(box_obj('road_surface', (0.0, (y0 - ROAD_W / 2), -0.045),
                       (span, ROAD_W, 0.09), M['asphalt'], c))
    bm = bmesh.new()
    cy = y0 - ROAD_W / 2
    k, gap = 3.0, 3.0
    n = int(span / (k + gap))
    for i in range(n):
        x = -span / 2 + (k + gap) * i + k / 2
        bm_box(bm, x, cy, 0.006, k, 0.14, 0.012)
    out.append(new_mesh_obj('road_centreline', bm, M['marking'], c, (0.0, cy, 0.0)))

    # The crossover: the apron where the gate meets the road.
    out.append(box_obj('road_crossover', (0.0, y0 - 1.3, 0.005),
                       (GATE_W + 3.0, WALK_W + 2.6, 0.02), M['kerb'], c))
    return out


def build_sidewalk(M, colls):
    c = colls['SIDEWALK']
    y0 = -HY
    span = PLOT_X + 96.0
    out = []
    out.append(box_obj('sidewalk_surface', (0.0, y0 - WALK_W / 2, KERB_H / 2 - 0.01),
                       (span, WALK_W, KERB_H), M['kerb'], c))
    out.append(box_obj('sidewalk_kerb', (0.0, y0 - WALK_W - 0.08, KERB_H / 2 - 0.01),
                       (span, 0.16, KERB_H + 0.04), M['concrete'], c))
    # Paving joints, as shallow recessed lines. Enough rhythm to give the
    # foreground a scale reference in a ground-level shot.
    bm = bmesh.new()
    for i in range(int(span / 2.4)):
        x = -span / 2 + 2.4 * i
        bm_box(bm, x, y0 - WALK_W / 2, KERB_H - 0.012, 0.05, WALK_W, 0.02)
    out.append(new_mesh_obj('sidewalk_joints', bm, M['ctx_dark'], c, (0.0, y0 - WALK_W / 2, 0.0)))
    return out


def massing(bm, x, y, w, d, h, base=0.0, floor=3.4, setback=None):
    """One context block with a floor rhythm and an optional setback.

    The brief is explicit that these must not read as cubes, and the cheapest
    honest fix is not more geometry — it is horizontal division. A recessed
    band at every floor line gives a block scale, a shadow and a plausible
    facade for the cost of a few quads, and the setback gives the skyline
    something other than a flat top."""
    body_h = h if setback is None else setback[0]
    bm_box(bm, x, y, base + body_h / 2, w, d, body_h)
    n = max(1, int(body_h / floor))
    for i in range(1, n):
        z = base + i * floor
        if z > base + body_h - 0.6:
            break
        bm_box(bm, x, y, z, w + 0.10, d + 0.10, 0.16)
    if setback is not None:
        _, sw, sd, sh = setback
        bm_box(bm, x, y, base + body_h + sh / 2, sw, sd, sh)
        m = max(1, int(sh / floor))
        for i in range(1, m):
            z = base + body_h + i * floor
            if z > base + body_h + sh - 0.6:
                break
            bm_box(bm, x, y, z, sw + 0.10, sd + 0.10, 0.16)
    return bm


def build_context(M, colls):
    """Urban context, placed by where the route's camera actually stands.

    The opening shot sits at glTF [46, 26, 52], which is Blender (46, -52, 26):
    south-east of the plot, looking north-west. That single fact decides the
    whole layout. A terrace on the far side of the street — the obvious place
    to put one — lands BETWEEN that camera and the site, and the first render
    showed exactly that: two blocks filling the left half of the frame with the
    construction site peering out behind them.

    So the mass goes north, behind the plot, where it reads as skyline and
    gives the site something to be in front of. The street's far side stays
    open, with nothing on it taller than a wall.

    Everything here is darker than the site and carries no accent colour, so it
    settles behind the fence line rather than competing with it."""
    c = colls['CONTEXT_BUILDINGS']
    out = []

    # The backdrop: a varied terrace across the north, set back behind the plot.
    back_y = HY + 13.0
    terrace = ((-46.0, 20.0, 15.0, 17.5, None),
               (-25.0, 19.0, 16.0, 26.5, (19.5, 14.0, 12.0, 7.0)),
               (-3.0, 22.0, 14.0, 33.0, (25.0, 16.0, 11.0, 8.0)),
               (20.0, 18.0, 16.0, 21.0, None),
               (41.0, 21.0, 15.0, 29.0, (22.0, 15.0, 11.0, 7.0)))
    for i, (x, w, d, h, sb) in enumerate(terrace):
        y = back_y + d / 2
        bm = bmesh.new()
        massing(bm, x, y, w, d, h, 0.0, 3.4, sb)
        out.append(new_mesh_obj(f'context_block_{i+1:02d}', bm, M['ctx'], c, (x, y, 0.0)))
        bm = bmesh.new()
        body = h if sb is None else sb[0]
        for k in range(max(1, int(body / 3.4))):
            z = 1.35 + k * 3.4
            if z > body - 1.0:
                break
            bm_box(bm, x, y - d / 2 - 0.02, z, w * 0.86, 0.06, 1.10)
        out.append(new_mesh_obj(f'context_glazing_{i+1:02d}', bm, M['glass'], c, (x, y, 0.0)))

    # Flanks, pushed well out so the plot keeps clear edges east and west.
    flank = (('east', HX + 19.0, 10.0, 18.0, 30.0, 23.5, (17.0, 14.0, 22.0, 7.0)),
             ('west', -HX - 20.0, -2.0, 18.0, 34.0, 16.5, None))
    for side, x, y, w, d, h, sb in flank:
        bm = bmesh.new()
        massing(bm, x, y, w, d, h, 0.0, 3.4, sb)
        out.append(new_mesh_obj(f'context_flank_{side}', bm, M['ctx'], c, (x, y, 0.0)))
        bm = bmesh.new()
        body = h if sb is None else sb[0]
        sx = -1 if side == 'east' else 1
        for k in range(max(1, int(body / 3.4))):
            z = 1.35 + k * 3.4
            if z > body - 1.0:
                break
            bm_box(bm, x + sx * w / 2, y, z, 0.06, d * 0.84, 1.10)
        out.append(new_mesh_obj(f'context_glazing_{side}', bm, M['glass'], c, (x, y, 0.0)))

    # One tower far to the north-east to break the skyline.
    bm = bmesh.new()
    massing(bm, 86.0, back_y + 54.0, 22.0, 22.0, 52.0, 0.0, 3.6, (38.0, 16.0, 16.0, 14.0))
    out.append(new_mesh_obj('context_tower_distant', bm, M['ctx_dark'], c,
                            (86.0, back_y + 54.0, 0.0)))

    # The far side of the street: a low wall only. Anything taller would stand
    # between the camera and the site, which is the mistake this layout exists
    # to avoid.
    wall_y = -HY - WALK_W - ROAD_W - 3.2
    bm = bmesh.new()
    span = PLOT_X + 96.0
    bm_box(bm, 0.0, wall_y, 0.62, span, 0.40, 1.24)
    for k in range(int(span / 6.0)):
        px = -span / 2 + 6.0 * k
        bm_box(bm, px, wall_y, 0.78, 0.46, 0.52, 1.56)
    out.append(new_mesh_obj('context_streetwall_south', bm, M['ctx_dark'], c,
                            (0.0, wall_y, 0.0)))
    return out


def build_vegetation(M, colls):
    """Street trees along the sidewalk and a little scrub on the verge.

    Limited, as asked. Four trees at wide spacing punctuate the street edge and
    give the ground-level shot a foreground; anything more would start to look
    like a park next to a building site."""
    c = colls['VEGETATION']
    out = []
    y = -HY - WALK_W + 0.7
    for i, x in enumerate((-30.0, -8.0, 14.0, 32.0)):
        bm = bmesh.new()
        bm_cyl(bm, x, y, 1.08, 0.12, 2.16, seg=8)
        out.append(new_mesh_obj(f'tree_trunk_{i+1:02d}', bm, M['trunk'], c, (x, y, 0.0)))
        bm = bmesh.new()
        # Five small offset lobes rather than three large ones. At three it read
        # as a stack of prisms in the foreground of the establishing shot — the
        # facets were bigger than the fence panels behind them.
        for dx, dy, dz, r in ((0.0, 0.0, 3.00, 0.88), (0.40, 0.20, 3.34, 0.63),
                              (-0.36, -0.23, 3.26, 0.58), (0.08, -0.42, 3.02, 0.52),
                              (-0.17, 0.36, 3.46, 0.46)):
            bm_sphere(bm, x + dx, y + dy, dz, r, seg=10, rings=5, squash=0.88)
        out.append(new_mesh_obj(f'tree_canopy_{i+1:02d}', bm, M['veg'], c, (x, y, 0.0)))

    bm = bmesh.new()
    for x, yy, r in ((-40.0, -HY - 0.9, 0.55), (-36.5, -HY - 1.1, 0.42),
                     (38.0, -HY - 1.0, 0.50), (41.5, -HY - 0.8, 0.38)):
        bm_sphere(bm, x, yy, r * 0.62, r, seg=8, rings=4, squash=0.62)
    out.append(new_mesh_obj('verge_scrub', bm, M['veg'], c, (0.0, -HY - 1.0, 0.0)))
    return out


# -------------------------------------------------------------------- build
COLLECTIONS = ['SITE_GROUND', 'SITE_BOUNDARY', 'FENCE', 'GATE', 'SITE_SIGN',
               'MATERIAL_STORAGE', 'PIPES', 'PALLETS', 'SITE_OFFICE',
               'SITE_LIGHTS', 'ROAD', 'SIDEWALK', 'CONTEXT_BUILDINGS',
               'VEGETATION']


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for db in (bpy.data.meshes, bpy.data.materials, bpy.data.objects,
               bpy.data.collections, bpy.data.cameras, bpy.data.lights):
        for item in list(db):
            db.remove(item)


def make_collections():
    root = bpy.data.collections.new('EMPTY_SITE')
    bpy.context.scene.collection.children.link(root)
    out = {'EMPTY_SITE': root}
    for name in COLLECTIONS:
        c = bpy.data.collections.new(name)
        root.children.link(c)
        out[name] = c
    return out


def group_empties(colls):
    """One empty per collection, and every mesh parented to it.

    The collections are how a person navigates the file; the empties are how
    the animation does. glTF has no concept of a collection, so without these
    the exported scene would be one flat list of eighty objects and the route
    would have to rebuild the grouping from name prefixes. With them, the
    hierarchy the file is organised by is the hierarchy that ships."""
    scene_coll = bpy.context.scene.collection
    root = bpy.data.objects.new('empty_site', None)
    root.empty_display_size = 4.0
    colls['EMPTY_SITE'].objects.link(root)
    for name in COLLECTIONS:
        c = colls[name]
        g = bpy.data.objects.new(name.lower(), None)
        g.empty_display_size = 1.5
        c.objects.link(g)
        g.parent = root
        for ob in list(c.objects):
            if ob is g:
                continue
            ob.parent = g
            ob.matrix_parent_inverse = g.matrix_world.inverted()
    return root


def build():
    reset()
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    M = build_materials()
    colls = make_collections()

    build_ground(M, colls)
    build_boundary(M, colls)
    build_fence(M, colls)
    build_gate(M, colls)
    build_sign(M, colls)
    build_storage(M, colls)
    build_pipes(M, colls)
    build_pallets(M, colls)
    build_office(M, colls)
    build_lights(M, colls)
    build_road(M, colls)
    build_sidewalk(M, colls)
    build_context(M, colls)
    build_vegetation(M, colls)

    root = group_empties(colls)
    return root, colls


def audit():
    """Checks the brief asks for, answered with numbers instead of opinions.

    The depsgraph update on the first line is load-bearing. `matrix_world` is
    cached, and until the view layer is evaluated it is still the identity for
    everything built this session — so every world-space test silently becomes a
    local-space test, and a fence at y = 26 reads as sitting on the origin. The
    first run of this audit reported the entire perimeter inside the clear zone
    for exactly that reason."""
    import mathutils
    bpy.context.view_layer.update()
    report = {}
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    report['objects'] = len(meshes)
    report['tris'] = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)

    bad_scale, bad_rot, floating, empty_mesh = [], [], [], []
    minz = 1e9
    for o in meshes:
        if any(abs(s - 1.0) > 1e-6 for s in o.scale):
            bad_scale.append(o.name)
        if any(abs(r) > 1e-6 for r in o.rotation_euler):
            bad_rot.append(o.name)
        if not o.data.polygons:
            empty_mesh.append(o.name)
        zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
        if zs:
            minz = min(minz, min(zs))
            # Anything whose lowest point is well clear of the ground and is not
            # meant to be up there is floating.
            if min(zs) > 0.35 and not any(k in o.name for k in
                                          ('canopy', 'glaz', 'sign_board', 'sign_header',
                                           'office_body', 'office_glazing', 'office_door',
                                           'load', 'context', 'aggregate')):
                floating.append((o.name, round(min(zs), 2)))
    report['non_unit_scale'] = bad_scale
    report['rotated_objects'] = bad_rot
    report['empty_meshes'] = empty_mesh
    report['floating'] = floating
    report['lowest_z'] = round(minz, 3)

    # The clear zone must be empty. This is the one that matters most: every
    # later stage lands in it.
    intruders = []
    for o in meshes:
        if o.name.startswith(('site_ground', 'road_', 'sidewalk_', 'site_boundary')):
            continue
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            if abs(w.x) < CLEAR_X and abs(w.y) < CLEAR_Y and w.z > 0.12:
                intruders.append(o.name)
                break
    report['clear_zone_intruders'] = sorted(set(intruders))

    # Duplicate geometry: the same vertices in the same world position twice.
    # Counting vertices and comparing origins was not enough — glazing sits at
    # the same origin as the block it belongs to and often has the same vertex
    # count, which is coincidence, not duplication. Hash the actual positions.
    seen = {}
    dupes = []
    for o in meshes:
        key = hash(tuple(round(c, 4) for v in o.data.vertices
                         for c in (o.matrix_world @ v.co)))
        if key in seen:
            dupes.append((seen[key], o.name))
        seen[key] = o.name
    report['possible_duplicates'] = dupes

    # Props must not interpenetrate. Ground, road, boundary and context are
    # excluded: those are meant to nest inside and under one another.
    props = [o for o in meshes if not o.name.startswith(
        ('site_ground', 'road_', 'sidewalk_', 'site_boundary', 'context_', 'verge_'))]
    def aabb(o):
        cs = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
        return (min(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs),
                max(c.x for c in cs), max(c.y for c in cs), max(c.z for c in cs))
    boxes = {o.name: aabb(o) for o in props}
    # Things that belong to one another and are supposed to touch.
    def paired(a, b):
        for p in ('pallet', 'site_office', 'site_sign', 'gate', 'storage_bay',
                  'storage_aggregate', 'pipe_stack'):
            if a.startswith(p) and b.startswith(p):
                return True
        return a.split('_')[0] == b.split('_')[0] and a[-2:] == b[-2:]
    clashes = []
    names = sorted(boxes)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if paired(a, b):
                continue
            ax0, ay0, az0, ax1, ay1, az1 = boxes[a]
            bx0, by0, bz0, bx1, by1, bz1 = boxes[b]
            ov = (min(ax1, bx1) - max(ax0, bx0), min(ay1, by1) - max(ay0, by0),
                  min(az1, bz1) - max(az0, bz0))
            if all(v > 0.05 for v in ov):
                clashes.append((a, b, [round(v, 2) for v in ov]))
    report['prop_clashes'] = clashes

    report['materials'] = sorted(m.name for m in bpy.data.materials)
    report['collections'] = {c.name: len([o for o in c.objects if o.type == 'MESH'])
                             for c in bpy.data.collections if c.name != 'EMPTY_SITE'}
    return report


if __name__ == '__main__':
    import json
    import sys
    root, colls = build()
    print(json.dumps(audit(), indent=1))
