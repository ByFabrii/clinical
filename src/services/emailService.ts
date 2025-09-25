// =================================================================
// SERVICIO DE EMAIL
// Sistema de Expedientes Clínicos Dentales
// =================================================================

import nodemailer from 'nodemailer';
import logger from '../config/logger';
import { EmailProvider } from '../types/notifications';

export class EmailService implements EmailProvider {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Inicializar el transportador de email
   */
  private async initializeTransporter(): Promise<void> {
    try {
      // Configuración desde variables de entorno
      const emailConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      };

      // Validar configuración
      if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        logger.warn('Configuración de email incompleta. Servicio de email deshabilitado.', {
          hasUser: !!emailConfig.auth.user,
          hasPassword: !!emailConfig.auth.pass
        });
        return;
      }

      // Crear transportador
      this.transporter = nodemailer.createTransport(emailConfig);

      // Verificar conexión
      await this.transporter.verify();
      this.isConfigured = true;

      logger.info('Servicio de email configurado exitosamente', {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        user: emailConfig.auth.user
      });
    } catch (error) {
      logger.error('Error al configurar servicio de email', {
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      this.isConfigured = false;
    }
  }

  /**
   * Enviar email
   */
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    isHtml: boolean = true
  ): Promise<boolean> {
    try {
      if (!this.isConfigured || !this.transporter) {
        logger.warn('Intento de envío de email con servicio no configurado', {
          to,
          subject
        });
        return false;
      }

      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
      const fromName = process.env.SMTP_FROM_NAME || 'Sistema Dental';

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        [isHtml ? 'html' : 'text']: body
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email enviado exitosamente', {
        to,
        subject,
        messageId: info.messageId,
        response: info.response
      });

      return true;
    } catch (error) {
      logger.error('Error al enviar email', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        to,
        subject
      });
      return false;
    }
  }

  /**
   * Enviar email con template HTML
   */
  async sendHtmlEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<boolean> {
    try {
      if (!this.isConfigured || !this.transporter) {
        logger.warn('Intento de envío de email HTML con servicio no configurado');
        return false;
      }

      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
      const fromName = process.env.SMTP_FROM_NAME || 'Sistema Dental';

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html: htmlBody,
        text: textBody || this.htmlToText(htmlBody)
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email HTML enviado exitosamente', {
        to,
        subject,
        messageId: info.messageId
      });

      return true;
    } catch (error) {
      logger.error('Error al enviar email HTML', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        to,
        subject
      });
      return false;
    }
  }

  /**
   * Enviar múltiples emails
   */
  async sendBulkEmails(
    recipients: Array<{
      to: string;
      subject: string;
      body: string;
      isHtml?: boolean;
    }>
  ): Promise<{ sent: number; failed: number; results: boolean[] }> {
    const results: boolean[] = [];
    let sent = 0;
    let failed = 0;

    for (const email of recipients) {
      const success = await this.sendEmail(
        email.to,
        email.subject,
        email.body,
        email.isHtml
      );
      
      results.push(success);
      if (success) {
        sent++;
      } else {
        failed++;
      }

      // Pequeña pausa entre envíos para evitar rate limiting
      await this.delay(100);
    }

    logger.info('Envío masivo de emails completado', {
      total: recipients.length,
      sent,
      failed
    });

    return { sent, failed, results };
  }

  /**
   * Validar configuración de email
   */
  validateConfig(config: any): boolean {
    const required = ['host', 'port', 'auth'];
    const authRequired = ['user', 'pass'];

    for (const field of required) {
      if (!config[field]) {
        logger.error(`Campo requerido faltante en configuración de email: ${field}`);
        return false;
      }
    }

    for (const field of authRequired) {
      if (!config.auth[field]) {
        logger.error(`Campo de autenticación faltante: ${field}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Verificar estado del servicio
   */
  async checkServiceHealth(): Promise<{
    isHealthy: boolean;
    isConfigured: boolean;
    lastError?: string;
  }> {
    try {
      if (!this.isConfigured || !this.transporter) {
        return {
          isHealthy: false,
          isConfigured: false,
          lastError: 'Servicio no configurado'
        };
      }

      await this.transporter.verify();
      
      return {
        isHealthy: true,
        isConfigured: true
      };
    } catch (error) {
      return {
        isHealthy: false,
        isConfigured: this.isConfigured,
        lastError: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Reconfigurar el servicio
   */
  async reconfigure(): Promise<void> {
    this.transporter = null;
    this.isConfigured = false;
    await this.initializeTransporter();
  }

  // =================================================================
  // MÉTODOS PRIVADOS
  // =================================================================

  /**
   * Convertir HTML a texto plano (básico)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remover tags HTML
      .replace(/&nbsp;/g, ' ') // Reemplazar espacios no separables
      .replace(/&amp;/g, '&') // Reemplazar entidades HTML
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim();
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
}

// =================================================================
// TEMPLATES HTML PARA EMAILS
// =================================================================

export class EmailTemplates {
  /**
   * Template base para emails
   */
  static getBaseTemplate(content: string, clinicName: string = 'Clínica Dental'): string {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${clinicName}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background-color: #2c5aa0;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
            }
            .content {
                background-color: #f9f9f9;
                padding: 30px;
                border-radius: 0 0 8px 8px;
            }
            .appointment-details {
                background-color: white;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #2c5aa0;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                color: #666;
                font-size: 14px;
            }
            .button {
                display: inline-block;
                background-color: #2c5aa0;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 4px;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🦷 ${clinicName}</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>Este es un mensaje automático, por favor no responder a este email.</p>
            <p>© ${new Date().getFullYear()} ${clinicName}. Todos los derechos reservados.</p>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Template para recordatorio de cita
   */
  static getAppointmentReminderTemplate(data: {
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    dentistName: string;
    clinicName: string;
    clinicPhone: string;
    clinicAddress: string;
  }): string {
    const content = `
      <h2>Recordatorio de Cita</h2>
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Te recordamos que tienes una cita programada:</p>
      
      <div class="appointment-details">
          <h3>📅 Detalles de tu Cita</h3>
          <p><strong>Fecha:</strong> ${data.appointmentDate}</p>
          <p><strong>Hora:</strong> ${data.appointmentTime}</p>
          <p><strong>Doctor:</strong> ${data.dentistName}</p>
          <p><strong>Clínica:</strong> ${data.clinicName}</p>
          <p><strong>Dirección:</strong> ${data.clinicAddress}</p>
      </div>
      
      <p>Por favor confirma tu asistencia llamando al <strong>${data.clinicPhone}</strong></p>
      
      <p>Si necesitas reprogramar o cancelar tu cita, contáctanos con al menos 24 horas de anticipación.</p>
      
      <p>¡Esperamos verte pronto!</p>
      
      <p>Saludos cordiales,<br>
      Equipo de ${data.clinicName}</p>
    `;
    
    return this.getBaseTemplate(content, data.clinicName);
  }

  /**
   * Template para confirmación de cita
   */
  static getAppointmentConfirmationTemplate(data: {
    patientName: string;
    appointmentTime: string;
    clinicName: string;
    clinicPhone: string;
  }): string {
    const content = `
      <h2>Confirma tu Cita</h2>
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Tu cita es en <strong>${data.appointmentTime}</strong>.</p>
      
      <p>Por favor confirma tu asistencia respondiendo a este mensaje o llamando al <strong>${data.clinicPhone}</strong></p>
      
      <a href="#" class="button">Confirmar Cita</a>
      
      <p>Gracias,<br>
      ${data.clinicName}</p>
    `;
    
    return this.getBaseTemplate(content, data.clinicName);
  }
}

export const emailService = new EmailService();