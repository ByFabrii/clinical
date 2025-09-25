// =================================================================
// SERVICIO DE SMS
// Sistema de Expedientes Clínicos Dentales
// =================================================================

import logger from '../config/logger';
import { SMSProvider } from '../types/notifications';

// Interfaces para diferentes proveedores de SMS
interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

interface NexmoConfig {
  apiKey: string;
  apiSecret: string;
  fromNumber: string;
}

export class SMSService implements SMSProvider {
  private provider: 'twilio' | 'nexmo' | 'mock';
  private isConfigured = false;
  private config: any;

  constructor() {
    this.provider = (process.env.SMS_PROVIDER as any) || 'mock';
    this.initializeProvider();
  }

  /**
   * Inicializar el proveedor de SMS
   */
  private initializeProvider(): void {
    try {
      switch (this.provider) {
        case 'twilio':
          this.initializeTwilio();
          break;
        case 'nexmo':
          this.initializeNexmo();
          break;
        case 'mock':
          this.initializeMock();
          break;
        default:
          logger.warn('Proveedor de SMS no soportado, usando mock', {
            provider: this.provider
          });
          this.initializeMock();
      }
    } catch (error) {
      logger.error('Error al inicializar proveedor de SMS', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        provider: this.provider
      });
      this.initializeMock();
    }
  }

  /**
   * Configurar Twilio
   */
  private initializeTwilio(): void {
    const config: TwilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || ''
    };

    if (!config.accountSid || !config.authToken || !config.fromNumber) {
      logger.warn('Configuración de Twilio incompleta, usando mock', {
        hasAccountSid: !!config.accountSid,
        hasAuthToken: !!config.authToken,
        hasFromNumber: !!config.fromNumber
      });
      this.initializeMock();
      return;
    }

    this.config = config;
    this.isConfigured = true;
    
    logger.info('Servicio SMS configurado con Twilio', {
      fromNumber: config.fromNumber
    });
  }

  /**
   * Configurar Nexmo/Vonage
   */
  private initializeNexmo(): void {
    const config: NexmoConfig = {
      apiKey: process.env.NEXMO_API_KEY || '',
      apiSecret: process.env.NEXMO_API_SECRET || '',
      fromNumber: process.env.NEXMO_FROM_NUMBER || ''
    };

    if (!config.apiKey || !config.apiSecret || !config.fromNumber) {
      logger.warn('Configuración de Nexmo incompleta, usando mock', {
        hasApiKey: !!config.apiKey,
        hasApiSecret: !!config.apiSecret,
        hasFromNumber: !!config.fromNumber
      });
      this.initializeMock();
      return;
    }

    this.config = config;
    this.isConfigured = true;
    
    logger.info('Servicio SMS configurado con Nexmo', {
      fromNumber: config.fromNumber
    });
  }

  /**
   * Configurar mock (para desarrollo/testing)
   */
  private initializeMock(): void {
    this.provider = 'mock';
    this.isConfigured = true;
    this.config = {
      fromNumber: '+1234567890'
    };
    
    logger.info('Servicio SMS configurado en modo mock (desarrollo)');
  }

  /**
   * Enviar SMS
   */
  async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        logger.warn('Intento de envío de SMS con servicio no configurado', {
          to: this.maskPhoneNumber(to),
          messageLength: message.length
        });
        return false;
      }

      // Validar número de teléfono
      const cleanPhone = this.cleanPhoneNumber(to);
      if (!this.isValidPhoneNumber(cleanPhone)) {
        logger.error('Número de teléfono inválido', {
          originalPhone: this.maskPhoneNumber(to),
          cleanPhone: this.maskPhoneNumber(cleanPhone)
        });
        return false;
      }

      // Validar longitud del mensaje
      if (message.length > 160) {
        logger.warn('Mensaje SMS excede 160 caracteres', {
          length: message.length,
          to: this.maskPhoneNumber(cleanPhone)
        });
      }

      let success = false;

      switch (this.provider) {
        case 'twilio':
          success = await this.sendViaTwilio(cleanPhone, message);
          break;
        case 'nexmo':
          success = await this.sendViaNexmo(cleanPhone, message);
          break;
        case 'mock':
          success = await this.sendViaMock(cleanPhone, message);
          break;
        default:
          logger.error('Proveedor de SMS no soportado', { provider: this.provider });
          return false;
      }

      if (success) {
        logger.info('SMS enviado exitosamente', {
          to: this.maskPhoneNumber(cleanPhone),
          provider: this.provider,
          messageLength: message.length
        });
      } else {
        logger.error('Error al enviar SMS', {
          to: this.maskPhoneNumber(cleanPhone),
          provider: this.provider
        });
      }

      return success;
    } catch (error) {
      logger.error('Error al enviar SMS', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        to: this.maskPhoneNumber(to),
        provider: this.provider
      });
      return false;
    }
  }

  /**
   * Enviar múltiples SMS
   */
  async sendBulkSMS(
    recipients: Array<{
      to: string;
      message: string;
    }>
  ): Promise<{ sent: number; failed: number; results: boolean[] }> {
    const results: boolean[] = [];
    let sent = 0;
    let failed = 0;

    for (const sms of recipients) {
      const success = await this.sendSMS(sms.to, sms.message);
      
      results.push(success);
      if (success) {
        sent++;
      } else {
        failed++;
      }

      // Pausa entre envíos para evitar rate limiting
      await this.delay(500);
    }

    logger.info('Envío masivo de SMS completado', {
      total: recipients.length,
      sent,
      failed
    });

    return { sent, failed, results };
  }

  /**
   * Validar configuración
   */
  validateConfig(config: any): boolean {
    switch (this.provider) {
      case 'twilio':
        return !!(config.accountSid && config.authToken && config.fromNumber);
      case 'nexmo':
        return !!(config.apiKey && config.apiSecret && config.fromNumber);
      case 'mock':
        return true;
      default:
        return false;
    }
  }

  /**
   * Verificar estado del servicio
   */
  async checkServiceHealth(): Promise<{
    isHealthy: boolean;
    isConfigured: boolean;
    provider: string;
    lastError?: string;
  }> {
    try {
      return {
        isHealthy: this.isConfigured,
        isConfigured: this.isConfigured,
        provider: this.provider
      };
    } catch (error) {
      return {
        isHealthy: false,
        isConfigured: this.isConfigured,
        provider: this.provider,
        lastError: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  // =================================================================
  // MÉTODOS PRIVADOS PARA PROVEEDORES
  // =================================================================

  /**
   * Enviar SMS vía Twilio
   */
  private async sendViaTwilio(to: string, message: string): Promise<boolean> {
    try {
      // En un entorno real, aquí usarías el SDK de Twilio
      // const twilio = require('twilio');
      // const client = twilio(this.config.accountSid, this.config.authToken);
      // 
      // const result = await client.messages.create({
      //   body: message,
      //   from: this.config.fromNumber,
      //   to: to
      // });
      // 
      // return !!result.sid;

      // Simulación para desarrollo
      logger.info('SMS simulado vía Twilio', {
        to: this.maskPhoneNumber(to),
        from: this.config.fromNumber,
        message: message.substring(0, 50) + '...'
      });
      
      return true;
    } catch (error) {
      logger.error('Error en Twilio SMS', {
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      return false;
    }
  }

  /**
   * Enviar SMS vía Nexmo
   */
  private async sendViaNexmo(to: string, message: string): Promise<boolean> {
    try {
      // En un entorno real, aquí usarías el SDK de Nexmo
      // const Nexmo = require('nexmo');
      // const nexmo = new Nexmo({
      //   apiKey: this.config.apiKey,
      //   apiSecret: this.config.apiSecret
      // });
      // 
      // return new Promise((resolve) => {
      //   nexmo.message.sendSms(
      //     this.config.fromNumber,
      //     to,
      //     message,
      //     (err, responseData) => {
      //       if (err) {
      //         resolve(false);
      //       } else {
      //         resolve(responseData.messages[0].status === '0');
      //       }
      //     }
      //   );
      // });

      // Simulación para desarrollo
      logger.info('SMS simulado vía Nexmo', {
        to: this.maskPhoneNumber(to),
        from: this.config.fromNumber,
        message: message.substring(0, 50) + '...'
      });
      
      return true;
    } catch (error) {
      logger.error('Error en Nexmo SMS', {
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      return false;
    }
  }

  /**
   * Enviar SMS vía Mock (desarrollo)
   */
  private async sendViaMock(to: string, message: string): Promise<boolean> {
    // Simular delay de red
    await this.delay(Math.random() * 1000 + 500);
    
    logger.info('📱 SMS MOCK enviado', {
      to: this.maskPhoneNumber(to),
      from: this.config.fromNumber,
      message: message,
      timestamp: new Date().toISOString()
    });
    
    // Simular 95% de éxito
    return Math.random() > 0.05;
  }

  // =================================================================
  // UTILIDADES
  // =================================================================

  /**
   * Limpiar número de teléfono
   */
  private cleanPhoneNumber(phone: string): string {
    // Remover espacios, guiones, paréntesis
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Si no empieza con +, agregar código de país por defecto (México)
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('52')) {
        cleaned = '+' + cleaned;
      } else if (cleaned.length === 10) {
        cleaned = '+52' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }
    
    return cleaned;
  }

  /**
   * Validar número de teléfono
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Formato internacional básico: +[código país][número]
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Enmascarar número de teléfono para logs
   */
  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return phone;
    
    const start = phone.substring(0, 3);
    const end = phone.substring(phone.length - 2);
    const middle = '*'.repeat(phone.length - 5);
    
    return start + middle + end;
  }

  /**
   * Pausa asíncrona
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtener estado de configuración
   */
  get configured(): boolean {
    return this.isConfigured;
  }

  /**
   * Obtener proveedor actual
   */
  get currentProvider(): string {
    return this.provider;
  }
}

// =================================================================
// TEMPLATES DE SMS
// =================================================================

export class SMSTemplates {
  /**
   * Template para recordatorio de cita
   */
  static getAppointmentReminder(data: {
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    clinicName: string;
    clinicPhone: string;
  }): string {
    return `🦷 ${data.clinicName}\n\nHola ${data.patientName}, recordatorio de tu cita:\n\n📅 ${data.appointmentDate}\n🕐 ${data.appointmentTime}\n\nConfirma llamando al ${data.clinicPhone}`;
  }

  /**
   * Template para confirmación de cita
   */
  static getAppointmentConfirmation(data: {
    patientName: string;
    appointmentTime: string;
    clinicName: string;
    clinicPhone: string;
  }): string {
    return `🦷 ${data.clinicName}\n\nHola ${data.patientName}, tu cita es en ${data.appointmentTime}.\n\nPor favor confirma llamando al ${data.clinicPhone}`;
  }

  /**
   * Template para seguimiento
   */
  static getFollowUp(data: {
    patientName: string;
    clinicName: string;
    clinicPhone: string;
  }): string {
    return `🦷 ${data.clinicName}\n\nHola ${data.patientName}, ¿cómo te sientes después de tu tratamiento?\n\nSi tienes molestias, llámanos: ${data.clinicPhone}`;
  }

  /**
   * Validar longitud de mensaje SMS
   */
  static validateLength(message: string): {
    isValid: boolean;
    length: number;
    segments: number;
    warning?: string;
  } {
    const length = message.length;
    const segments = Math.ceil(length / 160);
    
    return {
      isValid: length <= 1600, // Máximo 10 segmentos
      length,
      segments,
      warning: length > 160 ? `Mensaje será enviado en ${segments} partes` : undefined
    };
  }
}

export const smsService = new SMSService();