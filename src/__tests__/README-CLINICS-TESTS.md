# Tests del Módulo de Clínicas

Este documento describe la suite completa de tests para el módulo de gestión de clínicas.

## Estructura de Tests

### 🧪 Tests E2E (End-to-End)
**Archivo:** `e2e/clinics.e2e.test.ts`

**Propósito:** Probar el flujo completo desde la API hasta la base de datos.

**Cobertura:**
- ✅ Creación de clínicas con autenticación
- ✅ Listado con paginación y filtros
- ✅ Obtención por ID
- ✅ Actualización de datos
- ✅ Cambio de estado (activo/inactivo)
- ✅ Obtención de estadísticas
- ✅ Validación de autenticación y autorización
- ✅ Manejo de errores HTTP

**Ejecutar:**
```bash
npm run test:e2e:clinics
```

### 🔧 Tests de Integración
**Archivo:** `integration/clinics/clinics.integration.test.ts`

**Propósito:** Probar la lógica de negocio y validaciones.

**Cobertura:**
- ✅ Validaciones de formato (email, teléfono)
- ✅ Validaciones de longitud de campos
- ✅ Operaciones CRUD completas
- ✅ Paginación y filtros avanzados
- ✅ Cálculo de estadísticas
- ✅ Autorización multi-tenant
- ✅ Manejo de errores de base de datos

**Ejecutar:**
```bash
npm run test:integration:clinics
```

### ⚡ Tests Unitarios
**Archivo:** `unit/controllers/clinicController.test.ts`

**Propósito:** Probar la lógica del controlador de forma aislada.

**Cobertura:**
- ✅ Lógica de cada método del controlador
- ✅ Manejo de errores y excepciones
- ✅ Validaciones de entrada
- ✅ Respuestas HTTP correctas
- ✅ Llamadas a servicios con parámetros correctos
- ✅ Casos edge (usuario sin ID, parámetros faltantes)

**Ejecutar:**
```bash
npm run test:unit:controllers
```

## Scripts Disponibles

### Ejecutar todos los tests de clínicas
```bash
npm run test:clinics
```
Ejecuta en secuencia: unitarios → integración → E2E

### Ejecutar por tipo
```bash
# Solo tests unitarios
npm run test:unit:controllers

# Solo tests de integración
npm run test:integration:clinics

# Solo tests E2E
npm run test:e2e:clinics

# Todos los tests unitarios
npm run test:unit

# Todos los tests de integración
npm run test:integration

# Todos los tests E2E
npm run test:e2e
```

### Con coverage
```bash
npm run test:coverage
```

### Modo watch
```bash
npm run test:watch
```

## Casos de Prueba Principales

### 1. Creación de Clínicas
- ✅ Creación exitosa con datos válidos
- ✅ Validación de campos requeridos
- ✅ Validación de formato de email
- ✅ Validación de formato de teléfono mexicano
- ✅ Validación de longitud mínima de campos
- ✅ Manejo de errores de autenticación

### 2. Listado y Búsqueda
- ✅ Paginación correcta
- ✅ Filtros por estado (activo/inactivo)
- ✅ Búsqueda por nombre
- ✅ Ordenamiento
- ✅ Límites de resultados

### 3. Operaciones CRUD
- ✅ Lectura por ID
- ✅ Actualización parcial
- ✅ Cambio de estado
- ✅ Validación de permisos
- ✅ Manejo de recursos no encontrados

### 4. Estadísticas
- ✅ Cálculo de totales (pacientes, citas, tratamientos)
- ✅ Pacientes activos
- ✅ Validación de tipos de datos
- ✅ Valores no negativos

### 5. Seguridad y Autorización
- ✅ Autenticación requerida
- ✅ Validación de tokens
- ✅ Permisos por clínica (multi-tenant)
- ✅ Rate limiting

## Datos de Prueba

Los tests utilizan datos de prueba definidos en `e2e/setup.ts`:

```typescript
export const testUser = {
    email: 'test.e2e@example.com',
    password: 'TestPassword123!',
    clinic_id: '9fac1acc-2787-4fde-82d5-8fdd750d2178'
};
```

## Configuración

### Variables de Entorno
Los tests utilizan la configuración de `.env` para:
- Conexión a base de datos de prueba
- Configuración de JWT
- Rate limiting

### Setup Global
El archivo `e2e/setup.ts` configura:
- Instancia de la aplicación Express
- Helpers para autenticación
- Datos de prueba
- Logging de tests

## Mejores Prácticas Implementadas

### 1. Patrón AAA (Arrange-Act-Assert)
```typescript
it('debería crear una clínica', async () => {
    // Arrange: Preparar datos
    const clinicData = { name: 'Test' };
    
    // Act: Ejecutar acción
    const response = await testRequest.post('/api/clinics').send(clinicData);
    
    // Assert: Verificar resultado
    expect(response.status).toBe(201);
});
```

### 2. Mocking de Dependencias
```typescript
vi.mock('../../../services/clinicService');
vi.mocked(clinicService.createClinic).mockResolvedValue(mockData);
```

### 3. Cleanup y Setup
```typescript
beforeEach(() => {
    vi.clearAllMocks();
});
```

### 4. Tests Descriptivos
```typescript
describe('POST /api/clinics - Crear clínica', () => {
    it('debería crear una nueva clínica con datos válidos', async () => {
        // Test implementation
    });
});
```

## Métricas de Cobertura Esperadas

- **Controladores:** 95%+ cobertura de líneas
- **Servicios:** 90%+ cobertura de líneas
- **Rutas:** 100% cobertura de endpoints
- **Validaciones:** 100% cobertura de esquemas Zod

## Troubleshooting

### Error: "Usuario no autenticado"
- Verificar que el token se esté generando correctamente
- Revisar configuración JWT en `.env`

### Error: "Clínica no encontrada"
- Verificar que la clínica de prueba existe en la base de datos
- Revisar permisos del usuario de prueba

### Tests lentos
- Usar `--run` para evitar modo watch
- Verificar conexión a base de datos
- Revisar timeouts en `vitest.config.ts`

## Próximos Pasos

1. **Tests de Performance:** Agregar tests de carga para endpoints críticos
2. **Tests de Seguridad:** Validar inyección SQL, XSS, etc.
3. **Tests de Concurrencia:** Probar operaciones simultáneas
4. **Tests de Migración:** Validar cambios de esquema de base de datos

---

**Nota:** Estos tests están diseñados para ser ejecutados en un entorno de desarrollo/testing. No ejecutar contra base de datos de producción.