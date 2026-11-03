"""Generate the v4 topic packs (Foundations, Finance, and new Work topics) as SCW1/sources/packs/*.pack.json.
Content is generated (Claude, 2026-10-31) from topic names and direction supplied by Human0. MCP rows: repository
existence checked with `git ls-remote` on 2026-10-31; descriptions summarise each project's public README as known,
tool lists not re-read (left empty). Execution-capable servers are listed as context only; the context plane never
authorizes execution."""
import json, re, pathlib, sys
OUT = pathlib.Path(__file__).resolve().parent.parent / "SCW1" / "sources" / "packs"
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
PROC = {"builds", "plans", "computes", "drafts", "runs", "converts", "maps", "checks", "designs", "screens", "prices",
        "reconciles", "calculates", "estimates", "traces", "models", "scores", "files", "prepares", "generates", "sets"}

MCP = {
 "Google Maps MCP": ("Google Maps Platform MCP server: geocoding and reverse geocoding of addresses and coordinates, place search and place details, distance matrix, elevation and directions.", "https://github.com/modelcontextprotocol/servers-archived/tree/main/src/google-maps", "reference server, archived by its maintainers"),
 "Mapbox MCP Server": ("Mapbox location MCP server: forward and reverse geocoding, points of interest search, directions and travel-time isochrones, static map images.", "https://github.com/mapbox/mcp-server", ""),
 "OpenStreetMap MCP": ("OpenStreetMap MCP server: geocode addresses and place names to coordinates, find nearby places, route between locations, explore neighborhoods from open map data.", "https://github.com/jagan-shanmugam/open-streetmap-mcp", ""),
 "GitHub MCP Server": ("GitHub's official MCP server: repositories, code, issues, pull requests, Actions workflows and deployment pipelines, security alerts.", "https://github.com/github/github-mcp-server", ""),
 "Cloudflare MCP": ("Cloudflare MCP servers: Workers deployment and bindings, DNS, observability logs, edge compute and platform documentation.", "https://github.com/cloudflare/mcp-server-cloudflare", ""),
 "Docker MCP Gateway": ("Docker MCP Gateway: runs MCP servers in isolated containers, manages environment configuration, secrets and the catalog of servers.", "https://github.com/docker/mcp-gateway", ""),
 "Time MCP": ("Time reference MCP server: current time in any IANA time zone and conversion between time zones.", "https://github.com/modelcontextprotocol/servers/tree/main/src/time", "reference server"),
 "Memory MCP": ("Memory reference MCP server: persistent knowledge graph memory of entities, relations and observations stored across sessions.", "https://github.com/modelcontextprotocol/servers/tree/main/src/memory", "reference server"),
 "Git MCP": ("Git reference MCP server: read, search and manipulate git repositories, commits, diffs, branches and version history.", "https://github.com/modelcontextprotocol/servers/tree/main/src/git", "reference server"),
 "Redis MCP": ("Redis official MCP server: store, read and search data in Redis, key value state, streams, hashes and vectors.", "https://github.com/redis/mcp-redis", ""),
 "Terraform MCP": ("HashiCorp Terraform MCP server: Terraform registry providers, modules and policies for infrastructure as code workflows.", "https://github.com/hashicorp/terraform-mcp-server", ""),
 "Kubernetes MCP Server": ("Kubernetes MCP server: inspect and manage cluster resources, pods, deployments, namespaces, logs and Helm releases.", "https://github.com/containers/kubernetes-mcp-server", ""),
 "AWS MCP Servers": ("AWS Labs MCP servers: AWS documentation, infrastructure as code, cloud compute, serverless, cost and pricing analysis.", "https://github.com/awslabs/mcp", ""),
 "Playwright MCP": ("Microsoft Playwright MCP server: drive a browser through accessibility snapshots, navigate pages, click, fill forms and test web front ends.", "https://github.com/microsoft/playwright-mcp", ""),
 "Chrome DevTools MCP": ("Chrome DevTools MCP server: inspect a live Chrome page, console, network requests, performance traces and front-end debugging.", "https://github.com/ChromeDevTools/chrome-devtools-mcp", ""),
 "Semgrep MCP": ("Semgrep MCP server: static analysis security scanning of source code for vulnerabilities and insecure patterns.", "https://github.com/semgrep/mcp", ""),
 "Auth0 MCP Server": ("Auth0 MCP server: manage Auth0 identity tenants, applications, authentication and authorization configuration.", "https://github.com/auth0/auth0-mcp-server", ""),
 "Blender MCP": ("Blender MCP: control Blender for 3D modeling, scene construction and rendering of models and digital twin scenes.", "https://github.com/ahujasid/blender-mcp", ""),
 "MAVLinkMCP": ("MCP server for LLM to drone communication via MAVLink", "https://github.com/ion-g-ion/MAVLinkMCP", ""),
 "QuickBooks Online MCP": ("Intuit QuickBooks Online MCP server: accounting records, accounts, customers, vendors, invoices, bills and journal entries.", "https://github.com/intuit/quickbooks-online-mcp-server", "writes to a ledger: context only here"),
 "Stripe MCP": ("Stripe agent toolkit and MCP server: payments, customers, invoices, subscriptions, refunds and payment links.", "https://github.com/stripe/agent-toolkit", "can move money: context only here"),
 "Alpaca MCP": ("Alpaca MCP server: stock, options and crypto market data, account positions and order placement through a brokerage API.", "https://github.com/alpacahq/alpaca-mcp-server", "can place orders: context only here, never execution"),
 "Polygon MCP": ("Polygon.io MCP server: market data for stocks, options, indices, forex and crypto, aggregates, trades, quotes, reference data and financials.", "https://github.com/polygon-io/mcp_polygon", ""),
 "Yahoo Finance MCP": ("Yahoo Finance MCP server: stock prices, historical quotes, company financial statements, holders, options chains and news.", "https://github.com/Alex2Yang97/yahoo-finance-mcp", ""),
 "Twelve Data MCP": ("Twelve Data MCP server: real time and historical prices for stocks, forex, crypto, ETFs and indices, technical indicators.", "https://github.com/twelvedata/mcp", ""),
 "Financial Datasets MCP": ("Financial Datasets MCP server: company income statements, balance sheets, cash flow statements, stock prices and market news.", "https://github.com/financial-datasets/mcp-server", ""),
 "SEC EDGAR MCP": ("SEC EDGAR MCP server: company filings, 10-K, 10-Q, 8-K, XBRL financial data and insider trading forms from EDGAR.", "https://github.com/stefanoamorelli/sec-edgar-mcp", ""),
 "FRED MCP": ("FRED MCP server: Federal Reserve Economic Data series, interest rates, inflation, GDP, employment and economic indicators.", "https://github.com/stefanoamorelli/fred-mcp-server", ""),
 "QuantConnect MCP": ("QuantConnect MCP server: algorithmic trading research, backtests, projects and quantitative strategy code on the LEAN engine.", "https://github.com/QuantConnect/mcp-server", "can deploy live algorithms: context only here"),
 "CCXT MCP": ("CCXT MCP server: cryptocurrency exchange market data, tickers, order books, trades and accounts across many crypto exchanges.", "https://github.com/doggybee/mcp-server-ccxt", "can trade on exchanges: context only here"),
 "Coinbase AgentKit": ("Coinbase AgentKit: onchain wallets, token transfers, swaps and smart contract actions on crypto blockchains, with an MCP extension.", "https://github.com/coinbase/agentkit", "can move crypto: context only here"),
}

def pack(tid, label, desc, prefix, agents, checker, concepts, mcp=(), notes=None):
    """concepts: (cid, label, desc, keywords, primary, [(skill label, skill desc), ...])"""
    A = {f"{prefix}-{k}": v for k, v in agents.items()}
    ck = f"{prefix}-{checker}"
    cs, sk, lex = [], [], {}
    prim = [f"{prefix}-{c[4]}" for c in concepts]
    for i, (cid, cl, cd, kw, p, skills) in enumerate(concepts):
        cid = f"{prefix}-{cid}"
        cs.append([cid, cl, tid, cd, kw.split()])
        lex[cid.replace("-", "")] = kw
        sup = prim[(i + 1) % len(prim)]
        if sup == prim[i]:
            sup = next(x for x in A if x not in (prim[i], ck))
        for sl, sd in skills:
            kind = "procedural" if sd.split()[0].lower() in PROC else "semantic"
            sk.append([f"{prefix}-{slug(sl)}", cid, sl, sd, kind, [[prim[i], "primary"], [ck, "checker"], [sup, "support"]]])
    for a in A:
        if a not in prim and a != ck and not any(a == r[0] for s in sk for r in s[5]):
            sys.exit(f"unused agent {a}")
    rows = []
    for n in mcp:
        d, u, note = MCP[n]
        rows.append([n, None, d, [], "web-listed", u])
    return {"schema": "human0.topic-pack/1", "id": tid, "topic": {"id": tid, "label": label, "desc": desc},
            "concepts": cs, "skills": sk, "agents": A, "mcp": rows, "lexicon": lex,
            "provenance": {"generated_by": "Claude (claude-opus-5-5) in the Human0 session of 2026-10-31; Human0 supplied the topic names and direction",
                           "levels": {"topic": "user", "concepts": "generated", "skills": "generated", "agents": "generated", "mcp": "real" if rows else "none"},
                           "mcp_checked_at": "2026-10-31",
                           "mcp_notes": {n: f"repository exists (git ls-remote {MCP[n][1].split('/tree/')[0]}, 2026-10-31); description summarises its public README; tool list not re-read" + (f"; {MCP[n][2]}" if MCP[n][2] else "") for n in mcp},
                           "open_questions": notes or {},
                           "limitations": "Concepts, skills and agents are generated hypotheses, not curated knowledge. Context only: nothing here executes or authorizes a transaction, deployment or trade."}}

P = []
# ============================== FOUNDATIONS ==============================
P.append(pack("location", "Location and Place", "Where something is: geographic coordinates, place names, addresses, distances and routes on Earth, and the regions and jurisdictions that a place falls in. Physical location; digital locations (where software runs) are in Environments and Deployment.", "loc",
 {"geographer": "Geographer Agent", "gazetteer": "Gazetteer Agent", "navigator": "Navigation Agent", "jurisdiction": "Jurisdiction Agent", "checker": "Location Checker Agent"}, "checker", [
 ("places", "Place Names and Gazetteers", "Named places on Earth (cities, mountains, parks, rivers, landmarks) and how gazetteers resolve a place name to coordinates and a unique place.", "place name gazetteer city town landmark mountain park river toponym", "gazetteer",
  [("Geographic Coordinate Lookup", "Gets the geographic coordinates (latitude and longitude) of a place, address or landmark, and the place at given coordinates."),
   ("Place Name Resolver", "Resolves a place name to one place with its coordinates, type and country, and lists the alternatives when the name is ambiguous."),
   ("Nearby Places Finder", "Finds places near a coordinate or place name within a radius, by type, with distances.")]),
 ("distance", "Distance, Routing and Navigation", "Distance between places (great-circle and travel distance), routes, bearings and travel time by mode.", "distance route routing navigation bearing travel time directions walking driving", "navigator",
  [("Distance Calculator", "Computes great-circle distance and bearing between two coordinates or places, and travel distance when a route is known."),
   ("Route Planner", "Plans a route between places for a travel mode and reports distance, time and waypoints.")]),
 ("regions", "Regions and Jurisdictions", "Which country, state, county, city, time zone and legal jurisdiction a location falls in, and the boundaries that decide it.", "region country state county jurisdiction boundary border administrative zone", "jurisdiction",
  [("Jurisdiction Locator", "Maps a location to its country, state, county, municipality and time zone, and names the authority that governs it."),
   ("Boundary Explainer", "Explains an administrative or legal boundary and which places fall on each side.")]),
 ("planetary", "Planetary and Off-Earth Location", "Location beyond Earth: celestial coordinates, planetary surface coordinates and the reference frames used for the Moon, Mars and spacecraft.", "planetary celestial coordinate frame moon mars orbit selenographic location", "geographer",
  [("Planetary Coordinate Explainer", "Explains surface coordinates and reference frames for the Moon, Mars and other bodies, and how they differ from Earth latitude and longitude.")]),
 ], ("Google Maps MCP", "Mapbox MCP Server", "OpenStreetMap MCP")))

P.append(pack("environments", "Environments and Deployment", "Where software is built and runs: development environments, local, cloud and edge targets, endpoints and addresses, and promotion from development to production. Includes the Human0 development environment (name to be decided), an MCP app that would deploy a development server in one step.", "env",
 {"devenv": "Development Environment Agent", "target": "Deployment Target Agent", "release": "Release Agent", "endpoint": "Endpoint Agent", "checker": "Deployment Checker Agent"}, "checker", [
 ("human0-dev", "Human0 Development Environment", "Placeholder for the Human0 development environment (name to be decided): an MCP app where one click on a harness starts the development server. Open question: whether an MCP server is a location.", "human0 development environment dev server harness mcp app workspace click deploy", "devenv",
  [("Dev Environment Planner", "Plans a development environment for a project: runtime, dependencies, dev server, and how it is opened from the Human0 harness."),
   ("Location Resolution Placeholder", "Records the open question of where a piece of software is located (host, region, environment, endpoint, or MCP server) until the rule is decided; returns the candidates without choosing.")]),
 ("targets", "Local, Cloud and Edge Targets", "Choosing where an application or website runs: a local machine, a cloud region, an edge network, or a container host.", "local cloud edge region host target website hosting serverless container", "target",
  [("Hosting Target Selector", "Compares hosting targets for a website or service by latency, cost, region and operations burden, and names the trade-offs."),
   ("Website Hosting Planner", "Plans where a website should be built and hosted, from repository to live address.")]),
 ("promotion", "Environment Promotion", "Development, staging and production environments, configuration per environment, and promoting a release between them.", "development staging production environment promotion release configuration rollback preview", "release",
  [("Promotion Planner", "Plans promotion of a release from development to staging to production with checks and rollback at each step."),
   ("Environment Config Auditor", "Checks that configuration and secrets differ correctly between environments and none leak into the wrong one.")]),
 ("endpoints", "Endpoints and Addresses", "Digital addresses: URLs, domains, DNS records, ports and MCP endpoints, and how an address differs from where the code runs.", "endpoint address url domain dns port mcp server route", "endpoint",
  [("Endpoint Mapper", "Maps a service to its addresses (domain, URL, MCP endpoint) and to where it actually runs."),
   ("DNS Record Explainer", "Explains the DNS records a domain needs for a deployment and what each one does.")]),
 ], ("GitHub MCP Server", "Cloudflare MCP", "Docker MCP Gateway"),
 {"location-resolution": "Is an MCP server a location? Working hypothesis: an MCP server is an address (an endpoint); a location is host + region + environment. Undecided by the owner; recorded as concept env-human0-dev, skill env-location-resolution-placeholder, no rule reads it.",
  "dev-server-name": "The Human0 development server needs a new name (owner to decide)."}))

P.append(pack("time", "Time", "When something happens: clocks, time zones and timestamps, calendars and scheduling, durations and deadlines, and ordering of events.", "tim",
 {"clock": "Clock and Time Zone Agent", "calendar": "Calendar Agent", "duration": "Duration Agent", "sequence": "Event Sequencing Agent", "checker": "Time Checker Agent"}, "checker", [
 ("clocks", "Clocks, Time Zones and Timestamps", "Current time, UTC and local time, IANA time zones, daylight saving, timestamp formats and conversion.", "clock time zone utc local daylight saving timestamp iso8601 epoch convert", "clock",
  [("Time Zone Converter", "Converts a time between time zones, accounting for daylight saving, and states the UTC offset used."),
   ("Timestamp Normalizer", "Normalizes timestamps in mixed formats to ISO 8601 UTC and flags ambiguous ones.")]),
 ("calendars", "Calendars and Scheduling", "Calendars, recurring events, business days, holidays and scheduling across people and time zones.", "calendar schedule meeting recurring event holiday business day availability", "calendar",
  [("Meeting Scheduler", "Finds meeting times that fit participants in several time zones, avoiding holidays and outside working hours."),
   ("Business Day Calculator", "Computes business days between dates for a country's holiday calendar.")]),
 ("durations", "Durations, Deadlines and Intervals", "Elapsed time, deadlines, intervals, time to live and how durations are measured and stated.", "duration deadline interval elapsed countdown ttl period expiry", "duration",
  [("Deadline Tracker", "Computes time remaining to deadlines and flags those at risk."),
   ("Interval Overlap Checker", "Checks whether time intervals overlap and reports the overlap.")]),
 ("ordering", "Temporal Ordering and Event Sequencing", "Ordering events in time: timelines, causality, clocks across machines, logical and vector clocks.", "order sequence timeline causality before after logical clock event log", "sequence",
  [("Timeline Builder", "Builds a timeline from dated events and marks gaps and conflicting dates."),
   ("Event Order Explainer", "Explains how events from different machines are ordered (timestamps, logical clocks) and where order is uncertain.")]),
 ], ("Time MCP",)))

P.append(pack("state", "State", "What holds at a time and place: state models and state machines, persistence and storage, snapshots, versions and provenance, and keeping copies consistent.", "sta",
 {"modeler": "State Modeling Agent", "store": "Persistence Agent", "version": "Versioning Agent", "sync": "Synchronization Agent", "checker": "State Checker Agent"}, "checker", [
 ("machines", "State Models and State Machines", "Representing state explicitly: finite state machines, statecharts, transitions, guards and invalid states.", "state machine transition statechart guard status lifecycle model", "modeler",
  [("State Machine Designer", "Designs a state machine for a workflow, listing states, transitions, guards and unreachable or dead-end states."),
   ("Lifecycle Explainer", "Explains the lifecycle states of an object or process and what moves it between them.")]),
 ("persistence", "Persistence and Storage", "Where state is kept: memory, files, databases, key value stores, caches, and durability.", "persistence storage database key value cache durable file save restore", "store",
  [("Storage Selector", "Chooses a store for a kind of state by durability, latency, size and sharing needs."),
   ("Save and Restore Planner", "Plans how application state is saved, exported, imported and restored safely.")]),
 ("versions", "Snapshots, Versioning and Provenance", "Snapshots, versions, digests, history and provenance: knowing which state a result came from.", "snapshot version digest history provenance hash diff commit audit", "version",
  [("Snapshot Differ", "Compares two snapshots or versions of state and lists what changed."),
   ("Provenance Recorder", "Records which inputs and version a result came from, with digests, so it can be reproduced.")]),
 ("consistency", "Synchronization and Consistency", "Keeping copies of state consistent: replication, conflicts, eventual and strong consistency, locks and merges.", "synchronization consistency replication conflict merge lock eventual strong concurrent", "sync",
  [("Conflict Resolver", "Explains conflicting copies of state and proposes a merge with the rule used."),
   ("Consistency Model Explainer", "Explains the consistency guarantee a system gives and what a reader may observe.")]),
 ], ("Memory MCP", "Git MCP", "Redis MCP")))

P.append(pack("systems", "Systems", "Systems in general: systems thinking and feedback, boundaries and interfaces, modeling and architecture, reliability and failure modes, and emergence.", "sys",
 {"thinker": "Systems Thinking Agent", "interface": "Interface Agent", "architect": "Systems Architect Agent", "reliability": "Reliability Agent", "checker": "Systems Checker Agent"}, "checker", [
 ("feedback", "Systems Thinking and Feedback", "Stocks and flows, feedback loops, delays, leverage points and emergent behavior of systems.", "system thinking feedback loop stock flow delay leverage emergence dynamics", "thinker",
  [("Feedback Loop Mapper", "Maps the feedback loops in a system and labels each reinforcing or balancing, with its delays."),
   ("Leverage Point Finder", "Names where a small change to a system would have large effect, with reasoning.")]),
 ("interfaces", "Boundaries and Interfaces", "Where a system ends, what crosses its boundary, and the interfaces and contracts between components.", "boundary interface contract component input output dependency coupling", "interface",
  [("Interface Contract Writer", "Writes the contract for an interface between components: inputs, outputs, errors and guarantees."),
   ("Boundary Definer", "Defines what is inside and outside a system and what crosses the boundary.")]),
 ("architecture", "Systems Modeling and Architecture", "Modeling a system's structure and behavior: components, data flow, decomposition and architecture views.", "architecture model component decomposition diagram data flow subsystem modular", "architect",
  [("System Decomposer", "Decomposes a system into subsystems and components with their responsibilities and data flow."),
   ("Architecture View Builder", "Builds architecture views of a system (context, containers, components) from a description.")]),
 ("reliability", "Reliability and Failure Modes", "How systems fail: failure modes, redundancy, single points of failure, cascading failure and resilience.", "reliability failure mode redundancy resilience cascade fault tolerance availability", "reliability",
  [("Failure Mode Analyzer", "Lists a system's failure modes, their effects and detection, ranked by severity."),
   ("Single Point of Failure Finder", "Finds single points of failure in a system design and suggests redundancy.")]),
 ]))

P.append(pack("infrastructure", "Infrastructure", "What software runs on: compute and runtimes, networking and DNS, infrastructure as code, containers and orchestration, and CI/CD pipelines.", "inf",
 {"compute": "Compute Agent", "network": "Network Agent", "iac": "Infrastructure as Code Agent", "container": "Container Platform Agent", "cicd": "CI/CD Agent", "checker": "Infrastructure Checker Agent"}, "checker", [
 ("compute", "Compute and Runtimes", "Servers, virtual machines, serverless functions, edge workers and language runtimes, and sizing them.", "compute server virtual machine serverless function worker runtime cpu memory sizing", "compute",
  [("Compute Sizer", "Sizes compute for a workload (CPU, memory, instances or functions) and estimates cost."),
   ("Runtime Selector", "Chooses a runtime (VM, container, serverless, edge) for a service and names the limits of each.")]),
 ("networking", "Networking and DNS", "Networks, DNS, load balancers, TLS certificates, firewalls and content delivery.", "network dns load balancer tls certificate firewall cdn latency subnet", "network",
  [("Network Path Tracer", "Traces the network path of a request from client to service and names where it can fail."),
   ("TLS and DNS Checker", "Checks the DNS records and TLS certificate setup for a domain.")]),
 ("iac", "Infrastructure as Code", "Declaring infrastructure in code: Terraform, modules, providers, state files and drift.", "terraform infrastructure code module provider plan apply drift declarative", "iac",
  [("Terraform Plan Reviewer", "Reviews an infrastructure plan for destructive changes, drift and security issues before it is applied."),
   ("Module Designer", "Designs reusable infrastructure modules with inputs, outputs and defaults.")]),
 ("containers", "Containers and Orchestration", "Container images, registries, Kubernetes clusters, pods, deployments and scaling.", "container image docker kubernetes cluster pod deployment scaling helm registry", "container",
  [("Kubernetes Manifest Reviewer", "Reviews Kubernetes manifests for resource limits, probes, security context and scaling."),
   ("Container Image Planner", "Plans a container image build: base image, layers, size and vulnerabilities.")]),
 ("cicd", "CI/CD Pipelines", "Continuous integration and delivery: build, test and deploy pipelines, artifacts and release gates.", "pipeline continuous integration delivery build test deploy artifact release gate workflow", "cicd",
  [("Pipeline Designer", "Designs a build, test and deploy pipeline with gates between stages."),
   ("Failed Build Diagnoser", "Diagnoses a failed pipeline run from its logs and names the likely cause.")]),
 ], ("Cloudflare MCP", "Terraform MCP", "Kubernetes MCP Server", "AWS MCP Servers")))

# ============================== WORK ==============================
P.append(pack("ui-frontend", "UI and Front-End Development", "Building what people see in a browser: HTML, CSS and layout, components and frameworks, accessibility, browser testing and building websites.", "ui",
 {"layout": "Layout Engineer Agent", "component": "Component Engineer Agent", "a11y": "Accessibility Agent", "tester": "Browser Test Agent", "web": "Website Builder Agent", "checker": "Front-End Checker Agent"}, "checker", [
 ("layout", "HTML, CSS and Layout", "Page structure and styling: semantic HTML, CSS, flexbox and grid layout, responsive design and theming.", "html css layout flexbox grid responsive theme style page markup", "layout",
  [("Responsive Layout Builder", "Builds a responsive page layout in HTML and CSS that works from phone to desktop width."),
   ("CSS Debugger", "Finds why an element is positioned or styled wrongly and gives the minimal CSS fix.")]),
 ("components", "Components and Frameworks", "UI components, state in the browser, and frameworks such as React, Vue and Svelte.", "component react vue svelte framework javascript typescript props state render", "component",
  [("Component Designer", "Designs a reusable UI component with its props, states and events."),
   ("Framework Selector", "Compares front-end frameworks for a project by size, ecosystem and rendering model.")]),
 ("a11y", "Accessibility", "Making interfaces usable by everyone: WCAG, keyboard access, screen readers, contrast and focus.", "accessibility wcag keyboard screen reader contrast focus aria label", "a11y",
  [("Accessibility Auditor", "Audits a page against WCAG 2.1 AA and lists each failure with its fix.")]),
 ("testing", "Browser Testing", "Testing web front ends in real browsers: end-to-end tests, visual checks and console errors.", "browser test end playwright visual screenshot console error automation", "tester",
  [("End-to-End Test Writer", "Writes end-to-end browser tests for a user flow with assertions on what the user sees."),
   ("Console Error Triage", "Triages browser console and network errors on a page and names the cause.")]),
 ("websites", "Websites and Web Apps", "Building a website or web app end to end: pages, content, routing, build tools, performance and where it is deployed.", "website web app site page build bundle performance seo deploy static", "web",
  [("Website Builder", "Plans and builds a website: pages, navigation, content, build tooling and deploy target."),
   ("Web Performance Auditor", "Audits a website's load performance and lists the largest wins.")]),
 ], ("Playwright MCP", "Chrome DevTools MCP")))

P.append(pack("security-identity", "Security and Identity", "Keeping systems and people safe: authentication and authorization, secrets and keys, vulnerability scanning and threat modeling.", "sec",
 {"auth": "Identity and Access Agent", "secrets": "Secrets Agent", "scanner": "Vulnerability Scanner Agent", "threat": "Threat Modeling Agent", "checker": "Security Checker Agent"}, "checker", [
 ("authn", "Authentication and Authorization", "Who a user is and what they may do: login, OAuth, single sign-on, roles, permissions and sessions.", "authentication authorization oauth login sso role permission session token identity", "auth",
  [("Access Policy Designer", "Designs roles and permissions for an application with least privilege."),
   ("OAuth Flow Explainer", "Explains which OAuth flow fits an application and the steps of that flow.")]),
 ("secrets", "Secrets and Keys", "API keys, passwords, certificates and encryption keys: storage, rotation and leak response.", "secret key password certificate encryption rotation vault leak credential", "secrets",
  [("Secret Leak Responder", "Lists the steps after a secret is leaked: revoke, rotate, audit use and prevent recurrence."),
   ("Key Rotation Planner", "Plans rotation of keys and certificates without downtime.")]),
 ("vulns", "Vulnerability Scanning", "Finding vulnerabilities in code, dependencies and configuration with static analysis and scanners.", "vulnerability scan static analysis dependency cve injection insecure code", "scanner",
  [("Code Vulnerability Reviewer", "Reviews code for injection, insecure deserialization, auth bypass and other common vulnerabilities."),
   ("Dependency Risk Checker", "Checks dependencies for known vulnerabilities and outdated versions.")]),
 ("threats", "Threat Modeling", "Who might attack a system, how, and what to defend first.", "threat model attacker attack surface risk mitigation stride abuse", "threat",
  [("Threat Model Builder", "Builds a threat model for a system: assets, attackers, attack paths and mitigations ranked by risk.")]),
 ], ("Semgrep MCP", "Auth0 MCP Server")))

P.append(pack("real-estate", "Real Estate and Property", "Buying, selling, renting and valuing property: search and listings, valuation and comparables, transactions and closing, financing, zoning and land use.", "re",
 {"search": "Property Search Agent", "valuer": "Property Valuation Agent", "closing": "Real Estate Transaction Agent", "zoning": "Zoning and Land Use Agent", "checker": "Real Estate Checker Agent"}, "checker", [
 ("search", "Property Search and Listings", "Finding homes, land and commercial property for sale or rent, listing data and local real estate markets.", "real estate property home house listing rent sale local market search", "search",
  [("Local Real Estate Search", "Searches local real estate listings by location, price, size and type, and states each listing's source."),
   ("Market Snapshot", "Summarizes a local property market: prices, inventory, days on market and trend.")]),
 ("valuation", "Valuation and Comparables", "What a property is worth: comparable sales, appraisal, income approach and cap rates.", "valuation appraisal comparable sale price cap rate rental income property", "valuer",
  [("Comparable Sales Analyzer", "Estimates a property's value from comparable sales with adjustments shown."),
   ("Rental Yield Calculator", "Calculates gross and net rental yield and cap rate for a property.")]),
 ("transactions", "Transactions, Financing and Closing", "Offers, contracts, inspections, mortgages, escrow, title and closing.", "offer contract inspection mortgage escrow title closing financing down payment", "closing",
  [("Purchase Process Guide", "Lays out the steps from offer to closing for a property purchase in a given jurisdiction."),
   ("Mortgage Payment Calculator", "Calculates mortgage payments, interest and amortization for given terms.")]),
 ("zoning", "Zoning and Land Use", "Zoning codes, permitted uses, permits, easements and land use rules for a parcel.", "zoning land use permit parcel easement setback building code variance", "zoning",
  [("Zoning Lookup Guide", "Explains how to find a parcel's zoning and what uses and buildings it permits.")]),
 ]))

P.append(pack("simulation", "Simulation and Digital Twins", "Simulating systems before acting on them: physics and flight simulation, digital twins, and scenario and Monte Carlo analysis. Robot simulation is in Robotics.", "sim",
 {"physics": "Physics Simulation Agent", "twin": "Digital Twin Agent", "scenario": "Scenario Analysis Agent", "checker": "Simulation Checker Agent"}, "checker", [
 ("physics", "Physics and Flight Simulation", "Simulating motion and forces: rigid body dynamics, flight simulators, drone simulators and solver step size.", "simulation simulator physics flight drone dynamics solver step model", "physics",
  [("Drone Simulator Setup", "Sets up a drone or flight simulator with vehicle model, environment and autopilot in the loop."),
   ("Solver Stability Checker", "Checks a simulation's step size and solver for stability and energy drift.")]),
 ("twins", "Digital Twins", "A live model of a physical asset fed by its data, used to monitor and test changes.", "digital twin asset model sensor live mirror 3d scene", "twin",
  [("Digital Twin Designer", "Designs a digital twin: what is modeled, which data feeds it, and how it is validated against the real asset.")]),
 ("scenarios", "Scenario and Monte Carlo Analysis", "Running many what-if scenarios with random inputs to see the spread of outcomes.", "scenario monte carlo random distribution what sensitivity outcome stress", "scenario",
  [("Monte Carlo Runner", "Designs a Monte Carlo analysis: inputs and distributions, runs, and how results are summarized."),
   ("Sensitivity Analyzer", "Finds which inputs move an outcome most.")]),
 ], ("Blender MCP", "MAVLinkMCP")))

P.append(pack("travel-outdoors", "Travel and Outdoors", "Getting somewhere and being outside: trip and route planning, hiking, trails and parks, weather and conditions, bookings and permits.", "trv",
 {"planner": "Trip Planning Agent", "trail": "Trail and Hiking Agent", "weather": "Conditions Agent", "booking": "Bookings and Permits Agent", "checker": "Travel Checker Agent"}, "checker", [
 ("trips", "Trip and Route Planning", "Planning trips: destinations, itineraries, transport and routes between places.", "trip travel itinerary destination transport route plan journey", "planner",
  [("Itinerary Planner", "Plans a day-by-day itinerary with travel times between stops.")]),
 ("hiking", "Hiking, Trails and Parks", "Hikes and trails: finding a hike, distance, elevation gain, difficulty, trailheads and parks.", "hike hiking trail park trailhead elevation gain difficulty outdoor nature", "trail",
  [("Hike Finder", "Finds hikes near a place by distance, elevation gain and difficulty, with trailhead coordinates."),
   ("Trail Safety Briefing", "Briefs the safety needs of a hike: water, daylight, weather, terrain and turnaround time.")]),
 ("conditions", "Weather and Conditions", "Weather forecasts, seasons, daylight and conditions that affect travel and outdoor plans.", "weather forecast condition season daylight temperature rain snow wind", "weather",
  [("Conditions Check", "Checks forecast, daylight and seasonal conditions for a place and date.")]),
 ("bookings", "Bookings and Permits", "Reservations, campsites, park permits, passes and entry requirements.", "booking reservation campsite permit pass entry visa ticket", "booking",
  [("Permit Requirement Finder", "Finds whether a park, trail or campsite needs a permit or reservation and how to get it.")]),
 ], ("Google Maps MCP", "OpenStreetMap MCP")))

# ============================== FINANCE ==============================
P.append(pack("accounting", "Accounting", "Recording and reporting money: bookkeeping and the general ledger, financial statements, GAAP and IFRS, audit, and management accounting.", "acc",
 {"bookkeeper": "Bookkeeping Agent", "reporter": "Financial Reporting Agent", "standards": "Accounting Standards Agent", "auditor": "Audit Agent", "mgmt": "Management Accounting Agent", "checker": "Accounting Checker Agent"}, "checker", [
 ("ledger", "Bookkeeping and the General Ledger", "Double-entry bookkeeping, chart of accounts, journal entries, reconciliation and closing the books.", "bookkeeping ledger journal entry debit credit chart account reconciliation close", "bookkeeper",
  [("Journal Entry Builder", "Builds double-entry journal entries for a transaction and checks debits equal credits."),
   ("Bank Reconciliation", "Reconciles a bank statement to the ledger and lists unmatched items.")]),
 ("statements", "Financial Statements", "Income statement, balance sheet, cash flow statement and how they link.", "financial statement income balance sheet cash flow revenue expense asset liability equity", "reporter",
  [("Three-Statement Linker", "Shows how a transaction flows through the income statement, balance sheet and cash flow statement."),
   ("Financial Statement Reader", "Reads a company's financial statements and summarizes profitability, liquidity and leverage.")]),
 ("standards", "GAAP and IFRS", "Accounting standards: US GAAP, IFRS, revenue recognition, leases and differences between them.", "gaap ifrs standard revenue recognition lease asc fasb iasb", "standards",
  [("Revenue Recognition Guide", "Applies the five-step revenue recognition model to a contract."),
   ("GAAP vs IFRS Comparator", "Compares the GAAP and IFRS treatment of an item and its effect on reported numbers.")]),
 ("audit", "Audit and Internal Controls", "External audit, internal controls, SOX, materiality and audit evidence.", "audit internal control sox materiality evidence assurance auditor opinion", "auditor",
  [("Control Gap Finder", "Finds gaps in internal controls over a financial process.")]),
 ("management", "Management and Cost Accounting", "Budgets, cost allocation, unit economics and variance analysis for decisions.", "budget cost allocation unit economics variance margin forecast management", "mgmt",
  [("Variance Analyzer", "Explains budget versus actual variances by driver."),
   ("Unit Economics Calculator", "Computes contribution margin, CAC, LTV and payback for a business.")]),
 ], ("QuickBooks Online MCP",)))

P.append(pack("corporate-finance", "Corporate Finance", "Building and financing a corporation: entity formation and governance, capital structure, valuation, mergers and acquisitions, and treasury.", "cf",
 {"formation": "Entity Formation Agent", "capital": "Capital Structure Agent", "valuer": "Corporate Valuation Agent", "mna": "M&A Agent", "treasury": "Treasury Agent", "checker": "Corporate Finance Checker Agent"}, "checker", [
 ("formation", "Entity Formation and Governance", "Forming a corporation or LLC, jurisdictions such as Delaware, boards, bylaws, cap tables and equity grants.", "corporation incorporate entity llc delaware board bylaws cap table founder equity", "formation",
  [("Incorporation Planner", "Plans forming a corporation: entity type, jurisdiction, founders' equity, board and filings."),
   ("Cap Table Builder", "Builds a cap table through financing rounds with dilution and option pool.")]),
 ("capital", "Capital Structure and Financing", "Debt versus equity, cost of capital, WACC, leverage and financing choices.", "capital structure debt equity wacc leverage financing cost capital", "capital",
  [("WACC Calculator", "Computes weighted average cost of capital with each input's source."),
   ("Financing Options Comparator", "Compares debt, equity and hybrid financing for a company's situation.")]),
 ("valuation", "Valuation", "Valuing a company: discounted cash flow, comparable companies, precedent transactions and LBO.", "valuation dcf discounted cash flow comparable multiple precedent lbo enterprise value", "valuer",
  [("DCF Builder", "Builds a discounted cash flow valuation with stated assumptions and sensitivity."),
   ("Comparable Companies Analysis", "Values a company from trading multiples of comparable companies.")]),
 ("mna", "Mergers and Acquisitions", "Buying, selling and merging companies: deal process, due diligence, synergies and accretion/dilution.", "merger acquisition deal due diligence synergy accretion dilution target buyer", "mna",
  [("Accretion Dilution Analyzer", "Computes whether an acquisition is accretive or dilutive to earnings per share."),
   ("Due Diligence Checklist", "Builds a due diligence checklist for an acquisition by area.")]),
 ("treasury", "Treasury and Working Capital", "Cash management, liquidity, working capital, hedging and dividends or buybacks.", "treasury cash liquidity working capital hedging dividend buyback", "treasury",
  [("Working Capital Analyzer", "Analyzes working capital and the cash conversion cycle.")]),
 ], ("SEC EDGAR MCP", "Financial Datasets MCP")))

P.append(pack("offerings", "Securities Offerings and Going Public", "Raising capital and taking a company public: IPOs, follow-on and secondary offerings, private placements and exempt offerings, bookbuilding and allocation, SPACs and direct listings, and how investors participate.", "ofr",
 {"ipo": "IPO Agent", "ecm": "Equity Capital Markets Agent", "dcm": "Debt Capital Markets Agent", "private": "Private Placement Agent", "syndicate": "Syndicate Agent", "checker": "Offering Checker Agent"}, "checker", [
 ("ipo", "Initial Public Offerings", "Taking a company public: readiness, underwriters, S-1 registration, SEC review, roadshow, pricing and listing.", "ipo initial public offering underwriter s-1 registration roadshow pricing listing prospectus", "ipo",
  [("IPO Readiness Plan", "Plans IPO readiness: audits, governance, reporting, underwriters and timeline."),
   ("Prospectus Reader", "Reads an S-1 or prospectus and summarizes the business, risks, use of proceeds and terms.")]),
 ("followon", "Follow-On, Secondary and Shelf Offerings", "Offerings after the IPO: follow-ons, secondary sales by holders, shelf registrations, at-the-market programs and block trades.", "follow secondary shelf registration atm block trade offering overnight", "ecm",
  [("Offering Type Explainer", "Explains follow-on, secondary, shelf, ATM and block trade offerings and when each is used.")]),
 ("exempt", "Private Placements and Exempt Offerings", "Raising capital without full registration: Reg D, Rule 144A, Reg S, Reg A+, PIPEs and accredited investors.", "private placement reg rule 144a regulation exempt pipe accredited investor qib", "private",
  [("Exemption Selector", "Compares Reg D, 144A, Reg S and Reg A+ for a raise by investor type, limits and resale rules.")]),
 ("bookbuilding", "Bookbuilding, Allocation and Participation", "How an offering is marketed, the order book built, priced and allocated, and how institutional and retail investors participate.", "bookbuilding allocation order book participate investor institutional retail syndicate greenshoe", "syndicate",
  [("Participation Guide", "Explains how an investor participates in an offering: indications of interest, eligibility, allocation and settlement."),
   ("Greenshoe Explainer", "Explains the overallotment option and stabilization after pricing.")]),
 ("alt-listings", "SPACs and Direct Listings", "Alternative paths to public markets: SPAC mergers, direct listings and uplistings.", "spac direct listing merger alternative public uplisting de-spac", "ecm",
  [("Path to Public Comparator", "Compares IPO, SPAC and direct listing by cost, time, dilution and certainty.")]),
 ("debt", "Debt Offerings", "Issuing bonds and notes: investment grade and high yield deals, indentures, ratings and syndication.", "debt offering bond note issuance indenture rating high yield investment grade", "dcm",
  [("Bond Deal Explainer", "Explains a bond offering's process, documents, rating and pricing versus benchmark.")]),
 ], ("SEC EDGAR MCP",)))

P.append(pack("capital-markets", "Capital Markets and Exchanges", "Where securities trade: exchanges and trading venues, market structure, order types and execution concepts, clearing and settlement, indices, and trading platforms. Context only; no execution.", "cm",
 {"exchange": "Exchange Agent", "structure": "Market Structure Agent", "clearing": "Clearing and Settlement Agent", "index": "Index Agent", "platform": "Trading Platform Agent", "checker": "Markets Checker Agent"}, "checker", [
 ("exchanges", "Exchanges and Trading Venues", "Stock, futures and options exchanges, alternative trading systems, dark pools and their listing rules and hours.", "exchange nyse nasdaq cme venue ats dark pool listing trading hours", "exchange",
  [("Venue Explainer", "Explains a trading venue's role, listing rules, hours and which instruments trade there.")]),
 ("structure", "Market Structure and Orders", "Order types, order books, bid-ask spread, market makers, liquidity and best execution.", "order type limit market stop book bid ask spread market maker liquidity execution", "structure",
  [("Order Type Explainer", "Explains order types and which to use for a goal, with risks."),
   ("Liquidity Assessor", "Assesses an instrument's liquidity from spread, depth and volume.")]),
 ("clearing", "Clearing, Settlement and Custody", "What happens after a trade: clearing houses, settlement cycles, custody and prime brokerage.", "clearing settlement custody prime broker dtcc t+1 counterparty margin", "clearing",
  [("Trade Lifecycle Tracer", "Traces a trade from order to settlement, naming each party and step.")]),
 ("indices", "Indices and Benchmarks", "Market indices such as the S&P 500, how they are built, weighted and rebalanced, and index funds that track them.", "index indices benchmark s&p dow weighting rebalance constituent etf", "index",
  [("Index Methodology Explainer", "Explains how an index is constructed, weighted and rebalanced.")]),
 ("platforms", "Trading Platforms and Market Data", "Brokerages, trading platforms, terminals and market data feeds, and what each provides.", "platform brokerage broker terminal market data feed quote api", "platform",
  [("Platform Comparator", "Compares brokerages and trading platforms by instruments, fees, data and API access."),
   ("Market Data Explainer", "Explains market data types (quotes, trades, bars, depth) and their sources.")]),
 ], ("Polygon MCP", "Twelve Data MCP", "Alpaca MCP")))

P.append(pack("equities", "Stocks and Equities", "Shares in companies: common and preferred stock, fundamental and technical analysis, corporate actions, and reading company filings.", "eq",
 {"analyst": "Equity Research Agent", "technical": "Technical Analysis Agent", "actions": "Corporate Actions Agent", "filings": "Filings Analyst Agent", "checker": "Equity Checker Agent"}, "checker", [
 ("stocks", "Stocks and Share Classes", "Common and preferred stock, share classes, voting rights, dividends and ADRs.", "stock share common preferred class voting dividend adr equity", "analyst",
  [("Share Class Explainer", "Explains a company's share classes, voting rights and dividend terms.")]),
 ("fundamental", "Fundamental Analysis", "Valuing a stock from its business: earnings, ratios, growth, margins and multiples.", "fundamental analysis earnings ratio pe growth margin multiple stock", "analyst",
  [("Stock Fundamentals Summary", "Summarizes a stock's fundamentals: revenue, earnings, margins, valuation multiples and peers."),
   ("Earnings Report Reader", "Reads an earnings release and summarizes results versus expectations.")]),
 ("technical", "Technical Analysis", "Price and volume patterns, moving averages, momentum and indicators, and their limits.", "technical analysis price volume moving average momentum indicator chart rsi", "technical",
  [("Indicator Calculator", "Computes technical indicators for a price series and states what they do and do not show.")]),
 ("actions", "Corporate Actions", "Splits, dividends, buybacks, spinoffs, tender offers and their effect on shareholders.", "corporate action split dividend buyback spinoff tender offer record date", "actions",
  [("Corporate Action Explainer", "Explains a corporate action and its effect on a holder's shares and cost basis.")]),
 ("filings", "Reading Company Filings", "10-K, 10-Q, 8-K, proxy statements, 13F and insider Form 4 filings.", "filing 10-k 10-q 8-k proxy 13f form insider edgar annual report", "filings",
  [("10-K Reader", "Read a 10-K annual filing and extract business, risk factors, MD&A and key financials."),
   ("Insider and 13F Tracker", "Tracks insider Form 4 trades and institutional 13F holdings for a company.")]),
 ], ("SEC EDGAR MCP", "Yahoo Finance MCP", "Financial Datasets MCP")))

P.append(pack("fixed-income", "Bonds and Fixed Income", "Debt securities: government, municipal and corporate bonds, yield and duration, credit ratings and spreads, and securitized products.", "fi",
 {"rates": "Rates Agent", "credit": "Credit Analyst Agent", "muni": "Municipal Bond Agent", "struct": "Securitized Products Agent", "checker": "Fixed Income Checker Agent"}, "checker", [
 ("govt", "Government Bonds and the Yield Curve", "Treasuries and sovereign bonds, the yield curve, inflation-linked bonds and interest rate expectations.", "treasury government bond sovereign yield curve tips inflation interest rate", "rates",
  [("Yield Curve Reader", "Reads the yield curve's shape and explains what it implies about rates and growth.")]),
 ("math", "Yield, Duration and Convexity", "Bond pricing, yield to maturity, duration, convexity and interest rate risk.", "bond price yield maturity duration convexity coupon interest rate risk", "rates",
  [("Bond Pricer", "Prices a bond from its cash flows and yield and computes duration and convexity."),
   ("Rate Shock Estimator", "Estimates a bond portfolio's price change for a rate shock.")]),
 ("credit", "Corporate Bonds and Credit", "Corporate bonds, credit ratings, spreads, high yield, covenants and default risk.", "corporate bond credit rating spread high yield covenant default recovery", "credit",
  [("Credit Analysis", "Analyzes an issuer's credit: leverage, coverage, covenants and rating, with spread context.")]),
 ("muni", "Municipal Bonds", "Bonds issued by states and cities: general obligation and revenue bonds and tax exemption.", "municipal muni bond general obligation revenue tax exempt city state", "muni",
  [("Muni Tax-Equivalent Yield", "Computes a municipal bond's tax-equivalent yield for an investor's tax bracket.")]),
 ("securitized", "Securitized Products", "Mortgage-backed and asset-backed securities, CLOs, tranches and prepayment.", "mortgage backed asset securitized mbs abs clo tranche prepayment", "struct",
  [("Tranche Structure Explainer", "Explains a securitization's tranches, waterfall and prepayment risk.")]),
 ], ("FRED MCP",)))

P.append(pack("derivatives", "Derivatives and Options", "Contracts whose value derives from something else: options, futures and forwards, swaps, pricing and Greeks, and hedging strategies.", "dv",
 {"options": "Options Agent", "futures": "Futures Agent", "swaps": "Swaps Agent", "quant": "Derivatives Pricing Agent", "checker": "Derivatives Checker Agent"}, "checker", [
 ("options", "Options", "Calls and puts, strikes and expiries, intrinsic and time value, and options chains.", "option call put strike expiry premium chain intrinsic time value", "options",
  [("Option Payoff Builder", "Builds the payoff and break-even for an option or multi-leg options strategy."),
   ("Options Chain Reader", "Reads an options chain and explains open interest, implied volatility and skew.")]),
 ("futures", "Futures and Forwards", "Futures and forward contracts, margin, contango and backwardation, and roll.", "future forward contract margin contango backwardation roll expiry", "futures",
  [("Futures Roll Explainer", "Explains futures roll, contango and backwardation and their cost.")]),
 ("swaps", "Swaps", "Interest rate swaps, credit default swaps, currency swaps and total return swaps.", "swap interest rate credit default currency total return notional", "swaps",
  [("Swap Valuation Explainer", "Explains how a swap's legs are valued and what moves its value.")]),
 ("pricing", "Pricing and Greeks", "Black-Scholes and binomial pricing, implied volatility and the Greeks.", "pricing black scholes binomial implied volatility greek delta gamma vega theta", "quant",
  [("Option Pricer", "Prices a call or put option and computes its Greeks with Black-Scholes and states the assumptions.")]),
 ("hedging", "Hedging Strategies", "Using derivatives to hedge: protective puts, collars, futures hedges and delta hedging.", "hedge hedging protective put collar delta neutral risk exposure", "options",
  [("Hedge Designer", "Designs a hedge for an exposure and compares cost and residual risk.")]),
 ], ("Polygon MCP",)))

P.append(pack("commodities", "Commodities", "Raw materials that trade: energy, metals and agriculture, physical and futures markets, and supply and demand drivers.", "cmd",
 {"energy": "Energy Commodities Agent", "metals": "Metals Agent", "ags": "Agricultural Commodities Agent", "checker": "Commodities Checker Agent"}, "checker", [
 ("energy", "Energy", "Crude oil, natural gas, refined products and power, benchmarks such as WTI and Brent.", "energy crude oil natural gas wti brent refined power barrel", "energy",
  [("Oil Market Brief", "Summarizes crude oil supply, demand, inventories and the benchmark spread.")]),
 ("metals", "Metals", "Precious and industrial metals: gold, silver, copper, aluminum and their markets.", "metal gold silver copper aluminum precious industrial ounce", "metals",
  [("Metals Driver Explainer", "Explains what drives a metal's price: industrial demand, safe haven flows, currency and supply.")]),
 ("ags", "Agriculture", "Grains, softs and livestock: corn, wheat, soybeans, coffee, sugar, cattle, seasonality and crop reports.", "agriculture grain corn wheat soybean coffee sugar livestock crop", "ags",
  [("Crop Report Reader", "Reads a crop report and explains its effect on supply and prices.")]),
 ("drivers", "Physical Markets and Supply Chains", "Physical delivery, storage, transport, grades and how physical and futures prices connect.", "physical delivery storage transport grade basis supply chain spot", "energy",
  [("Basis Explainer", "Explains basis between a physical location and the futures price.")]),
 ], ("Twelve Data MCP",)))

P.append(pack("currencies", "Currencies and Foreign Exchange", "Money across borders: currency pairs and FX markets, exchange rate drivers and central banks, cross-border payments, and hedging currency risk.", "fx",
 {"trader": "FX Markets Agent", "macro": "Central Bank Agent", "payments": "Cross-Border Payments Agent", "checker": "FX Checker Agent"}, "checker", [
 ("pairs", "Currency Pairs and FX Markets", "Spot FX, currency pairs, quotes, pips and the over-the-counter FX market.", "currency pair forex fx spot quote pip exchange rate dollar euro yen", "trader",
  [("FX Quote Explainer", "Explains a currency quote, base and quote currency, pips and cross rates."),
   ("Currency Converter", "Converts amounts between currencies at a stated rate and source.")]),
 ("drivers", "Exchange Rate Drivers and Central Banks", "Interest rate differentials, inflation, trade balances, central bank policy and intervention.", "central bank interest rate inflation policy intervention fed ecb differential", "macro",
  [("Rate Differential Analyzer", "Explains a currency move by rate differentials and central bank policy.")]),
 ("payments", "Cross-Border Payments", "Sending money across borders: SWIFT, correspondent banking, remittances, fees and timing.", "cross border payment swift correspondent remittance wire transfer fee", "payments",
  [("Cross-Border Payment Planner", "Plans a cross-border payment route with fees, timing and compliance checks.")]),
 ("fx-hedging", "Currency Risk Hedging", "Hedging FX exposure with forwards, options and natural hedges.", "currency risk hedge forward exposure translation transaction", "trader",
  [("FX Exposure Hedger", "Measures a company's currency exposure and proposes a hedge.")]),
 ], ("Polygon MCP", "Twelve Data MCP")))

P.append(pack("crypto", "Cryptocurrencies and Digital Assets", "Digital money and assets: blockchains and consensus, cryptocurrencies and tokens, wallets and custody, crypto exchanges and DeFi, stablecoins and central bank digital currencies, and crypto regulation.", "cry",
 {"chain": "Blockchain Agent", "token": "Token Agent", "custody": "Wallet and Custody Agent", "defi": "DeFi Agent", "cbdc": "Digital Currency Agent", "checker": "Crypto Checker Agent"}, "checker", [
 ("chains", "Blockchains and Consensus", "How blockchains work: blocks, consensus (proof of work, proof of stake), nodes and smart contracts.", "blockchain consensus proof work stake node block smart contract ledger", "chain",
  [("Blockchain Explainer", "Explains how a blockchain records and confirms transactions and its trust assumptions.")]),
 ("tokens", "Cryptocurrencies and Tokens", "Bitcoin, Ether, tokens, token standards, supply schedules and tokenomics.", "cryptocurrency bitcoin ether token erc supply tokenomics coin", "token",
  [("Token Analyzer", "Analyzes a token's supply, distribution, utility and risks.")]),
 ("custody", "Wallets and Custody", "Wallets, private keys, seed phrases, self custody versus custodians, and security.", "wallet private key seed phrase custody hardware self custodian", "custody",
  [("Custody Option Comparator", "Compares self custody, hardware wallets and custodians by risk and control.")]),
 ("defi", "Crypto Exchanges and DeFi", "Centralized exchanges, decentralized exchanges, liquidity pools, lending and their risks.", "exchange defi decentralized liquidity pool lending yield swap amm", "defi",
  [("DeFi Risk Reviewer", "Reviews a DeFi protocol's smart contract, liquidity and counterparty risks.")]),
 ("digital-currencies", "Stablecoins and Central Bank Digital Currencies", "Fiat-backed and algorithmic stablecoins, reserves, and central bank digital currencies.", "stablecoin cbdc digital currency reserve fiat peg central bank", "cbdc",
  [("Stablecoin Reserve Checker", "Explains a stablecoin's peg mechanism and how its reserves are attested.")]),
 ("regulation", "Crypto Regulation and Tax", "How crypto is regulated and taxed by jurisdiction: securities status, licensing, travel rule and reporting.", "crypto regulation tax securities license travel rule reporting jurisdiction", "cbdc",
  [("Crypto Regulatory Map", "Maps how a crypto activity is regulated in a jurisdiction and what must be reported.")]),
 ], ("CCXT MCP", "Coinbase AgentKit")))

P.append(pack("investing", "Investing and Portfolio Management", "Building and running portfolios: asset allocation, funds and ETFs, risk and return, performance tracking, and quantitative strategies and backtesting.", "inv",
 {"allocator": "Asset Allocation Agent", "funds": "Fund Analyst Agent", "risk": "Portfolio Risk Agent", "tracker": "Performance Tracking Agent", "quant": "Quant Strategy Agent", "checker": "Investment Checker Agent"}, "checker", [
 ("allocation", "Asset Allocation", "Mixing stocks, bonds, cash and alternatives for a goal, horizon and risk tolerance, and rebalancing.", "asset allocation portfolio diversification rebalance risk tolerance horizon goal", "allocator",
  [("Allocation Planner", "Proposes an asset allocation for a goal and horizon and explains its risk."),
   ("Rebalancing Planner", "Plans rebalancing back to target weights with tax and cost notes.")]),
 ("funds", "Funds and ETFs", "Mutual funds, ETFs, index funds, expense ratios, tracking error and fund structures.", "fund etf mutual index expense ratio tracking error holdings nav", "funds",
  [("Fund Comparator", "Compares funds by holdings, fees, tracking error and structure.")]),
 ("risk", "Risk and Return", "Volatility, drawdown, correlation, beta, Sharpe ratio, value at risk and factor exposure.", "risk return volatility drawdown correlation beta sharpe var factor", "risk",
  [("Portfolio Risk Report", "Reports a portfolio's volatility, drawdown, beta, VaR and concentration.")]),
 ("tracking", "Performance Tracking", "Tracking holdings and performance: time-weighted and money-weighted returns, benchmarks and attribution.", "performance tracking return benchmark attribution holding position watchlist", "tracker",
  [("Performance Attribution", "Attributes a portfolio's return to allocation and selection versus its benchmark."),
   ("Position Tracker", "Tracks positions, cost basis and unrealized gains for a portfolio.")]),
 ("quant", "Quantitative Strategies and Backtesting", "Systematic strategies, factor models, backtesting and overfitting.", "quantitative strategy backtest factor model systematic algorithm overfitting signal", "quant",
  [("Backtest Reviewer", "Reviews a backtest for look-ahead bias, survivorship bias, costs and overfitting.")]),
 ], ("QuantConnect MCP", "Yahoo Finance MCP")))

P.append(pack("hedge-funds", "Hedge Funds and Alternative Investments", "Alternative investment vehicles: hedge fund strategies and structures (onshore and offshore, master-feeder), private equity and venture capital, prime brokerage and fund operations, and how investors subscribe and track them.", "hf",
 {"strategy": "Hedge Fund Strategy Agent", "structure": "Fund Structuring Agent", "pe": "Private Equity Agent", "ops": "Fund Operations Agent", "investor": "Investor Relations Agent", "checker": "Alternatives Checker Agent"}, "checker", [
 ("strategies", "Hedge Fund Strategies", "Long/short equity, global macro, event driven, relative value, credit and quant strategies.", "hedge fund strategy long short macro event driven arbitrage relative value", "strategy",
  [("Strategy Explainer", "Explains a hedge fund strategy's return sources, risks and typical leverage.")]),
 ("structures", "Fund Structures: Onshore and Offshore", "Delaware LPs, Cayman funds, master-feeder structures, side pockets and why each is used.", "onshore offshore cayman delaware master feeder limited partnership side pocket structure", "structure",
  [("Master-Feeder Explainer", "Explains a master-feeder structure, which investors use which feeder and why."),
   ("Fund Structure Selector", "Compares onshore, offshore and parallel fund structures for an investor base.")]),
 ("private-markets", "Private Equity and Venture Capital", "Buyouts, growth and venture funds, capital calls, J-curve, carried interest and exits.", "private equity venture capital buyout fund capital call carried interest exit", "pe",
  [("PE Fund Terms Explainer", "Explains fund terms: management fee, carry, hurdle, waterfall and capital calls.")]),
 ("operations", "Prime Brokerage and Fund Operations", "Prime brokers, fund administrators, NAV calculation, custody, margin and securities lending.", "prime brokerage administrator nav custody margin securities lending operations", "ops",
  [("Fund Ops Map", "Maps a fund's service providers (prime broker, administrator, auditor, custodian) and what each does.")]),
 ("subscriptions", "Subscribing, Reporting and Tracking", "How investors subscribe and redeem: eligibility, subscription documents, lockups, gates, and investor reporting.", "subscription redemption lockup gate investor reporting eligibility qualified purchaser", "investor",
  [("Subscription Guide", "Explains how an investor subscribes to a fund: eligibility, documents, KYC, lockups and redemptions.")]),
 ]))

P.append(pack("financial-regulation", "Financial Regulation, AML and Compliance", "Rules for finance: securities regulators and rules, anti-money laundering and KYC, sanctions, onshore and offshore regimes, and compliance programs.", "frg",
 {"securities": "Securities Regulation Agent", "aml": "AML Agent", "kyc": "KYC Agent", "sanctions": "Sanctions Agent", "program": "Compliance Program Agent", "checker": "Compliance Checker Agent"}, "checker", [
 ("securities", "Securities Regulators and Rules", "SEC, FINRA, CFTC and foreign regulators, registration, disclosure and market conduct rules.", "sec finra cftc regulator securities law registration disclosure conduct rule", "securities",
  [("Regulator Mapper", "Maps which regulator and rules apply to an activity and jurisdiction.")]),
 ("aml", "Anti-Money Laundering", "AML programs, suspicious activity monitoring, SARs, placement, layering and integration.", "aml anti money laundering suspicious activity sar monitoring layering bsa", "aml",
  [("AML Red Flag Reviewer", "Reviews a pattern of transactions for money laundering red flags and states each one."),
   ("AML Program Outline", "Outlines the parts of an AML program for a firm type.")]),
 ("kyc", "KYC and Beneficial Ownership", "Know your customer, customer due diligence, enhanced due diligence and beneficial ownership.", "kyc know customer due diligence beneficial ownership edd identity verification", "kyc",
  [("KYC Checklist Builder", "Builds the KYC and CDD checklist for a customer type, including beneficial owners.")]),
 ("sanctions", "Sanctions and Offshore Regimes", "Sanctions lists, screening, offshore financial centers and onshore versus offshore compliance.", "sanctions ofac screening offshore onshore jurisdiction cayman bvi list", "sanctions",
  [("Sanctions Screening Explainer", "Explains how sanctions screening works and how a match is resolved.")]),
 ("program", "Compliance Programs and Reporting", "Policies, surveillance, regulatory reporting, recordkeeping and exams.", "compliance policy surveillance reporting recordkeeping exam audit trail", "program",
  [("Regulatory Report Calendar", "Lists a firm's recurring regulatory filings with deadlines.")]),
 ]))

P.append(pack("financial-data", "Financial Data and Models", "The data and models finance runs on: market and reference data, fundamentals and filings data, economic data, financial modeling in spreadsheets and code, and data quality.", "fd",
 {"market": "Market Data Agent", "fundamentals": "Fundamentals Data Agent", "macro": "Economic Data Agent", "modeler": "Financial Modeling Agent", "quality": "Data Quality Agent", "checker": "Financial Data Checker Agent"}, "checker", [
 ("market-data", "Market and Reference Data", "Prices, quotes, trades, corporate actions, identifiers (ticker, CUSIP, ISIN, FIGI) and data vendors.", "market data price quote trade identifier ticker cusip isin vendor reference", "market",
  [("Identifier Mapper", "Maps a security between ticker, CUSIP, ISIN and FIGI and flags mismatches."),
   ("Market Data Source Selector", "Chooses a market data source by coverage, latency, history and cost.")]),
 ("fundamentals", "Fundamentals and Filings Data", "Standardized financial statements, XBRL, estimates and transcripts.", "fundamentals xbrl financial statement estimate transcript filing data standardized", "fundamentals",
  [("XBRL Extractor", "Extracts financial statement values from XBRL filings with their tags and periods.")]),
 ("economic", "Economic Data", "GDP, inflation, employment, interest rates and other macro series and their release calendars.", "economic gdp inflation cpi employment rate macro series release fred", "macro",
  [("Economic Series Finder", "Finds the official series for an economic indicator and its release schedule.")]),
 ("models", "Financial Models", "Three-statement models, DCF, LBO, merger and budget models, in spreadsheets and code, with assumptions and checks.", "financial model spreadsheet three statement dcf lbo assumption scenario excel", "modeler",
  [("Three-Statement Model Builder", "Builds a linked three-statement model with assumptions separated from formulas."),
   ("Model Auditor", "Audits a financial model for broken links, hard-coded numbers and balance sheet that does not balance.")]),
 ("quality", "Data Quality and Lineage", "Checking financial data: gaps, outliers, restatements, survivorship and lineage.", "data quality outlier gap restatement survivorship lineage validation", "quality",
  [("Price Data Validator", "Checks a price series for gaps, outliers, splits and stale values.")]),
 ], ("Financial Datasets MCP", "FRED MCP", "SEC EDGAR MCP", "Polygon MCP")))

P.append(pack("financial-services", "Financial Services and Banking", "Firms and services that move and hold money: banking and lending, payments, insurance, wealth management and brokerage, and the structure of investment banks.", "fs",
 {"bank": "Banking Agent", "payments": "Payments Agent", "insurance": "Insurance Agent", "wealth": "Wealth Management Agent", "ib": "Investment Banking Agent", "checker": "Financial Services Checker Agent"}, "checker", [
 ("banking", "Banking and Lending", "Deposits, loans, credit cards, underwriting, interest and bank capital.", "bank deposit loan lending credit card underwriting interest capital", "bank",
  [("Loan Comparator", "Compares loans by APR, fees and terms, and computes total cost.")]),
 ("payments", "Payments", "Card networks, ACH, wires, real-time payments, processors and fees.", "payment card ach wire real time processor merchant fee transfer", "payments",
  [("Payment Flow Explainer", "Explains how a payment moves between payer, processor, network and payee, with fees and timing.")]),
 ("insurance", "Insurance", "Life, property, casualty and health insurance, premiums, underwriting and claims.", "insurance life property casualty premium underwriting claim policy coverage", "insurance",
  [("Coverage Reviewer", "Reviews an insurance policy's coverage, exclusions and deductibles.")]),
 ("wealth", "Wealth Management and Brokerage", "Advisors, brokerage accounts, fiduciary duty, account types and fees.", "wealth advisor brokerage account fiduciary ira 401k fee", "wealth",
  [("Account Type Guide", "Explains brokerage and retirement account types and their tax treatment.")]),
 ("ib", "Investment Banks and Their Divisions", "How investment banks are organized: banking, sales and trading, research, prime services and asset management.", "investment bank division sales trading research prime services asset management front office", "ib",
  [("Investment Bank Map", "Maps an investment bank's divisions, what each does and how they interact on a deal.")]),
 ], ("Stripe MCP",)))

P.append(pack("taxes", "Taxes and Personal Finance", "Personal money: income tax preparation and filing, deductions and credits, investment and crypto taxes, budgeting and saving, and retirement planning.", "tax",
 {"preparer": "Tax Preparation Agent", "planner": "Tax Planning Agent", "budget": "Budgeting Agent", "retirement": "Retirement Planning Agent", "checker": "Tax Checker Agent"}, "checker", [
 ("filing", "Tax Preparation and Filing", "Preparing and filing income tax returns: forms, documents, deadlines and e-filing.", "tax taxes return filing form w-2 1099 deadline irs prepare", "preparer",
  [("Tax Return Prep Checklist", "Helps prepare and file your taxes: lists the forms and documents needed to prepare a tax return for a situation."),
   ("Filing Deadline Tracker", "Lists federal and state tax filing and estimated payment deadlines.")]),
 ("deductions", "Deductions, Credits and Tax Planning", "Standard and itemized deductions, credits, brackets and planning to reduce tax legally.", "deduction credit bracket itemized standard planning tax liability", "planner",
  [("Deduction Finder", "Finds deductions and credits that may apply and the evidence each needs.")]),
 ("investment-tax", "Investment and Crypto Taxes", "Capital gains, cost basis, wash sales, dividends and crypto tax reporting.", "capital gain cost basis wash sale dividend crypto tax reporting", "planner",
  [("Capital Gains Calculator", "Computes short and long term capital gains from trades with cost basis method stated.")]),
 ("budgeting", "Budgeting and Saving", "Budgets, cash flow, emergency funds, debt payoff and saving goals.", "budget saving cash flow expense emergency fund debt payoff goal", "budget",
  [("Budget Builder", "Builds a monthly budget from income and expenses and shows savings rate.")]),
 ("retirement", "Retirement Planning", "Retirement accounts, contribution limits, withdrawals and projecting retirement income.", "retirement 401k ira roth contribution withdrawal pension social security", "retirement",
  [("Retirement Projection", "Projects retirement savings and income under stated assumptions.")]),
 ], ("QuickBooks Online MCP",)))

if __name__ == "__main__":
    ids = [p["id"] for p in P]
    assert len(ids) == len(set(ids))
    for p in P:
        n = len(p["concepts"])
        assert 3 <= n <= 8, (p["id"], n)
        (OUT / f"{p['id']}.pack.json").write_text(json.dumps(p, indent=1, ensure_ascii=False))
    print(json.dumps({"packs": len(P), "concepts": sum(len(p["concepts"]) for p in P), "skills": sum(len(p["skills"]) for p in P),
                      "agents": sum(len(p["agents"]) for p in P), "mcp_rows": sum(len(p["mcp"]) for p in P), "ids": ids}))
