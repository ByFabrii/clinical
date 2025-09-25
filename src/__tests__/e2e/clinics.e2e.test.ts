import { describe, it, expect, beforeAll } from 'vitest';
import { testRequest, loginTestUser } from './setup';
import logger from '../../config/logger';
import { logServerResponse } from '../../test/helpers/testUtils';

describe('Clinics E2E Tests - Gestión de clínicas', () => {
    let authToken: string;
    let testClinicId: string;

    beforeAll(async () => {
        // Obtener token de autenticación
        const loginResponse = await loginTestUser();
        authToken = loginResponse.body.data.access_token;
        
        logger.info('🔑 Token de autenticación obtenido para tests de clínicas');
    });

    describe('POST /api/clinics - Crear clínica', () => {
        it('debería crear una nueva clínica con datos válidos', async () => {
            // Arrange
            const newClinic = {
                clinic_name: 'Clínica Dental Test E2E',
                clinic_code: 'CLINIC-E2E-001',
                email: 'test.clinic@example.com',
                phone: '+52 55 1234 5678',
                street: 'Av. Test 123',
                neighborhood: 'Col. Testing',
                city: 'Ciudad de México',
                state: 'CDMX',
                postal_code: '01234',
                country: 'México'
            };

            // Act
            const response = await testRequest
                .post('/api/clinics')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newClinic);

            logServerResponse('Respuesta de: debería crear una nueva clínica con datos válidos', response);

            // Assert
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data).toHaveProperty('clinic_name', newClinic.clinic_name);
            expect(response.body.data).toHaveProperty('email', newClinic.email);
            expect(response.body.data).toHaveProperty('is_active', true);

            // Guardar ID para tests posteriores
            testClinicId = response.body.data.id;

            logger.info('✅ Test de creación de clínica completado', { clinicId: testClinicId });
        });

        it('debería fallar al crear clínica sin autenticación', async () => {
            // Arrange
            const newClinic = {
                name: 'Clínica Sin Auth',
                address: 'Dirección test',
                phone: '+52 55 9999 9999',
                email: 'noauth@example.com'
            };

            // Act
            const response = await testRequest
                .post('/api/clinics')
                .send(newClinic);

            logServerResponse('Respuesta de: debería fallar al crear clínica sin autenticación', response);

            // Assert
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
        });

        it('debería fallar con datos inválidos', async () => {
            // Arrange - Email inválido
            const invalidClinic = {
                clinic_name: 'T', // Muy corto (mínimo 2 caracteres)
                clinic_code: 'invalid-code!', // Caracteres no permitidos
                phone: '123', // Teléfono muy corto
                email: 'email-invalido' // Email sin formato válido
            };

            // Act
            const response = await testRequest
                .post('/api/clinics')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidClinic);

            logServerResponse('Respuesta de: debería fallar con datos inválidos', response);

            // Assert
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('errors');
        });
    });

    describe('GET /api/clinics - Listar clínicas', () => {
        it('debería obtener lista de clínicas con autenticación', async () => {
            // Act
            const response = await testRequest
                .get('/api/clinics')
                .set('Authorization', `Bearer ${authToken}`);

            logServerResponse('Respuesta de: debería obtener lista de clínicas con autenticación', response);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body).toHaveProperty('pagination');

            logger.info('✅ Test de listado de clínicas completado');
        });

        it('debería fallar sin autenticación', async () => {
            // Act
            const response = await testRequest
                .get('/api/clinics');

            logServerResponse('Respuesta de: debería fallar sin autenticación', response);

            // Assert
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
        });

        it('debería respetar parámetros de paginación', async () => {
            // Act
            const response = await testRequest
                .get('/api/clinics?page=1&limit=5')
                .set('Authorization', `Bearer ${authToken}`);

            logServerResponse('Respuesta de: debería respetar parámetros de paginación', response);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body.pagination).toHaveProperty('page', 1);
            expect(response.body.pagination).toHaveProperty('limit', 5);
        });
    });

    describe('GET /api/clinics/:id - Obtener clínica por ID', () => {
        it('debería obtener clínica específica por ID', async () => {
            // Act
            const response = await testRequest
                .get(`/api/clinics/${testClinicId}`)
                .set('Authorization', `Bearer ${authToken}`);

            logServerResponse('Respuesta de: debería obtener clínica específica por ID', response);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('id', testClinicId);
            expect(response.body.data).toHaveProperty('clinic_name');
            expect(response.body.data).toHaveProperty('email');

            logger.info('✅ Test de obtención de clínica por ID completado');
        });

        it('debería fallar con ID inexistente', async () => {
            // Arrange
            const fakeId = '00000000-0000-0000-0000-000000000000';

            // Act
            const response = await testRequest
                .get(`/api/clinics/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`);

            logServerResponse('Respuesta de: debería fallar con ID inexistente', response);

            // Assert
            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('success', false);
        });

        it('debería fallar con ID inválido', async () => {
            // Act
            const response = await testRequest
                .get('/api/clinics/1111-2222-3333-4444')
                .set('Authorization', `Bearer ${authToken}`);

            logServerResponse('Respuesta de: debería fallar con ID inválido', response);

            // Assert
            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('success', false);
        });
    });

    describe('PUT /api/clinics/:id - Actualizar clínica', () => {
        it('debería actualizar clínica existente', async () => {
            // Arrange
            const updateData = {
                clinic_name: 'Clínica Dental Test E2E - Actualizada',
                email: 'updated.clinic@example.com',
                phone: '+52 55 9876 5432'
            };

            // Act
            const response = await testRequest
                .put(`/api/clinics/${testClinicId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);

            logServerResponse('Respuesta de: debería actualizar clínica existente', response);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('clinic_name', updateData.clinic_name);
            expect(response.body.data).toHaveProperty('email', updateData.email);

            logger.info('✅ Test de actualización de clínica completado');
        });

        it('debería fallar con datos inválidos', async () => {
            // Arrange
            const invalidData = {
                email: 'email-invalido-sin-formato'
            };

            // Act
            const response = await testRequest
                .put(`/api/clinics/${testClinicId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData);

            logServerResponse('Respuesta de: debería fallar con datos inválidos', response);

            // Assert
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
        });
    });

    describe('PATCH /api/clinics/:id/status - Cambiar estado de clínica', () => {
        it('debería cambiar estado de clínica a inactiva', async () => {
            // Arrange
            const statusData = { is_active: false };

            // Act
            const response = await testRequest
                .patch(`/api/clinics/${testClinicId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(statusData);

            logServerResponse('Respuesta de: debería cambiar estado de clínica a inactiva', response);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('is_active', false);

            logger.info('✅ Test de cambio de estado completado');
        });

        it('debería fallar con estado inválido', async () => {
            // Arrange
            const invalidStatus = { is_active: 'estado-invalido' };

            // Act
            const response = await testRequest
                .patch(`/api/clinics/${testClinicId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidStatus);

            logServerResponse('Respuesta de: debería fallar con estado inválido', response);

            // Assert
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
        });
    });

    describe('GET /api/clinics/:id/stats - Obtener estadísticas de clínica', () => {
        it('debería obtener estadísticas de clínica', async () => {
            // Act
            const response = await testRequest
                .get(`/api/clinics/${testClinicId}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            logServerResponse('Respuesta de: debería obtener estadísticas de clínica', response);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('patients_count');
            expect(response.body.data).toHaveProperty('appointments_count');
            expect(response.body.data).toHaveProperty('users_count');
            expect(typeof response.body.data.patients_count).toBe('number');

            logger.info('✅ Test de estadísticas de clínica completado');
        });

        it('debería fallar con ID inexistente', async () => {
            // Arrange
            const fakeId = '00000000-0000-0000-0000-000000000000';

            // Act
            const response = await testRequest
                .get(`/api/clinics/${fakeId}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            logServerResponse('Respuesta de: debería fallar con ID inexistente', response);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.users_count).toBe(0);
            expect(response.body.data.patients_count).toBe(0);
            expect(response.body.data.appointments_count).toBe(0);
        });
    });
});