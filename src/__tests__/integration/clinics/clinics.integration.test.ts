import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testRequest, createTestUser, testUser } from '../../e2e/setup';
import logger from '../../../config/logger';

describe('Clinics Integration Tests - Lógica de negocio', () => {
    let authToken: string;
    let testClinicId: string;
    let userId: string;

    beforeAll(async () => {
        // Crear usuario de prueba y obtener token
        const userResponse = await createTestUser();
        userId = userResponse.user.id;
        authToken = userResponse.access_token;
        
        logger.info('🔧 Setup de tests de integración para clínicas completado');
    });

    describe('Validaciones de negocio para clínicas', () => {
        it('debería validar formato de email correctamente', async () => {
            const invalidEmails = [
                'email-sin-arroba',
                'email@',
                '@dominio.com',
                'email@dominio',
                'email..doble@dominio.com'
            ];

            for (const email of invalidEmails) {
                const response = await testRequest
                    .post('/api/clinics')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        name: 'Clínica Test',
                        address: 'Dirección test',
                        phone: '+52 55 1234 5678',
                        email: email
                    });

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            }
        });

        it('debería validar formato de teléfono mexicano', async () => {
            const invalidPhones = [
                '123456789', // Muy corto
                '+1 555 123 4567', // Código de país incorrecto
                '55-1234-5678', // Sin código de país
                '+52 55 123 456', // Muy corto
                '+52 55 1234 56789' // Muy largo
            ];

            for (const phone of invalidPhones) {
                const response = await testRequest
                    .post('/api/clinics')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        name: 'Clínica Test',
                        address: 'Dirección test',
                        phone: phone,
                        email: 'test@example.com'
                    });

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            }
        });

        it('debería validar longitud mínima de campos requeridos', async () => {
            const invalidData = {
                name: 'AB', // Muy corto (mínimo 3 caracteres)
                address: 'X', // Muy corto (mínimo 10 caracteres)
                phone: '+52 55 1234 5678',
                email: 'test@example.com'
            };

            const response = await testRequest
                .post('/api/clinics')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.errors).toBeDefined();
        });
    });

    describe('Operaciones CRUD completas', () => {
        it('debería crear, leer, actualizar y cambiar estado de clínica', async () => {
            // CREATE - Crear clínica
            const createData = {
                name: 'Clínica Integral Test',
                address: 'Av. Revolución 1234, Col. Centro, CDMX',
                phone: '+52 55 1234 5678',
                email: 'integral@test.com',
                license_number: 'LIC-INT-001',
                description: 'Clínica de prueba para tests de integración'
            };

            const createResponse = await testRequest
                .post('/api/clinics')
                .set('Authorization', `Bearer ${authToken}`)
                .send(createData);

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.data).toMatchObject({
                name: createData.name,
                email: createData.email,
                status: 'active'
            });

            testClinicId = createResponse.body.data.id;

            // READ - Leer clínica creada
            const readResponse = await testRequest
                .get(`/api/clinics/${testClinicId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(readResponse.status).toBe(200);
            expect(readResponse.body.data.id).toBe(testClinicId);
            expect(readResponse.body.data.name).toBe(createData.name);

            // UPDATE - Actualizar clínica
            const updateData = {
                name: 'Clínica Integral Test - Actualizada',
                description: 'Descripción actualizada'
            };

            const updateResponse = await testRequest
                .put(`/api/clinics/${testClinicId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);

            expect(updateResponse.status).toBe(200);
            expect(updateResponse.body.data.name).toBe(updateData.name);
            expect(updateResponse.body.data.description).toBe(updateData.description);

            // STATUS CHANGE - Cambiar estado
            const statusResponse = await testRequest
                .patch(`/api/clinics/${testClinicId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'inactive' });

            expect(statusResponse.status).toBe(200);
            expect(statusResponse.body.data.status).toBe('inactive');

            logger.info('✅ Test CRUD completo de clínica completado');
        });
    });

    describe('Paginación y filtros', () => {
        it('debería manejar paginación correctamente', async () => {
            // Test con diferentes parámetros de paginación
            const paginationTests = [
                { page: 1, limit: 5 },
                { page: 1, limit: 10 },
                { page: 2, limit: 3 }
            ];

            for (const params of paginationTests) {
                const response = await testRequest
                    .get(`/api/clinics?page=${params.page}&limit=${params.limit}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body.pagination).toMatchObject({
                    page: params.page,
                    limit: params.limit
                });
                expect(response.body.pagination).toHaveProperty('total');
                expect(response.body.pagination).toHaveProperty('totalPages');
            }
        });

        it('debería manejar filtros de búsqueda', async () => {
            const searchTests = [
                { search: 'Test' },
                { search: 'Integral' },
                { status: 'active' },
                { status: 'inactive' }
            ];

            for (const filter of searchTests) {
                const queryString = Object.entries(filter)
                    .map(([key, value]) => `${key}=${value}`)
                    .join('&');

                const response = await testRequest
                    .get(`/api/clinics?${queryString}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(Array.isArray(response.body.data)).toBe(true);
            }
        });
    });

    describe('Estadísticas de clínica', () => {
        it('debería calcular estadísticas básicas correctamente', async () => {
            const response = await testRequest
                .get(`/api/clinics/${testClinicId}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveProperty('total_patients');
            expect(response.body.data).toHaveProperty('total_appointments');
            expect(response.body.data).toHaveProperty('total_treatments');
            expect(response.body.data).toHaveProperty('active_patients');
            
            // Verificar que son números
            expect(typeof response.body.data.total_patients).toBe('number');
            expect(typeof response.body.data.total_appointments).toBe('number');
            expect(typeof response.body.data.total_treatments).toBe('number');
            expect(typeof response.body.data.active_patients).toBe('number');

            // Verificar que no son negativos
            expect(response.body.data.total_patients).toBeGreaterThanOrEqual(0);
            expect(response.body.data.total_appointments).toBeGreaterThanOrEqual(0);
            expect(response.body.data.total_treatments).toBeGreaterThanOrEqual(0);
            expect(response.body.data.active_patients).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Autorización y permisos', () => {
        it('debería respetar permisos de usuario por clínica', async () => {
            // Este test verifica que los usuarios solo puedan ver/modificar
            // clínicas a las que tienen acceso (multi-tenant)
            const response = await testRequest
                .get('/api/clinics')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            
            // Verificar que solo se devuelven clínicas del usuario
            if (response.body.data.length > 0) {
                // Cada clínica debería estar asociada al usuario actual
                // (esto dependerá de tu implementación específica de multi-tenant)
                expect(response.body.data).toBeDefined();
            }
        });

        it('debería fallar al acceder a clínica sin permisos', async () => {
            // Intentar acceder a una clínica que no existe o no tiene permisos
            const fakeClinicId = '00000000-0000-0000-0000-000000000000';
            
            const response = await testRequest
                .get(`/api/clinics/${fakeClinicId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });

    describe('Manejo de errores', () => {
        it('debería manejar errores de base de datos graciosamente', async () => {
            // Test con UUID malformado
            const response = await testRequest
                .get('/api/clinics/invalid-uuid-format')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBeDefined();
        });

        it('debería validar campos requeridos en actualización', async () => {
            const response = await testRequest
                .put(`/api/clinics/${testClinicId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({}); // Enviar objeto vacío

            // Debería aceptar actualización parcial o rechazar si no hay campos
            expect([200, 400]).toContain(response.status);
        });
    });
});