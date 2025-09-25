import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';
import logger from './logger';

// Configuración básica de Swagger
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Sistema de Expedientes Dentales API',
    version: '1.0.0',
    description: 'API REST para el sistema de gestión de expedientes dentales con autenticación multi-tenant',
    contact: {
      name: 'Equipo de Desarrollo',
      email: 'dev@dentalrecords.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor de Desarrollo'
    },
    {
      url: 'https://api.dentalrecords.com',
      description: 'Servidor de Producción'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT obtenido del endpoint de login'
      }
    },
    schemas: {
      User: {
        type: 'object',
        required: ['id', 'email', 'profile'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'ID único del usuario'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Correo electrónico del usuario'
          },
          profile: {
            $ref: '#/components/schemas/UserProfile'
          }
        }
      },
      UserProfile: {
        type: 'object',
        required: ['first_name', 'last_name', 'role', 'clinic_id'],
        properties: {
          first_name: {
            type: 'string',
            description: 'Nombre del usuario'
          },
          last_name: {
            type: 'string',
            description: 'Apellido del usuario'
          },
          role: {
            type: 'string',
            enum: ['admin', 'dentist', 'assistant', 'receptionist'],
            description: 'Rol del usuario en el sistema'
          },
          clinic_id: {
            type: 'string',
            format: 'uuid',
            description: 'ID de la clínica a la que pertenece el usuario'
          },
          phone: {
            type: 'string',
            description: 'Número de teléfono del usuario'
          },
          is_active: {
            type: 'boolean',
            description: 'Estado activo del usuario'
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Correo electrónico del usuario'
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'Contraseña del usuario'
          }
        }
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'first_name', 'last_name', 'role', 'clinic_id'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Correo electrónico del usuario'
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'Contraseña del usuario'
          },
          first_name: {
            type: 'string',
            description: 'Nombre del usuario'
          },
          last_name: {
            type: 'string',
            description: 'Apellido del usuario'
          },
          role: {
            type: 'string',
            enum: ['admin', 'dentist', 'assistant', 'receptionist'],
            description: 'Rol del usuario en el sistema'
          },
          clinic_id: {
            type: 'string',
            format: 'uuid',
            description: 'ID de la clínica a la que pertenecerá el usuario'
          },
          phone: {
            type: 'string',
            description: 'Número de teléfono del usuario'
          },
          terms_accepted: {
            type: 'boolean',
            description: 'Aceptación de términos y condiciones'
          },
          privacy_accepted: {
            type: 'boolean',
            description: 'Aceptación de política de privacidad'
          }
        }
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: {
            type: 'string',
            description: 'Token de refresco válido para renovar el acceso'
          }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Indica si la operación fue exitosa'
          },
          message: {
            type: 'string',
            description: 'Mensaje descriptivo de la respuesta'
          },
          data: {
            type: 'object',
            properties: {
              user: {
                $ref: '#/components/schemas/User'
              },
              access_token: {
                type: 'string',
                description: 'Token JWT de acceso para autenticación'
              },
              refresh_token: {
                type: 'string',
                description: 'Token de refresco para renovar el acceso'
              },
              expires_in: {
                type: 'integer',
                description: 'Tiempo de expiración del token en segundos',
                example: 3600
              },
              token: {
                type: 'string',
                description: 'Token JWT para autenticación (compatibilidad)'
              }
            }
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp de la respuesta'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          message: {
            type: 'string',
            description: 'Mensaje de error'
          },
          error: {
            type: 'string',
            description: 'Código de error específico'
          },
          details: {
            type: 'object',
            description: 'Detalles adicionales del error'
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Authentication',
      description: 'Endpoints relacionados con autenticación y autorización'
    },
    {
      name: 'Health',
      description: 'Endpoints de estado y salud del sistema'
    },
    {
      name: 'Clínicas',
      description: 'Endpoints relacionados con clínicas'
    }
  ]
};

// Opciones para swagger-jsdoc
const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/app.ts'
  ]
};

// Generar especificación de Swagger
const swaggerSpec = swaggerJSDoc(options);

// Configurar Swagger UI
export const setupSwagger = (app: Application): void => {
  // Opciones de personalización para Swagger UI
  const swaggerUiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c5aa0 }
    `,
    customSiteTitle: 'Dental Records API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  };

  // Ruta para la documentación de Swagger
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  
  // Ruta para obtener la especificación JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info('Swagger UI configurado exitosamente', {
    action: 'setup_swagger',
    swaggerUrl: 'http://localhost:3000/api-docs',
    specUrl: 'http://localhost:3000/api-docs.json',
    timestamp: new Date().toISOString()
  });
};

export { swaggerSpec };