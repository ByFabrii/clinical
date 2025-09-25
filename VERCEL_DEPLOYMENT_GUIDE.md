# 🚀 Guía de Despliegue en Vercel - Sistema de Expedientes Dentales

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Prerrequisitos](#prerrequisitos)
3. [Configuración Inicial](#configuración-inicial)
4. [Variables de Entorno](#variables-de-entorno)
5. [Proceso de Despliegue](#proceso-de-despliegue)
6. [Verificación Post-Despliegue](#verificación-post-despliegue)
7. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)
8. [Troubleshooting](#troubleshooting)
9. [Optimizaciones](#optimizaciones)
10. [Contactos y Soporte](#contactos-y-soporte)

---

## 🎯 Resumen Ejecutivo

Esta guía proporciona instrucciones completas para desplegar el backend del Sistema de Expedientes Dentales en Vercel. El proyecto está configurado para funcionar como una aplicación serverless con optimizaciones específicas para el entorno de producción.

### ✅ Estado del Proyecto
- ✅ **Configuración Vercel**: Completada
- ✅ **Variables de Entorno**: Configuradas
- ✅ **CI/CD**: GitHub Actions implementado
- ✅ **Optimizaciones**: Build y dependencias optimizadas
- ✅ **Documentación**: Completa

---

## 🔧 Prerrequisitos

### Cuentas Requeridas
- [ ] **GitHub**: Repositorio del proyecto
- [ ] **Vercel**: Cuenta activa
- [ ] **Supabase**: Base de datos PostgreSQL
- [ ] **Resend**: Servicio de email (opcional)

### Herramientas Locales
```bash
# Node.js (versión 18 o superior)
node --version  # >= 18.0.0

# npm (versión 9 o superior)
npm --version   # >= 9.0.0

# Vercel CLI (opcional pero recomendado)
npm install -g vercel
```

### Accesos Requeridos
- [ ] Admin en el repositorio de GitHub
- [ ] Permisos de deploy en Vercel
- [ ] Acceso a las credenciales de Supabase
- [ ] Claves de servicios externos (JWT, etc.)

---

## ⚙️ Configuración Inicial

### 1. Preparación del Repositorio

```bash
# Clonar el repositorio
git clone [URL_DEL_REPOSITORIO]
cd dental-records-backend

# Instalar dependencias
npm install

# Verificar configuración
npm run build:vercel
```

### 2. Configuración en Vercel

#### Opción A: Desde la Web UI
1. Ir a [vercel.com](https://vercel.com)
2. Conectar con GitHub
3. Importar el repositorio
4. Configurar las variables de entorno (ver sección siguiente)

#### Opción B: Desde CLI
```bash
# Inicializar proyecto
vercel

# Configurar para producción
vercel --prod
```

### 3. Estructura de Archivos Clave

```
backend/
├── api/
│   └── index.ts              # Punto de entrada serverless
├── src/
│   ├── app.ts               # Configuración Express
│   ├── server.ts            # Servidor principal
│   └── ...                  # Resto del código
├── .env.production          # Variables de producción
├── .env.example             # Plantilla de variables
├── .vercelignore           # Archivos excluidos
├── vercel.json             # Configuración Vercel
├── tsconfig.production.json # TypeScript optimizado
└── package.json            # Scripts y dependencias
```

---

## 🔐 Variables de Entorno

### Configuración en Vercel Dashboard

1. **Ir a Project Settings** → Environment Variables
2. **Configurar las siguientes variables**:

#### 🔑 Variables Críticas (REQUERIDAS)

```bash
# Base de Datos
DATABASE_URL=postgresql://[usuario]:[password]@[host]:[puerto]/[database]
SUPABASE_URL=https://[proyecto].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Autenticación
JWT_SECRET=[clave-secreta-fuerte]
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=[clave-refresh-secreta]
JWT_REFRESH_EXPIRES_IN=7d

# Servidor
NODE_ENV=production
PORT=3000
```

#### 🌐 Variables de Vercel

```bash
# URLs
VERCEL_URL=[auto-generada]
FRONTEND_URL=https://[tu-frontend].vercel.app

# Configuración
VERCEL_REGION=iad1
FUNCTION_TIMEOUT=30
SERVERLESS_MODE=true
```

#### 📧 Variables de Email (Opcionales)

```bash
# Resend
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@[tu-dominio].com

# O SMTP alternativo
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=[email]
SMTP_PASS=[password]
```

#### 🔒 Variables de Seguridad

```bash
# Encriptación
ENCRYPTION_KEY=[clave-32-caracteres]
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://[tu-frontend].vercel.app
```

### 🎯 Configuración por Ambiente

#### Development
```bash
vercel env add NODE_ENV development
```

#### Preview/Staging
```bash
vercel env add NODE_ENV staging
```

#### Production
```bash
vercel env add NODE_ENV production
```

---

## 🚀 Proceso de Despliegue

### Despliegue Automático (Recomendado)

El proyecto está configurado con GitHub Actions para despliegue automático:

#### 1. **Push a `develop`** → Deploy a Staging
```bash
git checkout develop
git add .
git commit -m "feat: nueva funcionalidad"
git push origin develop
```

#### 2. **Merge a `main`** → Deploy a Producción
```bash
git checkout main
git merge develop
git push origin main
```

### Despliegue Manual

#### Desde CLI Local
```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

#### Desde GitHub
1. Ir a **Actions** en el repositorio
2. Seleccionar **Deploy to Vercel**
3. Hacer clic en **Run workflow**
4. Seleccionar branch y ambiente

### Proceso de Build

El build ejecuta automáticamente:

```bash
# 1. Instalar dependencias
npm ci

# 2. Build optimizado para producción
npm run build:vercel

# 3. Verificar archivos generados
ls -la dist/
```

---

## ✅ Verificación Post-Despliegue

### 1. Health Checks Automáticos

```bash
# Verificar que el servidor responde
curl https://[tu-proyecto].vercel.app/health

# Respuesta esperada:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "production",
  "version": "1.0.0"
}
```

### 2. Verificación de Endpoints

```bash
# Info del sistema
curl https://[tu-proyecto].vercel.app/info

# Documentación API
curl https://[tu-proyecto].vercel.app/api-docs

# Test de autenticación
curl -X POST https://[tu-proyecto].vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### 3. Verificación de Base de Datos

```bash
# Test de conexión (endpoint interno)
curl https://[tu-proyecto].vercel.app/api/health/database
```

### 4. Logs y Monitoreo

#### En Vercel Dashboard:
1. **Functions** → Ver logs en tiempo real
2. **Analytics** → Métricas de rendimiento
3. **Speed Insights** → Análisis de velocidad

#### Logs Estructurados:
```bash
# Ver logs recientes
vercel logs [deployment-url]

# Logs en tiempo real
vercel logs [deployment-url] --follow
```

---

## 📊 Monitoreo y Mantenimiento

### Métricas Clave

#### Rendimiento
- **Cold Start Time**: < 2 segundos
- **Response Time**: < 500ms (P95)
- **Error Rate**: < 1%
- **Uptime**: > 99.9%

#### Recursos
- **Memory Usage**: < 512MB
- **Function Duration**: < 10 segundos
- **Bandwidth**: Monitorear límites

### Alertas Configuradas

#### GitHub Actions
- ✅ **Build Failures**: Notificación inmediata
- ✅ **Test Failures**: Bloqueo de deploy
- ✅ **Deploy Success**: Confirmación en Slack

#### Vercel
- ✅ **Function Errors**: Email + Slack
- ✅ **High Latency**: Alerta automática
- ✅ **Quota Limits**: Notificación preventiva

### Mantenimiento Rutinario

#### Semanal
- [ ] Revisar logs de errores
- [ ] Verificar métricas de rendimiento
- [ ] Actualizar dependencias menores

#### Mensual
- [ ] Análisis de uso y costos
- [ ] Revisión de seguridad
- [ ] Backup de configuraciones
- [ ] Actualización de documentación

#### Trimestral
- [ ] Actualización de dependencias mayores
- [ ] Revisión de arquitectura
- [ ] Optimización de rendimiento
- [ ] Auditoría de seguridad

---

## 🔧 Troubleshooting

### Problemas Comunes

#### 1. **Error: Function Timeout**
```bash
# Síntoma
Error: Function execution timed out after 30s

# Solución
# Verificar en vercel.json:
{
  "functions": {
    "api/index.ts": {
      "maxDuration": 30  // Aumentar si es necesario
    }
  }
}
```

#### 2. **Error: Module Not Found**
```bash
# Síntoma
Error: Cannot find module '@/config/database'

# Solución
# Verificar tsconfig.production.json paths
# Verificar que tsc-alias se ejecute en build
```

#### 3. **Error: Database Connection**
```bash
# Síntoma
Error: Connection to database failed

# Verificar
1. Variables de entorno en Vercel
2. Whitelist de IPs en Supabase
3. SSL configuration
```

#### 4. **Error: CORS**
```bash
# Síntoma
Access to fetch blocked by CORS policy

# Solución
# Verificar CORS_ORIGIN en variables de entorno
# Verificar configuración en app.ts
```

### Comandos de Diagnóstico

```bash
# Verificar configuración local
npm run build:vercel

# Test de conexión a DB
npm run test:db

# Verificar variables de entorno
vercel env ls

# Logs detallados
vercel logs --follow

# Información del proyecto
vercel inspect [deployment-url]
```

### Contactos de Emergencia

#### Desarrollo
- **Lead Developer**: [email]
- **DevOps**: [email]
- **Slack**: #dental-records-alerts

#### Servicios
- **Vercel Support**: support@vercel.com
- **Supabase Support**: support@supabase.io

---

## ⚡ Optimizaciones

### Rendimiento Implementado

#### 1. **Build Optimizations**
- ✅ TypeScript optimizado para producción
- ✅ Source maps deshabilitados
- ✅ Comentarios removidos
- ✅ Tree shaking automático

#### 2. **Runtime Optimizations**
- ✅ Connection pooling para DB
- ✅ Cache de configuración
- ✅ Lazy loading de módulos
- ✅ Compression middleware

#### 3. **Serverless Optimizations**
- ✅ Cold start minimizado
- ✅ Memory allocation optimizada
- ✅ Function splitting por ruta
- ✅ Edge caching configurado

### Mejoras Futuras

#### Corto Plazo (1-2 meses)
- [ ] **Edge Functions**: Migrar endpoints críticos
- [ ] **Database Caching**: Implementar Redis
- [ ] **CDN**: Configurar para assets estáticos
- [ ] **Monitoring**: Implementar APM avanzado

#### Mediano Plazo (3-6 meses)
- [ ] **Multi-region**: Deploy en múltiples regiones
- [ ] **Auto-scaling**: Configuración avanzada
- [ ] **Performance Budget**: Límites automáticos
- [ ] **A/B Testing**: Framework de experimentos

---

## 📚 Recursos Adicionales

### Documentación
- [Vercel Documentation](https://vercel.com/docs)
- [Node.js on Vercel](https://vercel.com/docs/functions/serverless-functions/runtimes/node-js)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

### Herramientas
- [Vercel CLI](https://vercel.com/docs/cli)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Supabase Docs](https://supabase.com/docs)

### Monitoreo
- [Vercel Analytics](https://vercel.com/analytics)
- [Speed Insights](https://vercel.com/docs/speed-insights)
- [Web Vitals](https://web.dev/vitals/)

---

## 📞 Contactos y Soporte

### Equipo de Desarrollo
- **Project Manager**: [nombre] - [email]
- **Lead Developer**: [nombre] - [email]
- **DevOps Engineer**: [nombre] - [email]
- **QA Lead**: [nombre] - [email]

### Canales de Comunicación
- **Slack**: #dental-records-dev
- **Email**: dev-team@[empresa].com
- **Emergency**: +1-XXX-XXX-XXXX

### Horarios de Soporte
- **Desarrollo**: Lunes a Viernes, 9:00 AM - 6:00 PM
- **Emergencias**: 24/7 (solo para issues críticos)
- **Mantenimiento**: Domingos, 2:00 AM - 4:00 AM

---

## 📝 Changelog

### v1.0.0 (2024-01-15)
- ✅ Configuración inicial de Vercel
- ✅ Variables de entorno configuradas
- ✅ CI/CD con GitHub Actions
- ✅ Optimizaciones de build implementadas
- ✅ Documentación completa

### Próximas Versiones
- **v1.1.0**: Edge Functions y caching avanzado
- **v1.2.0**: Multi-region deployment
- **v2.0.0**: Microservices architecture

---

**📄 Documento actualizado**: 15 de Enero, 2024  
**👤 Autor**: Equipo de Desarrollo  
**🔄 Próxima revisión**: 15 de Febrero, 2024

---

> **⚠️ Importante**: Este documento debe mantenerse actualizado con cada cambio en la configuración de despliegue. Cualquier modificación debe ser comunicada al equipo y reflejada en esta documentación.