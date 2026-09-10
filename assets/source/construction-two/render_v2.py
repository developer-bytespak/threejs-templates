
import bpy, math
from pathlib import Path
from mathutils import Vector

OUT = Path(r"D:\Hassan\threejs-test\Claude outputs\v2")
OUT.mkdir(parents=True, exist_ok=True)

def setup_preview():
    scn = bpy.context.scene
    for n in ("PV_Sun", "PV_Fill", "PV_Warm", "PV_Cam"):
        o = bpy.data.objects.get(n)
        if o: bpy.data.objects.remove(o, do_unlink=True)
    # late-afternoon sun raking in through the window
    sd = bpy.data.lights.new("PV_SunD", 'SUN'); sd.energy = 4.2
    sd.color = (1.0, 0.93, 0.82); sd.angle = math.radians(1.6)
    sun = bpy.data.objects.new("PV_Sun", sd); scn.collection.objects.link(sun)
    d = Vector((-0.82, 0.28, 0.50)).normalized()
    sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    # cool sky fill from the open side
    fd = bpy.data.lights.new("PV_FillD", 'SUN'); fd.energy = 1.1
    fd.color = (0.80, 0.87, 1.0)
    fill = bpy.data.objects.new("PV_Fill", fd); scn.collection.objects.link(fill)
    d2 = Vector((0.25, -0.70, 0.62)).normalized()
    fill.rotation_euler = (-d2).to_track_quat('-Z', 'Y').to_euler()
    # warm task pool at the lamp
    wd = bpy.data.lights.new("PV_WarmD", 'POINT'); wd.energy = 26.0
    wd.color = (1.0, 0.78, 0.50); wd.shadow_soft_size = 0.12
    warm = bpy.data.objects.new("PV_Warm", wd); scn.collection.objects.link(warm)
    warm.location = (1.10, 1.26, 1.12)

    w = scn.world or bpy.data.worlds.new("World")
    scn.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.62, 0.68, 0.76, 1.0)
        bg.inputs[1].default_value = 0.55

    cd = bpy.data.cameras.new("PV_CamD")
    cam = bpy.data.objects.new("PV_Cam", cd); scn.collection.objects.link(cam)
    scn.camera = cam
    try:
        scn.render.engine = 'BLENDER_EEVEE_NEXT'
        scn.eevee.use_raytracing = True
        scn.eevee.use_shadows = True
    except Exception:
        scn.render.engine = 'BLENDER_EEVEE'
    scn.render.film_transparent = False
    scn.view_settings.view_transform = 'AgX' if 'AgX' in [i.name for i in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items] else 'Standard'
    scn.view_settings.look = 'None'
    return cam

def shot(cam, name, eye, tgt, lens=40, res=(1400, 900)):
    scn = bpy.context.scene
    scn.render.resolution_x, scn.render.resolution_y = res
    scn.render.resolution_percentage = 100
    cam.data.lens = lens
    cam.location = Vector(eye)
    cam.rotation_euler = (Vector(tgt) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
    scn.render.filepath = str(OUT / name)
    bpy.ops.render.render(write_still=True)
    return OUT / (name + ".png")

SHOTS = [
    ("v1_wide",      ( 2.40, -3.40, 1.90), (-0.20,  1.20, 1.15), 32),
    ("v2_window",    ( 1.95, -1.15, 1.52), (-1.70,  0.95, 1.18), 40),
    ("v3_shoulder",  (-0.92, -0.78, 1.44), ( 0.12,  1.52, 0.86), 42),
    ("v4_model",     ( 1.06,  0.52, 1.14), ( 0.54,  1.29, 0.90), 55),
    ("v5_pinboard",  ( 0.10, -1.45, 1.86), (-0.10,  3.50, 1.84), 38),
    ("v6_opposite",  (-2.55, -2.95, 1.78), ( 1.25,  1.40, 1.08), 32),
    ("v7_departure", ( 2.90, -3.85, 2.20), (-0.30,  1.00, 1.20), 28),
]
