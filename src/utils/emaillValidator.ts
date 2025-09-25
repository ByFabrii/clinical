/**
 * Valida si un email tiene un formato válido usando un regex robusto
 * Basado en RFC 5322 con mejoras para casos comunes
 * @param email - El email a validar
 * @returns true si el email es válido, false en caso contrario
 */
export const isValidEmail = (email: string): boolean => {
  // Regex para:
  // - Caracteres especiales permitidos: !#$%&'*+-/=?^_`{|}~
  // - Puntos no consecutivos ni al inicio/final
  // - Dominios con estructura válida
  // - Subdominios múltiples
  // - Extensiones de 2-6 caracteres
  const emailRegex = /^[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+(xn--[a-zA-Z0-9]+|[a-zA-Z]{2,6})$/
  
  // Validaciones adicionales
  if (!email || email.length > 254) return false // RFC 5321 límite
  if (email.includes('..')) return false // Puntos consecutivos
  if (email.startsWith('.') || email.endsWith('.')) return false // Puntos al inicio/final
  
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return false
  if (localPart.length > 64) return false // RFC 5321 límite parte local
  
  return emailRegex.test(email)
}