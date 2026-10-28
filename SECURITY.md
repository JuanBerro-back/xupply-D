# Política de seguridad

## Versiones soportadas

Solo `main` recibe correcciones de seguridad. Las ramas de trabajo se fusionan
o se descartan; no se mantienen parches en ramas antiguas.

## Cómo reportar una vulnerabilidad

**No abras un issue público** con detalles de la vulnerabilidad.

1. Usa la pestaña **Security → Report a vulnerability** del repositorio
   (GitHub Private Vulnerability Reporting).
2. Incluye: versión/commit afectado, pasos para reproducir, impacto y, si es
   posible, una prueba de concepto.
3. No incluyas datos personales, credenciales ni documentos de terceros.

Objetivo de respuesta: acuse en 48 h y evaluación inicial en 5 días hábiles.

## Prácticas del proyecto

- Nunca se versionan `.env`, contraseñas, tokens ni llaves privadas.
- Las credenciales demo (`demo1234`) están deshabilitadas en producción por
  `neutralizeDemoCredentials()`.
- Los endpoints de negocio exigen JWT; los documentos de verificación exigen
  permiso `verificacion`.
- El CI ejecuta typecheck, build y `npm audit --omit=dev` en cada PR.
- Dependabot revisa dependencias semanalmente.

## Alcance

Quedan fuera de alcance los ataques de denegación de servicio, la ingeniería
social y los reportes generados solo por escáneres sin impacto demostrable.
