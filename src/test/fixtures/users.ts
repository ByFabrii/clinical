// src/test/fixtures/users.ts
export const validUser = {
  email: 'test@example.com',
  password: 'password123',
  clinic_id: 'clinic-123'
}

export const invalidUser = {
  email: 'invalid-email',
  password: '123',
  clinic_id: ''
}

export const existingUser = {
  id: 'user-123',
  email: 'existing@example.com',
  clinic_id: 'clinic-123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

export const adminUser = {
  id: 'admin-123',
  email: 'admin@example.com',
  clinic_id: 'clinic-123',
  role: 'admin',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}