/**
 * =================================================================
 * CONFIGURACIÓN DE SUPABASE - SISTEMA EXPEDIENTES DENTALES
 * =================================================================
 * 
 * Este archivo configura la conexión con Supabase, que actúa como:
 * 1. Base de datos PostgreSQL (con nuestras 14 tablas)
 * 2. Sistema de autenticación (Supabase Auth)
 * 3. Almacenamiento de archivos (para imágenes médicas)
 * 4. Row Level Security (RLS) para multi-tenant
 * 
 * CONCEPTOS CLAVE:
 * - Cliente Anon: Para operaciones públicas (login, registro)
 * - Cliente Service Role: Para operaciones administrativas del backend
 * - RLS: Cada clínica solo ve sus propios datos
 * 
 * =================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import logger from './logger';

// Cargar variables de entorno
dotenv.config();

// =================================================================
// INTERFACES Y TIPOS
// =================================================================

/**
 * Configuración de Supabase
 * Define todas las opciones necesarias para la conexión
 */
interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  options: {
    auth: {
      autoRefreshToken: boolean;
      persistSession: boolean;
      detectSessionInUrl: boolean;
    };
    db: {
      schema: string;
    };
  };
}

/**
 * Tipos de clientes Supabase disponibles
 */
export type SupabaseClientType = 'anon' | 'service';

// =================================================================
// VALIDACIÓN DE VARIABLES DE ENTORNO
// =================================================================

/**
 * Valida que todas las variables de entorno necesarias estén presentes
 * Si falta alguna, la aplicación no debe iniciar
 */
function validateEnvironmentVariables(): void {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `❌ Variables de entorno faltantes: ${missingVars.join(', ')}\n` +
      `📝 Asegúrate de tener un archivo .env con todas las variables necesarias\n` +
      `📋 Consulta .env.example para ver el formato correcto`
    );
  }

  // Validar formato de URL
  const url = process.env.SUPABASE_URL!;
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    throw new Error(
      `❌ SUPABASE_URL tiene formato inválido: ${url}\n` +
      `✅ Formato esperado: https://tu-proyecto.supabase.co`
    );
  }

  logger.info('Variables de entorno de Supabase validadas correctamente', {
    action: 'validate_environment_variables',
    timestamp: new Date().toISOString()
  });
}

// =================================================================
// CONFIGURACIÓN DE SUPABASE
// =================================================================

/**
 * Configuración principal de Supabase
 * Estas opciones optimizan la conexión para nuestro backend
 */
const supabaseConfig: SupabaseConfig = {
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  options: {
    auth: {
      // No auto-refrescar tokens en el backend (lo manejamos manualmente)
      autoRefreshToken: false,
      // No persistir sesiones en el backend
      persistSession: false,
      // No detectar sesiones en URL (solo para frontend)
      detectSessionInUrl: false
    },
    db: {
      // Esquema de base de datos (por defecto 'public')
      schema: 'public'
    }
  }
};

// =================================================================
// CLIENTES SUPABASE
// =================================================================

/**
 * Cliente Supabase con clave anónima
 * 
 * USO:
 * - Operaciones de autenticación (login, registro)
 * - Operaciones que respetan RLS automáticamente
 * - Consultas que requieren autenticación de usuario
 * 
 * LIMITACIONES:
 * - Solo puede acceder a datos del usuario autenticado
 * - Respeta todas las políticas RLS
 * - No puede realizar operaciones administrativas
 */
export const supabaseAnon = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  supabaseConfig.options
);

/**
 * Cliente Supabase con clave de servicio (Service Role)
 * 
 * USO:
 * - Operaciones administrativas del backend
 * - Bypass de RLS cuando sea necesario
 * - Operaciones de sistema (auditoría, configuración)
 * - Gestión de usuarios desde el backend
 * 
 * ⚠️ ADVERTENCIA:
 * - Tiene permisos completos sobre la base de datos
 * - Puede bypass RLS si no se especifica lo contrario
 * - NUNCA exponer este cliente al frontend
 * - Usar solo en operaciones controladas del backend
 */
export const supabaseService = createClient(
  supabaseConfig.url,
  supabaseConfig.serviceRoleKey,
  {
    ...supabaseConfig.options,
    auth: {
      ...supabaseConfig.options.auth,
      // Para service role, podemos auto-refrescar si es necesario
      autoRefreshToken: true
    }
  }
);

// =================================================================
// FUNCIONES UTILITARIAS
// =================================================================

/**
 * Obtiene el cliente Supabase apropiado según el tipo
 * 
 * @param type - Tipo de cliente ('anon' | 'service')
 * @returns Cliente Supabase correspondiente
 */
export function getSupabaseClient(type: SupabaseClientType = 'anon') {
  switch (type) {
    case 'anon':
      return supabaseAnon;
    case 'service':
      return supabaseService;
    default:
      throw new Error(`Tipo de cliente Supabase inválido: ${type}`);
  }
}

/**
 * Verifica la conexión con Supabase
 * Útil para health checks y diagnósticos
 * 
 * @returns Promise<boolean> - true si la conexión es exitosa
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    // Intentar una consulta simple para verificar conectividad
    const { data, error } = await supabaseAnon
      .from('clinics')
      .select('id')
      .limit(1);

    if (error) {
      logger.error('Error al conectar con Supabase', {
        action: 'test_supabase_connection',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }

    logger.info('Conexión con Supabase exitosa', {
      action: 'test_supabase_connection',
      timestamp: new Date().toISOString()
    });
    return true;
  } catch (error) {
    logger.error('Error inesperado al conectar con Supabase', {
      action: 'test_supabase_connection',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

/**
 * Obtiene información del proyecto Supabase
 * Útil para debugging y monitoreo
 * 
 * @returns Información básica del proyecto
 */
export function getSupabaseInfo() {
  return {
    url: supabaseConfig.url,
    // No exponer las claves completas por seguridad
    anonKeyPreview: `${supabaseConfig.anonKey.substring(0, 20)}...`,
    serviceKeyPreview: `${supabaseConfig.serviceRoleKey.substring(0, 20)}...`,
    schema: supabaseConfig.options.db.schema,
    environment: process.env.NODE_ENV || 'development'
  };
}

// =================================================================
// INICIALIZACIÓN
// =================================================================

/**
 * Inicializa la configuración de Supabase
 * Debe llamarse al inicio de la aplicación
 */
export function initializeSupabase(): void {
  try {
    logger.info('Inicializando configuración de Supabase', {
      action: 'initialize_supabase',
      timestamp: new Date().toISOString()
    });
    
    // Validar variables de entorno
    validateEnvironmentVariables();
    
    // Mostrar información de configuración (sin datos sensibles)
    const info = getSupabaseInfo();
    logger.info('Información de Supabase', {
      action: 'initialize_supabase',
      url: info.url,
      schema: info.schema,
      environment: info.environment,
      timestamp: new Date().toISOString()
    });
    
    logger.info('Supabase inicializado correctamente', {
      action: 'initialize_supabase',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error al inicializar Supabase', {
      action: 'initialize_supabase',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw error; // Re-lanzar para que la aplicación no inicie
  }
}

// =================================================================
// EXPORTACIONES POR DEFECTO
// =================================================================

// Cliente por defecto (anon) para la mayoría de operaciones
export default supabaseAnon;

// =================================================================
// NOTAS DE IMPLEMENTACIÓN
// =================================================================
/*

1. **SEGURIDAD**:
   - El cliente 'anon' respeta automáticamente RLS
   - El cliente 'service' puede bypass RLS, usar con cuidado
   - Nunca exponer service_role_key al frontend

2. **MULTI-TENANT**:
   - RLS está configurado en todas las tablas con clinic_id
   - Los usuarios solo ven datos de su clínica
   - Las políticas RLS se aplican automáticamente

3. **AUTENTICACIÓN**:
   - Supabase Auth maneja tokens JWT automáticamente
   - Los tokens incluyen información del usuario y clínica
   - RLS usa esta información para filtrar datos

4. **PERFORMANCE**:
   - Conexiones reutilizables
   - Configuración optimizada para backend
   - Sin persistencia de sesión innecesaria

5. **DEBUGGING**:
   - Logs detallados de errores
   - Función de test de conexión
   - Información de configuración sin datos sensibles

*/