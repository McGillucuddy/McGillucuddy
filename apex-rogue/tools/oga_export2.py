# Export "Humanoid Low Poly Mesh (With Basic Face)" (OpenGameArt, CC0) in the same JSON form as oga_export.py:
# the body with its modelled face, its two eyeballs, skin weights and bones (renamed to the names js/body.js uses),
# in the game's axes (x forward, y up), the hip joints at the origin, scaled to 1.864 m tall.
import bpy, sys, json
from mathutils import Vector
src, out = sys.argv[-2], sys.argv[-1]
try: bpy.ops.wm.open_mainfile(filepath=src)
except RuntimeError: pass
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = bpy.data.objects['Cube']
NAME = {'Root': 'hips', 'Spine.001': 'spine', 'Ribs.001': 'chest', 'Neck': 'neck', 'Head': 'head'}
def rename(n):
    if n in NAME: return NAME[n]
    for a, b in (('UpperArm', 'upper_arm'), ('ForeArm', 'forearm'), ('Wrist', 'hand'), ('Hand', 'palm'), ('Shoulder', 'shoulder'), ('Thigh', 'thigh'), ('Shin', 'shin'), ('Foot', 'foot'), ('Toe', 'toe')):
        if n.startswith(a + '.'): return b + n[len(a):]
    if n.startswith('Fingers.'): s, k = n.split('.')[1], n.split('.')[2]; return 'f_all.0' + k[-1] + '.' + s
    if n.startswith('Thumb.'): s, k = n.split('.')[1], n.split('.')[2]; return 'thumb.0' + k[-1] + '.' + s
    return n
bones = list(rig.data.bones); idx = {b.name: i for i, b in enumerate(bones)}
rw = rig.matrix_world
foot, toe = bones[idx['Foot.L']], bones[idx['Toe.L']]
fwd = 1 if (rw @ toe.tail_local).y > (rw @ foot.head_local).y else -1
conv = (lambda v: [v.y, v.z, v.x]) if fwd > 0 else (lambda v: [-v.y, v.z, -v.x])
allz = [(body.matrix_world @ v.co).z for v in body.data.vertices]
S = 1.864 / (max(allz) - min(allz))
org = ((rw @ bones[idx['Thigh.L']].head_local) + (rw @ bones[idx['Thigh.R']].head_local)) / 2
rel = lambda p: [round(c * S, 4) for c in conv(p - org)]
B = [{'n': rename(b.name), 'p': idx[b.parent.name] if b.parent else -1, 'h': rel(rw @ b.head_local), 't': rel(rw @ b.tail_local)} for b in bones]
V, W, F, TAG = [], [], [], []
for ob, tag in ((body, 0), (bpy.data.objects['Eye.L'], 1), (bpy.data.objects['Eye.R'], 2)):
    base = len(V); mw = ob.matrix_world; gname = {g.index: g.name for g in ob.vertex_groups}
    for v in ob.data.vertices:
        V.append(rel(mw @ v.co)); TAG.append(tag)
        ws = sorted(((idx[gname[g.group]], g.weight) for g in v.groups if gname.get(g.group) in idx and g.weight > 0.001), key=lambda x: -x[1])[:4]
        if tag or not ws: ws = [(idx['Head'], 1.0)] if tag else [(idx['Root'], 1.0)]
        s = sum(w for _, w in ws) or 1
        W.append([[i, round(w / s, 3)] for i, w in ws])
    for p in ob.data.polygons:
        vs = [base + i for i in p.vertices]
        for k in range(1, len(vs) - 1): F.append([vs[0], vs[k], vs[k + 1]])
ys = [v[1] for v in V]
print('facing', fwd, 'scale', round(S, 4), 'verts', len(V), 'tris', len(F), 'y', min(ys), max(ys), 'L side z', B[idx['Thigh.L']]['h'][2])
json.dump({'full': {'bones': B, 'verts': V, 'weights': W, 'tris': F, 'tag': TAG}}, open(out, 'w'), separators=(',', ':'))
