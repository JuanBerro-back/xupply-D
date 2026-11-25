import { randomInt } from 'crypto';

/**
 * Códigos de negocio con el formato histórico: `PREFIJO-<base36 en mayúsculas>`.
 * Centraliza el formato sin alterar los valores que ya se insertaban en la BD.
 */
export function nextBusinessCode(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Llave de entrega de 4 dígitos. Antes se generaba con `Math.random`; ahora se
 * usa el PRNG criptográfico de Node manteniendo exactamente el mismo formato.
 */
export function nextConfirmationCode(): string {
  return String(randomInt(1000, 10000));
}
