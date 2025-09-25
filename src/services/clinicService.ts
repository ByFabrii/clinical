// src/services/clinicService.ts
import supabase, { supabaseService } from '../config/supabase';
import logger from '../config/logger';
import { 
  CreateClinicData, 
  UpdateClinicData, 
  ClinicFilters 
} from '../schemas/clinics.schemas';
import { v4 as uuidv4 } from 'uuid';

// Tipos para las respuestas
export interface Clinic {
  id: string;
  clinic_name: string;
  clinic_code: string;
  email?: string;
  phone?: string;
  website?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  rfc?: string;
  business_name?: string;
  tax_regime?: string;
  timezone: string;
  currency: string;
  language: string;
  subscription_plan: string;
  max_users: number;
  max_patients: number;
  is_active: boolean;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ClinicListResponse {
  clinics: Clinic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ClinicService {
  
  /**
   * Crear una nueva clínica
   */
  async createClinic(clinicData: CreateClinicData, requestId: string): Promise<Clinic> {
    try {
      logger.info('Iniciando creación de clínica', {
        requestId,
        clinic_name: clinicData.clinic_name,
        clinic_code: clinicData.clinic_code,
        action: 'create_clinic_start'
      });

      // 1. Verificar que el código de clínica no exista
      const { data: existingClinic, error: checkError } = await supabaseService
        .from('clinics')
        .select('id, clinic_code')
        .eq('clinic_code', clinicData.clinic_code)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        logger.error('Error verificando código de clínica', {
          requestId,
          error: checkError.message,
          clinic_code: clinicData.clinic_code
        });
        throw new Error('Error verificando disponibilidad del código de clínica');
      }

      if (existingClinic) {
        logger.warn('Código de clínica ya existe', {
          requestId,
          clinic_code: clinicData.clinic_code,
          existing_id: existingClinic.id
        });
        throw new Error('El código de clínica ya está en uso');
      }

      // 2. Crear la clínica
      const newClinic = {
        id: uuidv4(),
        ...clinicData,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: createdClinic, error: createError } = await supabaseService
        .from('clinics')
        .insert([newClinic])
        .select()
        .single();

      if (createError) {
        logger.error('Error creando clínica', {
          requestId,
          error: createError.message,
          clinic_data: clinicData
        });
        throw new Error('Error creando la clínica');
      }

      logger.info('Clínica creada exitosamente', {
        requestId,
        clinic_id: createdClinic.id,
        clinic_name: createdClinic.clinic_name,
        clinic_code: createdClinic.clinic_code,
        action: 'create_clinic_success'
      });

      return createdClinic;

    } catch (error) {
      logger.error('Error en createClinic', {
        requestId,
        error: error instanceof Error ? error.message : 'Error desconocido',
        clinic_data: clinicData
      });
      throw error;
    }
  }

  /**
   * Obtener clínica por ID
   */
  async getClinicById(clinicId: string, requestId: string): Promise<Clinic | null> {
    try {
      logger.debug('Obteniendo clínica por ID', {
        requestId,
        clinic_id: clinicId,
        action: 'get_clinic_by_id'
      });

      const { data: clinic, error } = await supabaseService
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.warn('Clínica no encontrada', {
            requestId,
            clinic_id: clinicId
          });
          return null;
        }
        
        logger.error('Error obteniendo clínica', {
          requestId,
          clinic_id: clinicId,
          error: error.message
        });
        throw new Error('Error obteniendo la clínica');
      }

      return clinic;

    } catch (error) {
      logger.error('Error en getClinicById', {
        requestId,
        clinic_id: clinicId,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      throw error;
    }
  }

  /**
   * Listar clínicas con filtros y paginación
   */
  async listClinics(filters: ClinicFilters, requestId: string): Promise<ClinicListResponse> {
    try {
      logger.debug('Listando clínicas', {
        requestId,
        filters,
        action: 'list_clinics'
      });

      let query = supabaseService
        .from('clinics')
        .select('*', { count: 'exact' });

      // Aplicar filtros
      if (filters.search) {
        query = query.or(`clinic_name.ilike.%${filters.search}%,clinic_code.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
      }

      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters.subscription_plan) {
        query = query.eq('subscription_plan', filters.subscription_plan);
      }

      if (filters.city) {
        query = query.eq('city', filters.city);
      }

      if (filters.state) {
        query = query.eq('state', filters.state);
      }

      // Paginación
      const offset = (filters.page - 1) * filters.limit;
      query = query.range(offset, offset + filters.limit - 1);

      // Ordenar por fecha de creación (más recientes primero)
      query = query.order('created_at', { ascending: false });

      const { data: clinics, error, count } = await query;

      if (error) {
        logger.error('Error listando clínicas', {
          requestId,
          error: error.message,
          filters
        });
        throw new Error('Error obteniendo la lista de clínicas');
      }

      const totalPages = Math.ceil((count || 0) / filters.limit);

      logger.debug('Clínicas listadas exitosamente', {
        requestId,
        total: count,
        returned: clinics?.length || 0,
        page: filters.page,
        totalPages
      });

      return {
        clinics: clinics || [],
        total: count || 0,
        page: filters.page,
        limit: filters.limit,
        totalPages
      };

    } catch (error) {
      logger.error('Error en listClinics', {
        requestId,
        error: error instanceof Error ? error.message : 'Error desconocido',
        filters
      });
      throw error;
    }
  }

  /**
   * Actualizar clínica
   */
  async updateClinic(clinicId: string, updateData: UpdateClinicData, requestId: string): Promise<Clinic> {
    try {
      logger.info('Iniciando actualización de clínica', {
        requestId,
        clinic_id: clinicId,
        action: 'update_clinic_start'
      });

      // 1. Verificar que la clínica existe
      const existingClinic = await this.getClinicById(clinicId, requestId);
      if (!existingClinic) {
        throw new Error('Clínica no encontrada');
      }

      // 2. Actualizar la clínica
      const updatedData = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const { data: updatedClinic, error } = await supabaseService
        .from('clinics')
        .update(updatedData)
        .eq('id', clinicId)
        .select()
        .single();

      if (error) {
        logger.error('Error actualizando clínica', {
          requestId,
          clinic_id: clinicId,
          error: error.message,
          update_data: updateData
        });
        throw new Error('Error actualizando la clínica');
      }

      logger.info('Clínica actualizada exitosamente', {
        requestId,
        clinic_id: clinicId,
        clinic_name: updatedClinic.clinic_name,
        action: 'update_clinic_success'
      });

      return updatedClinic;

    } catch (error) {
      logger.error('Error en updateClinic', {
        requestId,
        clinic_id: clinicId,
        error: error instanceof Error ? error.message : 'Error desconocido',
        update_data: updateData
      });
      throw error;
    }
  }

  /**
   * Activar/Desactivar clínica
   */
  async toggleClinicStatus(clinicId: string, isActive: boolean, requestId: string): Promise<Clinic> {
    try {
      logger.info('Cambiando estado de clínica', {
        requestId,
        clinic_id: clinicId,
        new_status: isActive,
        action: 'toggle_clinic_status'
      });

      const updatedClinic = await this.updateClinic(clinicId, { is_active: isActive }, requestId);

      logger.info('Estado de clínica cambiado exitosamente', {
        requestId,
        clinic_id: clinicId,
        new_status: isActive,
        action: 'toggle_clinic_status_success'
      });

      return updatedClinic;

    } catch (error) {
      logger.error('Error en toggleClinicStatus', {
        requestId,
        clinic_id: clinicId,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      throw error;
    }
  }

  /**
   * Obtener estadísticas de la clínica
   */
  async getClinicStats(clinicId: string, requestId: string): Promise<any> {
    try {
      logger.debug('Obteniendo estadísticas de clínica', {
        requestId,
        clinic_id: clinicId,
        action: 'get_clinic_stats'
      });

      // Obtener conteos de usuarios, pacientes, citas, etc.
      const [usersCount, patientsCount, appointmentsCount] = await Promise.all([
        supabaseService.from('users').select('id', { count: 'exact' }).eq('clinic_id', clinicId),
        supabaseService.from('patients').select('id', { count: 'exact' }).eq('clinic_id', clinicId),
        supabaseService.from('appointments').select('id', { count: 'exact' }).eq('clinic_id', clinicId)
      ]);

      const stats = {
        users_count: usersCount.count || 0,
        patients_count: patientsCount.count || 0,
        appointments_count: appointmentsCount.count || 0
      };

      logger.debug('Estadísticas obtenidas', {
        requestId,
        clinic_id: clinicId,
        stats
      });

      return stats;

    } catch (error) {
      logger.error('Error en getClinicStats', {
        requestId,
        clinic_id: clinicId,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      throw error;
    }
  }
}

// Exportar instancia singleton
export const clinicService = new ClinicService();