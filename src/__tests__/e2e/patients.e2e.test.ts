import { describe, it, expect, beforeAll } from 'vitest';
import { testRequest, loginTestUser } from './setup';
import logger from '../../config/logger';
import { logServerResponse } from '../../test/helpers/testUtils';

describe('Patients E2E Tests - Gestión de pacientes', () => {
    let authToken: string;
    let testPatientId: string;
    let testClinicId: string = '9fac1acc-2787-4fde-82d5-8fdd750d2178'; // ID de clínica de prueba
    let userId: string;

    beforeAll(async () => {
        // Obtener token de autenticación
        const loginResponse = await loginTestUser();
        authToken = loginResponse.body.data.access_token;
        userId = loginResponse.body.data.user.id;

        logger.info('🔑 Token de autenticación obtenido para tests de pacientes');
    });

    describe('POST /api/patients - Crear paciente', () => {
        it('debería crear un nuevo paciente con datos válidos', async () => {
            // Arrange
            const newPatient = {
                first_name: 'Juan Carlos',
                last_name: 'Pérez García',
                email: 'juan.perez.test@example.com',
                phone: '+52 55 1234 5678',
                date_of_birth: '1990-05-15',
                gender: 'male',
                street: 'Calle Falsa 123',
                neighborhood: 'Col. Centro',
                city: 'Ciudad de México',
                state: 'CDMX',
                postal_code: '06000',
                country: 'México',
                emergency_contact_name: 'María Pérez',
                emergency_contact_phone: '+52 55 9876 5432',
                emergency_contact_relationship: 'Esposa',
                clinic_id: testClinicId
            };

            // Act
            const response = await testRequest
                .post(`/api/clinics/${testClinicId}/patients`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(newPatient);

            logServerResponse('Respuesta de: debería crear un nuevo paciente con datos válidos', response);

            // Assert
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data).toHaveProperty('first_name', newPatient.first_name);
            expect(response.body.data).toHaveProperty('last_name', newPatient.last_name);
            expect(response.body.data).toHaveProperty('email', newPatient.email);
            expect(response.body.data).toHaveProperty('gender', newPatient.gender);
            expect(response.body.data).toHaveProperty('clinic_id', newPatient.clinic_id);
            expect(response.body.data).toHaveProperty('is_active', true);
            expect(response.body.data).toHaveProperty('created_by');

            // Guardar ID para tests posteriores
            testPatientId = response.body.data.id;
        });

        it('debería fallar al crear paciente sin autenticación', async () => {
            // Arrange
            const newPatient = {
                first_name: 'Sin',
                last_name: 'Autenticación',
                email: 'noauth@example.com',
                phone: '+52 55 9999 9999',
                date_of_birth: '1985-01-01',
                gender: 'female'
            };

            // Act
            const response = await testRequest
                .post(`/api/clinics/${testClinicId}/patients`)
                .send(newPatient);

            // Assert
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });

        it('debería fallar al crear paciente con datos inválidos', async () => {
            // Arrange - Datos inválidos (email mal formateado, género inválido)
            const invalidPatient = {
                first_name: 'Datos',
                last_name: 'Inválidos',
                email: 'email-invalido', // Email mal formateado
                phone: '+52 55 1111 1111',
                date_of_birth: '1990-01-01',
                gender: 'invalid_gender', // Género inválido
                clinic_id: testClinicId
            };

            // Act
            const response = await testRequest
                .post(`/api/clinics/${testClinicId}/patients`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidPatient);

            // Assert
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message');
        });
    });

    describe('GET /api/patients - Obtener pacientes', () => {
        it('debería obtener lista de pacientes con autenticación', async () => {
            // Act
            const response = await testRequest
                .get(`/api/clinics/${testClinicId}/patients`)
                .set('Authorization', `Bearer ${authToken}`);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('debería fallar al obtener lista sin autenticación', async () => {
            // Act
            const response = await testRequest
                .get(`/api/clinics/${testClinicId}/patients`);

            // Assert
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
        });
    });

    describe('GET /api/patients/:id - Obtener paciente por ID', () => {
        it('debería obtener un paciente específico por ID', async () => {
            // Primero crear un paciente para obtenerlo
            const newPatient = {
                first_name: 'Paciente',
                last_name: 'Para Obtener',
                email: 'paciente.obtener@example.com',
                phone: '+52 55 3333 3333',
                date_of_birth: '1992-08-20',
                gender: 'female'
            };

            const createResponse = await testRequest
                .post(`/api/clinics/${testClinicId}/patients`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(newPatient);

            logServerResponse('Respuesta de: debería crear un nuevo paciente con datos válidos', createResponse);

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.data).toBeDefined();
            const patientId = createResponse.body.data.id;

            // Act - Obtener el paciente creado
            const response = await testRequest
                .get(`/api/clinics/${testClinicId}/patients/${patientId}`)
                .set('Authorization', `Bearer ${authToken}`);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('id', patientId);
            expect(response.body.data).toHaveProperty('first_name', newPatient.first_name);
            expect(response.body.data).toHaveProperty('email', newPatient.email);
        });

        it('debería fallar al obtener paciente con ID inexistente', async () => {
            // Act
            const response = await testRequest
                .get(`/api/clinics/${testClinicId}/patients/00000000-0000-0000-0000-000000000000`)
                .set('Authorization', `Bearer ${authToken}`);

            logServerResponse('Respuesta de: debería fallar al obtener paciente con ID inexistente', response);

            // Assert
            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe('Paciente no encontrado');
        });
    });

    describe('PUT /api/patients/:id - Actualizar paciente', () => {
        it('debería actualizar un paciente existente', async () => {
            // Primero crear un paciente para actualizarlo
            const newPatient = {
                first_name: 'Paciente',
                last_name: 'Para Actualizar',
                email: 'paciente.actualizar@example.com',
                phone: '+52 55 4444 4444',
                date_of_birth: '1987-12-05',
                gender: 'male'
            };

            const createResponse = await testRequest
                .post(`/api/clinics/${testClinicId}/patients`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(newPatient);

            logServerResponse('Respuesta de: debería crear un nuevo paciente con datos válidos', createResponse);

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.data).toBeDefined();
            const patientId = createResponse.body.data.id;

            // Arrange - Datos actualizados
            const updatedData = {
                first_name: 'Paciente Actualizado',
                phone: '+52 55 5555 5555',
                emergency_contact_name: 'Contacto Actualizado'
            };

            // Act
            const response = await testRequest
                .put(`/api/clinics/${testClinicId}/patients/${patientId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updatedData);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('first_name', updatedData.first_name);
            expect(response.body.data).toHaveProperty('phone', updatedData.phone);
        });

        it('debería fallar al actualizar paciente con ID inexistente', async () => {
            // Arrange
            const updatedData = {
                first_name: 'No Existe'
            };

            // Act
            const response = await testRequest
                .put(`/api/clinics/${testClinicId}/patients/00000000-0000-0000-0000-000000000000`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updatedData);

            logServerResponse('Respuesta de: debería fallar al actualizar paciente con ID inexistente', response);

            // Assert
            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe('Paciente no encontrado');
        });
    });

    describe('PATCH /api/patients/:id/status - Cambiar estado del paciente', () => {
        it('debería cambiar el estado de un paciente existente', async () => {
            // Primero crear un paciente para cambiar su estado
            const newPatient = {
                first_name: 'Paciente',
                last_name: 'Para Cambiar Estado',
                email: 'paciente.estado@example.com',
                phone: '+52 55 6666 6666',
                date_of_birth: '1985-04-18',
                gender: 'female',
                clinic_id: testClinicId
            };

            const createResponse = await testRequest
                .post(`/api/clinics/${testClinicId}/patients`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(newPatient);

            logServerResponse('Respuesta de: debería crear un nuevo paciente con datos válidos', createResponse);

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.data).toBeDefined();
            const patientId = createResponse.body.data.id;

            // Act
            const response = await testRequest
                .patch(`/api/clinics/${testClinicId}/patients/${patientId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ is_active: true });

            logServerResponse('Respuesta de: debería cambiar el estado de un paciente existente', response);

            // Assert
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
        });

        it('debería fallar al cambiar estado de paciente con ID inexistente', async () => {
            // Act
            const response = await testRequest
                .patch(`/api/clinics/${testClinicId}/patients/00000000-0000-0000-0000-000000000000/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ is_active: true });

            logServerResponse('Respuesta de: debería fallar al cambiar estado de paciente con ID inexistente', response);

            // Assert
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe('Paciente no encontrado');
        });
    });
});