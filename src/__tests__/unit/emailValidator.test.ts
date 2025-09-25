import { describe, it, expect } from 'vitest'
import { isValidEmail } from '../../utils/emaillValidator'

/**
 * Casos válidos:
 */

export const VALID_EMAILS = [
  'test@example.com',
  'user@mail.domain.com',
  'user123@domain123.com',
  'user-name@domain-name.com',
  'user.name@domain.co.uk',
  'user+tag@domain.com',
  'a@b.co',
  'user@very-long-domain-name.com',
  'user_name@domain.org',
  'usuario@dominio.es',
  'user@domain2.com',
  'user@sub1.sub2.domain.com',
  'user@domain.uk',
  'user@domain.info',
  'User.Name@Domain.COM',
  'user.name@domain.co.uk',
  'user#@domain.com',
]


/**
 * Casos inválidos:
 */
export const INVALID_EMAILS = [
  '',
  '  ',
  'userdomain.com',
  'user@@domain.com',
  '@domain.com',
  'user@',
  'user@domain',
  'user @domain.com',
  '@user@domain.com',
  'user@domain.com@',
  'user.@domain.com.',
  '123@456',
  'user@domain.123',
  'user@dom ain.com',
]

describe('Email Validator', () => {
  VALID_EMAILS.forEach(email => {
    it(`should return true for valid email: ${email}`, () => {
      expect(isValidEmail(email)).toBe(true)
    })
  })

  INVALID_EMAILS.forEach(email => {
    it(`should return false for invalid email: ${email}`, () => {
      expect(isValidEmail(email)).toBe(false)
    })
  })
})