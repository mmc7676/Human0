import json, sys
from ev import route, args, skills_of, run
T = json.load(open("tasks.json"))["rows"]
NEG = ["hello there friend", "what should I cook for dinner tonight", "my cat keeps sleeping on the keyboard", "is it going to rain tomorrow",
       "tell me a joke about penguins", "remind me to call mom", "good morning how are you", "I lost my car keys again",
       "who won the game last night", "play some relaxing music"]   # author-written negatives: nothing in the map does these
out = {}
for mode in sys.argv[1:] or ("flat", "lens"):
    for beta in (0, 0.3, 0.5, 0.7, 0.9):
        R = run([args(t, beta, mode, 0.0 if mode == "flat" else None) for t, _ in T]); N = run([args(t, beta, mode, 0.0 if mode == "flat" else None) for t in NEG])
        rows = []; c1 = c3 = 0
        for (t, acc), r in zip(T, R):
            sk, sc = skills_of(r, mode)
            top = sk[0] if sk else None
            ok1 = (top in acc) if acc else False; ok3 = any(x in acc for x in sk[:3]) if acc else False
            c1 += ok1; c3 += ok3; rows.append([t, sk[:3], (sc or [None])[0] if sc else None, ok1])
        neg = [((skills_of(r, mode)[1] or [0])[0] if mode == "flat" else (r.get("lens") or [{}])[0].get("selected", [{}])[0].get("psi")) for r in N]
        pos = [row[2] for row in rows if row[2] is not None]
        out[f"{mode} beta={beta}"] = {"top1": c1, "top3": c3, "of": sum(1 for _, a in T if a), "rows": rows, "neg_top_scores": neg, "pos_top_scores": pos}
        print(f"{mode} beta={beta}: top1 {c1}/19 top3 {c3}/19  neg max {max([x or 0 for x in neg]):.3f}", flush=True)
json.dump(out, open("res_tasks.json", "w"), indent=1)
