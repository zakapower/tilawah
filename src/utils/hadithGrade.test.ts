import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bucketFromGradeLabel,
  resolveHadithGrade,
} from './hadithGrade.ts'

describe('bucketFromGradeLabel', () => {
  it('maps Hasan Sahih to sahih', () => {
    assert.equal(bucketFromGradeLabel('Hasan Sahih'), 'sahih')
  })

  it('maps Isnaad Hasan to hasan', () => {
    assert.equal(bucketFromGradeLabel('Isnaad Hasan'), 'hasan')
  })

  it('maps Daif to daif', () => {
    assert.equal(bucketFromGradeLabel('Daif'), 'daif')
  })

  it('maps Mawdu to mawdu', () => {
    assert.equal(bucketFromGradeLabel('Mawdu'), 'mawdu')
    assert.equal(bucketFromGradeLabel('Fabricated'), 'mawdu')
  })
})

describe('resolveHadithGrade', () => {
  it('forces bukhari and muslim to sahih', () => {
    assert.equal(resolveHadithGrade('bukhari', undefined), 'sahih')
    assert.equal(
      resolveHadithGrade('muslim', [{ name: 'X', grade: 'Daif' }]),
      'sahih',
    )
  })

  it('prefers Albani over earlier grades', () => {
    assert.equal(
      resolveHadithGrade('abudawud', [
        { name: 'Other', grade: 'Daif' },
        { name: 'Al-Albani', grade: 'Sahih' },
      ]),
      'sahih',
    )
  })

  it('falls back to first grade when Albani missing', () => {
    assert.equal(
      resolveHadithGrade('tirmidhi', [{ name: 'Zubair Ali Zai', grade: 'Hasan' }]),
      'hasan',
    )
  })

  it('returns unknown when grades empty', () => {
    assert.equal(resolveHadithGrade('abudawud', []), 'unknown')
    assert.equal(resolveHadithGrade('abudawud', undefined), 'unknown')
  })
})
