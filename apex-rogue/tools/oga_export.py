# Export the CC0 "Human Basemeshes" bodies (OpenGameArt) as compact JSON: vertices, triangles, skin weights and bones,
# in the game's axes (x forward, y up, z to the figure's right... see conv), hips at the origin, 1 unit = 1 metre.
import bpy, sys, json
src, out = sys.argv[-2], sys.argv[-1]
try: bpy.ops.wm.open_mainfile(filepath=src)
except RuntimeError: pass
conv = lambda v: [round(-v.y, 4), round(v.z, 4), round(-v.x, 4)]
for key in ('male', 'female'):
    for m in bpy.data.objects['basemesh_' + key].modifiers:
        if m.type == 'SUBSURF': m.levels = 1; m.show_viewport = True
        else: m.show_viewport = False
bpy.context.view_layer.update()
res = {}
for key in ('male', 'female'):
    ob, rig = bpy.data.objects['basemesh_' + key], bpy.data.objects['basemesh_' + key + '_rig']
    bones = list(rig.data.bones); idx = {b.name: i for i, b in enumerate(bones)}
    mw, rw = ob.matrix_world, rig.matrix_world
    hips = rw @ bones[idx['hips']].head_local
    rel = lambda p: conv(p - hips)
    B = [{'n': b.name, 'p': idx[b.parent.name] if b.parent else -1, 'h': rel(rw @ b.head_local), 't': rel(rw @ b.tail_local)} for b in bones]
    gname = {g.index: g.name for g in ob.vertex_groups}
    # The pack's bodies are meant to be seen subdivided (each carries a subdivision modifier): one level of it, in
    # the resting pose, with the skin weights carried onto the new vertices.
    for m in ob.modifiers:
        if m.type == 'SUBSURF': m.levels = 1; m.show_viewport = True
        else: m.show_viewport = False
    bpy.context.view_layer.update()
    me = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    V, W = [], []
    for v in me.vertices:
        V.append(rel(mw @ v.co))
        ws = sorted(((idx[gname[g.group]], g.weight) for g in v.groups if gname.get(g.group) in idx and g.weight > 0.001), key=lambda x: -x[1])[:4]
        s = sum(w for _, w in ws) or 1
        W.append([[i, round(w / s, 3)] for i, w in ws])
    F = []
    for p in me.polygons:
        vs = list(p.vertices)
        for k in range(1, len(vs) - 1): F.append([vs[0], vs[k], vs[k + 1]])
    res[key] = {'bones': B, 'verts': V, 'weights': W, 'tris': F}
    print(key, len(V), 'verts', len(F), 'tris', len(B), 'bones', 'unweighted', sum(1 for w in W if not w))
json.dump(res, open(out, 'w'), separators=(',', ':'))
