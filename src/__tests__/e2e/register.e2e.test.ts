import { describe, it, expect, beforeEach } from 'vitest';
import { testRequest, testUser, testUserLogin } from './setup';
import logger from '../../config/logger';

describe('Auth E2E Tests - Registro de Usuario', () => {

    describe('POST /auth/register', () => {

        it('debería registrar un nuevo usuario exitosamente', async () => {
            // Arrange: Preparar datos únicos para evitar conflictos
            const uniqueUser = {
                ...testUser,
                email: `prueba${Date.now()}@gmail.com`
            };

            try {
                // Act: Hacer la petición de registro
                const response = await testRequest
                    .post('/auth/register')
                    .send(uniqueUser);

                // Log completo de la respuesta para debugging
                console.log('=== RESPUESTA COMPLETA DEL SERVIDOR ===', {
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

                logger.info('📥 Respuesta recibida', {
                    status: response.status,
                    body: response.body,
                    headers: response.headers,
                    text: response.text,
                    error: response.error
                });


                // Assert: Verificar la respuesta
                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('message');
                expect(response.body.data).toHaveProperty('user');
                expect(response.body.data.user).toHaveProperty('email', uniqueUser.email);
                expect(response.body.data.user).toHaveProperty('first_name', uniqueUser.first_name);
                expect(response.body.data.user).toHaveProperty('last_name', uniqueUser.last_name);
                expect(response.body.data.user.clinic).toHaveProperty('id', uniqueUser.clinic_id);

                // Verificar que no se devuelva la contraseña
                expect(response.body.data.user).not.toHaveProperty('password');

                logger.info('✅ Test de registro exitoso completado');
            } catch (error) {
                // Log completo del error para debugging
                console.error('=== ERROR COMPLETO ===', {
                    message: error.message,
                    stack: error.stack,
                    response: error.response ? {
                        status: error.response.status,
                        headers: error.response.headers,
                        body: error.response.body,
                        text: error.response.text,
                        statusText: error.response.statusText
                    } : null
                });

                console.log('📥 Error interceptado', {
                    status: error.response?.status,
                    body: error.response?.body,
                    headers: error.response?.headers,
                    text: error.response?.text,
                    message: error.message,
                    stack: error.stack
                });

                throw error;
            }
        });

        it('debería rechazar registro con email duplicado', async () => {
            // Arrange: Usar el mismo email dos veces
            const duplicateUser = {
                ...testUser,
                email: `prueba2${Date.now()}@gmail.com`
            };

            try {
                // Act: Registrar usuario por primera vez
                const response = await testRequest
                    .post('/auth/register')
                    .send(duplicateUser);

                // Log completo de la primera respuesta
                console.log('\n=== PRIMERA RESPUESTA COMPLETA ===');
                console.log('Status:', response.status);
                console.log('Headers:', JSON.stringify(response.headers, null, 2));
                console.log('Body:', JSON.stringify(response.body, null, 2));
                console.log('Text:', response.text);
                console.log('=== FIN PRIMERA RESPUESTA ===\n');

                logger.info('📥 Respuesta de la primera petición recibida', {
                    status: response.status,
                    body: response.body,
                    headers: response.headers,
                    text: response.text
                });

                // Assert: Verificar mensaje de éxito
                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('message');
                expect(response.body.data).toHaveProperty('user');
                expect(response.body.data.user).toHaveProperty('email', duplicateUser.email);
                expect(response.body.data.user).toHaveProperty('first_name', duplicateUser.first_name);
                expect(response.body.data.user).toHaveProperty('last_name', duplicateUser.last_name);
                expect(response.body.data.user.clinic).toHaveProperty('id', duplicateUser.clinic_id);

                // Act: Intentar registrar el mismo usuario otra vez
                const response2 = await testRequest
                    .post('/auth/register')
                    .send(duplicateUser);

                // Log completo de la segunda respuesta
                console.log('\n=== SEGUNDA RESPUESTA COMPLETA ===');
                console.log('Status:', response2.status);
                console.log('Headers:', JSON.stringify(response2.headers, null, 2));
                console.log('Body:', JSON.stringify(response2.body, null, 2));
                console.log('Text:', response2.text);
                console.log('=== FIN SEGUNDA RESPUESTA ===\n');

                logger.info('📥 Respuesta de la segunda petición recibida', {
                    status: response2.status,
                    body: response2.body,
                    headers: response2.headers,
                    text: response2.text
                });

                // Assert: Verificar mensaje de error
                expect(response2.status).toBe(400);
                expect(response2.body).toHaveProperty('error');
                expect(response2.body.error).toHaveProperty('code');
                expect(response2.body.error.code).toContain('EMAIL_ALREADY_EXISTS');
                expect(response2.body.error.message).toContain('El email ya está registrado');

                logger.info('✅ Test de email duplicado completado');
            } catch (error) {
                logger.info('📥 Error interceptado', {
                    status: error.response?.status,
                    body: error.response?.body,
                    headers: error.response?.headers
                });

                throw error;
            }
        });

        it('debería rechazar registro con datos inválidos', async () => {
            // Arrange: Datos inválidos
            const invalidUser = {
                email: 'email-invalido', // Email sin formato correcto
                password: '123', // Contraseña muy corta
                full_name: '' // Nombre vacío
            };

            // Act: Intentar registrar con datos inválidos
            const response = await testRequest
                .post('/auth/register')
                .send(invalidUser);

            logger.info('📥 Respuesta recibida', {
                status: response.status,
                body: response.body,
                headers: response.headers
            });

            // Assert: Verificar que hay errores de validación
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');

            logger.info('✅ Test de datos inválidos completado');
        });

        it('debería rechazar registro con campos faltantes', async () => {
            // Arrange: Datos incompletos
            const incompleteUser = {
                email: 'test@example.com'
                // Faltan password y full_name
            };

            // Act: Intentar registrar con datos incompletos
            const response = await testRequest
                .post('/auth/register')
                .send(incompleteUser);

            logger.info('📥 Respuesta recibida', {
                status: response.status,
                body: response.body,
                headers: response.headers
            });

            // Assert: Verificar error de campos requeridos
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        

            logger.info('✅ Test de campos faltantes completado');
        });
    });
});