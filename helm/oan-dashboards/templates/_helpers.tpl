{{- define "oan-dashboards.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "oan-dashboards.selectorLabels" -}}
app.kubernetes.io/name: oan-dashboards
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "oan-dashboards.labels" -}}
{{ include "oan-dashboards.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{/* A VirtualService http route to the dashboards Service for one host. */}}
{{- define "oan-dashboards.httpRoute" -}}
- headers:
    request:
      set:
        x-forwarded-host: {{ .host | quote }}
        x-forwarded-proto: https
  match:
    - uri:
        prefix: /
  route:
    - destination:
        host: {{ include "oan-dashboards.fullname" .root }}
        port:
          number: {{ .root.Values.service.port }}
{{- end -}}

{{- define "oan-dashboards.serviceAccountName" -}}
{{ include "oan-dashboards.fullname" . }}
{{- end -}}

{{- define "oan-dashboards.ecrRefresher" -}}
{{ include "oan-dashboards.fullname" . }}-ecr-refresh
{{- end -}}

{{/* ECR registry host (<account>.dkr.ecr.<region>.amazonaws.com): ecrPullSecret.registry, else the host of image.repository. */}}
{{- define "oan-dashboards.ecrRegistry" -}}
{{- $registry := .Values.ecrPullSecret.registry | default (first (splitList "/" (toString .Values.image.repository))) -}}
{{- if not (contains ".dkr.ecr." $registry) -}}
{{- fail (printf "ecrPullSecret: %q is not an ECR registry host; set ecrPullSecret.registry or disable ecrPullSecret" $registry) -}}
{{- end -}}
{{- $registry -}}
{{- end -}}

{{/* Job spec that fetches an ECR token and writes the pull secret. Takes dict root, serviceAccount. */}}
{{- define "oan-dashboards.ecrJobSpec" -}}
{{- $v := .root.Values.ecrPullSecret -}}
{{- $registry := include "oan-dashboards.ecrRegistry" .root -}}
backoffLimit: 2
activeDeadlineSeconds: 300
template:
  metadata:
    labels:
      app.kubernetes.io/name: oan-dashboards-ecr-refresh
      app.kubernetes.io/instance: {{ .root.Release.Name }}
  spec:
    serviceAccountName: {{ .serviceAccount }}
    restartPolicy: Never
    initContainers:
      - name: get-token
        image: {{ $v.awsCliImage }}
        command: ["/bin/sh", "-c", "aws ecr get-login-password --region {{ index (splitList "." $registry) 3 }} > /token/ecr"]
        volumeMounts:
          - name: token
            mountPath: /token
    containers:
      - name: write-secret
        image: {{ $v.kubectlImage }}
        command:
          - /bin/sh
          - -c
          - |
            set -eu
            kubectl create secret docker-registry {{ $v.name }} \
              --namespace {{ .root.Release.Namespace }} \
              --docker-server={{ $registry }} \
              --docker-username=AWS \
              --docker-password="$(cat /token/ecr)" \
              --dry-run=client -o yaml | kubectl apply -f -
        volumeMounts:
          - name: token
            mountPath: /token
            readOnly: true
    volumes:
      - name: token
        emptyDir:
          medium: Memory
{{- end -}}
