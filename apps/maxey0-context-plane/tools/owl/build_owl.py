"""Maxey0 Context Plane graph -> OWL 2 ontology + SHACL shapes, with parity checks, SHACL validation, a negative control
and OWL 2 RL reasoning. Also defines the drift vocabulary (path / level / node SCWs of an observer-lens route) and
validates a drift record against it.
Usage: python3 tools/owl/build_owl.py <scw1.graph.json> <live graph.json or the same file> <out dir> [drift-scw.json ...]
Outputs: <out>/maxey0-context-plane.owl.ttl, .owl (RDF/XML), .shapes.ttl, .inferred.ttl, drift-*.ttl, build_log.json"""
import json, sys, hashlib, time, re
from collections import Counter
from rdflib import Graph, Namespace, Literal, URIRef, RDF, RDFS, OWL, XSD, BNode
from rdflib.collection import Collection
import pyshacl, owlrl

import os
LOCAL, LIVE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; DRIFTS = sys.argv[4:]
os.makedirs(OUT, exist_ok=True)
LOG = []
def log(scw, k, v): LOG.append({"scw": scw, "check": k, "result": v}); print(f"[{scw}] {k}: {v}")

g = json.load(open(LOCAL)); live = json.load(open(LIVE))

# ---------------- SCW90: decompose + coverage/parity of the server data ----------------
inv = {k: len(g[k]) for k in ("domains", "topics", "concepts", "skills", "agents", "mcp", "agent_mcp", "related")}
inv["skill_agent_edges"] = sum(len(s["agents"]) for s in g["skills"])
log("SCW90", "inventory", inv)
log("SCW90", "local digest == live digest", g["snapshot_digest"] == live["snapshot_digest"])
par = {k: (len(g[k]) == len(live[k])) for k in inv if k in live}
log("SCW90", "live/local count parity", par)
canon = lambda d: hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest()[:16]
log("SCW90", "live/local content parity per section", {k: canon(g[k]) == canon(live[k]) for k in ("domains","topics","concepts","skills","agents","mcp","agent_mcp","related")})
ids = {"topic": {t["id"] for t in g["topics"]}, "concept": {c["id"] for c in g["concepts"]}, "skill": {s["id"] for s in g["skills"]},
       "agent": {a["key"] for a in g["agents"]}, "mcp": {m["id"] for m in g["mcp"]}, "domain": {d["id"] for d in g["domains"]}}
dangling = {
 "topic->domain": sum(t["domain"] not in ids["domain"] for t in g["topics"]),
 "concept->topic": sum(c["topic"] not in ids["topic"] for c in g["concepts"]),
 "skill->concept": sum(s["concept"] not in ids["concept"] for s in g["skills"]),
 "skill->agent": sum(a["key"] not in ids["agent"] for s in g["skills"] for a in s["agents"]),
 "gate->agent": sum(l["agent"] not in ids["agent"] for l in g["agent_mcp"]),
 "gate->mcp": sum(l["mcp"] not in ids["mcp"] for l in g["agent_mcp"]),
 "related->concept": sum((r["a"] not in ids["concept"]) + (r["b"] not in ids["concept"]) for r in g["related"])}
log("SCW90", "dangling references", dangling)
_ = ({"scw": "SCW90", "source": "Maxey0 Context Plane server graph (/graph.json)", "digest": g["snapshot_digest"],
           "modules": {"objects": ["Domain","Topic","Concept","Skill","Agent","MCPServer","Gate(agent->mcp link)","Related(concept<->concept)"],
                       "relations": ["topic.domain","concept.topic","skill.concept","skill.agents[role]","agent_mcp(basis,score,via)","related(score)"],
                       "rules": g["similarity"], "not_modelled_as_owl": ["lexicon (routing vocabulary)", "topic_mcp (topic-listed servers: modelled as listsServer)", "topic_priority (modelled as datatype priority)"]},
           "inventory": inv})

# ---------------- SCW92: build the OWL graph from the SCW91 design ----------------
B = "https://maxey0-context-plane-mcp.maxey0.workers.dev/owl#"
M = Namespace(B); I = Namespace(B.replace("#", "/id/"))
O = Graph(); O.bind("mx", M); O.bind("id", I); O.bind("owl", OWL)
ont = URIRef(B[:-1]); O.add((ont, RDF.type, OWL.Ontology)); O.add((ont, OWL.versionInfo, Literal(g["schema"] + " " + g["snapshot_digest"] + " (server 6.3.0)")))
O.add((ont, RDFS.comment, Literal("OWL 2 form of the Maxey0 Context Plane: Domain > Topic > Concept > Skill > MaxeyN Agent > MCP server.")))
C = {n: M[n] for n in ("Domain","Topic","Concept","Skill","Agent","MCPServer","Gate","ConceptRelation")}
for c in C.values(): O.add((c, RDF.type, OWL.Class))
# all node classes pairwise disjoint
ad = BNode(); O.add((ad, RDF.type, OWL.AllDisjointClasses)); lst = BNode(); Collection(O, lst, list(C.values())); O.add((ad, OWL.members, lst))
def oprop(n, d, r, functional=False, inv=None, sub=None, extra=()):
    p = M[n]; O.add((p, RDF.type, OWL.ObjectProperty)); O.add((p, RDFS.domain, d)); O.add((p, RDFS.range, r))
    if functional: O.add((p, RDF.type, OWL.FunctionalProperty))
    if inv: O.add((M[inv], RDF.type, OWL.ObjectProperty)); O.add((M[inv], OWL.inverseOf, p))
    if sub: O.add((p, RDFS.subPropertyOf, M[sub]))
    for e in extra: O.add((p, RDF.type, e))
    return p
def dprop(n, d, r): p = M[n]; O.add((p, RDF.type, OWL.DatatypeProperty)); O.add((p, RDFS.domain, d)); O.add((p, RDFS.range, r)); return p
partOf = M.partOf; O.add((partOf, RDF.type, OWL.ObjectProperty)); O.add((partOf, RDF.type, OWL.TransitiveProperty))
inDomain = oprop("inDomain", C["Topic"], C["Domain"], True, "hasTopic", "partOf")
inTopic = oprop("inTopic", C["Concept"], C["Topic"], True, "hasConcept", "partOf")
inConcept = oprop("inConcept", C["Skill"], C["Concept"], True, "hasSkill", "partOf")
hasAgent = oprop("hasAgent", C["Skill"], C["Agent"], inv="servesSkill")
hasPrimary = oprop("hasPrimaryAgent", C["Skill"], C["Agent"], sub="hasAgent")
hasChecker = oprop("hasCheckerAgent", C["Skill"], C["Agent"], sub="hasAgent")
hasSupport = oprop("hasSupportAgent", C["Skill"], C["Agent"], sub="hasAgent")
holds = oprop("holdsServer", C["Agent"], C["MCPServer"], inv="heldBy")
lists = oprop("listsServer", C["Topic"], C["MCPServer"])
related = oprop("relatedConcept", C["Concept"], C["Concept"], extra=(OWL.SymmetricProperty, OWL.IrreflexiveProperty))
gA = oprop("gateAgent", C["Gate"], C["Agent"], True); gS = oprop("gateServer", C["Gate"], C["MCPServer"], True)
gT = oprop("gateTopic", C["Gate"], C["Topic"], True); gVS = oprop("viaSkill", C["Gate"], C["Skill"], True); gVP = oprop("viaPrimary", C["Gate"], C["Agent"], True)
rA = oprop("relA", C["ConceptRelation"], C["Concept"], True); rB = oprop("relB", C["ConceptRelation"], C["Concept"], True)
basis = dprop("basis", C["Gate"], XSD.string); score = dprop("score", OWL.Thing, XSD.decimal)
key = dprop("key", C["Agent"], XSD.string); prio = dprop("priority", C["Topic"], XSD.integer)
skType = dprop("memoryType", C["Skill"], XSD.string); kw = dprop("keyword", C["Concept"], XSD.string)
src = dprop("sourceUrl", C["MCPServer"], XSD.string); tool = dprop("toolName", C["MCPServer"], XSD.string); state = dprop("state", OWL.Thing, XSD.string)
# exactly-one-parent axioms (OWL: qualified cardinality)
for cls, p, r in ((C["Topic"], inDomain, C["Domain"]), (C["Concept"], inTopic, C["Topic"]), (C["Skill"], inConcept, C["Concept"]),
                  (C["Skill"], hasPrimary, C["Agent"]), (C["Skill"], hasChecker, C["Agent"])):
    rb = BNode(); O.add((rb, RDF.type, OWL.Restriction)); O.add((rb, OWL.onProperty, p)); O.add((rb, OWL.qualifiedCardinality, Literal(1, datatype=XSD.nonNegativeInteger)))
    O.add((rb, OWL.onClass, r)); O.add((cls, RDFS.subClassOf, rb))
slug = lambda s: re.sub(r"[^A-Za-z0-9._-]", "_", s)
U = {"domain": lambda i: I["domain/" + slug(i)], "topic": lambda i: I["topic/" + slug(i)], "concept": lambda i: I["concept/" + slug(i)],
     "skill": lambda i: I["skill/" + slug(i)], "agent": lambda i: I["agent/" + slug(i)], "mcp": lambda i: I["mcp/" + slug(i)]}
def node(u, c, label, desc=None):
    O.add((u, RDF.type, c)); O.add((u, RDFS.label, Literal(label)))
    if desc: O.add((u, RDFS.comment, Literal(desc)))
for d in g["domains"]: node(U["domain"](d["id"]), C["Domain"], d["label"], d.get("desc"))
for t in g["topics"]:
    u = U["topic"](t["id"]); node(u, C["Topic"], t["label"], t.get("desc")); O.add((u, inDomain, U["domain"](t["domain"])))
    if t.get("priority") is not None: O.add((u, prio, Literal(int(t["priority"]))))
for c in g["concepts"]:
    u = U["concept"](c["id"]); node(u, C["Concept"], c["label"], c.get("desc")); O.add((u, inTopic, U["topic"](c["topic"])))
    for k in c.get("keywords", []): O.add((u, kw, Literal(k)))
RP = {"primary": hasPrimary, "checker": hasChecker, "support": hasSupport}
for s in g["skills"]:
    u = U["skill"](s["id"]); node(u, C["Skill"], s["label"], s.get("desc")); O.add((u, inConcept, U["concept"](s["concept"]))); O.add((u, skType, Literal(s["type"])))
    for a in s["agents"]: O.add((u, RP[a["role"]], U["agent"](a["key"])))
for a in g["agents"]: u = U["agent"](a["key"]); node(u, C["Agent"], a["name"]); O.add((u, key, Literal(a["key"])))
for m in g["mcp"]:
    u = U["mcp"](m["id"]); node(u, C["MCPServer"], m["name"], m.get("desc"))
    if m.get("source"): O.add((u, src, Literal(m["source"])))
    if m.get("state"): O.add((u, state, Literal(m["state"])))
    for t in m.get("tools", []): O.add((u, tool, Literal(t)))
for t, ms in g["topic_mcp"].items():
    for m in ms: O.add((U["topic"](t), lists, U["mcp"](m)))
for n, l in enumerate(g["agent_mcp"]):
    gu = I[f"gate/{n}"]; O.add((gu, RDF.type, C["Gate"])); O.add((gu, gA, U["agent"](l["agent"]))); O.add((gu, gS, U["mcp"](l["mcp"]))); O.add((gu, basis, Literal(l["basis"])))
    O.add((U["agent"](l["agent"]), holds, U["mcp"](l["mcp"])))
    if l.get("score") is not None: O.add((gu, score, Literal(l["score"], datatype=XSD.decimal)))
    if l.get("topic"): O.add((gu, gT, U["topic"](l["topic"])))
    if l.get("via"): O.add((gu, gVS, U["skill"](l["via"]["skill"]))); O.add((gu, gVP, U["agent"](l["via"]["primary"])))
for n, r in enumerate(g["related"]):
    ru = I[f"rel/{n}"]; O.add((ru, RDF.type, C["ConceptRelation"])); O.add((ru, rA, U["concept"](r["a"]))); O.add((ru, rB, U["concept"](r["b"])))
    O.add((ru, score, Literal(r["score"], datatype=XSD.decimal))); O.add((U["concept"](r["a"]), related, U["concept"](r["b"])))
# the shared 3D embedding field: every node's place (axes 1-2 = place on its level, axis 3 = depth)
fX, fY, fZ = dprop("fieldX", OWL.Thing, XSD.decimal), dprop("fieldY", OWL.Thing, XSD.decimal), dprop("fieldZ", OWL.Thing, XSD.decimal)
LV = {"d": "domain", "t": "topic", "c": "concept", "s": "skill", "a": "agent", "m": "mcp"}
for k, xy in g["field"]["xy"].items():
    lv, i = k.split(":", 1); u = U[LV[lv]](i)
    O.add((u, fX, Literal(str(xy[0]), datatype=XSD.decimal))); O.add((u, fY, Literal(str(xy[1]), datatype=XSD.decimal)))
    O.add((u, fZ, Literal(str(g["field"].get("z", {}).get(k, 0)), datatype=XSD.decimal)))
# drift vocabulary: the record an observer-lens route keeps (one SCW per chosen node, per level, around the path)
for n in ("PathSCW", "LevelSCW", "DriftSCW"): C[n] = M[n]; O.add((M[n], RDF.type, OWL.Class))
oprop("hasLevel", C["PathSCW"], C["LevelSCW"]); oprop("hasDriftNode", C["LevelSCW"], C["DriftSCW"]); oprop("aboutNode", C["DriftSCW"], OWL.Thing, True)
for n, d, r in (("task", "PathSCW", XSD.string), ("digest", "PathSCW", XSD.string), ("totalDrift", "PathSCW", XSD.decimal), ("remainingTask", "PathSCW", XSD.decimal),
                ("level", "LevelSCW", XSD.string), ("lambda", "LevelSCW", XSD.decimal), ("taskIn", "LevelSCW", XSD.decimal), ("taskOut", "LevelSCW", XSD.decimal),
                ("explained", "LevelSCW", XSD.decimal), ("candidates", "LevelSCW", XSD.integer), ("flat", "DriftSCW", XSD.decimal), ("psi", "DriftSCW", XSD.decimal),
                ("drift", "DriftSCW", XSD.decimal), ("flatRank", "DriftSCW", XSD.integer), ("lensRank", "DriftSCW", XSD.integer), ("aObs", "DriftSCW", XSD.decimal),
                ("weight", "DriftSCW", XSD.decimal), ("distance", "DriftSCW", XSD.decimal)):
    dprop(n, C[d], r)
O.serialize(OUT + "/maxey0-context-plane.owl.ttl", format="turtle"); O.serialize(OUT + "/maxey0-context-plane.owl", format="xml")
log("SCW92", "triples", len(O))

# parity: OWL individuals and edges == JSON
q = lambda s: list(O.query("PREFIX mx: <%s>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n%s" % (B, s)))
cnt = lambda c: int(q(f"SELECT (COUNT(DISTINCT ?x) AS ?n) WHERE {{ ?x a mx:{c} }}")[0][0])
owl_counts = {"domains": cnt("Domain"), "topics": cnt("Topic"), "concepts": cnt("Concept"), "skills": cnt("Skill"), "agents": cnt("Agent"),
              "mcp": cnt("MCPServer"), "agent_mcp": cnt("Gate"), "related": cnt("ConceptRelation"),
              "skill_agent_edges": int(q("SELECT (COUNT(*) AS ?n) WHERE { { ?s mx:hasPrimaryAgent ?a } UNION { ?s mx:hasCheckerAgent ?a } UNION { ?s mx:hasSupportAgent ?a } }")[0][0])}
log("SCW92", "OWL vs JSON count parity", {k: (owl_counts[k], inv[k], owl_counts[k] == inv[k]) for k in inv})
fp = q("SELECT ?x ?a ?b ?c WHERE { ?x mx:fieldX ?a ; mx:fieldY ?b ; mx:fieldZ ?c }")
log("SCW92", "3D field places round-trip (nodes)", (len(fp), len(g["field"]["xy"]), len(fp) == len(g["field"]["xy"])))
# edge-level parity: every skill's exact (role, agent) set round-trips
bad = 0
rows = q("SELECT ?s ?p ?a WHERE { ?s ?p ?a . FILTER(?p IN (mx:hasPrimaryAgent, mx:hasCheckerAgent, mx:hasSupportAgent)) }")
got = Counter((str(s).rsplit("/", 1)[1], str(p).rsplit("#", 1)[1], str(a).rsplit("/", 1)[1]) for s, p, a in rows)
want = Counter((slug(s["id"]), {"primary": "hasPrimaryAgent", "checker": "hasCheckerAgent", "support": "hasSupportAgent"}[a["role"]], slug(a["key"])) for s in g["skills"] for a in s["agents"])
log("SCW92", "skill->agent role edges round-trip exactly", (set(got) == set(want), len(set(got)), len(set(want))))
# rule: a checker holds every server its primary holds via inheritance (gate with viaPrimary)
viol = q("""SELECT ?g WHERE { ?g a mx:Gate ; mx:basis ?b ; mx:gateAgent ?c ; mx:viaSkill ?s ; mx:viaPrimary ?p ; mx:gateServer ?m .
  FILTER(STRSTARTS(?b, "inherited")) FILTER NOT EXISTS { ?s mx:hasCheckerAgent ?c ; mx:hasPrimaryAgent ?p . ?p mx:holdsServer ?m } }""")
log("SCW92", "checker-inheritance rule violations", len(viol))

# SHACL (closed-world counterpart of the OWL cardinalities)
SH = """@prefix sh: <http://www.w3.org/ns/shacl#> . @prefix mx: <%s> . @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
mx: sh:declare [ sh:prefix "mx" ; sh:namespace "%s"^^<http://www.w3.org/2001/XMLSchema#anyURI> ] , [ sh:prefix "rdfs" ; sh:namespace "http://www.w3.org/2000/01/rdf-schema#"^^<http://www.w3.org/2001/XMLSchema#anyURI> ] .
mx:TopicShape a sh:NodeShape ; sh:targetClass mx:Topic ; sh:property [ sh:path mx:inDomain ; sh:minCount 1 ; sh:maxCount 1 ; sh:class mx:Domain ] , [ sh:path rdfs:label ; sh:minCount 1 ] .
mx:ConceptShape a sh:NodeShape ; sh:targetClass mx:Concept ; sh:property [ sh:path mx:inTopic ; sh:minCount 1 ; sh:maxCount 1 ; sh:class mx:Topic ] .
mx:SkillShape a sh:NodeShape ; sh:targetClass mx:Skill ; sh:property [ sh:path mx:inConcept ; sh:minCount 1 ; sh:maxCount 1 ; sh:class mx:Concept ] ,
  [ sh:path mx:hasPrimaryAgent ; sh:minCount 1 ; sh:maxCount 1 ; sh:class mx:Agent ] , [ sh:path mx:hasCheckerAgent ; sh:minCount 1 ; sh:maxCount 1 ; sh:class mx:Agent ] .
mx:GateShape a sh:NodeShape ; sh:targetClass mx:Gate ; sh:property [ sh:path mx:gateAgent ; sh:minCount 1 ; sh:maxCount 1 ; sh:class mx:Agent ] , [ sh:path mx:gateServer ; sh:minCount 1 ; sh:maxCount 1 ; sh:class mx:MCPServer ] ,
  [ sh:path mx:basis ; sh:minCount 1 ; sh:pattern "^(derived|inherited|declared):" ] .
mx:RelShape a sh:NodeShape ; sh:targetClass mx:ConceptRelation ; sh:property [ sh:path mx:score ; sh:minCount 1 ; sh:minInclusive 0.4 ] .
mx:FieldShape a sh:NodeShape ; sh:targetClass mx:Domain, mx:Topic, mx:Concept, mx:Skill, mx:Agent, mx:MCPServer ;
  sh:property [ sh:path mx:fieldX ; sh:minCount 1 ; sh:maxCount 1 ] , [ sh:path mx:fieldY ; sh:minCount 1 ; sh:maxCount 1 ] , [ sh:path mx:fieldZ ; sh:minCount 1 ; sh:maxCount 1 ] .
mx:PathShape a sh:NodeShape ; sh:targetClass mx:PathSCW ; sh:property [ sh:path mx:task ; sh:minCount 1 ] , [ sh:path mx:hasLevel ; sh:minCount 1 ; sh:class mx:LevelSCW ] .
mx:LevelShape a sh:NodeShape ; sh:targetClass mx:LevelSCW ;
  sh:property [ sh:path mx:level ; sh:minCount 1 ; sh:maxCount 1 ; sh:in ( "topic" "concept" "skill" "agent" "mcp" ) ] , [ sh:path mx:hasDriftNode ; sh:minCount 1 ; sh:class mx:DriftSCW ] ,
    [ sh:path mx:explained ; sh:minCount 1 ; sh:minInclusive 0 ; sh:maxInclusive 1 ] ;
  sh:sparql [ sh:prefixes mx: ; sh:message "a level cannot pass on more task than it received" ; sh:select '''SELECT $this WHERE { $this mx:taskIn ?i ; mx:taskOut ?o . FILTER(?o > ?i + 0.0001) }''' ] .
mx:DriftShape a sh:NodeShape ; sh:targetClass mx:DriftSCW ;
  sh:property [ sh:path mx:aboutNode ; sh:minCount 1 ; sh:maxCount 1 ] , [ sh:path mx:flat ; sh:minCount 1 ] , [ sh:path mx:psi ; sh:minCount 1 ; sh:minExclusive 0 ] ,
    [ sh:path mx:flatRank ; sh:minCount 1 ; sh:minInclusive 1 ] , [ sh:path mx:lensRank ; sh:minCount 1 ; sh:minInclusive 1 ] ;
  sh:sparql [ sh:prefixes mx: ; sh:message "drift must equal psi - flat" ; sh:select '''SELECT $this WHERE { $this mx:psi ?p ; mx:flat ?f ; mx:drift ?d . FILTER(ABS(?d - (?p - ?f)) > 0.0002) }''' ] ,
    [ sh:prefixes mx: ; sh:message "the node a drift SCW is about must exist in the plane" ; sh:select '''SELECT $this WHERE { $this mx:aboutNode ?n . FILTER NOT EXISTS { ?n rdfs:label ?l } }''' ] .
""" % (B, B)
open(OUT + "/maxey0-context-plane.shapes.ttl", "w").write(SH)
t0 = time.time(); conforms, _, txt = pyshacl.validate(O, shacl_graph=Graph().parse(data=SH, format="turtle"), inference="none")
log("SCW92", "SHACL conforms", (conforms, f"{time.time()-t0:.1f}s", txt.count("Constraint Violation")))
# negative control: break one skill (second primary) -> SHACL must fail
O2 = Graph(); [O2.add(t) for t in O]; O2.add((U["skill"](g["skills"][0]["id"]), hasPrimary, U["agent"]("Maxey1")))
log("SCW92", "SHACL negative control (2 primaries) rejected", not pyshacl.validate(O2, shacl_graph=Graph().parse(data=SH, format="turtle"))[0])
# OWL 2 RL reasoning: consistency + inferred partOf chains, inverse/symmetric
R = Graph(); [R.add(t) for t in O]; t0 = time.time(); owlrl.DeductiveClosure(owlrl.OWLRL_Semantics).expand(R)
incons = list(R.subjects(RDF.type, OWL.Nothing))
log("SCW92", "OWL 2 RL closure", {"triples_after": len(R), "secs": round(time.time()-t0, 1), "owl:Nothing members": len(incons)})
chk = R.query(f"PREFIX mx: <{B}> SELECT (COUNT(?s) AS ?n) WHERE {{ ?s a mx:Skill ; mx:partOf ?d . ?d a mx:Domain }}")
log("SCW92", "inferred skill partOf domain (transitive) for all skills", int(list(chk)[0][0]) == inv["skills"])
R.serialize(OUT + "/maxey0-context-plane.inferred.ttl", format="turtle")

def drift_graph(D):
    """A drift record (app export or the 'drift' field of route_task mode lens) as RDF, linked to the plane's individuals."""
    G = Graph(); G.bind("mx", M); G.bind("id", I); run = slug(D.get("run") or hashlib.sha256(D["task"].encode()).hexdigest()[:12])
    p = I["drift/" + run]; G.add((p, RDF.type, C["PathSCW"])); G.add((p, M.task, Literal(D["task"])))
    if D.get("digest"): G.add((p, M.digest, Literal(D["digest"])))
    G.add((p, M.totalDrift, Literal(str(D["total_drift"]), datatype=XSD.decimal))); G.add((p, M.remainingTask, Literal(str(D["remaining_task"]), datatype=XSD.decimal)))
    dec = lambda x: Literal(str(x), datatype=XSD.decimal)
    for l in D["chain"]:
        lu = I[f"drift/{run}/{l['level']}"]; G.add((p, M.hasLevel, lu)); G.add((lu, RDF.type, C["LevelSCW"])); G.add((lu, M.level, Literal(l["level"])))
        for k, v in (("lambda", "lambda"), ("taskIn", "task_in"), ("taskOut", "task_out"), ("explained", "explained")): G.add((lu, M[k], dec(l[v])))
        G.add((lu, M.candidates, Literal(int(l["candidates"]))))
        for n in l["nodes"]:
            lv, i = n["node"].split(":", 1)
            target = U[LV[lv]](i) if lv != "m" else (U["mcp"](g["mcp"][int(i)]["id"]) if i.isdigit() else U["mcp"](i))
            du = I[f"drift/{run}/{l['level']}/{slug(i)}"]; G.add((lu, M.hasDriftNode, du)); G.add((du, RDF.type, C["DriftSCW"])); G.add((du, M.aboutNode, target))
            for k, v in (("flat", "flat"), ("psi", "psi"), ("drift", "drift"), ("aObs", "a_obs"), ("weight", "weight")): G.add((du, M[k], dec(n[v])))
            G.add((du, M.flatRank, Literal(int(n["flat_rank"])))); G.add((du, M.lensRank, Literal(int(n["lens_rank"]))))
            if n.get("distance") is not None: G.add((du, M.distance, dec(n["distance"])))
    return G, run
SHG = Graph().parse(data=SH, format="turtle")
for path in DRIFTS:
    D = json.load(open(path)); DG, run = drift_graph(D)
    V = Graph(); [V.add(t) for t in O]; [V.add(t) for t in DG]
    ok, _, txt = pyshacl.validate(V, shacl_graph=SHG, inference="none")
    log("DRIFT", f"{run}: drift record conforms ({len(DG)} triples)", (ok, txt.count("Constraint Violation")))
    DG.serialize(f"{OUT}/drift-{run}.ttl", format="turtle")
    # negative control: tamper one node's drift -> must be rejected
    B2 = Graph(); [B2.add(t) for t in V]; du = next(B2.subjects(RDF.type, C["DriftSCW"])); old = next(B2.objects(du, M.drift))
    B2.remove((du, M.drift, old)); B2.add((du, M.drift, Literal(str(float(old) + 0.05), datatype=XSD.decimal)))
    log("DRIFT", f"{run}: tampered drift rejected", not pyshacl.validate(B2, shacl_graph=SHG, inference="none")[0])
json.dump(LOG, open(OUT + "/build_log.json", "w"), indent=1)
