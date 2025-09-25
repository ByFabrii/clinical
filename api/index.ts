/**
 * =================================================================
 * VERCEL SERVERLESS FUNCTION - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este archivo es el punto de entrada para Vercel Functions.
 * Exporta la aplicación Express como una función serverless.
 * 
 * CARACTERÍSTICAS:
 * 1. Compatible con Vercel Functions
 * 2. Inicialización optimizada para serverless
 * 3. Manejo de cold starts
 * 4. Configuración específica para producción
 * 
 * =================================================================
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp } from '../src/app';
import logger from '../src/config/logger';

// Cache de la aplicación para evitar reinicialización en cada request
let cachedApp: any = null;

/**
 * Función principal para Vercel
 * Maneja la inicialización y el enrutamiento de requests
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Configurar headers CORS para Vercel
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    // Manejar preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Inicializar aplicación si no está en cache
    if (!cachedApp) {
      logger.info('Inicializando aplicación para Vercel Functions', {
        action: 'vercel_init',
        timestamp: new Date().toISOString(),
        coldStart: true
      });
      
      cachedApp = await initializeApp();
      
      logger.info('Aplicación inicializada exitosamente', {
        action: 'vercel_init_success',
        timestamp: new Date().toISOString()
      });
    }

    // Procesar request con la aplicación Express
    return cachedApp(req, res);
    
  } catch (error) {
    logger.error('Error en Vercel Function', {
      action: 'vercel_error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });

    // Respuesta de error para el cliente
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVERLESS_ERROR',
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      }
    });
  }
}

// =================================================================
// CONFIGURACIÓN ESPECÍFICA PARA VERCEL
// =================================================================

/**
 * Configuración de la función para Vercel
 * Estas propiedades son leídas por Vercel durante el deploy
 */
export const config = {
  // Configuración de runtime
  runtime: 'nodejs18.x',
  
  // Regiones donde se desplegará la función
  regions: ['iad1'], // US East (Virginia) - más cercano a México
  
  // Tamaño máximo de memoria
  memory: 1024,
  
  // Timeout máximo (10 segundos para plan Pro)
  maxDuration: 10
};

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **SERVERLESS OPTIMIZATION**:
   - Cache de aplicación para evitar cold starts
   - Inicialización optimizada
   - Manejo eficiente de memoria
   - Timeout configurado apropiadamente

2. **CORS HANDLING**:
   - Headers CORS configurados para Vercel
   - Manejo de preflight requests
   - Compatibilidad con frontend

3. **ERROR HANDLING**:
   - Logging estructurado para debugging
   - Respuestas de error consistentes
   - Información de debugging en desarrollo

4. **PERFORMANCE**:
   - Región optimizada para México
   - Memoria suficiente para operaciones
   - Cache de aplicación Express

5. **MONITORING**:
   - Logs detallados para Vercel
   - Métricas de cold start
   - Información de debugging

*/