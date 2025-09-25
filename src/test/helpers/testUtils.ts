import { vi } from 'vitest'
import { Request, Response } from 'express'

/**
 * Utilidad para crear mocks de funciones
 */
export const createMockFunction = <T extends (...args: any[]) => any>(implementation?: T) => {
  return vi.fn(implementation)
}

/**
 * Crea un mock de Request de Express para testing
 */
export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: undefined,
    ...overrides
  }
}

/**
 * Crea un mock de Response de Express para testing
 */
export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis()
  }
  return res
}

/**
 * Utilidad para esperar un tiempo determinado (útil para tests async)
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Utilidad para generar IDs únicos en tests
 */
export const generateTestId = (prefix: string = 'test'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Función helper para crear datos de prueba aleatorios
 */
export const generateTestData = {
  email: () => `test${Date.now()}@example.com`,
  password: () => 'TestPassword123!',
  name: () => `Test User ${Date.now()}`,
  phone: () => `+1234567${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
  uuid: () => crypto.randomUUID()
}

/**
 * Utilidad para limpiar objetos de propiedades undefined
 */
export const cleanObject = (obj: Record<string, any>): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  )
}

/**
 * Función para validar estructura de respuesta de API
 */
export const validateApiResponse = (response: any, expectedKeys: string[]) => {
  expectedKeys.forEach(key => {
    if (!(key in response)) {
      throw new Error(`Expected key '${key}' not found in response`)
    }
  })
}

/**
 * Función para crear headers de autenticación para tests
 */
export const createAuthHeaders = (token: string) => {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

/**
 * Función para limpiar la base de datos en tests
 */
export const cleanupDatabase = async () => {
  // Aquí implementaremos la limpieza de la base de datos
  // Por ahora solo un placeholder
  console.warn('Database cleanup not implemented yet')
}

/** 
 * Función para imprimir la respuesta obtenida del servidor.
 */
export const logServerResponse = (testName: string, response: any) => {
    console.log(`=== SERVER RESPONSE FOR: ${testName} ===`, {
        status: response.status,
        headers: response.headers,
        body: response.body,
        text: response.text,
        error: response.error,
        rawResponse: {
            statusCode: response.status,
            statusText: response.statusText || 'N/A',
            type: response.type || 'N/A'
        }
    });
};