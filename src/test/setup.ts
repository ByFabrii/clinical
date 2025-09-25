// src/test/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { config } from 'dotenv'
import logger from '@config/logger'

// Cargar variables de entorno para testing
config({ path: '.env.test' })

// Configuración global antes de todos los tests
beforeAll(async () => {
  // Configurar entorno de testing
  process.env.NODE_ENV = 'test'
  
  // Configurar variables específicas para testing
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'test-url'
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'
  
  logger.info('Configuración de testing inicializada', {
    action: 'test_setup_init',
    environment: 'test',
    timestamp: new Date().toISOString()
  })
})

// Limpieza después de todos los tests
afterAll(async () => {
  logger.info('Limpieza de testing completada', {
    action: 'test_cleanup',
    environment: 'test',
    timestamp: new Date().toISOString()
  })
})

// Antes de cada test individual
beforeEach(async () => {
  // Aquí puedes limpiar mocks, resetear estado, etc.
})

// Después de cada test individual
afterEach(async () => {
  // Limpieza después de cada test
})