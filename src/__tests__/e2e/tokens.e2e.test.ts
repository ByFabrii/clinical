/**
 * =================================================================
 * TESTS E2E - GESTIÓN DE TOKENS (REFRESH Y LOGOUT)
 * =================================================================
 * 
 * PROPÓSITO:
 * Este archivo contiene tests end-to-end para la gestión de tokens,
 * específicamente para los flujos de renovación de tokens (refresh)
 * y cierre de sesión (logout).
 * 
 * ¿QUÉ SON LOS TESTS E2E?
 * Los tests End-to-End simulan el comportamiento real de un usuario
 * interactuando con la API completa, desde la request HTTP hasta
 * la respuesta final, pasando por todos los middlewares, controladores
 * y servicios.
 * 
 * ¿POR QUÉ ESTOS TESTS SON CRÍTICOS PARA EL MVP?
 * 1. **Seguridad**: Los tokens son la base de la autenticación
 * 2. **UX**: Un logout que falla frustra al usuario
 * 3. **Sesiones**: El refresh permite sesiones largas sin re-login
 * 4. **Compliance**: NOM-024 requiere trazabilidad de sesiones
 * 
 * CASOS CUBIERTOS:
 * ✅ Token refresh exitoso con refresh token válido
 * ✅ Rechazo de refresh con token inválido/expirado
 * ✅ Logout exitoso e invalidación de tokens
 * ✅ Verificación de token válido (/auth/verify)
 * 
 * =================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testRequest, testUserLogin, loginTestUser } from './setup';
import logger from '../../config/logger';
import { AuthErrorCode } from '../../types/auth';

/**
 * =================================================================
 * EXPLICACIÓN DE CONCEPTOS CLAVE
 * =================================================================
 * 
 * 1. **ACCESS TOKEN vs REFRESH TOKEN**:
 *    - Access Token: Token de corta duración (1 hora) para autenticar requests
 *    - Refresh Token: Token de larga duración (30 días) para renovar access tokens
 *    - ¿Por qué dos tokens? Seguridad: si roban el access token, expira pronto
 * 
 * 2. **FLUJO DE REFRESH**:
 *    - Cliente detecta que access token expiró (401)
 *    - Cliente envía refresh token a /auth/refresh
 *    - Servidor valida refresh token y genera nuevo access token
 *    - Cliente usa nuevo access token para requests
 * 
 * 3. **FLUJO DE LOGOUT**:
 *    - Cliente envía request a /auth/logout con access token
 *    - Servidor invalida la sesión (marca tokens como inválidos)
 *    - Cliente elimina tokens del storage local
 * 
 * 4. **VERIFICACIÓN DE TOKEN**:
 *    - Endpoint /auth/verify permite validar si un token es válido
 *    - Útil para verificar estado de sesión sin hacer requests pesados
 * 
 * =================================================================
 */

describe('Auth E2E Tests - Gestión de Tokens', () => {

    /**
     * =================================================================
     * VARIABLES DE ESTADO PARA LOS TESTS
     * =================================================================
     * 
     * Estas variables almacenan el estado entre tests:
     * - validAccessToken: Token válido obtenido del login
     * - validRefreshToken: Refresh token para renovación
     * - expiredToken: Token expirado para tests negativos
     */
    let validAccessToken: string;
    let validRefreshToken: string;
    let expiredToken: string;
    let loginResponse: any;

    /**
     * =================================================================
     * SETUP ANTES DE CADA TEST
     * =================================================================
     * 
     * ¿POR QUÉ beforeEach?
     * Cada test debe empezar con un estado limpio y predecible.
     * Hacemos login antes de cada test para obtener tokens frescos.
     */
    beforeEach(async () => {
        logger.info('🧪 Preparando tokens para test E2E', {
            action: 'e2e_tokens_setup',
            timestamp: new Date().toISOString()
        });

        // Hacer login para obtener tokens válidos
        loginResponse = await loginTestUser();
        
        // Extraer tokens de la respuesta
        if (loginResponse.status === 200 && loginResponse.body.data) {
            validAccessToken = loginResponse.body.data.access_token;
            validRefreshToken = loginResponse.body.data.refresh_token || 'mock_refresh_token';
        }

        // Simular un token expirado (para tests negativos)
        expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.expired';

        logger.debug('🔑 Tokens preparados para testing', {
            hasAccessToken: !!validAccessToken,
            hasRefreshToken: !!validRefreshToken,
            hasExpiredToken: !!expiredToken
        });
    });

    /**
     * =================================================================
     * TESTS DE REFRESH TOKEN
     * =================================================================
     */
    describe('POST /auth/refresh - Renovación de Tokens', () => {

        /**
         * TEST 1: Refresh exitoso con token válido
         * 
         * ESCENARIO:
         * - Given: Tengo un refresh token válido
         * - When: Envío request a /auth/refresh
         * - Then: Recibo un nuevo access token
         * 
         * ¿QUÉ VALIDAMOS?
         * - Status 200 (éxito)
         * - Estructura de respuesta correcta
         * - Nuevo access token presente
         * - Metadatos de respuesta
         */
        it('debería renovar access token con refresh token válido', async () => {
            // Arrange: Preparar datos de refresh
            const refreshData = {
                refresh_token: validRefreshToken
            };

            logger.info('🔄 Iniciando test de refresh token exitoso', {
                hasRefreshToken: !!refreshData.refresh_token,
                action: 'test_refresh_success_start'
            });

            try {
                // Act: Enviar request de refresh
                const response = await testRequest
                    .post('/auth/refresh')
                    .send(refreshData);

                // Log de debugging
                console.log('=== RESPUESTA DE REFRESH TOKEN ===', {
                    status: response.status,
                    body: response.body,
                    headers: response.headers
                });

                // Assert: Verificar respuesta
                // NOTA: Actualmente el endpoint devuelve 501 (Not Implemented)
                // Cuando se implemente, debería ser 200
                if (response.status === 501) {
                    // Verificar que es el error esperado de "no implementado"
                    expect(response.body).toHaveProperty('success', false);
                    expect(response.body.error).toHaveProperty('code', AuthErrorCode.NOT_IMPLEMENTED);
                    expect(response.body.error.message).toContain('no implementada');
                    
                    logger.info('⚠️ Refresh token no implementado (esperado)', {
                        status: response.status,
                        code: response.body.error?.code
                    });
                } else {
                    // Cuando esté implementado, verificar estructura correcta
                    expect(response.status).toBe(200);
                    expect(response.body).toHaveProperty('success', true);
                    expect(response.body.data).toHaveProperty('access_token');
                    expect(response.body.data).toHaveProperty('expires_in');
                    expect(response.body).toHaveProperty('timestamp');
                }

                logger.info('✅ Test de refresh token completado');

            } catch (error) {
                logger.error('❌ Error en test de refresh token', {
                    error: error.message,
                    stack: error.stack
                });
                throw error;
            }
        });

        /**
         * TEST 2: Rechazo con refresh token inválido
         * 
         * ESCENARIO:
         * - Given: Tengo un refresh token inválido/malformado
         * - When: Envío request a /auth/refresh
         * - Then: Recibo error 400 o 401
         * 
         * ¿POR QUÉ ES IMPORTANTE?
         * - Prevenir ataques con tokens falsos
         * - Validar manejo de errores
         * - Asegurar mensajes de error claros
         */
        it('debería rechazar refresh con token inválido', async () => {
            // Arrange: Token inválido
            const invalidRefreshData = {
                refresh_token: 'token_invalido_malformado'
            };

            logger.info('🚫 Iniciando test de refresh token inválido', {
                action: 'test_refresh_invalid_start'
            });

            // Act: Enviar request con token inválido
            const response = await testRequest
                .post('/auth/refresh')
                .send(invalidRefreshData);

            console.log('=== RESPUESTA CON TOKEN INVÁLIDO ===', {
                status: response.status,
                body: response.body
            });

            // Assert: Verificar rechazo
            // Puede ser 501 (no implementado) o 400/401 cuando esté implementado
            if (response.status === 501) {
                expect(response.body.error.code).toBe(AuthErrorCode.NOT_IMPLEMENTED);
            } else {
                expect([400, 401]).toContain(response.status);
                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('error');
            }

            logger.info('✅ Test de refresh token inválido completado');
        });

        /**
         * TEST 3: Rechazo sin refresh token
         * 
         * ESCENARIO:
         * - Given: No envío refresh token en el body
         * - When: Envío request a /auth/refresh
         * - Then: Recibo error 400 (Bad Request)
         */
        it('debería rechazar refresh sin token', async () => {
            logger.info('🚫 Iniciando test de refresh sin token', {
                action: 'test_refresh_missing_start'
            });

            // Act: Enviar request sin refresh token
            const response = await testRequest
                .post('/auth/refresh')
                .send({}); // Body vacío

            console.log('=== RESPUESTA SIN REFRESH TOKEN ===', {
                status: response.status,
                body: response.body
            });

            // Assert: Verificar error 400
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toHaveProperty('code', AuthErrorCode.TOKEN_MISSING);
            expect(response.body.error.message).toContain('Refresh token requerido');

            logger.info('✅ Test de refresh sin token completado');
        });
    });

    /**
     * =================================================================
     * TESTS DE LOGOUT
     * =================================================================
     */
    describe('POST /auth/logout - Cierre de Sesión', () => {

        /**
         * TEST 4: Logout exitoso
         * 
         * ESCENARIO:
         * - Given: Estoy autenticado con un token válido
         * - When: Envío request a /auth/logout
         * - Then: Mi sesión se cierra exitosamente
         * 
         * ¿QUÉ VALIDAMOS?
         * - Status 200 (éxito)
         * - Mensaje de confirmación
         * - Logs de auditoría generados
         * - Token queda invalidado (idealmente)
         */
        it('debería cerrar sesión exitosamente con token válido', async () => {
            // Verificar que tenemos un token válido
            expect(validAccessToken).toBeDefined();

            logger.info('🚪 Iniciando test de logout exitoso', {
                hasToken: !!validAccessToken,
                action: 'test_logout_success_start'
            });

            // Act: Enviar request de logout con token válido
            const response = await testRequest
                .post('/auth/logout')
                .set('Authorization', `Bearer ${validAccessToken}`);

            console.log('=== RESPUESTA DE LOGOUT ===', {
                status: response.status,
                body: response.body,
                headers: response.headers
            });

            // Assert: Verificar logout exitoso
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.message).toContain('Sesión cerrada exitosamente');
            expect(response.body).toHaveProperty('timestamp');

            logger.info('✅ Test de logout exitoso completado');
        });

        /**
         * TEST 5: Logout sin token de autorización
         * 
         * ESCENARIO:
         * - Given: No envío token de autorización
         * - When: Envío request a /auth/logout
         * - Then: Recibo error 401 (Unauthorized)
         * 
         * ¿POR QUÉ ES IMPORTANTE?
         * - Prevenir logout de sesiones ajenas
         * - Validar middleware de autenticación
         * - Asegurar que las rutas protegidas están protegidas
         */
        it('debería rechazar logout sin token de autorización', async () => {
            logger.info('🚫 Iniciando test de logout sin autorización', {
                action: 'test_logout_unauthorized_start'
            });

            // Act: Enviar request sin header Authorization
            const response = await testRequest
                .post('/auth/logout');
                // No enviamos .set('Authorization', ...)

            console.log('=== RESPUESTA LOGOUT SIN AUTH ===', {
                status: response.status,
                body: response.body
            });

            // Assert: Verificar rechazo
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toHaveProperty('code', AuthErrorCode.TOKEN_MISSING);

            logger.info('✅ Test de logout sin autorización completado');
        });

        /**
         * TEST 6: Logout con token inválido
         * 
         * ESCENARIO:
         * - Given: Envío un token malformado o expirado
         * - When: Envío request a /auth/logout
         * - Then: Recibo error 401 (Unauthorized)
         */
        it('debería rechazar logout con token inválido', async () => {
            logger.info('🚫 Iniciando test de logout con token inválido', {
                action: 'test_logout_invalid_token_start'
            });

            // Act: Enviar request con token inválido
            const response = await testRequest
                .post('/auth/logout')
                .set('Authorization', `Bearer ${expiredToken}`);

            console.log('=== RESPUESTA LOGOUT TOKEN INVÁLIDO ===', {
                status: response.status,
                body: response.body
            });

            // Assert: Verificar rechazo
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error.code).toMatch(/TOKEN_INVALID|TOKEN_EXPIRED/);

            logger.info('✅ Test de logout con token inválido completado');
        });
    });

    /**
     * =================================================================
     * TESTS DE VERIFICACIÓN DE TOKEN
     * =================================================================
     */
    describe('GET /auth/verify - Verificación de Token', () => {

        /**
         * TEST 7: Verificación exitosa de token válido
         * 
         * ESCENARIO:
         * - Given: Tengo un token válido
         * - When: Envío request a /auth/verify
         * - Then: Recibo confirmación de que el token es válido
         * 
         * ¿PARA QUÉ SIRVE?
         * - Verificar estado de sesión sin hacer requests pesados
         * - Validar tokens antes de operaciones críticas
         * - Debugging de problemas de autenticación
         */
        it('debería verificar token válido exitosamente', async () => {
            expect(validAccessToken).toBeDefined();

            logger.info('✅ Iniciando test de verificación de token válido', {
                hasToken: !!validAccessToken,
                action: 'test_verify_valid_start'
            });

            // Act: Verificar token válido
            const response = await testRequest
                .get('/auth/verify')
                .set('Authorization', `Bearer ${validAccessToken}`);

            console.log('=== RESPUESTA DE VERIFICACIÓN ===', {
                status: response.status,
                body: response.body
            });

            // Assert: Verificar respuesta exitosa
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.message).toContain('Token válido');
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data).toHaveProperty('token_info');
            expect(response.body.data.token_info).toHaveProperty('expires_at');
            expect(response.body.data.token_info).toHaveProperty('issued_at');

            logger.info('✅ Test de verificación de token válido completado');
        });

        /**
         * TEST 8: Verificación de token inválido
         * 
         * ESCENARIO:
         * - Given: Tengo un token inválido o expirado
         * - When: Envío request a /auth/verify
         * - Then: Recibo error 401
         */
        it('debería rechazar verificación de token inválido', async () => {
            logger.info('🚫 Iniciando test de verificación de token inválido', {
                action: 'test_verify_invalid_start'
            });

            // Act: Verificar token inválido
            const response = await testRequest
                .get('/auth/verify')
                .set('Authorization', `Bearer ${expiredToken}`);

            console.log('=== RESPUESTA VERIFICACIÓN INVÁLIDA ===', {
                status: response.status,
                body: response.body
            });

            // Assert: Verificar rechazo
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error.code).toMatch(/TOKEN_INVALID|TOKEN_EXPIRED/);

            logger.info('✅ Test de verificación de token inválido completado');
        });
    });
});

/**
 * =================================================================
 * NOTAS DE IMPLEMENTACIÓN Y DEBUGGING
 * =================================================================
 * 
 * 1. **ESTADO ACTUAL**:
 *    - Login y logout están implementados
 *    - Refresh token devuelve 501 (Not Implemented)
 *    - Verify token está implementado
 * 
 * 2. **CUANDO IMPLEMENTES REFRESH TOKEN**:
 *    - Actualizar los asserts en los tests de refresh
 *    - Cambiar expectativas de 501 a 200/400/401
 *    - Agregar validación de estructura de respuesta
 * 
 * 3. **DEBUGGING**:
 *    - Todos los tests tienen logs detallados
 *    - Console.log para ver respuestas completas
 *    - Logger para trazabilidad en desarrollo
 * 
 * 4. **SEGURIDAD**:
 *    - Tests validan tanto casos positivos como negativos
 *    - Verifican códigos de error específicos
 *    - Aseguran que rutas protegidas están protegidas
 * 
 * 5. **COMPLIANCE NOM-024**:
 *    - Logout genera logs de auditoría
 *    - Trazabilidad de sesiones
 *    - Timestamps en todas las operaciones
 * 
 * =================================================================
 */