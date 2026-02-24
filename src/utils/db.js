import * as duckdb from '@duckdb/duckdb-wasm'

let dbInstance = null
let connInstance = null

export async function getDB() {
  if (dbInstance) return { db: dbInstance, conn: connInstance }

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
  )
  const worker = new Worker(worker_url)
  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  URL.revokeObjectURL(worker_url)

  const conn = await db.connect()

  // Register the CSV file from public folder
  await db.registerFileURL(
    'sales.csv',
    '/data/abu_dhabi_sales.csv',
    duckdb.DuckDBDataProtocol.HTTP,
    false
  )

  // Create a clean view with renamed columns and proper types
  await conn.query(`
    CREATE VIEW IF NOT EXISTS sales AS
    SELECT
      "Asset Class"                                        AS asset_class,
      "Property Type"                                      AS property_type,
      TRY_CAST("Sale Application Date" AS DATE)            AS sale_date,
      TRY_CAST("Property Sold Area (SQM)" AS DOUBLE)       AS area_sqm,
      "Property Layout"                                    AS layout,
      "District"                                           AS district,
      "Community"                                          AS community,
      "Project Name"                                       AS project_name,
      TRY_CAST("Property Sale Price (AED)" AS DOUBLE)      AS price_aed,
      TRY_CAST("Property Sold Share" AS DOUBLE)            AS sold_share,
      TRY_CAST("Rate (AED per SQM)" AS DOUBLE)             AS rate_per_sqm,
      "Sale Application Type"                              AS sale_type,
      "Sale Sequence"                                      AS sale_sequence
    FROM read_csv_auto('sales.csv', HEADER=TRUE, IGNORE_ERRORS=TRUE)
  `)

  dbInstance = db
  connInstance = conn
  return { db, conn }
}

export async function query(sql, params = []) {
  const { conn } = await getDB()
  const stmt = await conn.prepare(sql)
  try {
    const result = await stmt.query(...params)
    return result.toArray().map(row => row.toJSON())
  } finally {
    await stmt.close()
  }
}
