"use client"

import { useEffect, useState } from "react"
import type { DashboardType } from "@/components/global-filters-sidebar"

/** What this deployment can serve (GET /api/config). */
export interface DeploymentConfig {
  dashboards: DashboardType[]
  /** Crop and livestock registry views (they still read the transitional database). */
  registryViews: boolean
}

// Until the config arrives, assume the minimum every deployment serves.
const MINIMAL: DeploymentConfig = { dashboards: ["registries"], registryViews: false }

let request: Promise<DeploymentConfig> | null = null

function loadConfig(): Promise<DeploymentConfig> {
  request ??= fetch("/api/config")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<DeploymentConfig>
    })
    .catch(() => {
      request = null
      return MINIMAL
    })
  return request
}

export function useDeploymentConfig(): DeploymentConfig {
  const [config, setConfig] = useState<DeploymentConfig>(MINIMAL)
  useEffect(() => {
    let active = true
    loadConfig().then(c => { if (active) setConfig(c) })
    return () => { active = false }
  }, [])
  return config
}
