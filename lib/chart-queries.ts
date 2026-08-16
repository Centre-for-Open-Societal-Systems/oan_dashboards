// lib/chart-queries.ts

export interface ChartFilters {
  region?: string;
  recordState?: string;
  zone?: string;
  woreda?: string;
  kebele?: string;
  farmingType?: string;
  farmerType?: string;
  sector?: string;
  dateFrom?: string;
  dateTo?: string;
  timePeriod?: string;
  /** A2C only: id of the credit provider (bank) to narrow the dashboard to. */
  provider?: string;
}

export interface ChartQueryResult {
  success: boolean;
  data: any[];
  error?: string | null;
  executionTime?: number;
}

// Every A2C panel is built on this scope so that one provider or location
// selection narrows the whole dashboard the same way. A2C stores HDX P-codes
// directly rather than g2p ids, so it gets its own placeholders that the API
// fills with the raw codes; with nothing selected both collapse to empty and
// the scope is the full programme.
//
// Filtering the base tables once here also keeps the panel queries free of
// filter plumbing — they just read from the scoped_* views below.
const A2C_SCOPE = `
  WITH scoped_farmer AS (
    SELECT *
    FROM a2c_farmer
    WHERE TRUE
      --- A2C_GEO_FILTERS ---
  ),
  scoped_provider AS (
    SELECT *
    FROM a2c_credit_provider
    WHERE TRUE
      --- A2C_PROVIDER_FILTERS ---
  ),
  scoped_consent AS (
    SELECT c.*
    FROM a2c_consent_request c
    JOIN scoped_farmer f ON f.farmer_ref = c.farmer_ref
    JOIN scoped_provider p ON p.id = c.provider_id
  ),
  scoped_application AS (
    SELECT a.*
    FROM a2c_loan_application a
    JOIN scoped_farmer f ON f.farmer_ref = a.farmer_ref
    JOIN scoped_provider p ON p.id = a.provider_id
  ),
  scoped_share AS (
    SELECT s.*
    FROM a2c_registry_data_share s
    JOIN scoped_application a ON a.id = s.application_id
  )
`

// Base SQL queries for each chart.
// The API route will replace '--- DYNAMIC_FILTERS ---' with an appropriate
// parameterized 'AND ...' clause if filters are applied.
export const CHART_QUERIES: { [key: string]: string } = {
  // === Farmer Dashboard Charts ===
  farmersByZone: `
    SELECT
      COALESCE(z.name, 'Unknown') as zone,
      z.code as zone_code,
      COUNT(DISTINCT rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_zone z ON rp.zone = z.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY z.name, z.code
    ORDER BY farmers DESC
  `,

  farmersByWoreda: `
    SELECT
      COALESCE(w.name, 'Unknown') as woreda,
      w.code as woreda_code,
      COUNT(DISTINCT rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_woreda w ON rp.woreda = w.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY w.name, w.code
    ORDER BY farmers DESC
  `,

  farmersByKebele: `
    SELECT
      COALESCE(k.name, 'Unknown') as kebele,
      k.code as kebele_code,
      COUNT(DISTINCT rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_kebele k ON rp.kebele = k.id
    LEFT JOIN g2p_woreda w ON k.woreda = w.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY k.name, k.code
    ORDER BY farmers DESC
  `,

  householdIncomeSources: `
    SELECT
      COALESCE(inc.name, 'Unknown') as income_source,
      inc.code as income_code,
      COUNT(DISTINCT rpr.res_partner_id) as farmers
    FROM g2p_hh_income_res_partner_rel rpr
    JOIN g2p_hh_income inc ON inc.id = rpr.g2p_hh_income_id
    JOIN res_partner rp ON rp.id = rpr.res_partner_id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY inc.name, inc.code
    ORDER BY farmers DESC
  `,

  farmersByRegion: `
    SELECT
      COALESCE(reg.name, 'Unknown') as region,
      reg.code as region_code,
      COUNT(DISTINCT rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY reg.name, reg.code
    ORDER BY farmers DESC
  `,

  farmersByGender: `
    SELECT
      COALESCE(rp.gender, 'Unknown') as gender,
      COUNT(rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
    GROUP BY rp.gender
    ORDER BY farmers DESC
  `,

  farmersByType: `
   SELECT
      COALESCE(rp.farming_type, 'Unknown') as farming_type,
      COUNT(DISTINCT rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY rp.farming_type
    ORDER BY farmers DESC
  `,

  farmersByAge: `
    SELECT
      CASE
        WHEN rp.age_int < 30 THEN 'Under 30'
        WHEN rp.age_int BETWEEN 30 AND 50 THEN '30-50'
        WHEN rp.age_int BETWEEN 51 AND 65 THEN '51-65'
        WHEN rp.age_int > 65 THEN 'Over 65'
        ELSE 'Unknown'
      END as age_group,
      COALESCE(rp.gender, 'Unknown') as gender,
      COUNT(rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
    GROUP BY age_group, rp.gender
    ORDER BY
      CASE age_group
        WHEN 'Under 30' THEN 1
        WHEN '30-50' THEN 2
        WHEN '51-65' THEN 3
        WHEN 'Over 65' THEN 4
        ELSE 5
      END
  `,


  farmerKpis: `
  WITH partners AS (
      SELECT DISTINCT rp.id, rp.gender, rp.hh_is_household_head, rp.total_land_area, rp.total_land_owned_area
      FROM res_partner rp
      WHERE rp.is_farmer = 'yes'
        AND rp.is_registrant = TRUE
        AND rp.is_group = FALSE
        AND rp.active = TRUE
        --- DYNAMIC_FILTERS ---
  ),
  uids AS (
      SELECT DISTINCT r.partner_id
      FROM g2p_reg_id r
      JOIN g2p_id_type t ON r.id_type = t.id AND t.name = 'UID'
  )
  SELECT
      COUNT(*) AS total_farmers,
      SUM(CASE WHEN LOWER(gender) = 'female' THEN 1 ELSE 0 END) AS female_farmers,
      SUM(CASE WHEN LOWER(gender) = 'male' THEN 1 ELSE 0 END) AS male_farmers,
      COALESCE(SUM(total_land_area), 0) AS total_land_size,
      COALESCE(AVG(total_land_area), 0) AS avg_farm_size,
      SUM(CASE WHEN LOWER(hh_is_household_head) = 'yes' THEN 1 ELSE 0 END) AS household_heads,
      SUM(CASE WHEN total_land_owned_area > 0 THEN 1 ELSE 0 END) AS farmers_with_owned_land,
      COUNT(DISTINCT CASE WHEN id IN (SELECT partner_id FROM uids) THEN id END) AS farmers_with_id,
      COUNT(*) - COUNT(DISTINCT CASE WHEN id IN (SELECT partner_id FROM uids) THEN id END) AS farmers_without_id
  FROM partners;
`,

  farmersByImportStatus: `
    SELECT
      CASE 
        WHEN LOWER(rp.db_import) = 'yes' THEN 'Imported'
        ELSE 'Not Imported'
      END as import_status,
      COUNT(DISTINCT rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY import_status
    ORDER BY farmers DESC
  `,

  farmersByFarmerId: `
    SELECT
      CASE 
        WHEN rp.farmer_id IS NOT NULL AND rp.farmer_id != '' THEN 'With Farmer ID'
        ELSE 'Without Farmer ID'
      END as id_status,
      COUNT(DISTINCT rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY id_status
    ORDER BY farmers DESC
  `,

  farmersByEducation: `
    SELECT
      COALESCE(rp.education, 'Unknown') as education,
      COUNT(DISTINCT rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY rp.education
    ORDER BY farmers DESC
  `,

  farmersByAgeAndGender: `
    SELECT
      age_group,
      gender,
      COUNT(*) as farmers
    FROM (
      SELECT
        CASE
          WHEN rp.age_int < 18 THEN '0-18'
          WHEN rp.age_int >= 18 AND rp.age_int < 30 THEN '18-30'
          WHEN rp.age_int >= 30 AND rp.age_int < 50 THEN '30-50'
          WHEN rp.age_int >= 50 AND rp.age_int < 70 THEN '50-70'
          WHEN rp.age_int >= 70 THEN '70+'
          ELSE 'Unknown'
        END as age_group,
        COALESCE(rp.gender, 'Unknown') as gender,
        rp.id
      FROM res_partner rp
      LEFT JOIN g2p_region reg ON rp.region = reg.id
      WHERE rp.is_farmer = 'yes'
        AND rp.is_registrant = TRUE
        AND rp.is_GROUP = FALSE
        --- DYNAMIC_FILTERS ---
    ) subquery
    GROUP BY age_group, gender
    ORDER BY
      CASE age_group
        WHEN '0-18' THEN 1
        WHEN '18-30' THEN 2
        WHEN '30-50' THEN 3
        WHEN '50-70' THEN 4
        WHEN '70+' THEN 5
        ELSE 6
      END,
      gender
  `,


  // farmerKpis: `
  //     SELECT
  //     COUNT(DISTINCT rp.id) as total_farmers,
  //     COUNT( CASE WHEN rp.gender = 'female' THEN 1 END) as female_farmers,
  //     COUNT( CASE WHEN rp.gender = 'male' THEN 1 END) as male_farmers,
  //     COALESCE(SUM(rp.total_land_area), 0) as total_land_size,
  //     COALESCE(AVG(rp.total_land_area), 0) as avg_farm_size,
  //     COUNT(CASE WHEN rp.hh_is_household_head = 'yes' THEN 1 END) as household_heads,
  //     COUNT( CASE WHEN rp.total_land_owned_area > 0 THEN 1 END) as farmers_with_owned_land,
  //     COUNT(DISTINCT CASE WHEN t.name = 'UID' THEN rp.id END) as farmers_with_id,
  //     COUNT(rp.id) - COUNT(DISTINCT CASE WHEN t.name = 'UID' THEN rp.id END) as farmers_without_id
  //   FROM
  //     res_partner rp
  //   LEFT JOIN
  //     g2p_reg_id r ON r.partner_id = rp.id
  //   LEFT JOIN
  //     g2p_id_type t ON r.id_type = t.id AND t.name = 'UID'
  //   WHERE
  //     rp.is_farmer = 'yes'
  //     AND rp.is_registrant = TRUE
  //     AND rp.is_group = FALSE
  //     AND rp.active = TRUE
  //     --- DYNAMIC_FILTERS ---
  // `,

  // === Land Charts ===
  landOwnershipDistribution: `
    SELECT
      li.ownership_type,
      COUNT(li.id) as farmers,
      SUM(li.total_land_area) as total_area
    FROM g2p_land_information li
    LEFT JOIN res_partner rp ON li.partner_id = rp.id
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      --- DYNAMIC_FILTERS ---
    GROUP BY li.ownership_type
    ORDER BY farmers DESC
  `,

  landAreaByRegion: `
    SELECT
      reg.name as region,
      reg.code as region_code,
      COALESCE(SUM(COALESCE(li.total_land_area, rp.total_land_area)), 0) as total_land_area,
      COALESCE(AVG(COALESCE(li.total_land_area, rp.total_land_area)), 0) as avg_land_area,
      COUNT(DISTINCT li.partner_id) as farmers_with_land
    FROM g2p_region reg
    LEFT JOIN res_partner rp ON rp.region = reg.id AND rp.is_registrant = true AND rp.active = true
    LEFT JOIN g2p_land_information li ON li.partner_id = rp.id
    WHERE 1=1 -- Dummy WHERE to allow safe appending of AND clauses
      --- DYNAMIC_FILTERS ---
    GROUP BY reg.name, reg.code
    HAVING COALESCE(SUM(li.total_land_area), 0) > 0
    ORDER BY total_land_area DESC
  `,

  landStats: `
    SELECT
      COALESCE(SUM(rp.total_land_area), 0) as total_land_area,
      COALESCE(AVG(rp.total_land_area), 0) as avg_land_area,
      (SELECT count(*) FROM g2p_land_information) as total_lands,
      COUNT(CASE WHEN rp.total_land_owned_area > 0 THEN 1 END) as total_land_ownership
    FROM res_partner rp
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      --- DYNAMIC_FILTERS ---
  `,

  // === Demography Charts ===
  registrantsByRegion: `
    SELECT
      reg.name as region,
      COUNT(rp.id) as registrants
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      --- DYNAMIC_FILTERS ---
    GROUP BY reg.name, reg.code
    ORDER BY registrants DESC
  `,

  registrantsByGender: `
    SELECT
      COALESCE(rp.gender, 'Unknown') as gender,
      COUNT(rp.id) as registrants
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      --- DYNAMIC_FILTERS ---
    GROUP BY rp.gender
    ORDER BY registrants DESC
  `,

  // === Missing Chart Queries ===
  demographyStats: `
    SELECT
      COUNT(DISTINCT rp.region) as total_regions,
      COUNT(DISTINCT rp.woreda) as total_woredas,
      COUNT(DISTINCT rp.kebele) as total_kebeles,
      COUNT(rp.id) as total_farmers
    FROM res_partner rp
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      --- DYNAMIC_FILTERS ---
  `,

  farmerPopulationByRegion: `
    SELECT
      COALESCE(reg.name, 'Unknown') as region,
      reg.code as region_code,
      COUNT(rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_GROUP = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY reg.name, reg.code
    ORDER BY farmers DESC
    LIMIT 10
  `,

  genderByRegion: `
    SELECT
      COALESCE(reg.name, 'Unknown') as region,
      reg.code as region_code,
      CASE
        WHEN LOWER(COALESCE(rp.gender, '')) = 'female' THEN 'Female'
        WHEN LOWER(COALESCE(rp.gender, '')) = 'male' THEN 'Male'
        ELSE 'Unknown'
      END as gender,
      COUNT(rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
    GROUP BY reg.name, reg.code,
      CASE
        WHEN LOWER(COALESCE(rp.gender, '')) = 'female' THEN 'Female'
        WHEN LOWER(COALESCE(rp.gender, '')) = 'male' THEN 'Male'
        ELSE 'Unknown'
      END
    ORDER BY region, gender
  `,



  // === Socio-Economic Chart Queries ===
  socioEconomicKpis: `
    SELECT
      COUNT(CASE WHEN rp.gender = 'female' THEN 1 END) as total_female_farmers,
      COUNT(CASE WHEN rp.gender = 'male' THEN 1 END) as total_male_farmers,
      COUNT(DISTINCT CASE WHEN m.individual IS NOT NULL AND rp.gender = 'female' THEN m.individual END) as female_farmers_in_household,
      COUNT(DISTINCT CASE WHEN m.individual IS NOT NULL AND rp.gender = 'male' THEN m.individual END) as male_farmers_in_household,
      COUNT(CASE WHEN rp.hh_is_household_head = 'yes' THEN 1 END) as total_household_heads,
      COUNT(CASE WHEN rp.hh_is_household_head = 'yes' AND rp.gender = 'male' THEN 1 END) as male_household_heads,
      COUNT(CASE WHEN rp.hh_is_household_head = 'yes' AND rp.gender = 'female' THEN 1 END) as female_household_heads
    FROM res_partner rp
    LEFT JOIN g2p_group_membership m ON m.individual = rp.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      --- DYNAMIC_FILTERS ---
  `,

  farmersByPsnpStatus: `
    SELECT
      CASE 
        WHEN rp.is_psnp_user = TRUE THEN 'PSNP User'
        ELSE 'Non-PSNP'
      END as psnp_status,
      COUNT(DISTINCT rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      --- DYNAMIC_FILTERS ---
    GROUP BY psnp_status
    ORDER BY farmers DESC
  `,

  householdStatusByGenderRegion: `
    SELECT
      reg.name as region,
      COALESCE(rp.gender, 'Unknown') as gender,
      CASE
        WHEN gm.status = 'Head' THEN 'Head'
        WHEN gm.status = 'Wife' THEN 'Wife'
        WHEN gm.status = 'Husband' THEN 'Husband'
        WHEN gm.status IS NOT NULL THEN 'Member'
        ELSE 'No Group'
      END as household_status,
      COUNT(rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    LEFT JOIN g2p_group_membership gm ON rp.id = gm.individual
    WHERE rp.is_registrant = true
      AND rp.active = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
    GROUP BY reg.name, rp.gender, household_status
    ORDER BY region, gender, household_status
  `,

  farmersByAgeGroupGenderRegion: `
    SELECT
      reg.name as region,
      COALESCE(rp.gender, 'Unknown') as gender,
      CASE
        WHEN rp.age_int < 30 THEN 'Under 30'
        WHEN rp.age_int BETWEEN 30 AND 50 THEN '30-50'
        WHEN rp.age_int BETWEEN 51 AND 65 THEN '51-65'
        WHEN rp.age_int > 65 THEN 'Over 65'
        ELSE 'Unknown'
      END as age_group,
      COUNT(rp.id) as farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
    GROUP BY reg.name, rp.gender, age_group
    ORDER BY region, gender, age_group
  `,

  // === Gender and Household Charts ===
  femaleFarmersByRegion: `
    SELECT
      reg.name as region,
      COUNT(CASE WHEN rp.gender = 'female' THEN 1 END) as female_farmers,
      COUNT(CASE WHEN rp.gender = 'male' THEN 1 END) as male_farmers,
      COUNT(rp.id) as total_farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
    GROUP BY reg.name, reg.code
    ORDER BY female_farmers DESC
  `,

  femaleHouseholdHeads: `
    SELECT
      reg.name as region,
      COUNT(CASE WHEN rp.gender = 'female' AND rp.hh_is_household_head = 'yes' THEN 1 END) as female_household_heads,
      COUNT(CASE WHEN rp.gender = 'male' AND rp.hh_is_household_head = 'yes' THEN 1 END) as male_household_heads,
      COUNT(CASE WHEN rp.hh_is_household_head = 'yes' THEN 1 END) as total_household_heads
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      --- DYNAMIC_FILTERS ---
    GROUP BY reg.name, reg.code
    ORDER BY female_household_heads DESC
  `,

  genderDistributionByFarmingType: `
    SELECT
      COALESCE(rp.farming_type, 'Unknown') as farming_type,
      COUNT(CASE WHEN rp.gender = 'female' THEN 1 END) as female_farmers,
      COUNT(CASE WHEN rp.gender = 'male' THEN 1 END) as male_farmers,
      COUNT(rp.id) as total_farmers
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
    GROUP BY rp.farming_type
    ORDER BY female_farmers DESC
  `,





  // === Land Information Charts ===
  landInfoStats: `
    SELECT
      COUNT(li.id) as total_land_parcels,
      COALESCE(SUM(li.total_land_area), 0) as total_land_area,
      COALESCE(AVG(li.total_land_area), 0) as avg_land_area,
      COUNT(CASE WHEN li.ownership_type = 'owner' THEN 1 END) as owned_parcels,
      COUNT(CASE WHEN li.ownership_type = 'rented' THEN 1 END) as rented_parcels,
      COUNT(CASE WHEN li.ownership_type = 'shared' THEN 1 END) as shared_parcels
    FROM g2p_land_information li
    LEFT JOIN res_partner rp ON li.partner_id = rp.id
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
  `,

  // landAreaByRegion: `
  //   SELECT
  //     reg.name as region,
  //     COALESCE(SUM(li.total_land_area), 0) as total_land_area,
  //     COALESCE(AVG(li.total_land_area), 0) as avg_land_area,
  //     COUNT(li.id) as land_parcels,
  //     COUNT(CASE WHEN li.ownership_type = 'owner' THEN 1 END) as owned_parcels,
  //     COUNT(CASE WHEN li.ownership_type = 'rented' THEN 1 END) as rented_parcels
  //   FROM g2p_land_information li
  //   LEFT JOIN res_partner rp ON li.partner_id = rp.id
  //   LEFT JOIN g2p_region reg ON rp.region = reg.id
  //   WHERE rp.is_registrant = true
  //     AND rp.active = true
  //     AND rp.is_farmer = 'yes'
  //     --- DYNAMIC_FILTERS ---
  //   GROUP BY reg.name, reg.code
  //   ORDER BY total_land_area DESC
  // `,

  landOwnershipByType: `
    SELECT
      COALESCE(li.ownership_type, 'Unknown') as ownership_type,
      COUNT(li.id) as land_parcels,
      COALESCE(SUM(li.total_land_area), 0) as total_area,
      COALESCE(AVG(li.total_land_area), 0) as avg_area
    FROM g2p_land_information li
    LEFT JOIN res_partner rp ON li.partner_id = rp.id
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
    GROUP BY li.ownership_type
    ORDER BY land_parcels DESC
  `,

  landAreaByGender: `
    SELECT
      COALESCE(rp.gender, 'Unknown') as gender,
      COUNT(li.id) as land_parcels,
      COALESCE(SUM(li.total_land_area), 0) as total_land_area,
      COALESCE(AVG(li.total_land_area), 0) as avg_land_area
    FROM g2p_land_information li
    LEFT JOIN res_partner rp ON li.partner_id = rp.id
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_registrant = true
      AND rp.active = true
      AND rp.is_farmer = 'yes'
      --- DYNAMIC_FILTERS ---
    GROUP BY rp.gender
    ORDER BY total_land_area DESC
  `,

  // ===================================================================
  // === Crop Sown Registry ============================================
  // ===================================================================

  cropKpis: `
    WITH crop_farmers AS (
      SELECT DISTINCT
        rp.id,
        rp.total_land_area,
        rp.total_land_owned_area,
        rp.primary_commodity_name,
        rp.woreda
      FROM res_partner rp
      WHERE rp.is_farmer = 'yes'
        AND rp.is_registrant = TRUE
        AND rp.is_group = FALSE
        AND rp.active = TRUE
        --- DYNAMIC_FILTERS ---
    )
    SELECT
      COALESCE(SUM(total_land_area), 0) AS total_area,
      COALESCE(SUM(total_land_owned_area), 0) AS owned_area,
      COUNT(*) AS farmers,
      COUNT(DISTINCT NULLIF(TRIM(COALESCE(primary_commodity_name, '')), '')) AS crop_types,
      COUNT(DISTINCT woreda) AS woredas_reporting,
      COALESCE(AVG(NULLIF(total_land_area, 0)), 0) AS avg_plot_size
    FROM crop_farmers
  `,

  cropAreaByCrop: `
    SELECT
      COALESCE(NULLIF(TRIM(rp.primary_commodity_name), ''), 'Unspecified') AS crop,
      COALESCE(SUM(rp.total_land_area), 0) AS area,
      COUNT(DISTINCT rp.id) AS farmers
    FROM res_partner rp
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      AND NULLIF(TRIM(COALESCE(rp.primary_commodity_name, '')), '') IS NOT NULL
      --- DYNAMIC_FILTERS ---
    GROUP BY 1
    HAVING COALESCE(SUM(rp.total_land_area), 0) > 0
    ORDER BY area DESC
  `,

  // The map keys off a numeric "farmers" column, so hectares ride in under that name.
  cropAreaByRegion: `
    SELECT
      COALESCE(reg.name, 'Unknown') AS region,
      reg.code AS region_code,
      ROUND(COALESCE(SUM(rp.total_land_area), 0))::bigint AS farmers,
      COUNT(DISTINCT rp.id) AS farmer_count
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      --- DYNAMIC_FILTERS ---
    GROUP BY reg.name, reg.code
    ORDER BY farmers DESC
  `,

  cropAreaByZone: `
    SELECT
      COALESCE(z.name, 'Unknown') AS zone,
      z.code AS zone_code,
      ROUND(COALESCE(SUM(rp.total_land_area), 0))::bigint AS farmers,
      COUNT(DISTINCT rp.id) AS farmer_count
    FROM res_partner rp
    LEFT JOIN g2p_zone z ON rp.zone = z.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      --- DYNAMIC_FILTERS ---
    GROUP BY z.name, z.code
    ORDER BY farmers DESC
  `,

  cropAreaByWoreda: `
    SELECT
      COALESCE(w.name, 'Unknown') AS woreda,
      w.code AS woreda_code,
      ROUND(COALESCE(SUM(rp.total_land_area), 0))::bigint AS farmers,
      COUNT(DISTINCT rp.id) AS farmer_count
    FROM res_partner rp
    LEFT JOIN g2p_woreda w ON rp.woreda = w.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      --- DYNAMIC_FILTERS ---
    GROUP BY w.name, w.code
    ORDER BY farmers DESC
  `,

  cropAreaByKebele: `
    SELECT
      COALESCE(k.name, 'Unknown') AS kebele,
      k.code AS kebele_code,
      ROUND(COALESCE(SUM(rp.total_land_area), 0))::bigint AS farmers,
      COUNT(DISTINCT rp.id) AS farmer_count
    FROM res_partner rp
    LEFT JOIN g2p_kebele k ON rp.kebele = k.id
    LEFT JOIN g2p_woreda w ON k.woreda = w.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      --- DYNAMIC_FILTERS ---
    GROUP BY k.name, k.code
    ORDER BY farmers DESC
  `,

  cropTopWoredas: `
    SELECT
      COALESCE(w.name, 'Unknown') AS woreda,
      w.code AS woreda_code,
      COALESCE(SUM(rp.total_land_area), 0) AS area,
      COUNT(DISTINCT rp.id) AS farmers
    FROM res_partner rp
    LEFT JOIN g2p_woreda w ON rp.woreda = w.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      AND rp.woreda IS NOT NULL
      --- DYNAMIC_FILTERS ---
    GROUP BY w.name, w.code
    HAVING COALESCE(SUM(rp.total_land_area), 0) > 0
    ORDER BY area DESC
    LIMIT 8
  `,

  // ===================================================================
  // === Livestock Registry ============================================
  // ===================================================================

  livestockKpis: `
    WITH livestock_farmers AS (
      SELECT DISTINCT
        rp.id,
        rp.gender,
        rp.hh_is_household_head,
        rp.total_land_area,
        rp.woreda
      FROM res_partner rp
      WHERE rp.is_farmer = 'yes'
        AND rp.is_registrant = TRUE
        AND rp.is_group = FALSE
        AND rp.active = TRUE
        --- DYNAMIC_FILTERS ---
    )
    SELECT
      COUNT(*) AS farmers,
      SUM(CASE WHEN LOWER(hh_is_household_head) = 'yes' THEN 1 ELSE 0 END) AS households,
      SUM(CASE WHEN LOWER(gender) = 'female' THEN 1 ELSE 0 END) AS female_farmers,
      COUNT(DISTINCT woreda) AS woredas_reporting,
      COALESCE(SUM(total_land_area), 0) AS total_area,
      (SELECT COUNT(*) FROM livestock_catalog) AS species_tracked,
      (SELECT COUNT(*) FROM livestock_breed) AS breeds_tracked
    FROM livestock_farmers
  `,

  // National CSA census reference data - deliberately unfiltered by geography.
  livestockBySpecies: `
    SELECT
      lc.name AS species,
      lp.species_code,
      lp.population_total AS population,
      lp.census_year,
      lc.chart_color
    FROM livestock_population lp
    JOIN livestock_catalog lc ON lc.species_code = lp.species_code
    WHERE lp.census_year = (SELECT MAX(census_year) FROM livestock_population)
    ORDER BY lp.population_total DESC
  `,

  livestockPopulationTrend: `
    SELECT
      lp.census_year,
      SUM(lp.population_total) AS population
    FROM livestock_population lp
    GROUP BY lp.census_year
    ORDER BY lp.census_year
  `,

  livestockTopWoredas: `
    SELECT
      COALESCE(w.name, 'Unknown') AS woreda,
      w.code AS woreda_code,
      COUNT(DISTINCT rp.id) AS farmers
    FROM res_partner rp
    LEFT JOIN g2p_woreda w ON rp.woreda = w.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      AND rp.woreda IS NOT NULL
      --- DYNAMIC_FILTERS ---
    GROUP BY w.name, w.code
    HAVING COUNT(DISTINCT rp.id) > 0
    ORDER BY farmers DESC
    LIMIT 8
  `,

  // ===================================================================
  // === Shared registry panels ========================================
  // ===================================================================

  landTenureSplit: `
    SELECT
      INITCAP(COALESCE(NULLIF(TRIM(li.ownership_type), ''), 'unknown')) AS ownership_type,
      COUNT(li.id) AS parcels,
      COALESCE(SUM(li.total_land_area), 0) AS area
    FROM g2p_land_information li
    JOIN res_partner rp ON li.partner_id = rp.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      --- DYNAMIC_FILTERS ---
    GROUP BY 1
    ORDER BY parcels DESC
  `,

  farmersByRecordState: `
    SELECT
      COALESCE(NULLIF(TRIM(rp.state), ''), 'unknown') AS record_state,
      COUNT(DISTINCT rp.id) AS farmers
    FROM res_partner rp
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      --- DYNAMIC_FILTERS ---
    GROUP BY 1
    ORDER BY farmers DESC
  `,

  recentRegistrations: `
    SELECT
      COALESCE(NULLIF(TRIM(rp.farmer_id), ''), 'FP-' || rp.id::text) AS farmer_ref,
      COALESCE(reg.name, 'Unknown') AS region,
      COALESCE(w.name, 'Unknown') AS woreda,
      TO_CHAR(rp.registration_date, 'DD Mon') AS registered_on,
      COALESCE(NULLIF(TRIM(rp.farming_type), ''), 'Unknown') AS farming_type,
      COALESCE(NULLIF(TRIM(rp.state), ''), 'unknown') AS record_state
    FROM res_partner rp
    LEFT JOIN g2p_region reg ON rp.region = reg.id
    LEFT JOIN g2p_woreda w ON rp.woreda = w.id
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      AND rp.registration_date IS NOT NULL
      --- DYNAMIC_FILTERS ---
    ORDER BY rp.registration_date DESC, rp.id DESC
    LIMIT 6
  `,

  // Registered administrative units against the national totals, for coverage rates.
  registryCoverage: `
    SELECT
      COUNT(DISTINCT rp.region) AS regions_covered,
      COUNT(DISTINCT rp.zone) AS zones_covered,
      COUNT(DISTINCT rp.woreda) AS woredas_covered,
      COUNT(DISTINCT rp.kebele) AS kebeles_covered,
      (SELECT COUNT(*) FROM g2p_region) AS regions_total,
      (SELECT COUNT(*) FROM g2p_zone) AS zones_total,
      (SELECT COUNT(*) FROM g2p_woreda) AS woredas_total,
      (SELECT COUNT(*) FROM g2p_kebele) AS kebeles_total
    FROM res_partner rp
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      --- DYNAMIC_FILTERS ---
  `,

  registryTrendByMonth: `
    SELECT
      TO_CHAR(DATE_TRUNC('month', rp.registration_date), 'YYYY-MM') AS period,
      COUNT(DISTINCT rp.id) AS farmers,
      COALESCE(SUM(rp.total_land_area), 0) AS total_area,
      COALESCE(SUM(rp.total_land_owned_area), 0) AS owned_area
    FROM res_partner rp
    WHERE rp.is_farmer = 'yes'
      AND rp.is_registrant = TRUE
      AND rp.is_group = FALSE
      AND rp.active = TRUE
      AND rp.registration_date IS NOT NULL
      --- DYNAMIC_FILTERS ---
    GROUP BY 1
    ORDER BY 1
  `,

  // ===================================================================
  // === Catalogs dashboard ============================================
  // ===================================================================
  // National reference data. These carry no DYNAMIC_FILTERS placeholder,
  // so the geography/farmer filters never apply to them.

  catalogKpis: `
    SELECT
      (SELECT COUNT(*) FROM crop_catalog) AS crops,
      (SELECT COUNT(*) FROM crop_variety) AS varieties,
      (SELECT COUNT(*) FROM crop_category) AS crop_categories,
      (SELECT COUNT(*) FROM ecological_zone) AS ecological_zones,
      (SELECT COUNT(*) FROM seed_catalog) AS seed_crops,
      (SELECT COUNT(DISTINCT budget_year) FROM seed_demand_trend) AS seed_years,
      (SELECT COALESCE(SUM(quantity_demanded), 0) FROM seed_demand_trend) AS seed_demand_quantity,
      (SELECT COUNT(*) FROM livestock_catalog) AS species,
      (SELECT COUNT(*) FROM livestock_breed) AS breeds,
      (SELECT COUNT(*) FROM livestock_registry_entry) AS livestock_records,
      (SELECT COUNT(*) FROM eth_regions) AS regions,
      (SELECT COUNT(*) FROM eth_zones) AS zones,
      (SELECT COUNT(*) FROM eth_woredas) AS woredas
  `,

  // One row per connected registry. "Connected" means the tables backing that
  // registry are present and populated; faults are live referential checks.
  catalogRegistrySources: `
    SELECT
      1 AS sort_order,
      'crop' AS registry_key,
      'Crop Catalog' AS registry,
      'Ethio-Seed (MOA)' AS upstream,
      (SELECT COUNT(*) FROM crop_catalog)
        + (SELECT COUNT(*) FROM crop_variety)
        + (SELECT COUNT(*) FROM crop_category)
        + (SELECT COUNT(*) FROM ecological_zone) AS records,
      (SELECT COUNT(*) FROM crop_catalog WHERE category_id IS NULL)
        + (SELECT COUNT(*) FROM crop_catalog WHERE preferred_ecological_zone_id IS NULL)
        + (SELECT COUNT(*) FROM crop_variety WHERE release_year IS NULL) AS faults,
      (SELECT COUNT(*) FROM crop_catalog)::text || ' crops · '
        || (SELECT COUNT(*) FROM crop_variety)::text || ' varieties' AS detail
    UNION ALL
    SELECT
      2,
      'seed',
      'Seed Catalog',
      'Ethio-Seed demand (MOA)',
      (SELECT COUNT(*) FROM seed_catalog)
        + (SELECT COUNT(*) FROM seed_demand_trend)
        + (SELECT COUNT(*) FROM seed_demand_trend_by_crop)
        + (SELECT COUNT(*) FROM seed_demand_summary),
      (SELECT COUNT(*) FROM seed_catalog s
        WHERE NOT EXISTS (SELECT 1 FROM seed_demand_trend_by_crop d WHERE d.crop_id = s.id)),
      (SELECT COUNT(*) FROM seed_catalog)::text || ' crops · '
        || (SELECT COUNT(DISTINCT budget_year) FROM seed_demand_trend)::text || ' budget years'
    UNION ALL
    SELECT
      3,
      'livestock',
      'Livestock Catalog',
      'LIS (MOA)',
      (SELECT COUNT(*) FROM livestock_catalog)
        + (SELECT COUNT(*) FROM livestock_breed)
        + (SELECT COUNT(*) FROM livestock_population),
      (SELECT COUNT(*) FROM livestock_catalog WHERE in_etlits_registry AND NOT in_lis_population)
        + (SELECT COUNT(*) FROM livestock_breed WHERE NOT in_national_standard),
      (SELECT COUNT(*) FROM livestock_catalog)::text || ' species · '
        || (SELECT COUNT(*) FROM livestock_breed)::text || ' breeds'
    UNION ALL
    SELECT
      4,
      'etlits',
      'Livestock Registry',
      'ET-LITS (MOA)',
      (SELECT COUNT(*) FROM livestock_registry_entry),
      (SELECT COUNT(*) FROM livestock_registry_entry WHERE breed_id IS NULL)
        + (SELECT COUNT(*) FROM livestock_registry_entry e
             JOIN livestock_breed b ON b.id = e.breed_id
            WHERE b.species_code <> e.species_code)
        + (SELECT COUNT(*) FROM livestock_registry_entry e
            WHERE NOT EXISTS (SELECT 1 FROM livestock_production_type_species s
                               WHERE s.species_code = e.species_code
                                 AND s.production_type_code = e.production_type_code)),
      (SELECT COUNT(*) FROM livestock_registry_entry WHERE status = 'ACTIVE')::text
        || ' active of ' || (SELECT COUNT(*) FROM livestock_registry_entry)::text || ' records'
    UNION ALL
    SELECT
      5,
      'location',
      'Location Catalog',
      'OCHA / HDX 2021',
      (SELECT COUNT(*) FROM eth_regions)
        + (SELECT COUNT(*) FROM eth_zones)
        + (SELECT COUNT(*) FROM eth_woredas),
      (SELECT COUNT(*) FROM eth_zones z
        WHERE NOT EXISTS (SELECT 1 FROM eth_regions r WHERE r."admin1Name" = z."admin1Name"))
        + (SELECT COUNT(*) FROM eth_woredas w
            WHERE NOT EXISTS (SELECT 1 FROM eth_regions r WHERE r."admin1Name" = w."admin1Name")),
      (SELECT COUNT(*) FROM eth_regions)::text || ' regions · '
        || (SELECT COUNT(*) FROM eth_woredas)::text || ' woredas'
    UNION ALL
    SELECT
      6,
      'farmer',
      'Farmer Registry',
      'OpenG2P',
      (SELECT COUNT(*) FROM res_partner
        WHERE is_farmer = 'yes' AND is_registrant = TRUE AND is_group = FALSE),
      (SELECT COUNT(*) FROM res_partner
        WHERE is_farmer = 'yes' AND is_registrant = TRUE AND is_group = FALSE
          AND (region IS NULL OR woreda IS NULL)),
      (SELECT COUNT(DISTINCT woreda) FROM res_partner
        WHERE is_farmer = 'yes' AND is_registrant = TRUE AND is_group = FALSE)::text || ' woredas reporting'
    ORDER BY sort_order
  `,

  // Live referential checks across the catalogs, one row per check.
  catalogIntegrationFaults: `
    SELECT 'Livestock Registry' AS source, 'Breed not resolved to the standard' AS fault,
           'danger' AS severity, COUNT(*) AS records
      FROM livestock_registry_entry WHERE breed_id IS NULL
    UNION ALL
    SELECT 'Livestock Registry', 'Breed does not match the record species', 'danger', COUNT(*)
      FROM livestock_registry_entry e
      JOIN livestock_breed b ON b.id = e.breed_id
     WHERE b.species_code <> e.species_code
    UNION ALL
    SELECT 'Livestock Registry', 'Production type invalid for species', 'danger', COUNT(*)
      FROM livestock_registry_entry e
     WHERE NOT EXISTS (SELECT 1 FROM livestock_production_type_species s
                        WHERE s.species_code = e.species_code
                          AND s.production_type_code = e.production_type_code)
    UNION ALL
    SELECT 'Location Catalog', 'Admin units with an unknown region name', 'danger',
           (SELECT COUNT(*) FROM eth_zones z
             WHERE NOT EXISTS (SELECT 1 FROM eth_regions r WHERE r."admin1Name" = z."admin1Name"))
         + (SELECT COUNT(*) FROM eth_woredas w
             WHERE NOT EXISTS (SELECT 1 FROM eth_regions r WHERE r."admin1Name" = w."admin1Name"))
    UNION ALL
    SELECT 'Crop Catalog', 'Crops with no category assigned', 'warning', COUNT(*)
      FROM crop_catalog WHERE category_id IS NULL
    UNION ALL
    SELECT 'Crop Catalog', 'Crops with no ecological zone', 'warning', COUNT(*)
      FROM crop_catalog WHERE preferred_ecological_zone_id IS NULL
    UNION ALL
    SELECT 'Crop Catalog', 'Varieties with no release year', 'warning', COUNT(*)
      FROM crop_variety WHERE release_year IS NULL
    UNION ALL
    SELECT 'Seed Catalog', 'Catalogued crops with no demand record', 'info', COUNT(*)
      FROM seed_catalog s
     WHERE NOT EXISTS (SELECT 1 FROM seed_demand_trend_by_crop d WHERE d.crop_id = s.id)
    UNION ALL
    SELECT 'Livestock Catalog', 'Species in ET-LITS but absent from LIS population', 'info', COUNT(*)
      FROM livestock_catalog WHERE in_etlits_registry AND NOT in_lis_population
    UNION ALL
    SELECT 'Livestock Catalog', 'Breeds outside the national standard', 'info', COUNT(*)
      FROM livestock_breed WHERE NOT in_national_standard
    ORDER BY records DESC
  `,

  // Upstream systems the catalogs are sourced from, derived from the source
  // and URL columns carried on the catalog records themselves.
  catalogExternalIntegrations: `
    SELECT
      1 AS sort_order,
      'Ethio-Seed Variety Service' AS system,
      'ethioseed.moa.gov.et' AS endpoint,
      'Crop varieties' AS domain,
      COUNT(*) FILTER (WHERE details_url IS NOT NULL) AS linked_records,
      COUNT(*) FILTER (WHERE details_url IS NULL) AS faults
    FROM crop_variety
    UNION ALL
    SELECT
      2,
      'LIS Species Reference',
      'lis.moa.gov.et',
      'Livestock species',
      COUNT(*) FILTER (WHERE icon_url IS NOT NULL),
      COUNT(*) FILTER (WHERE icon_url IS NULL)
    FROM livestock_catalog
    UNION ALL
    SELECT
      3,
      'ET-LITS Registry Feed',
      'et-lits.moa.gov.et',
      'Livestock records',
      (SELECT COUNT(*) FROM livestock_registry_entry),
      (SELECT COUNT(*) FROM livestock_registry_entry WHERE breed_id IS NULL)
    UNION ALL
    SELECT
      4,
      'National Livestock Data Standard',
      'MOA standard (2024)',
      'Breed reference',
      COUNT(*) FILTER (WHERE in_national_standard),
      COUNT(*) FILTER (WHERE NOT in_national_standard)
    FROM livestock_breed
    UNION ALL
    SELECT
      5,
      'OCHA / HDX Boundaries',
      'data.humdata.org',
      'Admin boundaries',
      (SELECT COUNT(*) FROM eth_regions)
        + (SELECT COUNT(*) FROM eth_zones)
        + (SELECT COUNT(*) FROM eth_woredas),
      (SELECT COUNT(*) FROM eth_zones z
        WHERE NOT EXISTS (SELECT 1 FROM eth_regions r WHERE r."admin1Name" = z."admin1Name"))
        + (SELECT COUNT(*) FROM eth_woredas w
            WHERE NOT EXISTS (SELECT 1 FROM eth_regions r WHERE r."admin1Name" = w."admin1Name"))
    ORDER BY sort_order
  `,

  catalogCropsByCategory: `
    SELECT
      COALESCE(cc.name, 'Uncategorised') AS category,
      COUNT(c.id) AS crops
    FROM crop_catalog c
    LEFT JOIN crop_category cc ON cc.id = c.category_id
    GROUP BY 1
    ORDER BY crops DESC
  `,

  catalogTopCropsByVariety: `
    SELECT
      COALESCE(c.name, v.crop_name) AS crop,
      COUNT(*) AS varieties
    FROM crop_variety v
    LEFT JOIN crop_catalog c ON c.id = v.crop_id
    GROUP BY 1
    ORDER BY varieties DESC
    LIMIT 8
  `,

  catalogVarietyTimeline: `
    SELECT
      release_year::text AS year,
      COUNT(*) AS varieties
    FROM crop_variety
    WHERE release_year BETWEEN 1950 AND 2100
    GROUP BY 1
    ORDER BY 1
  `,

  catalogVarietySource: `
    SELECT
      COALESCE(NULLIF(TRIM(source), ''), 'Unknown') AS source,
      COUNT(*) AS varieties
    FROM crop_variety
    GROUP BY 1
    ORDER BY varieties DESC
  `,

  catalogBreedsBySpecies: `
    SELECT
      lc.name AS species,
      b.breed_type,
      COUNT(*) AS breeds
    FROM livestock_breed b
    JOIN livestock_catalog lc ON lc.species_code = b.species_code
    GROUP BY 1, 2
    ORDER BY 1, 2
  `,

  catalogSeedDemandByClass: `
    SELECT
      budget_year,
      seed_class,
      quantity_demanded
    FROM seed_demand_trend
    ORDER BY budget_year, seed_class
  `,

  catalogSeedDemandByCrop: `
    SELECT
      crop_name,
      SUM(quantity_demanded) AS quantity
    FROM seed_demand_trend_by_crop
    GROUP BY 1
    ORDER BY quantity DESC
    LIMIT 6
  `,

  // Joined on P-code rather than name: the source sheets disagree on the
  // display name for the South / South West regions.
  catalogLocationHierarchy: `
    SELECT
      r."admin1Name" AS region,
      r."admin1Pcod" AS region_pcode,
      (SELECT COUNT(*) FROM eth_zones z WHERE z."admin1Pcod" = r."admin1Pcod") AS zones,
      (SELECT COUNT(*) FROM eth_woredas w WHERE w."admin1Pcod" = r."admin1Pcod") AS woredas
    FROM eth_regions r
    ORDER BY woredas DESC
  `,

  catalogLivestockRegistryStatus: `
    SELECT
      s.code AS status,
      s.name,
      s.sort_order,
      s.is_live_master_data,
      COUNT(e.id) AS records
    FROM livestock_record_status s
    LEFT JOIN livestock_registry_entry e ON e.status = s.code
    GROUP BY 1, 2, 3, 4
    ORDER BY s.sort_order
  `,

  // ===================================================================
  // === A2C (Access to Credit) dashboard ==============================
  // ===================================================================
  // Backed by data/a2c/*.sql (sample data — no live A2C feed yet). Each panel
  // reads from the A2C_SCOPE views above, so the credit provider and the
  // region/zone/woreda selection narrow every figure on the dashboard.

  a2cKpis: `
    ${A2C_SCOPE}
    SELECT
      (SELECT COUNT(*) FROM scoped_provider WHERE status = 'ACTIVE') AS providers_onboarded,
      (SELECT COUNT(*) FROM scoped_provider WHERE status = 'ONBOARDING') AS providers_onboarding,
      (SELECT COUNT(*) FROM scoped_provider) AS providers_total,
      (SELECT COUNT(*) FROM scoped_consent) AS consent_requests,
      (SELECT COUNT(*) FROM scoped_consent WHERE status = 'APPROVED') AS consents_approved,
      (SELECT COUNT(*) FROM scoped_consent WHERE status = 'PENDING') AS consents_pending,
      (SELECT COUNT(*) FROM scoped_consent WHERE status = 'DECLINED') AS consents_declined,
      (SELECT COUNT(*) FROM scoped_application) AS applications_total,
      (SELECT COUNT(*) FROM scoped_application WHERE status = 'IN_PROGRESS') AS applications_in_progress,
      (SELECT COUNT(*) FROM scoped_application WHERE status = 'APPROVED') AS loans_approved,
      (SELECT COUNT(*) FROM scoped_application WHERE status = 'DECLINED') AS loans_declined,
      (SELECT COUNT(*) FROM scoped_application WHERE status = 'PENDING') AS loans_pending,
      (SELECT COUNT(*) FROM scoped_share) AS data_shares_total,
      (SELECT COUNT(*) FROM scoped_share WHERE status = 'DELIVERED') AS data_shares_delivered,
      (SELECT COUNT(*) FROM scoped_share WHERE status = 'FAILED') AS data_shares_failed,
      (SELECT COUNT(*) FROM scoped_share WHERE status = 'PENDING') AS data_shares_pending,
      (SELECT COALESCE(SUM(record_count), 0) FROM scoped_share WHERE status = 'DELIVERED') AS records_shared,
      (SELECT COALESCE(SUM(amount_approved), 0) FROM scoped_application WHERE status = 'APPROVED') AS loan_value_approved,
      (SELECT COALESCE(SUM(amount_requested), 0) FROM scoped_application) AS loan_value_requested,
      (SELECT COUNT(*) FROM scoped_farmer) AS farmers_enrolled,
      (SELECT COUNT(DISTINCT farmer_ref) FROM scoped_application) AS farmers_with_application
  `,

  // Correlated subqueries rather than joins: joining consents and applications
  // in one pass would multiply the loan value by the consent count.
  a2cProviders: `
    ${A2C_SCOPE}
    SELECT
      p.short_name,
      p.name,
      p.provider_type,
      p.status,
      p.integration,
      p.onboarded_on,
      (SELECT COUNT(*) FROM scoped_consent c WHERE c.provider_id = p.id) AS consent_requests,
      (SELECT COUNT(*) FROM scoped_consent c WHERE c.provider_id = p.id AND c.status = 'APPROVED') AS consents_approved,
      (SELECT COUNT(*) FROM scoped_application a WHERE a.provider_id = p.id) AS applications,
      (SELECT COUNT(*) FROM scoped_application a WHERE a.provider_id = p.id AND a.status = 'APPROVED') AS loans_approved,
      (SELECT COALESCE(SUM(a.amount_approved), 0) FROM scoped_application a
        WHERE a.provider_id = p.id AND a.status = 'APPROVED') AS loan_value,
      (SELECT COUNT(*) FROM scoped_share s
         JOIN scoped_application a ON a.id = s.application_id
        WHERE a.provider_id = p.id AND s.status = 'FAILED') AS share_faults
    FROM scoped_provider p
    ORDER BY loan_value DESC, applications DESC, p.name
  `,

  // Map choropleth series. The map reads its metric from a column literally
  // named "farmers", so approved loan value (ETB) is aliased to it.
  a2cLoansByRegion: `
    ${A2C_SCOPE}
    SELECT
      f.region_name AS region,
      f.region_pcode AS region_code,
      COALESCE(SUM(a.amount_approved), 0) AS farmers
    FROM scoped_farmer f
    LEFT JOIN scoped_application a
      ON a.farmer_ref = f.farmer_ref AND a.status = 'APPROVED'
    GROUP BY 1, 2
    ORDER BY farmers DESC
  `,

  a2cLoansByZone: `
    ${A2C_SCOPE}
    SELECT
      f.zone_name AS zone,
      f.zone_pcode AS zone_code,
      COALESCE(SUM(a.amount_approved), 0) AS farmers
    FROM scoped_farmer f
    LEFT JOIN scoped_application a
      ON a.farmer_ref = f.farmer_ref AND a.status = 'APPROVED'
    GROUP BY 1, 2
    ORDER BY farmers DESC
  `,

  a2cLoansByWoreda: `
    ${A2C_SCOPE}
    SELECT
      f.woreda_name AS woreda,
      f.woreda_pcode AS woreda_code,
      COALESCE(SUM(a.amount_approved), 0) AS farmers
    FROM scoped_farmer f
    LEFT JOIN scoped_application a
      ON a.farmer_ref = f.farmer_ref AND a.status = 'APPROVED'
    GROUP BY 1, 2
    ORDER BY farmers DESC
  `,

  // A2C enrolment stops at woreda, but the map still asks for a kebele series
  // when it drills that far. Answer with an empty, correctly shaped result.
  a2cLoansByKebele: `
    SELECT NULL::text AS kebele, NULL::text AS kebele_code, 0 AS farmers
    WHERE FALSE
  `,

  a2cLocationSummary: `
    ${A2C_SCOPE}
    SELECT
      f.region_name AS region,
      f.zone_name AS zone,
      f.zone_pcode AS zone_code,
      f.woreda_name AS woreda,
      f.woreda_pcode AS woreda_code,
      COUNT(DISTINCT f.farmer_ref) AS farmers,
      COUNT(a.id) AS applications,
      COUNT(a.id) FILTER (WHERE a.status = 'APPROVED') AS loans_approved,
      COUNT(a.id) FILTER (WHERE a.status = 'IN_PROGRESS') AS applications_in_progress,
      COUNT(a.id) FILTER (WHERE a.status = 'PENDING') AS loans_pending,
      COUNT(a.id) FILTER (WHERE a.status = 'DECLINED') AS loans_declined,
      COALESCE(SUM(a.amount_approved), 0) AS loan_value
    FROM scoped_farmer f
    LEFT JOIN scoped_application a ON a.farmer_ref = f.farmer_ref
    GROUP BY 1, 2, 3, 4, 5
    ORDER BY farmers DESC
  `,

  a2cApplicationStatus: `
    ${A2C_SCOPE}
    SELECT
      status,
      COUNT(*) AS applications,
      COALESCE(SUM(amount_requested), 0) AS requested_value,
      COALESCE(SUM(amount_approved), 0) AS approved_value
    FROM scoped_application
    GROUP BY 1
    ORDER BY CASE status
      WHEN 'APPROVED' THEN 1
      WHEN 'IN_PROGRESS' THEN 2
      WHEN 'PENDING' THEN 3
      ELSE 4
    END
  `,

  a2cConsentStatus: `
    ${A2C_SCOPE}
    SELECT
      status,
      COUNT(*) AS requests
    FROM scoped_consent
    GROUP BY 1
    ORDER BY CASE status
      WHEN 'APPROVED' THEN 1
      WHEN 'PENDING' THEN 2
      ELSE 3
    END
  `,

  a2cLoanProducts: `
    ${A2C_SCOPE}
    SELECT
      product,
      COUNT(*) AS applications,
      COUNT(*) FILTER (WHERE status = 'APPROVED') AS loans_approved,
      COALESCE(SUM(amount_approved), 0) AS loan_value
    FROM scoped_application
    GROUP BY 1
    ORDER BY loan_value DESC
  `,

  a2cLoanTrend: `
    ${A2C_SCOPE}
    SELECT
      TO_CHAR(DATE_TRUNC('month', applied_on), 'Mon') AS month,
      DATE_TRUNC('month', applied_on) AS month_start,
      COUNT(*) AS applications,
      COUNT(*) FILTER (WHERE status = 'APPROVED') AS loans_approved,
      COALESCE(SUM(amount_approved), 0) AS loan_value
    FROM scoped_application
    GROUP BY 2
    ORDER BY 2
  `,

  a2cDataShares: `
    ${A2C_SCOPE}
    SELECT
      dataset,
      COUNT(*) AS shares,
      COUNT(*) FILTER (WHERE status = 'DELIVERED') AS delivered,
      COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
      COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
      COALESCE(SUM(record_count) FILTER (WHERE status = 'DELIVERED'), 0) AS records
    FROM scoped_share
    GROUP BY 1
    ORDER BY shares DESC, dataset
  `,

  // Failed payloads, grouped for the fault panel.
  a2cDataShareFaults: `
    ${A2C_SCOPE}
    SELECT
      s.fault_reason AS fault,
      p.short_name AS provider,
      s.dataset,
      COUNT(*) AS records,
      MAX(s.shared_on) AS last_seen
    FROM scoped_share s
    JOIN scoped_application a ON a.id = s.application_id
    JOIN scoped_provider p ON p.id = a.provider_id
    WHERE s.status = 'FAILED'
    GROUP BY 1, 2, 3
    ORDER BY records DESC, fault
  `,

  a2cDeclineReasons: `
    ${A2C_SCOPE}
    SELECT
      decline_reason AS reason,
      COUNT(*) AS applications,
      COALESCE(SUM(amount_requested), 0) AS requested_value
    FROM scoped_application
    WHERE status = 'DECLINED' AND decline_reason IS NOT NULL
    GROUP BY 1
    ORDER BY applications DESC, reason
  `,

  // --- A2C filter options -------------------------------------------
  // Deliberately unscoped: the dropdowns must keep offering every choice
  // regardless of what is currently selected.

  a2cFilterProviders: `
    SELECT
      p.id,
      p.short_name,
      p.name,
      p.status,
      (SELECT COUNT(*) FROM a2c_loan_application a WHERE a.provider_id = p.id) AS applications
    FROM a2c_credit_provider p
    ORDER BY
      CASE p.status WHEN 'ACTIVE' THEN 1 WHEN 'ONBOARDING' THEN 2 ELSE 3 END,
      p.name
  `,

  // The programme footprint is a handful of woredas, so the sidebar takes the
  // whole tree in one go and cascades client-side. Listing only places A2C
  // actually reaches keeps the user from picking a region with no loans in it.
  a2cFilterLocations: `
    SELECT
      region_name,
      region_pcode,
      zone_name,
      zone_pcode,
      woreda_name,
      woreda_pcode,
      COUNT(*) AS farmers
    FROM a2c_farmer
    GROUP BY 1, 2, 3, 4, 5, 6
    ORDER BY region_name, zone_name, woreda_name
  `,

  // ===================================================================
  // === DevOps (infrastructure monitoring) dashboard ==================
  // ===================================================================
  // Backed by data/devops/*.sql (mock data — no monitoring feed is wired up
  // yet). These describe the platform estate rather than farmer geography, so
  // they carry no DYNAMIC_FILTERS placeholder and the sidebar filters never
  // apply.

  devopsKpis: `
    SELECT
      (SELECT COUNT(*) FROM devops_platform) AS platforms_total,
      (SELECT COUNT(*) FROM devops_platform WHERE kind = 'REGISTRY') AS registries,
      (SELECT COUNT(*) FROM devops_platform WHERE kind = 'SERVICE') AS services,

      (SELECT COUNT(*) FROM devops_app_instance) AS instances_total,
      (SELECT COUNT(*) FROM devops_app_instance WHERE status = 'RUNNING') AS instances_running,
      (SELECT COUNT(*) FROM devops_app_instance WHERE status <> 'RUNNING') AS instances_unhealthy,
      (SELECT COALESCE(SUM(restarts_24h), 0) FROM devops_app_instance) AS restarts_24h,

      (SELECT COUNT(*) FROM devops_database) AS databases_total,
      (SELECT COUNT(*) FROM devops_database WHERE status = 'HEALTHY') AS databases_healthy,
      (SELECT COUNT(*) FROM devops_database WHERE role = 'REPLICA') AS databases_replicas,
      (SELECT COALESCE(ROUND(SUM(size_gb)), 0) FROM devops_database WHERE role = 'PRIMARY') AS database_size_gb,
      (SELECT COALESCE(MAX(replication_lag_s), 0) FROM devops_database) AS max_replication_lag_s,

      (SELECT COUNT(*) FROM devops_api_endpoint WHERE scope = 'INTERNAL') AS apis_internal,
      (SELECT COUNT(*) FROM devops_api_endpoint WHERE scope = 'EXTERNAL') AS apis_external,
      (SELECT COUNT(*) FROM devops_api_endpoint WHERE status <> 'HEALTHY') AS apis_degraded,
      (SELECT ROUND(AVG(availability_pct), 2) FROM devops_api_endpoint WHERE scope = 'INTERNAL') AS internal_availability_pct,
      (SELECT ROUND(AVG(availability_pct), 2) FROM devops_api_endpoint WHERE scope = 'EXTERNAL') AS external_availability_pct,
      (SELECT COALESCE(SUM(requests_24h), 0) FROM devops_api_endpoint) AS requests_24h,
      -- Weighted by traffic, so a quiet endpoint cannot skew the estate figure.
      (SELECT ROUND(SUM(requests_24h * error_rate_pct) / NULLIF(SUM(requests_24h), 0), 2)
         FROM devops_api_endpoint) AS error_rate_pct,

      (SELECT COUNT(*) FROM devops_node) AS nodes_total,
      (SELECT COUNT(*) FROM devops_node WHERE status = 'HEALTHY') AS nodes_healthy,
      (SELECT COUNT(*) FROM devops_node WHERE status = 'WARNING') AS nodes_warning,
      (SELECT COUNT(*) FROM devops_node WHERE status = 'CRITICAL') AS nodes_critical,
      (SELECT COALESCE(SUM(cpu_cores), 0) FROM devops_node) AS cpu_cores,
      (SELECT COALESCE(SUM(memory_gb), 0) FROM devops_node) AS memory_gb,
      (SELECT COALESCE(ROUND(SUM(disk_gb) / 1024.0, 1), 0) FROM devops_node) AS disk_tb,
      (SELECT ROUND(AVG(cpu_pct), 1) FROM devops_node) AS avg_cpu_pct,
      (SELECT ROUND(AVG(memory_pct), 1) FROM devops_node) AS avg_memory_pct,
      (SELECT ROUND(AVG(disk_pct), 1) FROM devops_node) AS avg_disk_pct,

      (SELECT COUNT(*) FROM devops_pipeline) AS pipelines_total,
      (SELECT COUNT(*) FROM devops_pipeline WHERE last_status = 'FAILED') AS pipelines_failed,
      (SELECT COUNT(*) FROM devops_pipeline WHERE last_status = 'RUNNING') AS pipelines_running,
      (SELECT COALESCE(SUM(deploys_30d), 0) FROM devops_pipeline) AS deploys_30d,
      (SELECT ROUND(COUNT(*) FILTER (WHERE status = 'SUCCESS') * 100.0
                    / NULLIF(COUNT(*) FILTER (WHERE status <> 'RUNNING'), 0), 1)
         FROM devops_pipeline_run) AS deploy_success_rate_pct,

      (SELECT COUNT(*) FROM devops_incident WHERE status <> 'MITIGATED') AS incidents_open,
      (SELECT COUNT(*) FROM devops_incident WHERE severity = 'CRITICAL' AND status <> 'MITIGATED') AS incidents_critical,
      (SELECT COUNT(*) FROM devops_incident) AS incidents_total
  `,

  // One row per platform for the estate health table. Correlated subqueries keep
  // instance, database and API counts independent — joining them in one pass
  // would multiply every count by the others.
  devopsPlatforms: `
    SELECT
      p.platform_key,
      p.name,
      p.short_name,
      p.kind,
      p.tier,
      p.owner_team,
      p.version,
      (SELECT COUNT(*) FROM devops_app_instance i WHERE i.platform_id = p.id) AS instances,
      (SELECT COUNT(*) FROM devops_app_instance i WHERE i.platform_id = p.id AND i.status = 'RUNNING') AS instances_running,
      (SELECT COALESCE(SUM(i.restarts_24h), 0) FROM devops_app_instance i WHERE i.platform_id = p.id) AS restarts_24h,
      (SELECT COUNT(*) FROM devops_database d WHERE d.platform_id = p.id) AS databases,
      (SELECT COUNT(*) FROM devops_database d WHERE d.platform_id = p.id AND d.status <> 'HEALTHY') AS databases_unhealthy,
      (SELECT COALESCE(ROUND(SUM(d.size_gb)), 0) FROM devops_database d WHERE d.platform_id = p.id AND d.role = 'PRIMARY') AS database_size_gb,
      (SELECT COUNT(*) FROM devops_api_endpoint a WHERE a.platform_id = p.id AND a.scope = 'INTERNAL') AS apis_internal,
      (SELECT COUNT(*) FROM devops_api_endpoint a WHERE a.platform_id = p.id AND a.scope = 'EXTERNAL') AS apis_external,
      (SELECT COUNT(*) FROM devops_api_endpoint a WHERE a.platform_id = p.id AND a.status <> 'HEALTHY') AS apis_degraded,
      (SELECT ROUND(AVG(a.availability_pct), 2) FROM devops_api_endpoint a WHERE a.platform_id = p.id) AS availability_pct,
      (SELECT COALESCE(SUM(a.requests_24h), 0) FROM devops_api_endpoint a WHERE a.platform_id = p.id) AS requests_24h,
      (SELECT MAX(a.p95_latency_ms) FROM devops_api_endpoint a WHERE a.platform_id = p.id) AS p95_latency_ms,
      (SELECT COUNT(*) FROM devops_incident n WHERE n.platform_id = p.id AND n.status <> 'MITIGATED') AS open_incidents,
      (SELECT COUNT(*) FROM devops_pipeline pl WHERE pl.platform_id = p.id AND pl.last_status = 'FAILED') AS pipelines_failed,
      -- Worst-of roll-up: a crash-looping instance or a dead endpoint is
      -- critical; anything else off-nominal is degraded.
      CASE
        WHEN EXISTS (SELECT 1 FROM devops_app_instance i WHERE i.platform_id = p.id AND i.status IN ('CRASHLOOP', 'STOPPED'))
          OR EXISTS (SELECT 1 FROM devops_api_endpoint a WHERE a.platform_id = p.id AND a.status = 'DOWN')
          THEN 'CRITICAL'
        WHEN EXISTS (SELECT 1 FROM devops_app_instance i WHERE i.platform_id = p.id AND i.status = 'DEGRADED')
          OR EXISTS (SELECT 1 FROM devops_database d WHERE d.platform_id = p.id AND d.status <> 'HEALTHY')
          OR EXISTS (SELECT 1 FROM devops_api_endpoint a WHERE a.platform_id = p.id AND a.status = 'DEGRADED')
          THEN 'DEGRADED'
        ELSE 'HEALTHY'
      END AS status
    FROM devops_platform p
    ORDER BY p.sort_order
  `,

  devopsInstanceStatus: `
    SELECT
      status,
      COUNT(*) AS instances,
      COALESCE(SUM(restarts_24h), 0) AS restarts_24h
    FROM devops_app_instance
    GROUP BY 1
    ORDER BY instances DESC, status
  `,

  // Hardware, worst first — an operator reads the top of this list and stops.
  devopsNodes: `
    SELECT
      n.hostname,
      n.role,
      n.cluster,
      n.datacentre,
      n.cpu_cores,
      n.memory_gb,
      n.disk_gb,
      n.cpu_pct,
      n.memory_pct,
      n.disk_pct,
      n.status,
      n.uptime_days,
      GREATEST(n.cpu_pct, n.memory_pct, n.disk_pct) AS peak_pct,
      (SELECT COUNT(*) FROM devops_app_instance i WHERE i.node_id = n.id) AS instances,
      (SELECT COUNT(*) FROM devops_database d WHERE d.node_id = n.id) AS databases
    FROM devops_node n
    ORDER BY
      CASE n.status WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
      peak_pct DESC,
      n.hostname
  `,

  devopsClusters: `
    SELECT
      cluster,
      datacentre,
      COUNT(*) AS nodes,
      COALESCE(SUM(cpu_cores), 0) AS cpu_cores,
      COALESCE(SUM(memory_gb), 0) AS memory_gb,
      COALESCE(ROUND(SUM(disk_gb) / 1024.0, 1), 0) AS disk_tb,
      ROUND(AVG(cpu_pct), 1) AS cpu_pct,
      ROUND(AVG(memory_pct), 1) AS memory_pct,
      ROUND(AVG(disk_pct), 1) AS disk_pct,
      COUNT(*) FILTER (WHERE status = 'HEALTHY') AS healthy,
      COUNT(*) FILTER (WHERE status = 'WARNING') AS warning,
      COUNT(*) FILTER (WHERE status = 'CRITICAL') AS critical
    FROM devops_node
    GROUP BY 1, 2
    ORDER BY nodes DESC, cluster
  `,

  devopsDatabases: `
    SELECT
      d.db_name,
      d.role,
      p.name AS platform,
      n.hostname AS node,
      d.pg_version,
      d.size_gb,
      d.connections,
      d.max_connections,
      ROUND(d.connections * 100.0 / NULLIF(d.max_connections, 0), 1) AS connection_pct,
      d.replication_lag_s,
      d.cache_hit_pct,
      d.last_backup_at,
      d.status
    FROM devops_database d
    JOIN devops_platform p ON p.id = d.platform_id
    JOIN devops_node n ON n.id = d.node_id
    ORDER BY
      CASE d.status WHEN 'DEGRADED' THEN 0 WHEN 'LAGGING' THEN 1 ELSE 2 END,
      connection_pct DESC,
      d.db_name
  `,

  // Internal (platform-to-platform) versus external (partner) API posture.
  devopsApiScope: `
    SELECT
      scope,
      COUNT(*) AS endpoints,
      COALESCE(SUM(requests_24h), 0) AS requests_24h,
      ROUND(SUM(requests_24h * error_rate_pct) / NULLIF(SUM(requests_24h), 0), 2) AS error_rate_pct,
      ROUND(AVG(availability_pct), 2) AS availability_pct,
      ROUND(AVG(p95_latency_ms)) AS p95_latency_ms,
      MAX(p95_latency_ms) AS worst_p95_latency_ms,
      COUNT(*) FILTER (WHERE status <> 'HEALTHY') AS degraded,
      COUNT(DISTINCT platform_id) AS platforms
    FROM devops_api_endpoint
    GROUP BY 1
    ORDER BY scope
  `,

  // The endpoints worth looking at first: unhealthy, then noisiest by errors.
  devopsApiHotspots: `
    SELECT
      a.name,
      a.scope,
      a.method,
      a.path,
      a.consumer,
      p.short_name AS platform,
      a.requests_24h,
      a.error_rate_pct,
      a.p95_latency_ms,
      a.availability_pct,
      a.status,
      ROUND(a.requests_24h * a.error_rate_pct / 100.0) AS failed_calls_24h
    FROM devops_api_endpoint a
    JOIN devops_platform p ON p.id = a.platform_id
    ORDER BY
      CASE a.status WHEN 'DOWN' THEN 0 WHEN 'DEGRADED' THEN 1 ELSE 2 END,
      a.error_rate_pct DESC,
      a.p95_latency_ms DESC
    LIMIT 8
  `,

  devopsPipelines: `
    SELECT
      pl.name,
      COALESCE(p.name, 'Platform-wide') AS platform,
      COALESCE(p.short_name, 'Platform-wide') AS platform_short,
      COALESCE(p.kind, 'INFRA') AS kind,
      pl.repository,
      pl.environment,
      pl.trigger_type,
      pl.last_status,
      pl.last_duration_s,
      pl.last_run_at,
      pl.failed_stage,
      pl.deploys_30d,
      pl.success_rate_pct,
      pl.lead_time_hours
    FROM devops_pipeline pl
    LEFT JOIN devops_platform p ON p.id = pl.platform_id
    ORDER BY
      CASE pl.last_status WHEN 'FAILED' THEN 0 WHEN 'RUNNING' THEN 1 ELSE 2 END,
      pl.last_run_at DESC
  `,

  // Daily run outcomes. Anchored to the newest run rather than now(), so the
  // window stays populated however long the mock data sits in the repo.
  devopsPipelineTrend: `
    SELECT
      DATE_TRUNC('day', started_at) AS day,
      TO_CHAR(DATE_TRUNC('day', started_at), 'DD Mon') AS label,
      COUNT(*) AS runs,
      COUNT(*) FILTER (WHERE status = 'SUCCESS') AS succeeded,
      COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
      ROUND(AVG(duration_s)) AS avg_duration_s
    FROM devops_pipeline_run
    WHERE started_at >= (SELECT MAX(started_at) FROM devops_pipeline_run) - INTERVAL '13 days'
    GROUP BY 1, 2
    ORDER BY day
  `,

  devopsDeployFrequency: `
    SELECT
      COALESCE(p.short_name, 'Platform-wide') AS platform,
      COALESCE(p.kind, 'INFRA') AS kind,
      COUNT(*) AS pipelines,
      COALESCE(SUM(pl.deploys_30d), 0) AS deploys_30d,
      ROUND(AVG(pl.success_rate_pct), 1) AS success_rate_pct,
      ROUND(AVG(pl.lead_time_hours), 1) AS lead_time_hours
    FROM devops_pipeline pl
    LEFT JOIN devops_platform p ON p.id = pl.platform_id
    GROUP BY 1, 2
    ORDER BY deploys_30d DESC, 1
  `,

  devopsTraffic: `
    SELECT
      sampled_at,
      TO_CHAR(sampled_at, 'HH24:00') AS label,
      COALESCE(SUM(requests), 0) AS requests,
      COALESCE(SUM(errors), 0) AS errors,
      ROUND(SUM(errors) * 100.0 / NULLIF(SUM(requests), 0), 2) AS error_rate_pct,
      MAX(p95_latency_ms) AS p95_latency_ms
    FROM devops_traffic_sample
    GROUP BY 1, 2
    ORDER BY sampled_at
  `,

  devopsIncidents: `
    SELECT
      i.title,
      i.component,
      i.severity,
      i.status,
      i.opened_at,
      i.detail,
      COALESCE(p.name, 'Platform-wide') AS platform,
      -- Age measured against the newest monitoring sample, not now(), so the
      -- mock data reads consistently no matter when it is loaded.
      ROUND(
        EXTRACT(EPOCH FROM ((SELECT MAX(sampled_at) FROM devops_traffic_sample) - i.opened_at)) / 3600.0,
        1
      ) AS age_hours
    FROM devops_incident i
    LEFT JOIN devops_platform p ON p.id = i.platform_id
    ORDER BY
      CASE i.severity WHEN 'CRITICAL' THEN 0 WHEN 'MAJOR' THEN 1 ELSE 2 END,
      CASE i.status WHEN 'OPEN' THEN 0 WHEN 'ACKNOWLEDGED' THEN 1 ELSE 2 END,
      i.opened_at DESC
  `,
};
