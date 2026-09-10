
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler

# ---------------------------------------------------------------- scene plumbing
def reset_scene():
    bpy.ops.wm.read_homefile(use_empty=True)
    scn = bpy.context.scene
    scn.unit_settings.system = 'METRIC'
    scn.unit_settings.scale_length = 1.0
    try: scn.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception: scn.render.engine = 'BLENDER_EEVEE'
    return scn

def srgb(h):
    h = h.lstrip("#"); o = []
    for i in (0, 2, 4):
        c = int(h[i:i+2], 16)/255.0
        o.append(c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4)
    return (o[0], o[1], o[2], 1.0)

def mat(name, base, rough=0.75, metal=0.0, alpha=1.0, emis=None, estr=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.location = (0, 0)
    o = nt.nodes.new("ShaderNodeOutputMaterial"); o.location = (320, 0)
    b.inputs["Base Color"].default_value = srgb(base)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emis and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = srgb(emis)
        b.inputs["Emission Strength"].default_value = estr
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        try: m.blend_method = 'BLEND'
        except Exception: pass
    nt.links.new(b.outputs[0], o.inputs[0])
    return m

def coll(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    host = parent or bpy.context.scene.collection
    if c.name not in [x.name for x in host.children]:
        host.children.link(c)
    return c

def mk(bm, name, material, collection, group, loc=(0, 0, 0), rot=(0, 0, 0),
       smooth=False, order=None, parent=None, extra=None):
    """Finalise a bmesh. `group` and `order` ride out to glTF node extras, which
    become object.userData on the web side — that is the runtime contract."""
    me = bpy.data.meshes.new(name)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    ob.location = loc; ob.rotation_euler = rot
    ob["group"] = group
    if order is not None: ob["order"] = int(order)
    if extra:
        for k, v in extra.items(): ob[k] = v
    if parent is not None:
        ob.parent = parent
        ob.matrix_parent_inverse = parent.matrix_world.inverted()
    return ob

def tris(ob):
    ob.data.calc_loop_triangles(); return len(ob.data.loop_triangles)

# ---------------------------------------------------------------- primitives
def box(bm, size, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0, seg=1):
    m = bmesh.ops.create_cube(bm, size=1.0)
    vs = m["verts"]
    M = (Matrix.Translation(loc) @
         Euler(rot, 'XYZ').to_matrix().to_4x4() @
         Matrix.Diagonal(Vector(size).to_4d()))
    bmesh.ops.transform(bm, matrix=M, verts=vs)
    if bevel > 0:
        es = [e for e in bm.edges if all(v in vs for v in e.verts)]
        bmesh.ops.bevel(bm, geom=es + vs, offset=bevel, segments=seg,
                        affect='EDGES', profile=0.5, clamp_overlap=True)
    return vs

def cyl(bm, r, h, loc=(0, 0, 0), rot=(0, 0, 0), verts=16, r2=None, cap=True):
    r2 = r if r2 is None else r2
    res = bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts,
                                radius1=r, radius2=r2, depth=h)
    M = (Matrix.Translation(loc) @ Euler(rot, 'XYZ').to_matrix().to_4x4())
    bmesh.ops.transform(bm, matrix=M, verts=res["verts"])
    return res["verts"]

def uvsphere(bm, r, loc=(0, 0, 0), seg=20, rings=10, squash=(1, 1, 1)):
    res = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    M = (Matrix.Translation(loc) @ Matrix.Diagonal(Vector(squash).to_4d()))
    bmesh.ops.transform(bm, matrix=M, verts=res["verts"])
    return res["verts"]

def vlist(bm, pts):
    return [bm.verts.new(Vector(p)) for p in pts]

def bridge(bm, A, B, flip=False, closed=True):
    n = len(A)
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        j = (i + 1) % n
        q = (A[i], A[j], B[j], B[i])
        try: bm.faces.new(tuple(reversed(q)) if flip else q)
        except ValueError: pass

def cap_ring(bm, L, up=True):
    c = bm.verts.new(sum((v.co for v in L), Vector()) / len(L))
    n = len(L)
    for i in range(n):
        t = (c, L[i], L[(i+1) % n]) if up else (c, L[(i+1) % n], L[i])
        try: bm.faces.new(t)
        except ValueError: pass
    return c

def prism(bm, pts2d, z0, z1, caps=True):
    A = vlist(bm, [(p[0], p[1], z0) for p in pts2d])
    B = vlist(bm, [(p[0], p[1], z1) for p in pts2d])
    bridge(bm, A, B)
    if caps:
        cap_ring(bm, B, True); cap_ring(bm, A, False)
    return A, B

def frames(points):
    """parallel-transport frames along a polyline — untwisted sweeps"""
    P = [Vector(p) for p in points]
    T = []
    for i in range(len(P)):
        if i == 0: d = P[1] - P[0]
        elif i == len(P) - 1: d = P[-1] - P[-2]
        else: d = P[i+1] - P[i-1]
        T.append(d.normalized() if d.length > 1e-9 else Vector((0, 0, 1)))
    ref = Vector((0, 0, 1))
    if abs(T[0].dot(ref)) > 0.95: ref = Vector((1, 0, 0))
    N = [(ref - T[0]*ref.dot(T[0])).normalized()]
    for i in range(1, len(P)):
        n = N[-1] - T[i]*N[-1].dot(T[i])
        N.append(n.normalized() if n.length > 1e-9 else N[-1])
    B = [T[i].cross(N[i]).normalized() for i in range(len(P))]
    return P, T, N, B

def sweep(bm, points, profile, caps=True, smooth_rings=None):
    """profile: list of (u,v) or callable(t)->list of (u,v)"""
    P, T, N, B = frames(points)
    rings = []
    for i, p in enumerate(P):
        prof = profile(i/(len(P)-1)) if callable(profile) else profile
        rings.append(vlist(bm, [p + N[i]*u + B[i]*v for (u, v) in prof]))
    for i in range(len(rings)-1):
        bridge(bm, rings[i], rings[i+1])
    if caps:
        cap_ring(bm, rings[-1], True); cap_ring(bm, rings[0], False)
    return rings

def circle_profile(r, sides=10, sx=1.0, sy=1.0):
    return [(math.cos(math.tau*k/sides)*r*sx, math.sin(math.tau*k/sides)*r*sy)
            for k in range(sides)]

def rrect_profile(w, h, r, per=3):
    """rounded rectangle, per = samples per corner"""
    pts = []
    cs = [(w/2-r, h/2-r, 0.0), (-(w/2-r), h/2-r, math.pi/2),
          (-(w/2-r), -(h/2-r), math.pi), (w/2-r, -(h/2-r), 3*math.pi/2)]
    for cx, cy, a0 in cs:
        for k in range(per+1):
            a = a0 + (math.pi/2)*k/per
            pts.append((cx + math.cos(a)*r, cy + math.sin(a)*r))
    return pts

def plate(bm, w, d, t, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.006):
    return box(bm, (w, d, t), loc=loc, rot=rot, bevel=bevel, seg=1)
