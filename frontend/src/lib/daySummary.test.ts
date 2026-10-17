import { describe, expect, it } from 'vitest'
import { buildDaySummary, distanceToTarget } from './daySummary'

const targets = { target_kcal: 2200, target_protein: 150, target_fat: 70, target_carbs: 250 }

describe('buildDaySummary', () => {
  it('derives macro ranges from targets when explicit limits are missing', () => {
    const [kcal, protein, fat, carbs] = buildDaySummary({ kcal: 0, protein: 0, fat: 0, carbs: 0 }, targets)

    expect(kcal).toMatchObject({ key: 'kcal', unit: 'kcal', min: 1980, max: 2200, target: '2200' })
    expect(protein).toMatchObject({ key: 'protein', unit: 'g', min: 135, max: 165, target: '135-165' })
    expect(fat).toMatchObject({ min: 63, max: 77, target: '63-77' })
    expect(carbs).toMatchObject({ min: 225, max: 275, target: '225-275' })
  })

  it('prefers explicit macro limits from the profile', () => {
    const [, protein] = buildDaySummary(
      { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      { ...targets, target_protein_min: 120, target_protein_max: 180 },
    )

    expect(protein).toMatchObject({ min: 120, max: 180, target: '120-180' })
  })

  it('rounds consumed values and marks each metric as under, on or over target', () => {
    const [kcal, protein, fat, carbs] = buildDaySummary({ kcal: 1240, protein: 152.3, fat: 96.2, carbs: 132.6 }, targets)

    expect(kcal).toMatchObject({ value: 1240, status: 'under' })
    expect(protein).toMatchObject({ value: 152, status: 'ok' })
    expect(fat).toMatchObject({ value: 96, status: 'over' })
    expect(carbs).toMatchObject({ value: 133, status: 'under' })
  })

  it('fills the bar up to the upper limit and shows the excess as overflow', () => {
    const [kcal, protein] = buildDaySummary({ kcal: 1100, protein: 330, fat: 0, carbs: 0 }, targets)

    expect(kcal.fillPercent).toBe(50)
    expect(kcal.overflowPercent).toBe(0)
    expect(protein.fillPercent).toBe(100)
    expect(protein.overflowPercent).toBe(100)
  })

  it('keeps bars empty when targets are missing', () => {
    const [kcal, protein] = buildDaySummary(
      { kcal: 500, protein: 20, fat: 0, carbs: 0 },
      { target_kcal: 0, target_protein: 0, target_fat: 0, target_carbs: 0 },
    )

    expect(kcal).toMatchObject({ fillPercent: 0, overflowPercent: 0, status: 'over' })
    expect(protein).toMatchObject({ fillPercent: 0, overflowPercent: 0 })
  })
})

describe('distanceToTarget', () => {
  it('measures what is missing to the target or how much it was exceeded', () => {
    const [kcal, protein, fat, carbs] = buildDaySummary({ kcal: 2000, protein: 100, fat: 80, carbs: 250 }, targets)

    expect(distanceToTarget(kcal)).toBe(0)
    expect(distanceToTarget(protein)).toBe(35)
    expect(distanceToTarget(fat)).toBe(3)
    expect(distanceToTarget(carbs)).toBe(0)
  })

  it('measures missing calories against the full calorie target', () => {
    const [kcal] = buildDaySummary({ kcal: 1240, protein: 0, fat: 0, carbs: 0 }, targets)

    expect(distanceToTarget(kcal)).toBe(960)
  })
})
