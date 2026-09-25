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
