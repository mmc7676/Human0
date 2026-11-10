import json, random, sys, urllib.request, concurrent.futures as cf, time
B = "https://maxey0-context-plane-mcp.maxey0.workers.dev/route"
g = json.load(open("/home/claude/human0/apps/maxey0-context-plane/SCW1/scw1.graph.json"))
SK = {s["id"]: s for s in g["skills"]}; CT = {c["id"]: c["topic"] for c in g["concepts"]}
def route(args, tries=4):
    for t in range(tries):
        try:
            rq = urllib.request.Request(B, json.dumps(args).encode(), {"content-type": "application/json", "user-agent": "maxey0-dense-eval/1"})
            return json.loads(urllib.request.urlopen(rq, timeout=60).read())
        except Exception as e:
            if t == tries - 1: return {"error": repr(e)}
            time.sleep(1 + 2 * t)
def args(task, beta, mode, mn=None):
    a = {"task": task, "mode": mode, "limit": 5}
    if beta == 0: a["dense"] = False
    else: a["dense_weight"] = beta
    if mn is not None: a["min_score"] = mn
    return a
def skills_of(r, mode):
    if mode == "flat": return [p["skill"] for p in r.get("paths", [])], [p.get("score") for p in r.get("paths", [])]
    L = [l for l in r.get("lens", []) if l["level"] == "skill"]; return ([x["id"] for x in L[0]["selected"]] if L else []), None
def run(jobs):
    with cf.ThreadPoolExecutor(8) as ex: return list(ex.map(lambda a: route(a), jobs))
if __name__ == "__main__":
    which = sys.argv[1]
    random.seed(7); cal = random.sample(g["skills"], 300)
    out = {}
    if which == "labels":
        for mode in (sys.argv[2:] or ["flat", "lens"]):
            for beta in (0, 0.3, 0.5, 0.7, 0.9):
                R = run([args(s["label"], beta, mode, 0.0 if mode == "flat" else None) for s in cal])
                errs = sum("error" in r for r in R); h1 = h5 = t1 = dense_on = 0
                for s, r in zip(cal, R):
                    sk, _ = skills_of(r, mode); dense_on += (r.get("signal", {}).get("dense", 0) > 0)
                    h1 += bool(sk) and sk[0] == s["id"]; h5 += s["id"] in sk[:5]
                    t1 += bool(sk) and CT[SK[sk[0]]["concept"]] == CT[s["concept"]]
                out[f"{mode} beta={beta}"] = dict(skill1=round(h1/300, 3), skill5=round(h5/300, 3), topic1=round(t1/300, 3), dense_used=dense_on, errors=errs)
                print(f"{mode} beta={beta}", out[f"{mode} beta={beta}"], flush=True)
    json.dump(out, open(f"res_{which}.json", "w"), indent=1)
