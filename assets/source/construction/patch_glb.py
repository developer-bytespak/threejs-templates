"""
Apply the rebar and pour-stream fixes straight to the exported GLB.

This exists because Blender was not running and the fix could not wait. It is
NOT a second source of truth: `build_foundation.py` and `build_concrete.py`
already carry the same change, and the next time either is run in Blender it
produces exactly this geometry. Everything here is chosen so that it does —
the hexagon angles, the anchor, the radius, the lengths.

WHAT IT DOES

  1. Lengthens the vertical reinforcement. Every bar in a REBAR_V_* group is
     a prism standing on the group's own origin, so its local Y runs 0..H.
     Each old H is remapped to its new one by exact value, which needs no
     assumption about vertex order — and the exporter's flat shading means
     there is no reliable vertex order to assume.

  2. Thickens the same bars from 55 mm to 78 mm radius. A bar's vertices are
     the corners of two hexagons about one vertical centreline, so the
     centreline is recovered by clustering on (x, z): two bars are never
     closer than 0.5 m and one bar's corners are never further than 0.08 m
     from its own axis. Each corner is then pushed out from that axis by the
     ratio. A uniform radial scale of a hexagon is the hexagon the builder
     would have drawn at the larger radius, so the two agree exactly.

  3. Removes the pour streams from the scene graph by taking the mesh off
     their nodes. Deleting the nodes outright would mean renumbering every
     node reference in the file; dropping one key does not, and an empty is
     as absent as it needs to be.

Normals are untouched on purpose: lengthening a prism moves no face, and
scaling one radially leaves every side face and both caps pointing where they
already pointed.
"""

import json
import struct
import sys

#: old height -> new height, in metres. Matches build_foundation.py.
LENGTHS = {
    1.50: 2.55,   # perimeter dowels        STRIP_BAR
    2.40: 3.10,   # pad column starters     PAD_COLUMN
    1.05: 2.10,   # pad + beam uprights     PAD_UPRIGHT / BEAM_BAR
    1.55: 2.35,   # pit wall starters       PIT_BAR
}
#: The beam links are 1.05 like the pad uprights but want 1.95, so they are
#: remapped per group rather than by value alone.
PER_GROUP = {
    'REBAR_V_BEAM': {1.05: 1.95},
}

OLD_R = 0.055
NEW_R = 0.078
TOL = 1e-4


def read_glb(path):
    with open(path, 'rb') as f:
        magic, version, length = struct.unpack('<III', f.read(12))
        assert magic == 0x46546C67, 'not a GLB'
        chunks = []
        while f.tell() < length:
            clen, ctype = struct.unpack('<II', f.read(8))
            chunks.append((ctype, bytearray(f.read(clen))))
    js = json.loads(bytes(chunks[0][1]).decode('utf-8'))
    bin_ = chunks[1][1] if len(chunks) > 1 else bytearray()
    return js, bin_


def write_glb(path, js, bin_):
    j = json.dumps(js, separators=(',', ':')).encode('utf-8')
    j += b' ' * ((4 - len(j) % 4) % 4)
    b = bytes(bin_) + b'\x00' * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(b)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(j), 0x4E4F534A))
        f.write(j)
        f.write(struct.pack('<II', len(b), 0x004E4942))
        f.write(b)
    return total


def positions(js, bin_, accessor_index):
    """Every position in one accessor, as a list of [x, y, z] and a writer."""
    acc = js['accessors'][accessor_index]
    assert acc['componentType'] == 5126 and acc['type'] == 'VEC3', 'expected float VEC3'
    view = js['bufferViews'][acc['bufferView']]
    stride = view.get('byteStride') or 12
    start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    n = acc['count']
    verts = []
    for i in range(n):
        o = start + i * stride
        verts.append(list(struct.unpack_from('<fff', bin_, o)))

    def write(vs):
        for i, v in enumerate(vs):
            struct.pack_into('<fff', bin_, start + i * stride, *v)
        acc['min'] = [min(v[k] for v in vs) for k in range(3)]
        acc['max'] = [max(v[k] for v in vs) for k in range(3)]

    return verts, write


def cluster_axes(verts, tol=0.2):
    """Which vertical centreline each vertex belongs to, keyed on (x, z)."""
    axes = []          # [x, z, count]
    owner = []
    for v in verts:
        hit = -1
        for k, a in enumerate(axes):
            if abs(v[0] - a[0]) < tol and abs(v[2] - a[1]) < tol:
                hit = k
                break
        if hit < 0:
            axes.append([v[0], v[2], 0])
            hit = len(axes) - 1
        owner.append(hit)
    # The centre of a hexagon is the mean of its corners, so refine.
    sums = [[0.0, 0.0, 0] for _ in axes]
    for v, k in zip(verts, owner):
        sums[k][0] += v[0]
        sums[k][1] += v[2]
        sums[k][2] += 1
    for k, s in enumerate(sums):
        axes[k][0] = s[0] / s[2]
        axes[k][1] = s[1] / s[2]
    return axes, owner


def main(path, out):
    js, bin_ = read_glb(path)
    nodes = js['nodes']
    by_name = {n.get('name', ''): i for i, n in enumerate(nodes)}
    report = {'lengthened': {}, 'thickened': 0, 'bars': 0, 'streams': []}

    for name, ni in sorted(by_name.items()):
        if not name.startswith('REBAR_V_'):
            continue
        node = nodes[ni]
        if 'mesh' not in node:
            continue
        family = next((k for k in PER_GROUP if name.startswith(k)), None)
        table = dict(LENGTHS)
        if family:
            table.update(PER_GROUP[family])

        for prim in js['meshes'][node['mesh']]['primitives']:
            verts, write = positions(js, bin_, prim['attributes']['POSITION'])
            axes, owner = cluster_axes(verts)
            heights = {}
            for v in verts:
                for old, new in table.items():
                    if abs(v[1] - old) < 0.02:
                        v[1] = new
                        heights[old] = new
                        break
            for v, k in zip(verts, owner):
                cx, cz = axes[k][0], axes[k][1]
                v[0] = cx + (v[0] - cx) * (NEW_R / OLD_R)
                v[2] = cz + (v[2] - cz) * (NEW_R / OLD_R)
            write(verts)
            report['thickened'] += len(verts)
            report['bars'] += len(axes)
            for old, new in heights.items():
                report['lengthened'].setdefault(f'{old}->{new}', 0)
                report['lengthened'][f'{old}->{new}'] += 1

    # The pour streams stop being anything.
    for name, ni in by_name.items():
        if 'CONCRETE_STREAM' not in name:
            continue
        if nodes[ni].pop('mesh', None) is not None:
            report['streams'].append(name)

    report['bytes'] = write_glb(out, js, bin_)
    return report


if __name__ == '__main__':
    print(json.dumps(main(sys.argv[1], sys.argv[2]), indent=2, sort_keys=True))
