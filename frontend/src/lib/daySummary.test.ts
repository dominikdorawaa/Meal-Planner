import { describe, expect, it } from 'vitest'
import { addConsumed, buildDaySummary, isDayGoalMet } from './daySummary'

const targets = { target_kcal: 2200, target_protein: 150, target_fat: 70, target_carbs: 250 }
const nothing = { kcal: 0, protein: 0, fat: 0, carbs: 0 }

describe('buildDaySummary', () => {
  it('shows the calorie target and macro ranges derived from targets', () => {
    const [kcal, protein, fat, carbs] = buildDaySummary(nothing, targets)

    expect(kcal).toMatchObject({ key: 'kcal', unit: 'kcal', target: '2200' })
    expect(protein).toMatchObject({ key: 'protein', unit: 'g', target: '135-165' })
    expect(fat).toMatchObject({ key: 'fat', target: '63-77' })
    expect(carbs).toMatchObject({ key: 'carbs', target: '225-275' })
    expect([kcal.goal, protein.goal, fat.goal, carbs.goal]).toEqual([2200, 150, 70, 250])
  })

  it('prefers explicit macro limits from the profile', () => {
    const [, protein] = buildDaySummary(
      { ...nothing, protein: 179 },
      { ...targets, target_protein_min: 120, target_protein_max: 180 },
    )

    expect(protein).toMatchObject({ target: '120-180', status: 'ok' })
  })

  it('rounds consumed values and marks each metric as under, on or over target', () => {
    const [kcal, protein, fat, carbs] = buildDaySummary({ kcal: 1240, protein: 152.3, fat: 96.2, carbs: 132.6 }, targets)

    expect(kcal).toMatchObject({ value: 1240, status: 'under' })
    expect(protein).toMatchObject({ value: 152, status: 'ok' })
    expect(fat).toMatchObject({ value: 96, status: 'over' })
    expect(carbs).toMatchObject({ value: 133, status: 'under' })
  })

  it('judges the status on exact values so it matches the bar', () => {
    const [, protein, , carbs] = buildDaySummary({ ...nothing, protein: 165.4, carbs: 275 }, targets)

    expect(protein).toMatchObject({ value: 165, status: 'over', distance: 1 })
    expect(protein.overflowPercent).toBeGreaterThan(0)
    expect(carbs).toMatchObject({ status: 'ok', overflowPercent: 0 })
  })

  it('measures what is missing to the target range or how much it was exceeded', () => {
    const [kcal, protein, fat, carbs] = buildDaySummary({ kcal: 1240, protein: 100, fat: 80, carbs: 250 }, targets)

    expect(kcal.distance).toBe(960)
    expect(protein.distance).toBe(35)
    expect(fat.distance).toBe(3)
    expect(carbs.distance).toBe(0)
  })

  it('counts missing calories exactly to the goal', () => {
    const [kcal] = buildDaySummary({ ...nothing, kcal: 2243 }, { ...targets, target_kcal: 3006 })

    expect(kcal).toMatchObject({ status: 'under', distance: 763, exceeded: false })
  })

  it('treats calories within 2 percent of the goal as on target but still shows the exact difference', () => {
    const [below] = buildDaySummary({ ...nothing, kcal: 2156 }, targets)
    const [above] = buildDaySummary({ ...nothing, kcal: 2244 }, targets)
    const [exact] = buildDaySummary({ ...nothing, kcal: 2200 }, targets)

    expect(below).toMatchObject({ status: 'ok', distance: 44, exceeded: false, overflowPercent: 0 })
    expect(above).toMatchObject({ status: 'ok', distance: 44, exceeded: true, fillPercent: 100, overflowPercent: 0 })
    expect(exact).toMatchObject({ status: 'ok', distance: 0, exceeded: false })
  })

  it('marks calories outside the 2 percent band as under or over the goal', () => {
    const [under] = buildDaySummary({ ...nothing, kcal: 2155 }, targets)
    const [over] = buildDaySummary({ ...nothing, kcal: 2245 }, targets)

    expect(under).toMatchObject({ status: 'under', distance: 45 })
    expect(over).toMatchObject({ status: 'over', distance: 45, exceeded: true })
    expect(over.overflowPercent).toBeGreaterThan(0)
  })

  it('fills the bar up to the upper limit and shows the excess as overflow', () => {
    const [kcal, protein] = buildDaySummary({ ...nothing, kcal: 1100, protein: 330 }, targets)

    expect(kcal.fillPercent).toBe(50)
    expect(kcal.overflowPercent).toBe(0)
    expect(protein.fillPercent).toBe(100)
    expect(protein.overflowPercent).toBe(100)
  })

  it('keeps bars empty when targets are missing', () => {
    const [kcal, protein] = buildDaySummary(
      { ...nothing, kcal: 500, protein: 20 },
      { target_kcal: 0, target_protein: 0, target_fat: 0, target_carbs: 0 },
    )

    expect(kcal).toMatchObject({ fillPercent: 0, overflowPercent: 0 })
    expect(protein).toMatchObject({ fillPercent: 0, overflowPercent: 0 })
  })
})

describe('addConsumed', () => {
  it('adds an item to the day keeping whole calories and one decimal for macros', () => {
    expect(addConsumed({ kcal: 1000, protein: 50.1, fat: 30.2, carbs: 100 }, { kcal: 177.6, protein: 2.2, fat: 0.06, carbs: 46 }))
      .toEqual({ kcal: 1178, protein: 52.3, fat: 30.3, carbs: 146 })
  })
})

describe('isDayGoalMet', () => {
  const onTarget = { kcal: 2150, protein: 150, fat: 70, carbs: 240 }

  it('accepts a day within five percent of the calorie goal with no macro over its range', () => {
    expect(isDayGoalMet(onTarget, targets)).toBe(true)
    expect(isDayGoalMet({ ...onTarget, kcal: 2090 }, targets)).toBe(true)
    expect(isDayGoalMet({ ...onTarget, kcal: 2310 }, targets)).toBe(true)
  })

  it('rejects a day with calories more than five percent away from the goal', () => {
    expect(isDayGoalMet({ ...onTarget, kcal: 2089 }, targets)).toBe(false)
    expect(isDayGoalMet({ ...onTarget, kcal: 2311 }, targets)).toBe(false)
  })

  it('rejects a day with a macro over its range even when calories fit', () => {
    expect(isDayGoalMet({ ...onTarget, fat: 78 }, targets)).toBe(false)
  })

  it('accepts a day with a macro below its range', () => {
    expect(isDayGoalMet({ ...onTarget, protein: 60 }, targets)).toBe(true)
  })

  it('never marks an empty day or a profile without a calorie goal', () => {
    expect(isDayGoalMet(nothing, { ...targets, target_kcal: 0 })).toBe(false)
    expect(isDayGoalMet(onTarget, { ...targets, target_kcal: 0 })).toBe(false)
  })
})
