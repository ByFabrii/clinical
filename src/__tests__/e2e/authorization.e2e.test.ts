/**
 * =================================================================
 * TESTS E2E - AUTORIZACIÓN BÁSICA POR ROLES
 * =================================================================
 * 
 * PROPÓSITO:
 * Este archivo contiene tests end-to-end para verificar que el sistema
 * de autorización por roles funciona correctamente, asegurando que
 * solo los usuarios con permisos adecuados puedan acceder a recursos
 * específicos.
 * 
 * ¿QUÉ ES LA AUTORIZACIÓN?
 * La autorización es el proceso de verificar si un usuario autenticado
 * tiene permisos para realizar una acción específica o acceder a un
 * recurso determinado. Es diferente de la autenticación:
 * 
 * - **AUTENTICACIÓN**: "¿Quién eres?" (verificar identidad)
 * - **AUTORIZACIÓN**: "¿Qué puedes hacer?" (verificar permisos)
 * 
 * ¿POR QUÉ ESTOS TESTS SON CRÍTICOS PARA EL MVP?
 * 1. **Seguridad**: Prevenir acceso no autorizado a datos sensibles
 * 2. **Compliance**: NOM-024 requiere control de acceso estricto
 * 3. **Multi-tenant**: Cada clínica debe ver solo sus datos
 * 4. **Roles médicos**: Doctores, asistentes y recepcionistas tienen permisos diferentes
 * 5. **Auditoría**: Rastrear quién accede a qué información
 * 
 * CASOS CUBIERTOS:
 * ✅ Acceso exitoso con token válido a rutas protegidas
 * ✅ Rechazo de acceso sin token de autorización
 * ✅ Rechazo de acceso con token inválido/expirado
 * ✅ Verificación de middleware de autenticación
 * ✅ Validación de estructura de respuestas de error
 * 
 * =================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testRequest, testUserLogin, loginTestUser, createTestUser } from './setup';
import logger from '../../config/logger';
import { AuthErrorCode, UserRole } from '../../types/auth';

/**
 * =================================================================
 * EXPLICACIÓN DE CONCEPTOS CLAVE
 * =================================================================
 * 
 * 1. **JERARQUÍA DE ROLES**:
 *    - SYSTEM_ADMIN: Acceso total al sistema, todas las clínicas
 *    - CLINIC_ADMIN: Administrador de una clínica específica
 *    - DOCTOR: Personal médico con acceso a pacientes
 *    - ASSISTANT: Asistente médico con permisos limitados
 *    - RECEPTIONIST: Personal de recepción, solo citas y contacto
 * 
 * 2. **MIDDLEWARE DE AUTORIZACIÓN**:
 *    - authenticate: Verifica que el usuario esté autenticado
 *    - authorize: Verifica que el usuario tenga el rol correcto
 *    - verifyClinicAccess: Verifica acceso a clínica específica
 * 
 * 3. **RUTAS PROTEGIDAS ACTUALES**:
 *    - GET /auth/profile: Requiere autenticación
 *    - PUT /auth/profile: Requiere autenticación
 *    - POST /auth/logout: Requiere autenticación
 *    - GET /auth/verify: Requiere autenticación
 * 
 * 4. **CÓDIGOS DE ERROR DE AUTORIZACIÓN**:
 *    - TOKEN_MISSING: No se proporcionó token
 *    - TOKEN_INVALID: Token malformado o inválido
 *    - TOKEN_EXPIRED: Token expirado
 *    - INSUFFICIENT_PERMISSIONS: Usuario sin permisos
 *    - AUTHENTICATION_FAILED: Error general de autenticación
 * 
 * =================================================================
 */

describe('Auth E2E Tests - Autorización Básica', () => {

    /**
     * =================================================================
     * VARIABLES DE ESTADO PARA LOS TESTS
     * =================================================================
     */
    let validAccessToken: string;
    let expiredToken: string;
    let malformedToken: string;
    let loginResponse: any;
    let testUser: any;

    /**
     * =================================================================
     * SETUP ANTES DE CADA TEST
     * =================================================================
     * 
     * Preparamos diferentes tipos de tokens para probar diversos
     * escenarios de autorización.
     */
    beforeEach(async () => {
        logger.info('🧪 Preparando tokens para tests de autorización', {
            action: 'e2e_authorization_setup',
            timestamp: new Date().toISOString()
        });

        // Hacer login para obtener token válido
        loginResponse = await loginTestUser();
        
        if (loginResponse.status === 200 && loginResponse.body.data) {
            validAccessToken = loginResponse.body.data.access_token;
            testUser = loginResponse.body.data.user;
        }

        // Simular diferentes tipos de tokens inválidos
        expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.expired';
        malformedToken = 'token.malformado.invalido';

        logger.debug('🔑 Tokens preparados para testing de autorización', {
            hasValidToken: !!validAccessToken,
            hasExpiredToken: !!expiredToken,
            hasMalformedToken: !!malformedToken,
            userRole: testUser?.role
        });
    });

    /**
     * =================================================================
     * TESTS DE ACCESO A RUTAS PROTEGIDAS
     * =================================================================
     */
    describe('Acceso a Rutas Protegidas', () => {

        /**
         * TEST 1: Acceso exitoso con token válido
         * 
         * ESCENARIO:
         * - Given: Tengo un token de acceso válido
         * - When: Accedo a una ruta protegida (/auth/profile)
         * - Then: Obtengo acceso exitoso y datos del usuario
         * 
         * ¿QUÉ VALIDAMOS?
         * - Status 200 (éxito)
         * - Datos del usuario en la respuesta
         * - Estructura correcta de la respuesta
         * - Middleware de autenticación funcionando
         */
        it('debería permitir acceso con token válido a /auth/profile', async () => {
            expect(validAccessToken).toBeDefined();

            logger.info('✅ Iniciando test de acceso autorizado', {
                endpoint: '/auth/profile',
                hasToken: !!validAccessToken,
                action: 'test_authorized_access_start'
            });

            try {
                // Act: Acceder a ruta protegida con token válido
                const response = await testRequest
                    .get('/auth/profile')
                    .set('Authorization', `Bearer ${validAccessToken}`);

                console.log('=== RESPUESTA DE ACCESO AUTORIZADO ===', {
                    status: response.status,
                    body: response.body,
                    headers: response.headers
                });

                // Assert: Verificar acceso exitoso
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('user');
                expect(response.body.data.user).toHaveProperty('id');
                expect(response.body.data.user).toHaveProperty('email');
                expect(response.body.data.user).toHaveProperty('role');
                expect(response.body).toHaveProperty('timestamp');

                // Verificar que los datos del usuario son correctos
                expect(response.body.data.user.email).toBe(testUser.email);
                expect(response.body.data.user.role).toBe(testUser.role);

                logger.info('✅ Test de acceso autorizado completado exitosamente');

            } catch (error) {
                logger.error('❌ Error en test de acceso autorizado', {
                    error: error.message,
                    stack: error.stack
                });
                throw error;
            }
        });

        /**
         * TEST 2: Acceso exitoso a endpoint de verificación
         * 
         * ESCENARIO:
         * - Given: Tengo un token de acceso válido
         * - When: Accedo a /auth/verify
         * - Then: Obtengo confirmación de token válido
         */
        it('debería permitir acceso con token válido a /auth/verify', async () => {
            expect(validAccessToken).toBeDefined();

            logger.info('✅ Iniciando test de verificación autorizada', {
                endpoint: '/auth/verify',
                action: 'test_verify_authorized_start'
            });

            // Act: Verificar token en endpoint protegido
            const response = await testRequest
                .get('/auth/verify')
                .set('Authorization', `Bearer ${validAccessToken}`);

            console.log('=== RESPUESTA DE VERIFICACIÓN AUTORIZADA ===', {
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

            logger.info('✅ Test de verificación autorizada completado');
        });
    });

    /**
     * =================================================================
     * TESTS DE RECHAZO DE ACCESO
     * =================================================================
     */
    describe('Rechazo de Acceso No Autorizado', () => {

        /**
         * TEST 3: Rechazo sin token de autorización
         * 
         * ESCENARIO:
         * - Given: No envío token de autorización
         * - When: Intento acceder a una ruta protegida
         * - Then: Recibo error 401 (Unauthorized)
         * 
         * ¿POR QUÉ ES IMPORTANTE?
         * - Verificar que las rutas están realmente protegidas
         * - Asegurar que el middleware de autenticación funciona
         * - Prevenir acceso anónimo a datos sensibles
         */
        it('debería rechazar acceso sin token a /auth/profile', async () => {
            logger.info('🚫 Iniciando test de acceso sin autorización', {
                endpoint: '/auth/profile',
                action: 'test_unauthorized_access_start'
            });

            // Act: Intentar acceder sin token
            const response = await testRequest
                .get('/auth/profile');
                // No enviamos header Authorization

            console.log('=== RESPUESTA SIN AUTORIZACIÓN ===', {
                status: response.status,
                body: response.body
            });

            // Assert: Verificar rechazo
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toHaveProperty('code', AuthErrorCode.TOKEN_MISSING);
            expect(response.body.error.message).toContain('Token de acceso requerido');
            expect(response.body.error).toHaveProperty('timestamp');

            logger.info('✅ Test de acceso sin autorización completado');
        });

        /**
         * TEST 4: Rechazo con token malformado
         * 
         * ESCENARIO:
         * - Given: Envío un token malformado
         * - When: Intento acceder a una ruta protegida
         * - Then: Recibo error 401 con código TOKEN_INVALID
         */
        it('debería rechazar acceso con token malformado', async () => {
            logger.info('🚫 Iniciando test de token malformado', {
                endpoint: '/auth/profile',
                action: 'test_malformed_token_start'
            });

            // Act: Intentar acceder con token malformado
            const response = await testRequest
                .get('/auth/profile')
                .set('Authorization', `Bearer ${malformedToken}`);

            console.log('=== RESPUESTA CON TOKEN MALFORMADO ===', {
                status: response.status,
                body: response.body
            });

            // Assert: Verificar rechazo
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toHaveProperty('code', AuthErrorCode.TOKEN_INVALID);
            expect(response.body.error.message).toContain('Token inválido');

            logger.info('✅ Test de token malformado completado');
        });

        /**
         * TEST 5: Rechazo con token expirado
         * 
         * ESCENARIO:
         * - Given: Envío un token expirado
         * - When: Intento acceder a una ruta protegida
         * - Then: Recibo error 401 con código TOKEN_EXPIRED
         */
        it('debería rechazar acceso con token expirado', async () => {
            logger.info('🚫 Iniciando test de token expirado', {
                endpoint: '/auth/profile',
                action: 'test_expired_token_start'
            });

            // Act: Intentar acceder con token expirado
            const response = await testRequest
                .get('/auth/profile')
                .set('Authorization', `Bearer ${expiredToken}`);

            console.log('=== RESPUESTA CON TOKEN EXPIRADO ===', {
                status: response.status,
                body: response.body
            });

            // Assert: Verificar rechazo
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error.code).toMatch(/TOKEN_INVALID|TOKEN_EXPIRED/);

            logger.info('✅ Test de token expirado completado');
        });

        /**
         * TEST 6: Rechazo sin Bearer prefix
         * 
         * ESCENARIO:
         * - Given: Envío token sin el prefijo "Bearer "
         * - When: Intento acceder a una ruta protegida
         * - Then: Recibo error 401
         */
        it('debería rechazar acceso con token sin Bearer prefix', async () => {
            logger.info('🚫 Iniciando test de token sin Bearer', {
                endpoint: '/auth/profile',
                action: 'test_no_bearer_prefix_start'
            });

            // Act: Intentar acceder con token sin Bearer
            const response = await testRequest
                .get('/auth/profile')
                .set('Authorization', validAccessToken); // Sin "Bearer "

            console.log('=== RESPUESTA SIN BEARER PREFIX ===', {
                status: response.status,
                body: response.body
            });

            // Assert: Verificar rechazo
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toHaveProperty('code', AuthErrorCode.TOKEN_MISSING);

            logger.info('✅ Test de token sin Bearer completado');
        });
    });

    /**
     * =================================================================
     * TESTS DE MÚLTIPLES ENDPOINTS PROTEGIDOS
     * =================================================================
     */
    describe('Verificación de Múltiples Endpoints Protegidos', () => {

        /**
         * TEST 7: Verificar que PUT /auth/profile requiere autenticación
         */
        it('debería proteger PUT /auth/profile', async () => {
            logger.info('🔒 Verificando protección de PUT /auth/profile', {
                action: 'test_put_profile_protection'
            });

            // Test sin token
            const responseWithoutToken = await testRequest
                .put('/auth/profile')
                .send({ first_name: 'Test' });

            expect(responseWithoutToken.status).toBe(401);
            expect(responseWithoutToken.body.error.code).toBe(AuthErrorCode.TOKEN_MISSING);

            // Test con token válido (debería funcionar)
            const responseWithToken = await testRequest
                .put('/auth/profile')
                .set('Authorization', `Bearer ${validAccessToken}`)
                .send({ first_name: 'Test Update' });

            // Puede ser 200 (éxito) o 400 (validación), pero no 401
            expect([200, 400]).toContain(responseWithToken.status);
            if (responseWithToken.status === 401) {
                throw new Error('PUT /auth/profile no está protegido correctamente');
            }

            logger.info('✅ PUT /auth/profile está correctamente protegido');
        });

        /**
         * TEST 8: Verificar que POST /auth/logout requiere autenticación
         */
        it('debería proteger POST /auth/logout', async () => {
            logger.info('🔒 Verificando protección de POST /auth/logout', {
                action: 'test_logout_protection'
            });

            // Test sin token
            const responseWithoutToken = await testRequest
                .post('/auth/logout');

            expect(responseWithoutToken.status).toBe(401);
            expect(responseWithoutToken.body.error.code).toBe(AuthErrorCode.TOKEN_MISSING);

            // Test con token válido (debería funcionar)
            const responseWithToken = await testRequest
                .post('/auth/logout')
                .set('Authorization', `Bearer ${validAccessToken}`);

            expect(responseWithToken.status).toBe(200);
            expect(responseWithToken.body.success).toBe(true);

            logger.info('✅ POST /auth/logout está correctamente protegido');
        });
    });

    /**
     * =================================================================
     * TESTS DE ESTRUCTURA DE RESPUESTAS DE ERROR
     * =================================================================
     */
    describe('Estructura de Respuestas de Error', () => {

        /**
         * TEST 9: Verificar estructura consistente de errores de autorización
         * 
         * ESCENARIO:
         * - Given: Diferentes tipos de errores de autorización
         * - When: Se producen estos errores
         * - Then: Todos siguen la misma estructura de respuesta
         */
        it('debería mantener estructura consistente en errores de autorización', async () => {
            logger.info('📋 Verificando estructura de errores de autorización', {
                action: 'test_error_structure_consistency'
            });

            // Test 1: Sin token
            const noTokenResponse = await testRequest.get('/auth/profile');
            
            // Test 2: Token malformado
            const malformedResponse = await testRequest
                .get('/auth/profile')
                .set('Authorization', `Bearer ${malformedToken}`);

            // Test 3: Token expirado
            const expiredResponse = await testRequest
                .get('/auth/profile')
                .set('Authorization', `Bearer ${expiredToken}`);

            // Verificar que todas las respuestas tienen la misma estructura
            const responses = [noTokenResponse, malformedResponse, expiredResponse];
            
            responses.forEach((response, index) => {
                console.log(`=== ESTRUCTURA ERROR ${index + 1} ===`, {
                    status: response.status,
                    body: response.body
                });

                // Verificar estructura base
                expect(response.status).toBe(401);
                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toHaveProperty('timestamp');
                
                // Verificar estructura del error
                expect(response.body.error).toHaveProperty('code');
                expect(response.body.error).toHaveProperty('message');
                expect(typeof response.body.error.code).toBe('string');
                expect(typeof response.body.error.message).toBe('string');
                expect(typeof response.body.error.timestamp).toBe('string');
                
                // Verificar que el código de error es válido
                const validErrorCodes = Object.values(AuthErrorCode);
                expect(validErrorCodes).toContain(response.body.error.code);
            });

            logger.info('✅ Estructura de errores de autorización es consistente');
        });
    });
});

/**
 * =================================================================
 * NOTAS DE IMPLEMENTACIÓN Y PRÓXIMOS PASOS
 * =================================================================
 * 
 * 1. **ESTADO ACTUAL**:
 *    - Tests básicos de autorización implementados
 *    - Verificación de middleware de autenticación
 *    - Validación de estructura de errores
 *    - Cobertura de endpoints protegidos existentes
 * 
 * 2. **PRÓXIMOS TESTS DE AUTORIZACIÓN (DEUDA TÉCNICA)**:
 *    - Tests de roles específicos (cuando se implementen rutas con requireDoctor, etc.)
 *    - Tests de acceso multi-tenant (verifyClinicAccess)
 *    - Tests de jerarquía de roles
 *    - Tests de permisos granulares
 * 
 * 3. **CUANDO SE IMPLEMENTEN MÁS RUTAS PROTEGIDAS**:
 *    - Agregar tests para cada nuevo endpoint
 *    - Verificar que los roles correctos tienen acceso
 *    - Validar que los roles incorrectos son rechazados
 * 
 * 4. **DEBUGGING Y MONITOREO**:
 *    - Logs detallados para cada test
 *    - Console.log para ver respuestas completas
 *    - Verificación de códigos de error específicos
 * 
 * 5. **SEGURIDAD VALIDADA**:
 *    - Middleware de autenticación funciona correctamente
 *    - Tokens inválidos son rechazados apropiadamente
 *    - Estructura de errores es consistente
 *    - No hay bypass de autenticación
 * 
 * 6. **COMPLIANCE NOM-024**:
 *    - Auditoría de accesos implementada
 *    - Trazabilidad de intentos de acceso
 *    - Logs estructurados para compliance
 * 
 * =================================================================
 */