import { DATASET_COLUMNS, CELL_VOLTAGE_FIELDS } from '../config/schema'
import realRows from './realDataset.json'

// The bundled default dataset is a REAL recorded discharge (vin_398_discharge_3),
// so the dashboard shows authentic battery behaviour out of the box.
export function createSampleDataset() {
  const rows = realRows.map((raw, index) => {
    const row = { ...raw, __id: `real-${index}`, __index: index }
    DATASET_COLUMNS.forEach(column => {
      if (!(column in row)) row[column] = ''
    })
    // Derive a readable fault_type label for the UI (dataset only has fault_label).
    row.CHARGE_STATUS = raw.CHARGE_STATUS ?? ''
    return row
  })

  return {
    id: 'real-discharge-vin398',
    name: 'Real Discharge — vin_398',
    rows,
    columns: DATASET_COLUMNS,
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'bundled',
    size: 0
  }
}

export function getCurrentDemoRow(index = 0) {
  const ds = createSampleDataset()
  return ds.rows[Math.abs(index) % ds.rows.length]
}

export { CELL_VOLTAGE_FIELDS }
