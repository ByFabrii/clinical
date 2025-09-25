/**
 * =================================================================
 * SERVIDOR PRINCIPAL - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este archivo es el punto de entrada principal del servidor.
 * Inicializa la aplicación Express y maneja el ciclo de vida del servidor.
 * 
 * RESPONSABILIDADES:
 * 1. Inicializar la aplicación
 * 2. Configurar el servidor HTTP
 * 3. Manejar señales del sistema (graceful shutdown)
 * 4. Logging de inicio y errores
 * 5. Configuración de puerto y host
 * 
 * =================================================================
 */

import { createServer, Server } from 'http';
import { initializeApp } from './app';
import { config, isDevelopment } from './config/env';
import logger from './config/logger';

// =================================================================
// VARIABLES GLOBALES
// =================================================================

let server: Server;
let isShuttingDown = false;

// =================================================================
// FUNCIONES DE UTILIDAD
// =================================================================

/**
 * Formatea el tiempo de uptime en formato legible
 * @param seconds - Segundos de uptime
 * @returns String formateado (ej: "2h 30m 45s")
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);
  
  return parts.join(' ') || '0s';
}

/**
 * Obtiene información del sistema para logging
 */
function getSystemInfo() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    uptime: formatUptime(process.uptime())
  };
}

// =================================================================
// MANEJO DE SEÑALES DEL SISTEMA
// =================================================================

/**
 * Maneja el cierre graceful del servidor
 * Asegura que todas las conexiones se cierren correctamente
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown ya en progreso, forzando salida', {
      action: 'graceful_shutdown',
      signal,
      status: 'force_exit',
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
  
  isShuttingDown = true;
  logger.info('Señal recibida, iniciando shutdown graceful', {
    action: 'graceful_shutdown',
    signal,
    status: 'starting',
    timestamp: new Date().toISOString()
  });
  
  const shutdownTimeout = setTimeout(() => {
    logger.error('Timeout en shutdown graceful, forzando salida', {
      action: 'graceful_shutdown',
      signal,
      status: 'timeout',
      timeoutMs: 10000,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }, 10000); // 10 segundos timeout
  
  try {
    if (server) {
      logger.info('Cerrando servidor HTTP', {
        action: 'graceful_shutdown',
        signal,
        status: 'closing_server',
        timestamp: new Date().toISOString()
      });
      
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            logger.error('Error al cerrar servidor HTTP', {
              action: 'graceful_shutdown',
              signal,
              status: 'server_close_error',
              error: err.message,
              stack: err.stack,
              timestamp: new Date().toISOString()
            });
            reject(err);
          } else {
            logger.info('Servidor HTTP cerrado correctamente', {
              action: 'graceful_shutdown',
              signal,
              status: 'server_closed',
              timestamp: new Date().toISOString()
            });
            resolve();
          }
        });
      });
    }
    
    // Aquí se pueden agregar otros cleanups:
    // - Cerrar conexiones de base de datos
    // - Finalizar workers
    // - Limpiar archivos temporales
    // - etc.
    
    clearTimeout(shutdownTimeout);
    
    const systemInfo = getSystemInfo();
    logger.info('Estadísticas finales del sistema', {
      action: 'graceful_shutdown',
      signal,
      status: 'final_stats',
      systemInfo,
      timestamp: new Date().toISOString()
    });
    logger.info('Sistema de Expedientes Dentales finalizado correctamente', {
      action: 'graceful_shutdown',
      signal,
      status: 'completed',
      timestamp: new Date().toISOString()
    });
    
    process.exit(0);
    
  } catch (error) {
    clearTimeout(shutdownTimeout);
    logger.error('Error durante shutdown graceful', {
      action: 'graceful_shutdown',
      signal,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}

/**
 * Configura los manejadores de señales del sistema
 */
function setupSignalHandlers(): void {
  // SIGTERM - Terminación graceful (usado por Docker, PM2, etc.)
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  
  // SIGINT - Interrupción (Ctrl+C)
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // SIGUSR2 - Usado por nodemon para restart
  process.on('SIGUSR2', () => {
    logger.info('Señal SIGUSR2 recibida para reinicio', {
      action: 'signal_handler',
      signal: 'SIGUSR2',
      reason: 'nodemon_restart',
      timestamp: new Date().toISOString()
    });
    gracefulShutdown('SIGUSR2');
  });
  
  // Manejar errores no capturados
  process.on('uncaughtException', (error) => {
    logger.error('Excepción no capturada detectada', {
      action: 'uncaught_exception',
      error: error.message,
      stack: error.stack,
      isDevelopment,
      timestamp: new Date().toISOString()
    });
    
    // En producción, hacer shutdown graceful
    if (!isDevelopment) {
      gracefulShutdown('uncaughtException');
    } else {
      // En desarrollo, solo loggear y continuar
      logger.warn('Continuando en modo desarrollo después de excepción', {
        action: 'development_continue',
        reason: 'uncaught_exception',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Manejar promesas rechazadas no capturadas
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promesa rechazada no manejada detectada', {
      action: 'unhandled_rejection',
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: String(promise),
      isDevelopment,
      timestamp: new Date().toISOString()
    });
    
    // En producción, hacer shutdown graceful
    if (!isDevelopment) {
      gracefulShutdown('unhandledRejection');
    } else {
      // En desarrollo, solo loggear y continuar
      logger.warn('Continuando en modo desarrollo después de promesa rechazada', {
        action: 'development_continue',
        reason: 'unhandled_rejection',
        timestamp: new Date().toISOString()
      });
    }
  });
}

// =================================================================
// FUNCIÓN PRINCIPAL DE INICIO
// =================================================================

/**
 * Inicia el servidor principal
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Iniciando Sistema de Expedientes Dentales', {
      action: 'startup_banner',
      system: 'SISTEMA DE EXPEDIENTES DENTALES',
      date: new Date().toLocaleString('es-MX'),
      environment: config.server.environment.toUpperCase(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    });
    
    // Configurar manejadores de señales
    setupSignalHandlers();
    
    // Inicializar aplicación
    logger.info('Inicializando aplicación', {
      action: 'app_initialization',
      step: 'start',
      timestamp: new Date().toISOString()
    });
    const app = await initializeApp();
    
    // Crear servidor HTTP
    server = createServer(app);
    
    // Configurar eventos del servidor
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error;
      }
      
      const bind = typeof config.server.port === 'string'
        ? `Pipe ${config.server.port}`
        : `Puerto ${config.server.port}`;
      
      switch (error.code) {
        case 'EACCES':
          logger.error('Puerto requiere privilegios elevados', {
            action: 'server_error',
            step: 'port_binding',
            errorCode: 'EACCES',
            bind,
            port: config.server.port,
            timestamp: new Date().toISOString()
          });
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error('Puerto ya está en uso', {
            action: 'server_error',
            step: 'port_binding',
            errorCode: 'EADDRINUSE',
            bind,
            port: config.server.port,
            timestamp: new Date().toISOString()
          });
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
    
    server.on('listening', () => {
      const addr = server.address();
      const bind = typeof addr === 'string'
        ? `pipe ${addr}`
        : `puerto ${addr?.port}`;
      
      logger.info('Servidor iniciado correctamente', {
        action: 'start_server',
        step: 'server_listening',
        bind,
        host: config.server.host,
        port: config.server.port,
        urls: {
          local: `http://${config.server.host}:${config.server.port}`,
          health: `http://${config.server.host}:${config.server.port}/health`,
          info: `http://${config.server.host}:${config.server.port}/info`
        },
        environment: config.server.environment,
        isDevelopment,
        developmentFeatures: isDevelopment ? {
          hotReload: true,
          detailedLogs: true,
          corsPermissive: true,
          rateLimitingDisabled: true
        } : undefined,
        timestamp: new Date().toISOString()
      });
      
      logger.info('Próximos pasos de configuración', {
        action: 'start_server',
        step: 'next_steps',
        steps: [
          'Configurar archivo .env con credenciales de Supabase',
          'Probar endpoint /health en Postman',
          'Implementar rutas de autenticación',
          'Configurar base de datos en Supabase'
        ],
        shutdownInstruction: 'Para detener el servidor: Ctrl+C',
        timestamp: new Date().toISOString()
      });
      
      // Mostrar información del sistema
      const systemInfo = getSystemInfo();
      logger.info('Información del sistema', {
        action: 'start_server',
        step: 'system_info',
        systemInfo,
        timestamp: new Date().toISOString()
      });
    });
    
    // Iniciar servidor
    server.listen(config.server.port, config.server.host);
    
  } catch (error) {
    logger.error('Error crítico al iniciar servidor', {
      action: 'start_server',
      step: 'critical_error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      isDevelopment,
      timestamp: new Date().toISOString()
    });
    
    logger.error('Posibles soluciones para el error', {
      action: 'start_server',
      step: 'error_solutions',
      solutions: [
        'Verificar que el archivo .env existe y tiene las variables correctas',
        'Comprobar que Supabase está configurado correctamente',
        'Verificar que el puerto no esté en uso',
        'Revisar los logs anteriores para más detalles'
      ],
      timestamp: new Date().toISOString()
    });
    
    process.exit(1);
  }
}

// =================================================================
// MANEJO DE ENTORNOS ESPECIALES
// =================================================================

/**
 * Configuración específica para diferentes entornos
 */
function setupEnvironmentSpecificConfig(): void {
  // Configuración para desarrollo
  if (isDevelopment) {
    // Habilitar stack traces más detallados
    Error.stackTraceLimit = 50;
    
    // Configurar colores en consola si está disponible
    if (process.stdout.isTTY) {
      process.env.FORCE_COLOR = '1';
    }
  }
  
  // Configuración para producción
  if (config.server.environment === 'production') {
    // Optimizaciones para producción
    process.env.NODE_ENV = 'production';
    
    // Configurar límites de memoria si es necesario
    if (!process.env.NODE_OPTIONS) {
      process.env.NODE_OPTIONS = '--max-old-space-size=2048';
    }
  }
}

// =================================================================
// PUNTO DE ENTRADA
// =================================================================

/**
 * Función principal - punto de entrada del servidor
 */
async function main(): Promise<void> {
  try {
    // Configurar entorno
    setupEnvironmentSpecificConfig();
    
    // Iniciar servidor
    await startServer();
    
  } catch (error) {
    logger.error('Error fatal en función main', {
      action: 'main',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}

// =================================================================
// EJECUCIÓN
// =================================================================

// Solo ejecutar si este archivo es el punto de entrada principal
if (require.main === module) {
  main().catch((error) => {
    logger.error('Error no manejado en punto de entrada principal', {
      action: 'main_entry_point',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  });
}

// =================================================================
// EXPORTACIONES
// =================================================================

export { startServer, gracefulShutdown };
export default main;

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **ROBUSTEZ**:
   - Manejo completo de señales del sistema
   - Shutdown graceful con timeout
   - Manejo de errores no capturados
   - Logging detallado de errores

2. **MONITOREO**:
   - Información del sistema al inicio
   - Estadísticas de memoria y uptime
   - Health checks integrados
   - Logging estructurado

3. **DESARROLLO**:
   - Configuración específica para desarrollo
   - Hot reload compatible
   - Logs coloridos en terminal
   - Información útil para debugging

4. **PRODUCCIÓN**:
   - Optimizaciones de memoria
   - Manejo robusto de errores
   - Shutdown graceful para zero-downtime
   - Logging apropiado para monitoreo

5. **MANTENIBILIDAD**:
   - Código bien estructurado
   - Funciones reutilizables
   - Documentación inline
   - Separación clara de responsabilidades

*/