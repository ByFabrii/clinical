import { describe, it, expect } from 'vitest';
import { testRequest, testUserLogin } from './setup';
import logger from '../../config/logger';

describe('Auth E2E Tests - Login de usuarios', () => {

    describe('POST /auth/login', () => {
        it('debería permitir iniciar sesión con usuario válido', async () => {
            // Arrange: Datos de inicio de sesión válidos
            const validLogin = {
                email: testUserLogin.email,
                password: testUserLogin.password
            };

            // Act: Intentar iniciar sesión
            const response = await testRequest
                .post('/auth/login')
                .send(validLogin);

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


            // Assert: Verificar que se ha recibido un token de acceso
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('access_token');
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data.user).toHaveProperty('email', testUserLogin.email);

            logger.info('✅ Test de inicio de sesión completado');
        });
    });
});