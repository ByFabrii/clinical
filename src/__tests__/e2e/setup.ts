import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import createApp from '../../app'
import logger from '../../config/logger'
import { logServerResponse } from '@/test/helpers';

// Variables globales para los test E2E
export let testServer: any;
export let testRequest: any;
export let app: any;

// Datos de prueba para Tests E2E
export const testUser = {
  email: `test.e2e@example.com`,
  password: 'TestPassword123!',
  first_name: 'Test User',
  last_name: 'Test Lastname',
  clinic_id: '9fac1acc-2787-4fde-82d5-8fdd750d2178', // ID de clínica de prueba
  terms_accepted: true,
  privacy_accepted: true
}

export const adminUser = {
  email: 'fabrizzio.ddd@gmail.com',
  password: '123456789',
  first_name: 'Admin',
  last_name: 'User',
  clinic_id: '9fac1acc-2787-4fde-82d5-8fdd750d2178', // ID de clínica de prueba
  terms_accepted: true,
  privacy_accepted: true
}

export const testUserLogin = {
  email: 'fabrizzio.ddd@gmail.com',
  password: '123456789'
}

// Configuración antes de todos los tests E2E
beforeAll(async () => {
  // Crear la instancia de la aplicación
  app = createApp();
  testRequest = request(app);

  logger.info('🧪 Entorno de testing E2E configurado', {
    action: 'e2e_setup_init',
    environment: 'test',
    timestamp: new Date().toISOString()
  });
});

// Limpieza después de todos los tests E2E
afterAll(async () => {
  logger.info('🧹 Limpieza de testing E2E completada', {
    action: 'e2e_cleanup',
    environment: 'test',
    timestamp: new Date().toISOString()
  });
});

// Función helper para crear un usuario de prueba E2E
export const createTestUser = async () => {
  const response = await testRequest
    .post('/auth/register')
    .send(testUser);
  return response;
};

export const createAdminUser = async () => {
  const response = await testRequest
    .post('/auth/register')
    .send(adminUser);

  logServerResponse('Respuesta de: debería registrar usuario administrador', response);

  return response;
}

// Función helper para hacer login y obtener token
export const loginTestUser = async () => {
  const response = await testRequest
    .post('/auth/login')
    .send(testUserLogin);

  if (response.body.success == false && response.body.error.code == 'INVALID_CREDENTIALS') {
    const registerResponse = await testRequest
      .post('/auth/register')
      .send(adminUser);

    logServerResponse('Respuesta de: debería registrar usuario administrador', registerResponse);
  }

  const response2 = await testRequest
    .post('/auth/login')
    .send(testUserLogin);

  logServerResponse('Respuesta de: debería hacer login y obtener token', response2);
  return response2;
};