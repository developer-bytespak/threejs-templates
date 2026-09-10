
import bpy, bmesh, math, random, sys, importlib
from pathlib import Path
from mathutils import Vector, Matrix
_SRC = Path(r"D:\Hassan\threejs-test\assets\source\construction-two")
if str(_SRC) not in sys.path: sys.path.append(str(_SRC))
import room_lib as RL; importlib.reload(RL)
from room_lib import (reset_scene, mat, coll, mk, tris, box, cyl, uvsphere, vlist,
                      bridge, cap_ring, prism, sweep, circle_profile, rrect_profile, plate)

scn = reset_scene()

# ============================================================ palette / materials
# 70% neutral architectural tone, 20% dark, 10% blue accent.
P = {}
def M(name, base, rough=0.8, metal=0.0, alpha=1.0, lit=None, shadow=None, emis=None, estr=0.0):
    m = mat(name, base, rough, metal, alpha, emis, estr)
    P[name] = {"lit": lit or base, "shadow": shadow or base}
    return m

MAT = {
  "wall":     M("mat_wall_plaster", "#E7E1D6", 0.92, lit="#E7E1D6", shadow="#B9B1A3"),
  "wall_dk":  M("mat_wall_dark",    "#2B2E34", 0.88, lit="#2B2E34", shadow="#1B1D21"),
  "board":    M("mat_board",        "#3C3E45", 0.95, lit="#3C3E45", shadow="#26282D"),
  "ceiling":  M("mat_ceiling",      "#DCD5C8", 0.94, lit="#DCD5C8", shadow="#B0A99B"),
  "floor":    M("mat_floor",        "#7C6753", 0.80, lit="#7C6753", shadow="#4B3D31"),
  "floor_inlay": M("mat_floor_inlay","#8E877C", 0.95, lit="#8E877C", shadow="#655F56"),
  "walnut":   M("mat_walnut",       "#8B6A4B", 0.72, lit="#8B6A4B", shadow="#54402D"),
  "dark_m":   M("mat_dark_metal",   "#3A3D42", 0.55, 0.65, lit="#3A3D42", shadow="#212328"),
  "brushed":  M("mat_brushed_metal","#A9ACB0", 0.38, 0.85, lit="#A9ACB0", shadow="#6C7075"),
  "black":    M("mat_black",        "#1B1D21", 0.70, lit="#1B1D21", shadow="#111216"),
  "blue":     M("mat_blue_accent",  "#2F4E8F", 0.78, lit="#2F4E8F", shadow="#1B2F5C"),
  "paper":    M("mat_paper",        "#EDE8DE", 0.94, lit="#EDE8DE", shadow="#C8C1B3"),
  "model":    M("mat_model_white",  "#F2EFE7", 0.90, lit="#F2EFE7", shadow="#C6BFB1"),
  "card":     M("mat_model_card",   "#C2BAA9", 0.93, lit="#C2BAA9", shadow="#968E7F"),
  "glass":    M("mat_glass",        "#B4C4CE", 0.10, 0.0, 0.42, lit="#B4C4CE", shadow="#93A6B4"),
  "frost":    M("mat_frosted_glass","#C3D0DA", 0.55, 0.0, 0.78, lit="#C3D0DA", shadow="#9EAEBB"),
  "skin":     M("mat_skin",         "#DFC2A6", 0.86, lit="#DFC2A6", shadow="#AE8B6F"),
  "cloth_l":  M("mat_clothing_light","#E5E0D4", 0.92, lit="#E5E0D4", shadow="#B3AB9C"),
  "cloth_d":  M("mat_clothing_dark","#32353C", 0.90, lit="#32353C", shadow="#1E2025"),
  "hair":     M("mat_hair",         "#3B332C", 0.85, lit="#3B332C", shadow="#221D18"),
  "plant":    M("mat_plant",        "#5B6A51", 0.88, lit="#5B6A51", shadow="#36402E"),
  "soil":     M("mat_soil",         "#4A423A", 0.95, lit="#4A423A", shadow="#332D27"),
  "city_n":   M("mat_city_near",    "#93A0AA", 0.95, lit="#93A0AA", shadow="#93A0AA"),
  "city_f":   M("mat_city_far",     "#BAC5CD", 0.95, lit="#BAC5CD", shadow="#BAC5CD"),
  "sky":      M("mat_sky",          "#DCE4E8", 0.95, lit="#DCE4E8", shadow="#DCE4E8"),
  "warm":     M("mat_emissive_warm","#FFD9A0", 0.50, lit="#FFD9A0", shadow="#FFD9A0",
                emis="#FFD9A0", estr=1.0),
}

GROUPS = ["Floor","Ceiling","Walls","Window","Skyline","Pinboard","Desk","Chair",
          "Desktop","Bin","Credenza","Plant","Figure","Building","LightingElements"]
C = {g: coll(g) for g in GROUPS}

# ============================================================ room dimensions
X0, X1 = -3.25, 3.25          # window wall .. storage wall      (6.50 m)
Y0, Y1 = -4.00, 3.60          # open camera side .. pinboard wall (7.60 m)
Z1     = 3.35                 # ceiling height
T      = 0.16                 # wall thickness
CEIL_FRONT = -2.40            # ceiling stops here: cutaway for the camera

# ---------------------------------------------------------------- floor
bm = bmesh.new()
box(bm, (X1-X0, Y1-Y0, 0.10), loc=((X0+X1)/2, (Y0+Y1)/2, -0.05))
mk(bm, "Floor_Slab", MAT["floor"], C["Floor"], "Floor")

bm = bmesh.new()                                   # inlaid rug-like resin panel, warm grey
box(bm, (3.30, 2.60, 0.010), loc=(0.05, 0.45, 0.005), bevel=0.004)
mk(bm, "Floor_Inlay", MAT["floor_inlay"], C["Floor"], "Floor")

# ---------------------------------------------------------------- walls (real thickness)
def wall(name, cx, cy, w, d, h=Z1, z0=0.0, m=None, group="Walls"):
    bm = bmesh.new(); box(bm, (w, d, h), loc=(cx, cy, z0 + h/2))
    return mk(bm, name, m or MAT["wall"], C["Walls"], group)

wall("Wall_Back",   (X0+X1)/2, Y1 + T/2, (X1-X0) + T*2, T)
wall("Wall_Right",  X1 + T/2,  (Y1 + 0.20)/2 + 0.10, T, Y1 - 0.20)
# a short return wall folds the open side, so the cutaway reads as architecture
wall("Wall_Return", X1 - 0.45, 0.20 - T/2, 0.90, T, h=Z1)

# feature: one deep charcoal wall section behind the credenza
bm = bmesh.new(); box(bm, (0.035, 2.30, 2.55), loc=(X1 - 0.02, 2.05, 1.275))
mk(bm, "Wall_Feature_Dark", MAT["wall_dk"], C["Walls"], "Walls")

# shallow recess in the back wall behind the pinboard
bm = bmesh.new(); box(bm, (4.60, 0.05, 2.70), loc=(-0.10, Y1 - 0.026, 1.55))
mk(bm, "Wall_Recess", MAT["wall"], C["Walls"], "Walls")

# recessed skirting: a slim shadow reveal, not a moulding
for nm, cx, cy, w, d in (("Skirt_Back", (X0+X1)/2, Y1 - 0.012, X1-X0, 0.024),
                         ("Skirt_Left", X0 + 0.012, (Y0+Y1)/2, 0.024, Y1-Y0),
                         ("Skirt_Right", X1 - 0.012, (Y1+0.2)/2 + 0.1, 0.024, Y1-0.2)):
    bm = bmesh.new(); box(bm, (w, d, 0.075), loc=(cx, cy, 0.0375))
    mk(bm, nm, MAT["wall_dk"], C["Walls"], "Walls")

# ---------------------------------------------------------------- ceiling + shadow gap
bm = bmesh.new()
box(bm, (X1-X0, Y1-CEIL_FRONT, 0.14), loc=((X0+X1)/2, (Y1+CEIL_FRONT)/2, Z1 + 0.07))
mk(bm, "Ceiling_Slab", MAT["ceiling"], C["Ceiling"], "Ceiling")
bm = bmesh.new()                                   # recessed perimeter shadow gap
for cx, cy, w, d in (((X0+X1)/2, Y1 - 0.05, X1-X0, 0.10),
                     (X0 + 0.05, (Y1+CEIL_FRONT)/2, 0.10, Y1-CEIL_FRONT),
                     (X1 - 0.05, (Y1+CEIL_FRONT)/2, 0.10, Y1-CEIL_FRONT)):
    box(bm, (w, d, 0.05), loc=(cx, cy, Z1 - 0.025))
mk(bm, "Ceiling_ShadowGap", MAT["wall_dk"], C["Ceiling"], "Ceiling")
bm = bmesh.new()                                   # exposed edge beam at the cutaway
box(bm, (X1-X0, 0.22, 0.34), loc=((X0+X1)/2, CEIL_FRONT + 0.11, Z1 - 0.17))
mk(bm, "Ceiling_Beam", MAT["ceiling"], C["Ceiling"], "Ceiling")
bm = bmesh.new()                                   # slim track-light rail
box(bm, (0.05, 4.4, 0.06), loc=(0.35, 1.25, Z1 - 0.05))
for k in range(4):
    y = -0.55 + k*1.15
    cyl(bm, 0.035, 0.16, loc=(0.35, y, Z1 - 0.15), rot=(0, 0, 0), verts=10, r2=0.052)
mk(bm, "Ceiling_Track", MAT["dark_m"], C["Ceiling"], "Ceiling")

# ---------------------------------------------------------------- window wall + window
WY0, WY1 = -1.10, 2.40                 # opening, 3.50 m wide
WZ0, WZ1 = 0.85, 2.75                  # opening, 1.90 m tall
wall("Wall_Left_Below", X0 - T/2, (Y0+Y1)/2, T, (Y1-Y0), h=WZ0)
wall("Wall_Left_Above", X0 - T/2, (Y0+Y1)/2, T, (Y1-Y0), h=Z1-WZ1, z0=WZ1)
wall("Wall_Left_Front", X0 - T/2, (Y0+WY0)/2, T, WY0-Y0, h=WZ1-WZ0, z0=WZ0)
wall("Wall_Left_Back",  X0 - T/2, (WY1+Y1)/2, T, Y1-WY1, h=WZ1-WZ0, z0=WZ0)

bm = bmesh.new()                                            # reveal lining
box(bm, (T, WY1-WY0, 0.05), loc=(X0 - T/2, (WY0+WY1)/2, WZ0 + 0.025))
box(bm, (T, WY1-WY0, 0.05), loc=(X0 - T/2, (WY0+WY1)/2, WZ1 - 0.025))
for y in (WY0 + 0.025, WY1 - 0.025):
    box(bm, (T, 0.05, WZ1-WZ0), loc=(X0 - T/2, y, (WZ0+WZ1)/2))
mk(bm, "Win_Reveal", MAT["wall"], C["Window"], "Window")

bm = bmesh.new()                                            # thin dark metal frame
FT = 0.045
box(bm, (0.075, WY1-WY0+FT*2, FT), loc=(X0 - 0.035, (WY0+WY1)/2, WZ0 + FT/2))
box(bm, (0.075, WY1-WY0+FT*2, FT), loc=(X0 - 0.035, (WY0+WY1)/2, WZ1 - FT/2))
for y in (WY0 + FT/2, WY1 - FT/2):
    box(bm, (0.075, FT, WZ1-WZ0), loc=(X0 - 0.035, y, (WZ0+WZ1)/2))
for k in range(1, 4):                                       # 3 mullions -> 4 panes
    y = WY0 + (WY1-WY0)*k/4
    box(bm, (0.062, 0.036, WZ1-WZ0-FT*2), loc=(X0 - 0.035, y, (WZ0+WZ1)/2))
box(bm, (0.030, 0.16, 0.030), loc=(X0 - 0.005, WY0 + 0.9, WZ0 + 0.42))   # handle
mk(bm, "Win_Frame", MAT["dark_m"], C["Window"], "Window")

bm = bmesh.new()                                            # stone sill, inside + out
box(bm, (0.34, WY1-WY0+0.22, 0.045), loc=(X0 + 0.09, (WY0+WY1)/2, WZ0 - 0.022), bevel=0.006)
box(bm, (0.26, WY1-WY0+0.30, 0.035), loc=(X0 - 0.20, (WY0+WY1)/2, WZ0 - 0.05), bevel=0.005)
mk(bm, "Win_Sill", MAT["wall"], C["Window"], "Window")

bm = bmesh.new()
box(bm, (0.012, WY1-WY0-FT*2, WZ1-WZ0-FT*2), loc=(X0 - 0.035, (WY0+WY1)/2, (WZ0+WZ1)/2))
mk(bm, "Win_Glass", MAT["glass"], C["Window"], "Window")

# ---------------------------------------------------------------- skyline (layered, graphic)
random.seed(11)
def city_layer(name, x, mtl, n, hmin, hmax, wmin, wmax, spread, z0=0.0):
    bm = bmesh.new(); y = -spread
    while y < spread:
        w = random.uniform(wmin, wmax); h = random.uniform(hmin, hmax)
        box(bm, (0.22, w, h), loc=(x, y + w/2, z0 + h/2))
        if random.random() < 0.30:                            # setback cap
            box(bm, (0.22, w*0.55, h*0.16), loc=(x, y + w/2, z0 + h + h*0.08))
        y += w + random.uniform(0.10, 0.55)
    return mk(bm, name, mtl, C["Skyline"], "Skyline")

city_layer("City_Far",  -9.2, MAT["city_f"], 0, 2.2, 5.4, 0.7, 2.1, 11.0, z0=-0.6)
city_layer("City_Mid",  -7.0, MAT["city_n"], 0, 1.6, 4.2, 0.6, 1.7, 9.0,  z0=-0.9)
bm = bmesh.new()                                              # one nearer marker tower
box(bm, (0.24, 0.85, 5.2), loc=(-5.6, 3.1, 1.7))
box(bm, (0.24, 0.45, 0.9), loc=(-5.6, 3.1, 4.6))
cyl(bm, 0.030, 1.0, loc=(-5.6, 3.1, 5.4), verts=8, r2=0.012)
mk(bm, "City_Tower", MAT["city_n"], C["Skyline"], "Skyline")
bm = bmesh.new()
box(bm, (0.10, 26.0, 15.0), loc=(-12.0, 1.0, 4.0))
mk(bm, "Sky_Card", MAT["sky"], C["Skyline"], "Skyline")

# ---------------------------------------------------------------- desk
DX0, DX1 = -1.42, 1.62                 # 3.04 m wide
DY0, DY1 = 0.78, 1.80                  # 1.02 m deep
DTOP = 0.742
bm = bmesh.new()
box(bm, (DX1-DX0, DY1-DY0, 0.032), loc=((DX0+DX1)/2, (DY0+DY1)/2, DTOP-0.016), bevel=0.005)
mk(bm, "Desk_Top", MAT["walnut"], C["Desk"], "Desk")

bm = bmesh.new()                                              # slim dark frame + legs
rail = 0.030
for cy in (DY0 + 0.075, DY1 - 0.075):
    box(bm, (DX1-DX0-0.16, rail, 0.055), loc=((DX0+DX1)/2, cy, DTOP-0.062))
for cx in (DX0 + 0.10, DX1 - 0.10):
    box(bm, (rail, DY1-DY0-0.20, 0.055), loc=(cx, (DY0+DY1)/2, DTOP-0.062))
for cx in (DX0 + 0.10, DX1 - 0.10):
    for cy in (DY0 + 0.10, DY1 - 0.10):
        box(bm, (0.032, 0.032, DTOP-0.09), loc=(cx, cy, (DTOP-0.09)/2))
box(bm, (0.44, 0.20, 0.028), loc=(0.95, DY1 - 0.24, DTOP-0.115))       # cable tray
mk(bm, "Desk_Frame", MAT["dark_m"], C["Desk"], "Desk")

bm = bmesh.new()                                              # modesty panel
box(bm, (2.34, 0.020, 0.30), loc=(0.10, DY1 - 0.085, DTOP-0.235), bevel=0.003)
mk(bm, "Desk_Panel", MAT["dark_m"], C["Desk"], "Desk")

# ---------------------------------------------------------------- task chair
# A slim contemporary task chair, modelled AROUND the seated figure rather than
# in isolation. Every height here was measured off her geometry first:
#
#   thigh underside .... z 0.400 - 0.414   ->  seat plane sits at 0.396 - 0.405
#   lumbar, furthest back at y_rel -0.128  ->  back panel front face at -0.146
#   forearm underside .. z 0.732 upward    ->  arm pads top out at 0.667
#
# She is leaning forward onto the desk, so her back is off the backrest above
# the lumbar and her forearms are lifted clear of the arm pads. Both are true
# of anyone actually working; what matters is that nothing intersects.
#
# Note the local loft() below. room_lib's sweep() chooses its own parallel
# transport frame, and on a run that is mostly horizontal that frame stands the
# profile on edge — which is exactly how the previous seat became a 5.6 cm wide
# vertical fin instead of a 46 cm seat pad. Every section here is placed
# explicitly instead.
CX, CY = -0.34, 0.16

CHAIR_ROOT = bpy.data.objects.new("Chair_Root", None)
C["Chair"].objects.link(CHAIR_ROOT)
CHAIR_ROOT.location = (CX, CY, 0.0)
CHAIR_ROOT.empty_display_size = 0.12
CHAIR_ROOT["group"] = "Chair"
bpy.context.view_layer.update()

def CV(x, y, z):
    return (CX + x, CY + y, z)

def loft(bm, rings, caps=True):
    R = [vlist(bm, r) for r in rings]
    for i in range(len(R) - 1):
        bridge(bm, R[i], R[i + 1])
    if caps:
        cap_ring(bm, R[-1], True)
        cap_ring(bm, R[0], False)
    return R

def CH(bm, name, material, smooth=True):
    return mk(bm, name, material, C["Chair"], "Chair", smooth=smooth, parent=CHAIR_ROOT)

# --- seat: 49 x 45 cm, dished, tapered underside, front edge rolled away from
#     the back of her knee. (y_rel, width, thickness, top z)
SEAT = [(-0.155, 0.430, 0.036, 0.405), (-0.095, 0.476, 0.048, 0.400),
        ( 0.000, 0.490, 0.052, 0.397), ( 0.100, 0.488, 0.050, 0.399),
        ( 0.195, 0.472, 0.046, 0.404), ( 0.258, 0.442, 0.038, 0.404),
        ( 0.295, 0.398, 0.024, 0.396)]
bm = bmesh.new()
loft(bm, [[CV(u, y, zt - t/2 + v) for (u, v) in rrect_profile(w, t, t*0.44, per=2)]
          for (y, w, t, zt) in SEAT])
CH(bm, "Chair_Seat", MAT["black"])

# --- back: a thin mesh-style panel, curved in plan so the edges come forward
#     around her, with a lumbar bulge. (z, front-face y_rel, width)
BACK = [(0.455, -0.160, 0.372), (0.520, -0.152, 0.416), (0.585, -0.146, 0.430),
        (0.660, -0.156, 0.420), (0.740, -0.174, 0.392), (0.820, -0.196, 0.360),
        (0.890, -0.216, 0.330), (0.935, -0.230, 0.306)]
WRAP, PT = 0.62, 0.022                    # plan radius, panel thickness

def back_ring(z, yf, w):
    hw = w/2
    xs = [-hw + 2*hw*k/7 for k in range(8)]
    front = [CV(x, yf + x*x/(2*WRAP), z) for x in xs]
    rear  = [CV(x, yf + x*x/(2*WRAP) - PT, z) for x in reversed(xs)]
    return front + rear

bm = bmesh.new()
loft(bm, [back_ring(*row) for row in BACK])
CH(bm, "Chair_Back", MAT["board"])

# --- back frame: slim perimeter rails plus the two spines carrying the back
#     down to the mechanism, routed behind the seat so nothing passes through it
bm = bmesh.new()
for s_ in (-1, 1):
    rings = []
    for (z, yf, w) in (BACK[0], BACK[2], BACK[4], BACK[6], BACK[7]):
        x = s_*(w/2 + 0.013)
        yc = yf + x*x/(2*WRAP) - PT/2
        rings.append([CV(x + u, yc + v, z)
                      for (u, v) in rrect_profile(0.020, 0.038, 0.009, per=2)])
    loft(bm, rings)
for idx, th in ((7, 0.030), (0, 0.026)):
    z, yf, w = BACK[idx]
    hw = w/2 + 0.013
    rings = []
    for k in range(6):
        x = -hw + 2*hw*k/5
        yc = yf + x*x/(2*WRAP) - PT/2
        rings.append([CV(x, yc + u, z + v)
                      for (u, v) in rrect_profile(0.036, th, 0.010, per=2)])
    loft(bm, rings)
SPINE = [(0.340, -0.176, 0.048), (0.400, -0.180, 0.046),
         (0.450, -0.174, 0.044), (0.492, -0.166, 0.040)]
for s_ in (-1, 1):
    loft(bm, [[CV(s_*0.150 + u, y + v, z)
               for (u, v) in rrect_profile(0.026, d, 0.010, per=2)]
              for (z, y, d) in SPINE])
CH(bm, "Chair_BackFrame", MAT["black"])

# --- arms: narrow pads on a single tapered blade, mounted to the cross-member
#     under the seat. The pads sit under the outer half of her upper arm.
ARMP = [(-0.020, 0.050, 0.015, 0.652), (0.045, 0.058, 0.019, 0.656),
        ( 0.140, 0.058, 0.019, 0.662), (0.222, 0.054, 0.017, 0.667),
        ( 0.265, 0.042, 0.011, 0.664)]
# The blade leans outward as it rises and thins as it goes, so it reads as
# structure rather than a stick. (z, y_rel, depth, |x|)
POST = [(0.336, 0.072, 0.062, 0.236), (0.430, 0.078, 0.054, 0.242),
        (0.540, 0.084, 0.047, 0.247), (0.646, 0.090, 0.042, 0.250)]
for s_, nm in ((-1, "Chair_Arm_Left"), (1, "Chair_Arm_Right")):
    bm = bmesh.new()
    loft(bm, [[CV(s_*0.244 + u, y, zt - t/2 + v)
               for (u, v) in rrect_profile(w, t, t*0.44, per=2)]
              for (y, w, t, zt) in ARMP])
    loft(bm, [[CV(s_*px + u, y + v, z)
               for (u, v) in rrect_profile(0.020 + (0.646 - z)*0.026, d, 0.009, per=2)]
              for (z, y, d, px) in POST])
    CH(bm, nm, MAT["black"])

# --- mechanism: compact housing plus the cross-member the arm blades land on.
#     Kept just inside the seat's own width so its ends read as arm mounts
#     rather than as bars sticking out from under the pad.
bm = bmesh.new()
box(bm, (0.230, 0.230, 0.038), loc=CV(0, -0.058, 0.334), bevel=0.006)
box(bm, (0.496, 0.072, 0.026), loc=CV(0, 0.064, 0.338), bevel=0.008)
cyl(bm, 0.010, 0.130, loc=CV(0.180, -0.014, 0.318), rot=(0, math.pi/2, 0.35), verts=8)
box(bm, (0.066, 0.018, 0.006), loc=CV(0.256, 0.010, 0.318), rot=(0, 0, 0.35), bevel=0.002)
CH(bm, "Chair_Mechanism", MAT["dark_m"], smooth=False)

# --- column: gas lift with its telescoping collar. Dark metal, not polished:
#     a bright base pulls the eye straight to the floor in every wide shot.
bm = bmesh.new()
cyl(bm, 0.033, 0.244, loc=CV(0, 0, 0.216), verts=14, r2=0.027)
cyl(bm, 0.040, 0.086, loc=CV(0, 0, 0.190), verts=14)
cyl(bm, 0.046, 0.018, loc=CV(0, 0, 0.328), verts=14)
CH(bm, "Chair_Column", MAT["dark_m"])

# --- base: five evenly spaced tapered spokes, one running dead aft.
#     (radius, half-width, top z, bottom z) — a low stance that thins outward.
SPOKE_A = [math.radians(270 + 72*k) for k in range(5)]
SEC = [(0.052, 0.030, 0.100, 0.060), (0.150, 0.026, 0.084, 0.048),
       (0.250, 0.020, 0.064, 0.038), (0.325, 0.016, 0.052, 0.032)]
bm = bmesh.new()
cyl(bm, 0.060, 0.048, loc=CV(0, 0, 0.078), verts=20, r2=0.052)
for a in SPOKE_A:
    ca, sa = math.cos(a), math.sin(a)
    rings = []
    for (r, hw, zt, zb) in SEC:
        cz, th = (zt + zb)/2, zt - zb
        rings.append([CV(ca*r - sa*u, sa*r + ca*u, cz + v)
                      for (u, v) in rrect_profile(hw*2, th, min(hw, th/2)*0.7, per=2)])
    loft(bm, rings)
CH(bm, "Chair_Base", MAT["dark_m"])

# --- casters: compact wheels, each its own node
for k, a in enumerate(SPOKE_A):
    ca, sa = math.cos(a), math.sin(a)
    bm = bmesh.new()
    cyl(bm, 0.014, 0.034, loc=CV(ca*0.325, sa*0.325, 0.046), verts=8)
    cyl(bm, 0.027, 0.020, loc=CV(ca*0.332, sa*0.332, 0.035),
        rot=(math.pi/2, 0, a), verts=12)
    CH(bm, f"Chair_Caster_{k+1:02d}", MAT["black"])

# ---------------------------------------------------------------- task lamp
LPX, LPY = 1.34, 1.52
bm = bmesh.new()
cyl(bm, 0.085, 0.016, loc=(LPX, LPY, DTOP+0.008), verts=16)
sweep(bm, [Vector((LPX, LPY, DTOP+0.02)), Vector((LPX, LPY, DTOP+0.30)),
           Vector((LPX-0.03, LPY-0.05, DTOP+0.46)), Vector((LPX-0.16, LPY-0.20, DTOP+0.50))],
      circle_profile(0.011, 8))
mk(bm, "Lamp_Frame", MAT["dark_m"], C["LightingElements"], "LightingElements", smooth=True)
bm = bmesh.new()
cyl(bm, 0.075, 0.10, loc=(LPX-0.20, LPY-0.245, DTOP+0.475), rot=(0.85, 0, -0.72), verts=16, r2=0.052)
mk(bm, "Lamp_Shade", MAT["dark_m"], C["LightingElements"], "LightingElements", smooth=True)
bm = bmesh.new()
cyl(bm, 0.048, 0.008, loc=(LPX-0.233, LPY-0.283, DTOP+0.447), rot=(0.85, 0, -0.72), verts=14)
mk(bm, "Lamp_Emitter", MAT["warm"], C["LightingElements"], "LightingElements")

# ================================================================ THE MODEL
# A conceptual tower: shifted slabs, two frosted volumes, an exposed circulation
# core and a mast.
#
# IMPORTANT, and the source of a long-standing bug on the web side: every piece
# shares ONE origin, at the model's base centre on the desk. A piece's own
# height is baked into its local Z, so local bounding boxes are neither centred
# on the origin nor sitting on it — Bld_13_mast's local Z runs 0.521 to 0.691.
# Anything growing these pieces upward has to read each mesh's own local bounds
# rather than assume a centred or base-seated origin.
MX, MY = 0.56, 1.30
BLD = []
def bld(idx, name, material, build):
    bm = bmesh.new(); build(bm)
    ob = mk(bm, name, material, C["Building"], "Building", loc=(MX, MY, DTOP),
            rot=(0, 0, math.radians(-62)), order=idx)
    BLD.append(ob); return ob

def slab(bm, w, d, t, dx=0.0, dy=0.0, z=0.0, rz=0.0, bev=0.0035):
    box(bm, (w, d, t), loc=(dx, dy, z + t/2), rot=(0, 0, rz), bevel=bev)

# An asymmetric proposal: a long low bar, a slender offset tower, alternating
# cantilevered floor plates and one exposed circulation core running full height.
RZ = math.radians(-6.0)
bld(1,  "Bld_01_base",   MAT["card"],
    lambda bm: (slab(bm, 0.520, 0.400, 0.011, 0.0, 0.0, 0.000, 0.0, 0.002),
                slab(bm, 0.470, 0.352, 0.004, 0.010, -0.004, 0.011, 0.0, 0.001)))
bld(2,  "Bld_02_podium", MAT["model"],                       # long low bar, cut open
    lambda bm: (slab(bm, 0.430, 0.150, 0.070, -0.020, -0.086, 0.015, RZ),
                slab(bm, 0.150, 0.190, 0.070, -0.160, 0.040, 0.015, RZ),
                slab(bm, 0.450, 0.330, 0.008, -0.020, -0.020, 0.085, RZ, 0.001)))
bld(3,  "Bld_03_plate",  MAT["card"],                        # first cantilever, +x
    lambda bm: (slab(bm, 0.412, 0.250, 0.009, 0.021, 0.020, 0.093, RZ),
                slab(bm, 0.412, 0.008, 0.020, 0.021, 0.121, 0.096, RZ, 0.001)))
bld(4,  "Bld_04_volume", MAT["frost"],                       # glazed lower volume
    lambda bm: slab(bm, 0.210, 0.196, 0.098, 0.030, 0.014, 0.102, RZ, 0.002))
bld(5,  "Bld_05_plate",  MAT["card"],                        # cantilever swings -x
    lambda bm: (slab(bm, 0.352, 0.244, 0.009, -0.050, 0.012, 0.200, RZ),
                slab(bm, 0.008, 0.244, 0.020, -0.222, 0.012, 0.203, RZ, 0.001)))
bld(6,  "Bld_06_volume", MAT["model"],                       # solid mass, terrace notch
    lambda bm: (slab(bm, 0.200, 0.186, 0.092, 0.026, 0.020, 0.209, RZ, 0.002),
                slab(bm, 0.070, 0.080, 0.030, -0.060, -0.030, 0.209, RZ, 0.002)))
bld(7,  "Bld_07_plate",  MAT["card"],
    lambda bm: (slab(bm, 0.355, 0.232, 0.009, -0.008, 0.024, 0.301, RZ),
                slab(bm, 0.100, 0.120, 0.004, -0.110, -0.040, 0.301, RZ, 0.001)))
bld(8,  "Bld_08_volume", MAT["frost"],                       # slender tower begins
    lambda bm: slab(bm, 0.150, 0.164, 0.104, 0.048, 0.028, 0.310, RZ, 0.002))
bld(9,  "Bld_09_plate",  MAT["card"],
    lambda bm: (slab(bm, 0.337, 0.208, 0.009, -0.016, 0.024, 0.414, RZ),
                slab(bm, 0.337, 0.008, 0.018, -0.016, 0.124, 0.417, RZ, 0.001)))
bld(10, "Bld_10_volume", MAT["model"],
    lambda bm: (slab(bm, 0.138, 0.150, 0.088, 0.052, 0.026, 0.423, RZ, 0.002),
                slab(bm, 0.026, 0.150, 0.088, -0.030, 0.026, 0.423, RZ, 0.001)))
def core(bm):                                                # exposed core, full height
    # Runs past the roof and takes a cap of its own: a lift overrun. Previously
    # it stopped dead level with the roof slab that does not cover it, which
    # read as an unfinished shaft parked beside the tower.
    box(bm, (0.070, 0.104, 0.542), loc=(-0.176, -0.042, 0.271), rot=(0, 0, RZ), bevel=0.002)
    box(bm, (0.090, 0.124, 0.014), loc=(-0.176, -0.042, 0.549), rot=(0, 0, RZ), bevel=0.002)
    for k in range(10):
        box(bm, (0.078, 0.016, 0.004), loc=(-0.176, -0.042, 0.050 + k*0.052), rot=(0, 0, RZ))
    box(bm, (0.150, 0.014, 0.010), loc=(-0.110, -0.042, 0.196), rot=(0, 0, RZ))
    box(bm, (0.150, 0.014, 0.010), loc=(-0.110, -0.042, 0.404), rot=(0, 0, RZ))
bld(11, "Bld_11_core",   MAT["model"], core)
bld(12, "Bld_12_roof",   MAT["card"],
    lambda bm: (slab(bm, 0.196, 0.186, 0.010, 0.052, 0.026, 0.511, RZ),
                slab(bm, 0.196, 0.010, 0.028, 0.052, 0.117, 0.521, RZ, 0.001),
                slab(bm, 0.010, 0.186, 0.028, 0.148, 0.026, 0.521, RZ, 0.001)))
def mast(bm):
    cyl(bm, 0.0070, 0.170, loc=(0.052, 0.026, 0.606), verts=8, r2=0.0030)
    box(bm, (0.128, 0.007, 0.006), loc=(0.104, 0.026, 0.646), rot=(0, 0, RZ))
    box(bm, (0.007, 0.007, 0.034), loc=(0.162, 0.026, 0.630))
bld(13, "Bld_13_mast",   MAT["model"], mast)

bm = bmesh.new()                                             # blue reveal, the one accent
box(bm, (0.452, 0.332, 0.004), loc=(-0.020, -0.020, 0.087), rot=(0, 0, RZ))
mk(bm, "Bld_Accent", MAT["blue"], C["Building"], "Building", loc=(MX, MY, DTOP),
   rot=(0, 0, math.radians(-62)), order=2)

# ================================================================ desktop
def sheet(bm, w, d, x, y, rz, t=0.0016, z=DTOP):
    box(bm, (w, d, t), loc=(x, y, z + t/2), rot=(0, 0, rz))

bm = bmesh.new()                                           # the main drawing + trace layers
sheet(bm, 0.62, 0.44, -0.44, 1.16, math.radians(-6))
sheet(bm, 0.58, 0.41, -0.40, 1.22, math.radians(3), z=DTOP+0.0016)
sheet(bm, 0.30, 0.22, -0.72, 1.02, math.radians(11), z=DTOP+0.0032)
mk(bm, "Desktop_Drawings", MAT["paper"], C["Desktop"], "Desktop")

bm = bmesh.new()                                           # plan linework on the top sheet
bmA = bmesh.new()
SR = math.radians(3); SCX, SCY = -0.40, 1.22
def DL(bmx, dx, dy, w, d, z=DTOP+0.0046):
    ca, sa = math.cos(SR), math.sin(SR)
    box(bmx, (w, d, 0.0008), loc=(SCX + dx*ca - dy*sa, SCY + dx*sa + dy*ca, z), rot=(0, 0, SR))
for (dx, dy, w, d) in ((0, 0.150, 0.440, 0.0075), (0, -0.150, 0.440, 0.0075),
                       (-0.220, 0, 0.0075, 0.300), (0.220, 0, 0.0075, 0.300)):
    DL(bm, dx, dy, w, d)
DL(bm, -0.052, 0.014, 0.0050, 0.272); DL(bm, 0.086, 0.070, 0.268, 0.0050)
for k in range(7):
    DL(bm, 0.150, -0.098 + k*0.019, 0.120, 0.0026)
for k in range(10):
    a = math.tau*k/10
    DL(bm, -0.130 + math.cos(a)*0.040, -0.020 + math.sin(a)*0.040, 0.020, 0.0030)
DL(bm, -0.150, -0.118, 0.150, 0.012); DL(bm, -0.150, -0.100, 0.150, 0.0022)
mk(bm, "Desktop_Linework", MAT["dark_m"], C["Desktop"], "Desktop")
for k in range(4):
    DL(bmA, 0.086, -0.118 + k*0.056, 0.250, 0.0030)
DL(bmA, 0.196, 0.0, 0.0040, 0.240)
mk(bmA, "Desktop_Linework_Blue", MAT["blue"], C["Desktop"], "Desktop")

bm = bmesh.new()                                           # sketchbook, closed
box(bm, (0.24, 0.17, 0.020), loc=(-1.02, 1.44, DTOP+0.010), rot=(0, 0, math.radians(-14)), bevel=0.003)
mk(bm, "Desktop_Sketchbook", MAT["cloth_d"], C["Desktop"], "Desktop")
bm = bmesh.new()
box(bm, (0.226, 0.158, 0.013), loc=(-1.02, 1.44, DTOP+0.0105), rot=(0, 0, math.radians(-14)))
mk(bm, "Desktop_Sketchbook_Pages", MAT["paper"], C["Desktop"], "Desktop")

bm = bmesh.new()                                           # pencil + scale rule
cyl(bm, 0.0045, 0.145, loc=(-0.10, 0.96, DTOP+0.005), rot=(0, math.pi/2, math.radians(24)), verts=6)
cyl(bm, 0.0048, 0.020, loc=(-0.172, 0.964, DTOP+0.005), rot=(0, math.pi/2, math.radians(24)), verts=6, r2=0.0016)
mk(bm, "Desktop_Pencil", MAT["dark_m"], C["Desktop"], "Desktop", smooth=True)
bm = bmesh.new()
box(bm, (0.30, 0.026, 0.006), loc=(0.02, 0.90, DTOP+0.003), rot=(0, 0, math.radians(6)), bevel=0.001)
mk(bm, "Desktop_Scale", MAT["brushed"], C["Desktop"], "Desktop")

bm = bmesh.new()                                           # books, two flat one leaning
box(bm, (0.20, 0.26, 0.030), loc=(-1.16, 1.05, DTOP+0.015), rot=(0, 0, math.radians(8)), bevel=0.003)
box(bm, (0.19, 0.25, 0.026), loc=(-1.14, 1.06, DTOP+0.043), rot=(0, 0, math.radians(-4)), bevel=0.003)
mk(bm, "Desktop_Books", MAT["walnut"], C["Desktop"], "Desktop")
bm = bmesh.new()
box(bm, (0.185, 0.245, 0.022), loc=(-1.14, 1.06, DTOP+0.043), rot=(0, 0, math.radians(-4)))
mk(bm, "Desktop_Book_Blue", MAT["blue"], C["Desktop"], "Desktop")

bm = bmesh.new()                                           # material samples, a neat row
for k in range(4):
    box(bm, (0.062, 0.062, 0.007), loc=(1.06 + (k%2)*0.072, 1.10 - (k//2)*0.072, DTOP+0.004),
        rot=(0, 0, math.radians(2*k)), bevel=0.001)
mk(bm, "Desktop_Samples", MAT["model"], C["Desktop"], "Desktop")
bm = bmesh.new()
box(bm, (0.058, 0.058, 0.005), loc=(1.132, 1.028, DTOP+0.0095), rot=(0, 0, math.radians(4)))
mk(bm, "Desktop_Sample_Walnut", MAT["walnut"], C["Desktop"], "Desktop")

bm = bmesh.new()                                           # tablet, laid flat, dark
box(bm, (0.19, 0.26, 0.007), loc=(0.02, 1.62, DTOP+0.004), rot=(0, 0, math.radians(-9)), bevel=0.002)
mk(bm, "Desktop_Tablet", MAT["black"], C["Desktop"], "Desktop")

bm = bmesh.new()                                           # bin, under the desk edge
cyl(bm, 0.115, 0.30, loc=(1.86, 0.72, 0.15), verts=18, r2=0.095)
mk(bm, "Bin", MAT["dark_m"], C["Bin"], "Bin", smooth=True)

# ================================================================ pin-up wall
BYF = Y1 - 0.055                      # front face of the board
bm = bmesh.new()
box(bm, (4.50, 0.030, 2.05), loc=(-0.10, BYF + 0.015, 1.82))
mk(bm, "Board_Panel", MAT["board"], C["Pinboard"], "Pinboard")
bm = bmesh.new()                      # slim frame
for cx, cz, w, h in ((-0.10, 2.855, 4.55, 0.030), (-0.10, 0.785, 4.55, 0.030),
                     (-2.365, 1.82, 0.030, 2.10), (2.165, 1.82, 0.030, 2.10)):
    box(bm, (w, 0.042, h), loc=(cx, BYF + 0.008, cz))
mk(bm, "Board_Frame", MAT["dark_m"], C["Pinboard"], "Pinboard")

random.seed(23)
SHEETS = [(-1.72, 2.35, 0.66, 0.90, -1.6), (-1.02, 2.30, 0.54, 0.74, 2.4),
          (-0.30, 2.42, 0.78, 0.56, -0.9), (0.52, 2.34, 0.60, 0.84, 1.8),
          (1.30, 2.40, 0.70, 0.52, -2.2), (1.86, 2.16, 0.44, 0.62, 1.1),
          (-1.90, 1.34, 0.56, 0.78, 1.4), (-1.16, 1.28, 0.72, 0.54, -1.9),
          (-0.24, 1.30, 0.62, 0.86, 0.8), (0.56, 1.24, 0.80, 0.58, -1.2),
          (1.44, 1.32, 0.52, 0.74, 2.0)]
bm = bmesh.new()
for (cx, cz, w, h, r) in SHEETS:
    box(bm, (w, 0.0016, h), loc=(cx, BYF - 0.004, cz), rot=(0, math.radians(r), 0))
mk(bm, "Board_Sheets", MAT["paper"], C["Pinboard"], "Pinboard")

# graphic linework only: plan, elevation, section, axo. no glyphs anywhere.
bmL = bmesh.new(); bmD = bmesh.new()
def LN(bmx, cx, cz, r, dx, dz, w, h, y=BYF - 0.0062):
    ca, sa = math.cos(math.radians(r)), math.sin(math.radians(r))
    box(bmx, (w, 0.0009, h), loc=(cx + dx*ca - dz*sa, y, cz + dx*sa + dz*ca),
        rot=(0, math.radians(r), 0))

def draw_sheet(bmD, bmL, cx, cz, w, h, r, kind):
    iw, ih = w*0.80, h*0.74
    top = ih/2; bot = -ih/2 + h*0.09
    LN(bmD, cx, cz, r, -iw/2 + iw*0.16, -h*0.40, iw*0.32, 0.014)          # title strip
    LN(bmD, cx, cz, r, -iw/2 + iw*0.16, -h*0.40 + 0.020, iw*0.32, 0.0022)
    if kind == 0:                                                          # PLAN
        for (dx, dz, ww, hh) in ((0, top, iw, 0.010), (0, bot, iw, 0.010),
                                 (-iw/2, (top+bot)/2, 0.010, top-bot),
                                 (iw/2, (top+bot)/2, 0.010, top-bot)):
            LN(bmD, cx, cz, r, dx, dz, ww, hh)
        LN(bmD, cx, cz, r, -iw*0.10, (top+bot)/2, 0.006, (top-bot)*0.72)
        LN(bmD, cx, cz, r, iw*0.14, (top+bot)/2 + (top-bot)*0.18, iw*0.36, 0.006)
        for k in range(6):                                                 # stair run
            LN(bmD, cx, cz, r, iw*0.26, bot + 0.022 + k*0.017, iw*0.20, 0.0028)
        for k in range(8):                                                 # core, drawn round
            a = math.tau*k/8
            LN(bmL, cx, cz, r, -iw*0.28 + math.cos(a)*0.030,
               (top+bot)/2 + math.sin(a)*0.030, 0.014, 0.0035)
    elif kind == 1:                                                        # ELEVATION
        LN(bmD, cx, cz, r, 0, bot, iw*1.06, 0.010)                         # ground
        LN(bmD, cx, cz, r, -iw*0.30, (top+bot)/2, 0.007, top-bot)
        LN(bmD, cx, cz, r, iw*0.34, (top+bot)/2 - (top-bot)*0.16, 0.007, (top-bot)*0.68)
        LN(bmD, cx, cz, r, 0.02, top, iw*0.70, 0.007)
        for k in range(4):
            LN(bmL, cx, cz, r, 0.02, bot + (top-bot)*(k+1)/5, iw*0.66, 0.0030)
        for k in range(5):                                                 # one glazed bay
            LN(bmD, cx, cz, r, -iw*0.16 + k*0.020, (top+bot)/2, 0.0022, (top-bot)*0.52)
        for k in range(6):                                                 # a tree, as a blob
            a = math.tau*k/6
            LN(bmD, cx, cz, r, iw*0.44 + math.cos(a)*0.018, bot + 0.045 + math.sin(a)*0.018, 0.012, 0.0035)
    elif kind == 2:                                                        # SECTION
        LN(bmD, cx, cz, r, 0, bot, iw*1.02, 0.008)
        for k in range(10):                                                # ground hatch
            LN(bmD, cx, cz, r, -iw/2 + k*iw/9, bot - 0.016, 0.0022, 0.024)
        for k in range(4):
            LN(bmD, cx, cz, r, -iw*0.06, bot + (top-bot)*(k+1)/4.4, iw*0.72, 0.009)
        LN(bmD, cx, cz, r, iw*0.34, (top+bot)/2, 0.010, top-bot)
        LN(bmL, cx, cz, r, -iw*0.40, (top+bot)/2, 0.006, (top-bot)*0.80)
    else:                                                                  # AXO stack
        for k in range(4):
            off = -0.026 + k*0.017
            LN(bmD, cx, cz, r, off, bot + 0.030 + k*(top-bot)*0.24, iw*(0.62 - 0.07*k), 0.008)
            LN(bmD, cx, cz, r, off - iw*(0.31 - 0.035*k), bot + 0.030 + k*(top-bot)*0.24 + 0.020,
               0.0035, 0.040)
        LN(bmL, cx, cz, r, 0.006, bot + 0.030 + 1.6*(top-bot)*0.24, 0.0040, (top-bot)*0.62)

for i2, (cx, cz, w, h, r) in enumerate(SHEETS):
    draw_sheet(bmD, bmL, cx, cz, w, h, r, i2 % 4)
mk(bmL, "Board_Linework_Blue", MAT["blue"], C["Pinboard"], "Pinboard")
mk(bmD, "Board_Linework_Dark", MAT["dark_m"], C["Pinboard"], "Pinboard")

bm = bmesh.new()                                    # tacks
for (cx, cz, w, h, r) in SHEETS:
    cyl(bm, 0.0075, 0.012, loc=(cx, BYF - 0.010, cz + h/2 - 0.028),
        rot=(math.pi/2, 0, 0), verts=8)
mk(bm, "Board_Tacks", MAT["brushed"], C["Pinboard"], "Pinboard", smooth=True)

bm = bmesh.new()                                    # pinned material swatches
for k in range(4):
    box(bm, (0.085, 0.006, 0.085), loc=(1.86 + 0*k, 1.62 - k*0.10, 0), rot=(0, 0, 0))
mk(bm, "Board_Swatches_tmp", MAT["walnut"], C["Pinboard"], "Pinboard")
bpy.data.objects.remove(bpy.data.objects["Board_Swatches_tmp"], do_unlink=True)
bm = bmesh.new()
for k in range(3):
    box(bm, (0.088, 0.006, 0.088), loc=(1.90, BYF - 0.006, 0.98 + k*0.105), rot=(0, math.radians(1.5*k), 0))
mk(bm, "Board_Swatches", MAT["walnut"], C["Pinboard"], "Pinboard")

# ================================================================ credenza / material library
CRX = X1 - 0.235
bm = bmesh.new()
box(bm, (0.47, 2.10, 0.62), loc=(CRX, 2.05, 0.40), bevel=0.006)
box(bm, (0.49, 2.14, 0.028), loc=(CRX, 2.05, 0.725), bevel=0.004)
box(bm, (0.44, 0.020, 0.50), loc=(CRX - 0.012, 1.02, 0.40))
mk(bm, "Cred_Body", MAT["walnut"], C["Credenza"], "Credenza")
bm = bmesh.new()
for k in range(3):                                    # recessed plinth + drawer reveals
    box(bm, (0.472, 0.010, 0.60), loc=(CRX, 1.35 + k*0.70, 0.40))
box(bm, (0.42, 2.06, 0.09), loc=(CRX + 0.02, 2.05, 0.045))
mk(bm, "Cred_Reveals", MAT["dark_m"], C["Credenza"], "Credenza")
bm = bmesh.new()                                      # shallow wall shelf above
box(bm, (0.30, 1.70, 0.032), loc=(X1 - 0.155, 2.20, 1.62), bevel=0.004)
for cy in (1.42, 2.98):
    box(bm, (0.28, 0.026, 0.20), loc=(X1 - 0.155, cy, 1.51))
mk(bm, "Cred_Shelf", MAT["walnut"], C["Credenza"], "Credenza")

bm = bmesh.new()                                      # upright books on the shelf
random.seed(7); yy = 1.55
for k in range(9):
    t = random.uniform(0.022, 0.042); hh = random.uniform(0.20, 0.27)
    lean = math.radians(random.uniform(-3, 3))
    box(bm, (0.17, t, hh), loc=(X1 - 0.17, yy + t/2, 1.638 + hh/2), rot=(lean, 0, 0), bevel=0.002)
    yy += t + 0.004
mk(bm, "Cred_Books", MAT["paper"], C["Credenza"], "Credenza")
bm = bmesh.new()
yy = 1.55
random.seed(7)
for k in range(9):
    t = random.uniform(0.022, 0.042); hh = random.uniform(0.20, 0.27)
    if k % 3 == 0:
        box(bm, (0.172, t*0.96, hh*0.98), loc=(X1 - 0.17, yy + t/2, 1.638 + hh/2), bevel=0.002)
    yy += t + 0.004
mk(bm, "Cred_Books_Accent", MAT["blue"], C["Credenza"], "Credenza")

bm = bmesh.new()                                      # sample boxes + rolled plans on top
box(bm, (0.30, 0.34, 0.12), loc=(CRX, 1.35, 0.80), bevel=0.004)
box(bm, (0.28, 0.32, 0.10), loc=(CRX - 0.01, 1.36, 0.905), bevel=0.004)
mk(bm, "Cred_Boxes", MAT["model"], C["Credenza"], "Credenza")
bm = bmesh.new()
for k in range(3):
    cyl(bm, 0.028, 0.52, loc=(CRX + 0.02 - k*0.055, 2.55 + k*0.03, 0.775 + (k%2)*0.052),
        rot=(math.pi/2, 0, math.radians(4*k)), verts=10)
mk(bm, "Cred_Rolls", MAT["paper"], C["Credenza"], "Credenza", smooth=True)
bm = bmesh.new()                                      # a small study model, echoing the hero
box(bm, (0.16, 0.16, 0.012), loc=(CRX, 3.02, 0.745), bevel=0.002)
box(bm, (0.10, 0.10, 0.075), loc=(CRX - 0.012, 3.03, 0.789), bevel=0.002)
box(bm, (0.07, 0.07, 0.055), loc=(CRX + 0.010, 3.01, 0.854), bevel=0.002)
mk(bm, "Cred_Study_Model", MAT["model"], C["Credenza"], "Credenza")

# ================================================================ plant
PLX, PLY = -2.62, 0.38
bm = bmesh.new()
cyl(bm, 0.185, 0.40, loc=(PLX, PLY, 0.20), verts=20, r2=0.150)
box(bm, (0.40, 0.40, 0.018), loc=(PLX, PLY, 0.408), bevel=0.004)
mk(bm, "Plant_Pot", MAT["wall"], C["Plant"], "Plant", smooth=True)
bm = bmesh.new()
cyl(bm, 0.150, 0.03, loc=(PLX, PLY, 0.395), verts=18)
mk(bm, "Plant_Soil", MAT["soil"], C["Plant"], "Plant")

bm = bmesh.new()
random.seed(31)
for tier, (n, lo, hi, up) in enumerate(((6, 0.34, 0.50, 0.30), (5, 0.46, 0.66, 0.66))):
    for k in range(n):
        a = math.tau*k/n + tier*0.55 + random.uniform(-0.16, 0.16)
        L = random.uniform(lo, hi)
        base = Vector((PLX, PLY, 0.41 + tier*0.16))
        outr = L*random.uniform(0.70, 0.95)
        tip = base + Vector((math.cos(a)*outr, math.sin(a)*outr, L*up + 0.06))
        m1 = base.lerp(tip, 0.38) + Vector((0, 0, L*0.30))
        m2 = base.lerp(tip, 0.74) + Vector((0, 0, L*0.16))
        stem = [base, m1, m2, tip]
        def prof(t, L=L):
            wdt = 0.128*math.sin(math.pi*min(t*1.06, 1.0))**0.55 * (0.75 + 0.35*(L/0.66))
            return [(-0.004 - wdt, -0.0032), (0.004 + wdt, -0.0032),
                    (0.004 + wdt, 0.0032), (-0.004 - wdt, 0.0032)]
        sweep(bm, stem, prof)
mk(bm, "Plant_Leaves", MAT["plant"], C["Plant"], "Plant", smooth=True)

bm = bmesh.new()                                  # leaning presentation boards
box(bm, (0.030, 0.86, 1.28), loc=(-3.10, -1.85, 0.66), rot=(0.11, 0, 0), bevel=0.004)
box(bm, (0.026, 0.74, 1.12), loc=(-3.02, -1.72, 0.58), rot=(0.14, 0, 0), bevel=0.004)
mk(bm, "Cred_Lean_Boards", MAT["model"], C["Credenza"], "Walls")
bm = bmesh.new()
box(bm, (0.008, 0.52, 0.36), loc=(-3.00, -1.72, 0.86), rot=(0.14, 0, 0))
mk(bm, "Cred_Lean_Print", MAT["blue"], C["Credenza"], "Walls")

# ================================================================ the architect
FX, FY = CX, CY                                   # seated on the chair
def V(x, y, z): return Vector((FX + x, FY + y, z))

# torso: one lofted volume, hips -> shoulders, leaning into the work
TOR = [V(0, 0.030, 0.505), V(0, 0.075, 0.620), V(0, 0.120, 0.735),
       V(0, 0.158, 0.850), V(0, 0.168, 0.945), V(0, 0.172, 0.995)]
TW  = [(0.340, 0.225), (0.298, 0.192), (0.312, 0.192),
       (0.356, 0.202), (0.386, 0.190), (0.330, 0.170)]
bm = bmesh.new()
def torso_profile(t):
    f = t*(len(TW)-1); i = min(int(f), len(TW)-2); k = f-i
    w = TW[i][0]*(1-k) + TW[i+1][0]*k
    d = TW[i][1]*(1-k) + TW[i+1][1]*k
    return rrect_profile(w, d, min(w, d)*0.42, per=4)
sweep(bm, TOR, torso_profile)
mk(bm, "Fig_Torso", MAT["cloth_l"], C["Figure"], "Figure", smooth=True)

bm = bmesh.new()                                  # neck
sweep(bm, [V(0, 0.176, 0.975), V(0, 0.188, 1.020), V(0, 0.196, 1.050)],
      circle_profile(0.046, 12, 1.0, 0.92))
mk(bm, "Fig_Neck", MAT["skin"], C["Figure"], "Figure", smooth=True)

bm = bmesh.new()                                  # head
uvsphere(bm, 0.098, loc=(FX, FY + 0.205, 1.118), seg=22, rings=13, squash=(1.0, 1.12, 1.20))
mk(bm, "Fig_Head", MAT["skin"], C["Figure"], "Figure", smooth=True)

bm = bmesh.new()                                  # hair: a sculpted bob, open at the face
HC = Vector((FX, FY + 0.205, 1.118)); SEG, RNG = 24, 14
grid = []
for i in range(RNG + 1):
    va = math.pi * (i / RNG) * 0.96 + 0.02
    ring = []
    for j in range(SEG):
        ua = math.tau * j / SEG
        nx, ny, nz = math.sin(va)*math.sin(ua), math.sin(va)*math.cos(ua), math.cos(va)
        front = max(0.0, ny) ** 1.4                     # 1 at the face, 0 at the back
        off = 0.014 - 0.062*front
        drop = 0.030 * max(0.0, (i/RNG) - 0.55) * (1.0 - front)   # length at the nape
        ring.append(bm.verts.new(HC + Vector(((0.098 + off)*nx,
                                              (0.110 + off)*ny,
                                              (0.120 + off)*nz - drop))))
    grid.append(ring)
for i in range(RNG):
    bridge(bm, grid[i], grid[i+1])
cap_ring(bm, grid[0], True); cap_ring(bm, grid[-1], False)
sweep(bm, [V(0, 0.108, 1.052), V(0, 0.086, 1.012), V(0, 0.090, 0.982)],
      lambda t: circle_profile(0.044 - 0.012*t, 12, 1.10, 0.62))
mk(bm, "Fig_Hair", MAT["hair"], C["Figure"], "Figure", smooth=True)

bm = bmesh.new()                                  # collar band, the editorial detail
sweep(bm, [V(0, 0.172, 0.982), V(0, 0.176, 1.000)],
      lambda t: rrect_profile(0.152 - 0.020*t, 0.126 - 0.016*t, 0.048, per=4))
mk(bm, "Fig_Collar", MAT["cloth_d"], C["Figure"], "Figure", smooth=True)

def limb(bm, pts, r0, r1, sides=10, sx=1.0):
    sweep(bm, pts, lambda t: circle_profile(r0*(1-t) + r1*t, sides, sx, 1.0))

bm = bmesh.new()                                  # arms, sleeves to the wrist
for s_ in (-1, 1):
    limb(bm, [V(s_*0.176, 0.144, 0.928), V(s_*0.208, 0.236, 0.848),
              V(s_*0.214, 0.396, 0.790), V(s_*0.202, 0.556, 0.774),
              V(s_*0.188, 0.706, 0.766)], 0.060, 0.034, 11)
mk(bm, "Fig_Arms", MAT["cloth_l"], C["Figure"], "Figure", smooth=True)

bm = bmesh.new()                                  # hands resting on the sheets
for s_ in (-1, 1):
    sweep(bm, [V(s_*0.186, 0.712, 0.764), V(s_*0.182, 0.772, 0.757),
               V(s_*0.178, 0.838, 0.752), V(s_*0.176, 0.882, 0.753)],
          lambda t: rrect_profile(0.078 - 0.014*t, 0.036 - 0.008*t, 0.015, per=3))
    sweep(bm, [V(s_*0.156, 0.742, 0.760), V(s_*0.142, 0.804, 0.755)],
          lambda t: circle_profile(0.017 - 0.004*t, 8))
mk(bm, "Fig_Hands", MAT["skin"], C["Figure"], "Figure", smooth=True)

bm = bmesh.new()                                  # legs
for s_ in (-1, 1):
    limb(bm, [V(s_*0.105, 0.055, 0.512), V(s_*0.122, 0.230, 0.492),
              V(s_*0.132, 0.415, 0.470), V(s_*0.128, 0.470, 0.330),
              V(s_*0.124, 0.492, 0.130), V(s_*0.122, 0.500, 0.072)],
         0.098, 0.052, 11)
mk(bm, "Fig_Legs", MAT["cloth_d"], C["Figure"], "Figure", smooth=True)

bm = bmesh.new()                                  # shoes
for s_ in (-1, 1):
    sweep(bm, [V(s_*0.122, 0.488, 0.062), V(s_*0.122, 0.560, 0.036),
               V(s_*0.120, 0.620, 0.028)],
          lambda t: rrect_profile(0.086, 0.062 - 0.018*t, 0.022, per=3))
mk(bm, "Fig_Shoes", MAT["black"], C["Figure"], "Figure", smooth=True)

# ================================================================ finish
import json as _json
scn["room_palette"] = _json.dumps(P)
scn["room_groups"] = _json.dumps(GROUPS)

tot = 0; per = {}
for g in GROUPS:
    t = sum(tris(o) for o in C[g].objects if o.type == 'MESH')
    per[g] = t; tot += t
for g in GROUPS:
    print(f"  {g:18s} {len(C[g].objects):3d} obj  {per[g]:6d} tris")
print("TOTAL", tot, "tris in", sum(len(C[g].objects) for g in GROUPS), "objects")
print("building pieces:", [o.name for o in sorted(C['Building'].objects, key=lambda x: x.get('order', 0))])

BLEND = str(_SRC / "office_room_v2.blend")
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print("saved:", BLEND)
