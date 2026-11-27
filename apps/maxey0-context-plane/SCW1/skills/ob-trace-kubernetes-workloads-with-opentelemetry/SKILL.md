---
name: ob-trace-kubernetes-workloads-with-opentelemetry
description: Gets distributed traces from services running on Kubernetes with the OpenTelemetry Operator. It installs cert-manager and the Operator, deploys an OpenTelemetry Collector with the Kubernetes attributes processor, creates Instrumentation resources, opts workloads in with inject annotations, and verifies that spans arrive tagged with their pod, namespace and deployment. Use when asked about Kubernetes observability, tracing, traces or spans for pods, deployments or services, or OpenTelemetry auto-instrumentation on a cluster.
metadata:
  context-plane-concept: ob-signals
  context-plane-label: Kubernetes observability: trace workloads with OpenTelemetry
  context-plane-type: procedural
  context-plane-agents: Maxey911:primary Maxey905:checker Maxey1628:support
---

# Trace Kubernetes workloads with OpenTelemetry

Auto-instruments .NET, Java, Node.js and Python services on a Kubernetes cluster and sends their traces through an OpenTelemetry Collector. Go services also need the Operator's `enable-go-instrumentation` feature gate (off by default) and extra annotations, and Deno needs its own environment variable and flag; this skill covers neither.

Versions are pinned to the releases that were current on November 27, 2026: cert-manager v1.21.3, OpenTelemetry Operator v0.164.0 and the Kubernetes distribution of the OpenTelemetry Collector 0.164.0. To move to newer ones, change all three together and keep the Collector's version equal to the Operator's.

## Inputs

- **Cluster access:** `kubectl` pointed at the cluster, with rights to install cluster-wide resources (CRDs, a ClusterRole).
- **App namespace:** the namespace the services run in. Every command below reads it from `APP_NS`, and each `kubectl apply` refuses to run if it isn't set, so set it first in bash, for example `export APP_NS=checkout` for a namespace named `checkout`.
- **Services and languages:** each Deployment to trace and the language it runs.

## Steps

The commands are bash. Each heredoc ends with a `YAML` line at the start of the line, so copy each block whole.

### Step 1. Install cert-manager

Skip this if cert-manager already runs on the cluster.

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.21.3/cert-manager.yaml
kubectl wait --for=condition=Available deployment --all --namespace cert-manager --timeout=300s
kubectl get pods --namespace cert-manager
```

The `cert-manager`, `cert-manager-cainjector` and `cert-manager-webhook` pods should be `Running`.

### Step 2. Install the OpenTelemetry Operator

```bash
kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/download/v0.164.0/opentelemetry-operator.yaml
kubectl wait --for=condition=Available deployment/opentelemetry-operator-controller-manager --namespace opentelemetry-operator-system --timeout=300s
```

Wait for this before Step 4. The Operator's webhook has to be up before it accepts a Collector or an Instrumentation resource.

### Step 3. Give the Collector read access to pod metadata

The Kubernetes attributes processor calls the Kubernetes API, so the Collector runs as a service account bound to this ClusterRole. The cluster-wide names carry the namespace, so a second namespace gets its own.

```bash
: "${APP_NS:?set APP_NS to the app namespace first}" && kubectl apply -f - <<YAML
apiVersion: v1
kind: ServiceAccount
metadata:
  name: collector
  namespace: ${APP_NS}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: otel-collector-${APP_NS}
rules:
  - apiGroups: ['']
    resources: ['pods', 'namespaces']
    verbs: ['get', 'watch', 'list']
  - apiGroups: ['apps']
    resources: ['replicasets']
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['extensions']
    resources: ['replicasets']
    verbs: ['get', 'list', 'watch']
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: otel-collector-${APP_NS}
subjects:
  - kind: ServiceAccount
    name: collector
    namespace: ${APP_NS}
roleRef:
  kind: ClusterRole
  name: otel-collector-${APP_NS}
  apiGroup: rbac.authorization.k8s.io
YAML
```

### Step 4. Deploy the Collector

The Operator's default Collector image is the core distribution, which has no Kubernetes attributes processor, so `spec.image` names the Kubernetes distribution, which has it along with the OTLP receiver, the memory limiter and the debug and OTLP exporters. In the default Deployment mode the Operator creates a Deployment and a Service named after the resource plus `-collector`, here `demo-collector`. The `debug` exporter prints spans to the Collector's log at `detailed` verbosity, so you can see traces and their attributes before a backend is connected.

```bash
: "${APP_NS:?set APP_NS to the app namespace first}" && kubectl apply -f - <<YAML
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: demo
  namespace: ${APP_NS}
spec:
  image: ghcr.io/open-telemetry/opentelemetry-collector-releases/opentelemetry-collector-k8s:0.164.0
  serviceAccount: collector
  config:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    processors:
      memory_limiter:
        check_interval: 1s
        limit_percentage: 75
        spike_limit_percentage: 15
      k8sattributes:
        auth_type: 'serviceAccount'
        extract:
          metadata:
            - k8s.namespace.name
            - k8s.pod.name
            - k8s.pod.start_time
            - k8s.pod.uid
            - k8s.deployment.name
            - k8s.node.name
        pod_association:
          - sources:
              - from: resource_attribute
                name: k8s.pod.ip
          - sources:
              - from: resource_attribute
                name: k8s.pod.uid
          - sources:
              - from: connection
    exporters:
      debug:
        verbosity: detailed
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, k8sattributes]
          exporters: [debug]
YAML
kubectl rollout status deployment/demo-collector --namespace "${APP_NS}" --timeout=300s
```

The rollout should end with `deployment "demo-collector" successfully rolled out`. If it doesn't, `kubectl describe deployment/demo-collector -n "${APP_NS}"` and `kubectl logs deployment/demo-collector -n "${APP_NS}"` show why.

### Step 5. Create the Instrumentation resources before the services restart

Order matters: a pod started before its Instrumentation resource exists isn't instrumented. .NET, Java and Python send OTLP over HTTP to port 4318 (Python doesn't support gRPC); Node.js sends OTLP over gRPC to port 4317. Create both if the namespace mixes languages.

```bash
: "${APP_NS:?set APP_NS to the app namespace first}" && kubectl apply -f - <<YAML
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: demo-instrumentation
  namespace: ${APP_NS}
spec:
  exporter:
    endpoint: http://demo-collector:4318
  propagators:
    - tracecontext
    - baggage
  sampler:
    type: parentbased_traceidratio
    argument: "1"
---
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: nodejs-instrumentation
  namespace: ${APP_NS}
spec:
  exporter:
    endpoint: http://demo-collector:4317
  propagators:
    - tracecontext
    - baggage
  sampler:
    type: parentbased_traceidratio
    argument: "1"
YAML
```

The sampler argument `"1"` keeps every trace. Lower it, for example to `"0.25"`, to keep a quarter of them.

### Step 6. Opt each service in

In each Deployment's manifest, add the annotation for its language under `spec.template.metadata.annotations`, naming its Instrumentation resource, then apply the manifest again so the pods restart with instrumentation:

```yaml
spec:
  template:
    metadata:
      annotations:
        instrumentation.opentelemetry.io/inject-java: "demo-instrumentation"
```

The keys are `inject-dotnet`, `inject-java`, `inject-python` and `inject-nodejs` (use `"nodejs-instrumentation"` for Node.js), each prefixed with `instrumentation.opentelemetry.io/`. The value `"true"` injects the Instrumentation resource from the current namespace, so name the resource whenever the namespace has more than one; `"other-namespace/name"` picks one from another namespace, and `"false"` turns injection off. The annotation can also go on the namespace to opt in every service in it.

### Step 7. Send traces to the real backend

Once spans show up (see Check), replace `debug` in the traces pipeline with the exporter that your tracing backend documents for the OpenTelemetry Collector, and apply the Collector again. The Kubernetes distribution includes the `otlp` and `otlphttp` exporters.

## Check (checker role)

- `kubectl rollout status deployment/demo-collector -n "${APP_NS}"` reports the Collector rolled out, and its pod is `Running`.
- `kubectl describe otelinst -n "${APP_NS}"` lists both Instrumentation resources with the right endpoints.
- `kubectl get events -n "${APP_NS}"` shows `Created container opentelemetry-auto-instrumentation` and `Started container opentelemetry-auto-instrumentation` for each instrumented pod. If not, the pod probably started before its Instrumentation resource: restart it.
- `kubectl logs -l app.kubernetes.io/name=opentelemetry-operator --container manager -n opentelemetry-operator-system --follow` shows no auto-instrumentation errors.
- `kubectl logs deployment/demo-collector -n "${APP_NS}" --follow`, while you send a request to an instrumented service, shows spans whose resource attributes include `k8s.namespace.name`, `k8s.pod.name` and `k8s.deployment.name`.

## Boundaries

- Installing CRDs, cluster roles and cert-manager changes the whole cluster. On a shared or production cluster, get the cluster owner's yes first.
- Applying a manifest with a new annotation restarts that Deployment's pods.

## Sources

Read on November 27, 2026:

- https://opentelemetry.io/docs/platforms/kubernetes/operator/ (install, first Collector)
- https://opentelemetry.io/docs/platforms/kubernetes/operator/automatic/ (Collector, Instrumentation per language, annotations, feature gates, troubleshooting)
- https://opentelemetry.io/docs/platforms/kubernetes/collector/components/ (Kubernetes attributes processor and its RBAC)
- https://github.com/open-telemetry/opentelemetry-operator/blob/main/docs/api/opentelemetrycollectors.md (`spec.image`, `spec.serviceAccount`)
- The v0.164.0 Operator manifest (Deployment `opentelemetry-operator-controller-manager`, default Collector image `opentelemetry-collector:0.164.0`) and the Operator's e2e test `tests/e2e/smoke-collector/smoke-collector-deployment/00-assert.yaml` at v0.164.0 (Deployment named `<name>-collector`)
- `distributions/otelcol-k8s/manifest.yaml` and `distributions/otelcol/manifest.yaml` in opentelemetry-collector-releases at v0.164.0 (the Kubernetes distribution has `k8sattributesprocessor`; the core one doesn't), and the `opentelemetry-collector-k8s:0.164.0` image on ghcr.io
- https://cert-manager.io/docs/installation/kubectl/ (cert-manager install and check); the latest release resolved to v1.21.3
