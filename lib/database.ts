// lib/database.ts
// Database connection and data fetching functions for MOF Dashboard
import { Pool } from 'pg'
import { DataPoint } from './mock-data'
import { DATABASE_CONFIG, FARMER_DATABASE_CONFIG } from './config'

// Create connection pool using centralized configuration
export const pool = new Pool({
  ...DATABASE_CONFIG
})

export const farmerPool = new Pool({
  ...FARMER_DATABASE_CONFIG
})

// Interface for raw database results
interface FarmerRecord {
  id: number
  name: string
  gender: string
  region_name: string
  zone_name: string
  woreda_name: string
  kebele_name: string
  farming_type: string
  is_farmer: string
  registration_date: string
  create_date: string
  total_land_area: number
  is_disabled: string
  hh_is_household_head: string
  has_national_id: string
  primary_commodity_name: string
  size_of_family: number
  age_int: number
}

interface CropRecord {
  partner_id: number
  crop_name: string
  collected_gc: string
  season_name: string
  region_name: string
}

interface LivestockRecord {
  partner_id: number
  livestock_name: string
  number_of_livestock: number
  collected_gc: string
  season_name: string
  region_name: string
}

interface LandRecord {
  partner_id: number
  total_land_area: number
  ownership_type: string
  region_name: string
}

/**
 * Main function to fetch and transform farmer data from database
 * Returns data in the format expected by the original dashboard charts
 * Based on actual database: 22 farmers, 5711 non-farmers, 5733 total registrants
 */
export async function fetchFarmersData(): Promise<DataPoint[]> {
  const client = await farmerPool.connect()
  try {
    const farmersQuery = `
      SELECT
        f.functional_record_id as id,
        f.record_name as name,
        f.gender,
        f.main_farming_type as farming_type,
        f.land_ownership as total_land_area,
        f.created_at as registration_date,
        f.created_at as create_date,
        f.region_name,
        (SELECT elem->>'level_value_id' FROM jsonb_array_elements(f.geo_code_hierarchy_json->'hierarchy') elem WHERE elem->>'level_mnemonic' = 'region' LIMIT 1) as region_code
      FROM g2p_register_farmers f
      WHERE f.record_status = 'ACTIVE'
      ORDER BY f.created_at DESC
    `

    const { rows } = await client.query(farmersQuery)

    // Return one record per farmer, no synthetic fan-out
    return rows.map((farmer: any): DataPoint => ({
      id: String(farmer.id),
      year: farmer.registration_date ? new Date(farmer.registration_date).getFullYear() : new Date().getFullYear(),
      category: 'farmer',
      subcategory: 'raw',
      value: 1,
      region: farmer.region_name || 'Unknown',
      sector: 'agriculture',
      gender: farmer.gender || 'unknown',
      farmingType: farmer.farming_type || undefined,
      landSize: farmer.total_land_area || 0,
      unit: 'count',
    }))

  } catch (error) {
    console.error('Database query error:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Function to fetch aggregated statistics for dashboard summary cards
 * Returns actual statistics: 22 farmers, 5711 non-farmers, 5733 total
 */
export async function fetchAggregatedStats() {
  const client = await farmerPool.connect()
  try {
    // Farmers by region
    const farmerRegionStatsQuery = `
      SELECT
        COALESCE(f.region_name, 'Unknown') as region_name,
        (SELECT elem->>'level_value_id' FROM jsonb_array_elements(f.geo_code_hierarchy_json->'hierarchy') elem WHERE elem->>'level_mnemonic' = 'region' LIMIT 1) as region_code,
        COUNT(*) as total_farmers,
        COUNT(CASE WHEN LOWER(f.gender) = 'male' THEN 1 END) as male_farmers,
        COUNT(CASE WHEN LOWER(f.gender) = 'female' THEN 1 END) as female_farmers,
        COUNT(CASE WHEN f.gender IS NULL OR f.gender = '' THEN 1 END) as unknown_gender,
        0 as avg_land_area,
        0 as total_land_area,
        MIN(f.created_at) as earliest_registration,
        MAX(f.created_at) as latest_registration
      FROM g2p_register_farmers f
      WHERE f.record_status = 'ACTIVE'
      GROUP BY 1, 2
      ORDER BY total_farmers DESC
    `

    const regionStats = await client.query(farmerRegionStatsQuery)

    // Farming type distribution (for farming type charts)
    const farmingTypeQuery = `
      SELECT
        f.main_farming_type as farming_type,
        COUNT(*) as count,
        0 as avg_land_area,
        0 as total_land_area
      FROM g2p_register_farmers f
      WHERE f.record_status = 'ACTIVE'
        AND f.main_farming_type IS NOT NULL
      GROUP BY f.main_farming_type
      ORDER BY count DESC
    `

    const farmingTypeStats = await client.query(farmingTypeQuery)

    // Overall farmer summary statistics
    const farmerSummaryQuery = `
      SELECT
        COUNT(*) as total_farmers,
        COUNT(CASE WHEN f.gender IS NOT NULL AND f.gender != '' THEN 1 END) as farmers_with_gender,
        COUNT(CASE WHEN f.main_farming_type IS NOT NULL AND f.main_farming_type != '' THEN 1 END) as farmers_with_type,
        0 as farmers_with_land,
        0 as avg_land_area,
        0 as total_land_area,
        0 as min_land_area,
        0 as max_land_area,
        COUNT(DISTINCT f.region_name) as regions_with_farmers
      FROM g2p_register_farmers f
      WHERE f.record_status = 'ACTIVE'
    `

    const farmerSummaryStats = await client.query(farmerSummaryQuery)

    // Total registrants summary (for comparison)
    const totalRegistrantsQuery = `
      SELECT
        COUNT(*) as total_registrants,
        COUNT(*) as total_farmers,
        0 as non_farmers
      FROM g2p_register_farmers f
      WHERE f.record_status = 'ACTIVE'
    `

    const totalRegistrantsStats = await client.query(totalRegistrantsQuery)


    return {
      regionStats: regionStats.rows,
      farmingTypeStats: farmingTypeStats.rows,
      farmerSummaryStats: farmerSummaryStats.rows[0],
      totalRegistrantsStats: totalRegistrantsStats.rows[0]
    }

  } catch (error) {
    console.error('Database query error:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Test database connection
 * Useful for health checks and debugging
 */
export async function testConnection(): Promise<boolean> {
  try {
    // Fail fast if connect hangs beyond the configured timeout
    const client = await pool.connect()
    await client.query('SELECT NOW()')
    client.release()
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}

/**
 * Close the database connection pool
 * Should be called when the application shuts down
 */
export async function closePool(): Promise<void> {
  await pool.end()
}

/**
 * Utility function to get all available regions
 * Raw SQL query for actual regions in database
 */
export async function fetchRegions() {
  const client = await pool.connect()
  try {
    const query = `
      SELECT DISTINCT
        reg.id,
        reg.name,
        COALESCE(reg.code, reg.name) as code,
        COUNT(rp.id) as registrant_count
      FROM g2p_region reg
      LEFT JOIN res_partner rp ON rp.region = reg.id AND rp.is_registrant = true AND rp.active = true
      GROUP BY reg.id, reg.name, reg.code
      ORDER BY registrant_count DESC, reg.name
    `
    const result = await client.query(query)
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * Utility function to get all available record statuses
 * Since occupation data is mostly null, use record status instead
 */
export async function fetchRecordStatuses() {
  const client = await pool.connect()
  try {
    const query = `
      SELECT DISTINCT
        rp.imported_record_state as status,
        COUNT(*) as count
      FROM res_partner rp
      WHERE rp.is_registrant = true
        AND rp.active = true
        AND rp.imported_record_state IS NOT NULL
        AND rp.imported_record_state != ''
      GROUP BY rp.imported_record_state
      ORDER BY count DESC, rp.imported_record_state
    `
    const result = await client.query(query)
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * Distinct farming types recorded against farmers, used to populate the
 * "Type of Farmer" filter with whatever labels the source registry holds.
 */
export async function fetchFarmerTypes() {
  const client = await pool.connect()
  try {
    const query = `
      SELECT
        TRIM(rp.farming_type) as farmer_type,
        COUNT(*) as count
      FROM res_partner rp
      WHERE rp.is_registrant = true
        AND rp.active = true
        AND rp.farming_type IS NOT NULL
        AND TRIM(rp.farming_type) != ''
      GROUP BY TRIM(rp.farming_type)
      ORDER BY count DESC, farmer_type
    `
    const result = await client.query(query)
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * Utility function to get zones for a specific region
 */
export async function fetchZones(regionId: number) {
  const client = await pool.connect()
  try {
    const query = `
      SELECT DISTINCT
        z.id,
        z.name,
        z.code,
        COUNT(rp.id) as registrant_count
      FROM g2p_zone z
      LEFT JOIN res_partner rp ON rp.zone = z.id AND rp.is_registrant = true AND rp.active = true
      WHERE z.region = $1
      GROUP BY z.id, z.name, z.code
      ORDER BY registrant_count DESC, z.name
    `
    const result = await client.query(query, [regionId])
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * Utility function to get woredas for a specific zone
 */
export async function fetchWoredas(zoneId: number) {
  const client = await pool.connect()
  try {
    const query = `
      SELECT DISTINCT
        w.id,
        w.name,
        w.code,
        COUNT(rp.id) as registrant_count
      FROM g2p_woreda w
      LEFT JOIN res_partner rp ON rp.woreda = w.id AND rp.is_registrant = true AND rp.active = true
      WHERE w.zone = $1
      GROUP BY w.id, w.name, w.code
      ORDER BY registrant_count DESC, w.name
    `
    const result = await client.query(query, [zoneId])
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * Utility function to get kebeles for a specific woreda
 */
export async function fetchKebeles(woredaId: number) {
  const client = await pool.connect()
  try {
    const query = `
      SELECT DISTINCT
        k.id,
        k.name,
        k.code,
        COUNT(rp.id) as registrant_count
      FROM g2p_kebele k
      LEFT JOIN res_partner rp ON rp.kebele = k.id AND rp.is_registrant = true AND rp.active = true
      WHERE k.woreda = $1
      GROUP BY k.id, k.name, k.code
      ORDER BY registrant_count DESC, k.name
    `
    const result = await client.query(query, [woredaId])
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * Legacy function for compatibility - returns record statuses as occupations
 */
export async function fetchOccupations() {
  const statuses = await fetchRecordStatuses()
  return statuses.map(s => s.status)
}

/**
 * Get data for a specific date range
 * Useful for time-based filtering
 */
export async function fetchDataByDateRange(startDate: Date, endDate: Date) {
  const client = await pool.connect()
  try {
    const query = `
      SELECT
        rp.id,
        rp.name,
        rp.gender,
        rp.occupation,
        rp.registration_date,
        rp.create_date,
        reg.name as region_name
      FROM res_partner rp
      LEFT JOIN g2p_region reg ON rp.region = reg.id
      WHERE rp.is_registrant = true
        AND rp.active = true
        AND (
          (rp.registration_date >= $1 AND rp.registration_date <= $2)
          OR
          (rp.registration_date IS NULL AND rp.create_date >= $1 AND rp.create_date <= $2)
        )
      ORDER BY COALESCE(rp.registration_date, rp.create_date) DESC
    `
    const result = await client.query(query, [startDate, endDate])
    return result.rows
  } finally {
    client.release()
  }
}
