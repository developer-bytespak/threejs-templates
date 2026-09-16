"""Renders the site from the three shots the brief names, so the model can be
judged by looking at it rather than by reading its object list."""
import math, sys
import bpy
from mathutils import Vector
sys.path.insert(0, '/home/claude/site')
from build_empty_site import build, PLOT_X, PLOT_Y

root, colls = build()
scene = bpy.context.scene

# --- light: one low key plus a cool sky, matching the route's dark studio mood
world = bpy.data.worlds.new('w'); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.055, 0.065, 0.085, 1)
bg.inputs[1].default_value = 1.0

sun_data = bpy.data.lights.new('key', 'SUN')
sun_data.energy = 3.1
sun_data.angle = math.radians(2.5)
sun_data.color = (1.0, 0.94, 0.86)
sun = bpy.data.objects.new('key', sun_data)
sun.rotation_euler = (math.radians(58), 0, math.radians(38))
scene.collection.objects.link(sun)

fill_data = bpy.data.lights.new('fill', 'SUN')
fill_data.energy = 0.55
fill_data.color = (0.70, 0.80, 1.0)
fill = bpy.data.objects.new('fill', fill_data)
fill.rotation_euler = (math.radians(66), 0, math.radians(232))
scene.collection.objects.link(fill)

scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.film_transparent = False
try:
    scene.eevee.taa_render_samples = 48
except Exception:
    pass
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Base Contrast'

SHOTS = {
    # The route's own opening camera, converted from glTF [46,26,52] -> Blender.
    'a_three_quarter': ((46, -52, 26), (0, 0, 3.5), 38),
    # Wide establishing, pulled back to hold the whole plot with air around it.
    'b_establishing':  ((78, -92, 40), (0, 2, 4.0), 36),
    # Ground level, outside the fence on the street corner.
    # On the sidewalk at the south-east corner, looking across the plot —
    # a ground-level view OF the site rather than of the street it is on.
    'c_ground':        ((25, -29.2, 1.70), (-14, 14, 2.2), 46),
}

cam_data = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

for name, (pos, tgt, fov) in SHOTS.items():
    cam.location = Vector(pos)
    d = Vector(tgt) - Vector(pos)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam_data.lens = (18.0 / math.tan(math.radians(fov) / 2))
    cam_data.sensor_width = 36.0
    cam_data.clip_end = 900
    scene.render.filepath = f'/home/claude/site/shot_{name}.png'
    bpy.ops.render.render(write_still=True)
    print('rendered', name)
