# Correo enterprise y entregabilidad (anti-spam)

Guía para que Xupply envíe correos transaccionales (pedidos, facturas, pruebas) desde un **dominio corporativo** y lleguen a la **bandeja de entrada**, no a spam.

---

## 1. Cómo funciona en el código

`app/server/src/lib/email.ts` soporta tres proveedores y autodetecta el que esté configurado:

| Prioridad | Proveedor | Variables | Recomendado para |
|---|---|---|---|
| 1 | **SMTP** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Google Workspace, Microsoft 365, Amazon SES, Zoho |
| 2 | **Resend** | `RESEND_API_KEY` | Startups/hackathon, DKIM automático |
| 3 | **EmailJS** (legacy) | `EMAILJS_*` | Compatibilidad con la configuración anterior |

Si no hay ninguno, el correo se omite con un warning; **nunca rompe** la creación de un pedido o factura.

Si el proveedor principal falla (credenciales caducadas, puerto SMTP bloqueado en
serverless), `sendEmail()` reintenta 3 veces y luego usa el siguiente proveedor
configurado como respaldo. El orden por defecto es SMTP → Resend → EmailJS.

### Variables nuevas

```env
MAIL_PROVIDER=smtp                # smtp | resend | emailjs | vacío = autodetectar
MAIL_FROM=notificaciones@tudominio.com
MAIL_FROM_NAME=Xupply
MAIL_REPLY_TO=soporte@tudominio.com
MAIL_BCC=auditoria@tudominio.com  # opcional: copia oculta de auditoría
APP_URL=https://tudominio.com
MAIL_COMPANY_NAME=Xupply
MAIL_COMPANY_ADDRESS=Bucaramanga, Santander, Colombia
# Selectores DKIM para el diagnóstico automático (separados por coma).
# Si no se define, se prueban los habituales (google, selector1, resend, amazonses...).
MAIL_DKIM_SELECTORS=google

# SMTP
SMTP_HOST=smtp.tudominio.com
SMTP_PORT=587
SMTP_SECURE=false                 # true solo para puerto 465
SMTP_USER=notificaciones@tudominio.com
SMTP_PASS=...

# o Resend
# RESEND_API_KEY=re_...
```

> `MAIL_FROM` debe pertenecer al **mismo dominio** de `SMTP_USER`. Si no coincide, SPF/DKIM fallan y el correo cae en spam.

---

## 2. "Entrada de correo enterprise" (buzón real)

Para que los clientes puedan **responder** y tú recibas en un buzón corporativo:

1. Crea el dominio y los buzones en tu proveedor:
   - `notificaciones@tudominio.com` → remitente automático.
   - `soporte@tudominio.com` → bandeja que recibe respuestas (`MAIL_REPLY_TO`).
   - `auditoria@tudominio.com` → copia oculta de todos los envíos (`MAIL_BCC`), opcional.
   - `dmarc@tudominio.com` → reportes DMARC.
2. Configura `MAIL_REPLY_TO=soporte@tudominio.com`. Así el cliente responde a una persona, no a `no-reply`.
3. No uses `no-reply@` como `MAIL_FROM` si esperas respuestas; usa `notificaciones@`.
4. Verifica que el buzón `soporte@` tenga IMAP/SMTP activo y que el proveedor permita SMTP AUTH.

> En Google Workspace o Microsoft 365 el buzón ya existe como "entrada" corporativa; Xupply solo necesita credenciales SMTP de ese buzón.

---

## 3. Configuración DNS (la clave para no caer en spam)

Añade estos registros en el panel DNS de tu dominio. Sustituye `tudominio.com` y los valores por los que te dé el proveedor.

### 3.1 SPF — autoriza a tu proveedor

Un solo registro TXT en la raíz:

| Proveedor | Registro SPF |
|---|---|
| Google Workspace | `v=spf1 include:_spf.google.com ~all` |
| Microsoft 365 | `v=spf1 include:spf.protection.outlook.com ~all` |
| Amazon SES | `v=spf1 include:amazonses.com ~all` |
| Resend | `v=spf1 include:amazonses.com ~all` (Resend usa SES) |
| Zoho | `v=spf1 include:zoho.com ~all` |

**No tengas dos registros SPF**: se invalidan. Si ya existe uno, fusiónalo.

### 3.2 DKIM — firma criptográfica

El proveedor te da registros CNAME/TXT con un selector (por ejemplo `google._domainkey`, `selector1._domainkey`, `resend._domainkey`). Añádelos **tal cual**. DKIM es el factor que más pesa para Gmail/Outlook.

- Google Workspace: Admin → Apps → Google Workspace → Gmail → Autenticar correo.
- Microsoft 365: Defender → Email authentication → DKIM → habilitar dominio.
- Amazon SES: Verified identities → DKIM → CNAMEs.
- Resend: Domains → Add domain → copiar registros.

### 3.3 DMARC — política y reportes

TXT en `_dmarc.tudominio.com`:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@tudominio.com; ruf=mailto:dmarc@tudominio.com; adkim=s; aspf=s; pct=100
```

- Empieza con `p=none` si estás migrando, revisa reportes 1–2 semanas y luego pasa a `quarantine` y `reject`.
- `adkim=s; aspf=s` exige alineación estricta: el dominio de `MAIL_FROM` debe coincidir con el que firma.
- `rua` te envía reportes agregados; úsalos para detectar fallos.

### 3.4 Registro MX y PTR

- **MX**: solo necesario para el buzón de entrada (`soporte@`). El proveedor de correo te da los MX.
- **PTR / rDNS**: si usas un VPS con SMTP propio, configura el registro inverso a tu dominio. Sin PTR, Gmail penaliza.
- **No abras el puerto 25** en VPS cloud (bloqueado por AWS/GCP/Azure); usa el puerto 587 de tu proveedor.

### 3.5 Verificación

```powershell
# SPF
nslookup -type=TXT tudominio.com

# DMARC
nslookup -type=TXT _dmarc.tudominio.com

# DKIM (ejemplo con selector de Google)
nslookup -type=TXT google._domainkey.tudominio.com
```

Herramientas online: MXToolbox, Google Admin Toolbox (Messageheader), mail-tester.com.

---

## 4. Buenas prácticas de contenido

El código ya aplica varias:

- HTML **y** texto plano (`multipart/alternative`).
- Remitente con nombre (`Xupply <notificaciones@...>`).
- `Reply-To` a un buzón real.
- `Message-ID` generado por el proveedor.
- Cabeceras `X-Mailer` y `X-Auto-Response-Suppress`.
- Sin imágenes externas obligatorias ni adjuntos pesados.
- Footer con empresa y dirección física (CAN-SPAM).

Recomendaciones adicionales:

- No uses mayúsculas sostenidas ni signos `!!!` en asuntos.
- Evita palabras típicas de spam: "gratis", "urgente", "100% garantizado", "haz clic aquí".
- Incluye siempre el nombre del destinatario cuando lo tengas.
- No envíes correos masivos desde el mismo dominio transaccional; usa un subdominio (`mail.tudominio.com`) o un proveedor separado.
- Calienta el dominio: primeros días pocos envíos, luego aumenta.
- Si haces campañas, añade `List-Unsubscribe`; los transaccionales (pedido/factura) no lo necesitan.

---

## 5. Prueba en local / producción

### 5.1 Script de prueba

```powershell
cd app\server
npm run email:test -- tu-correo@tudominio.com
```

Muestra proveedor, `From`, `Reply-To`, advertencias y envía un correo real. Revisa **Recibidos** y **Spam**.

### 5.2 Endpoint de administración

Con un token de administrador:

```http
GET  /api/admin/email/status        → proveedor(es), from, reply_to, warnings
GET  /api/admin/email/dns?refresh=1 → SPF, DKIM, DMARC y MX del dominio de MAIL_FROM
POST /api/admin/email/test          → envía a tu propio correo (cooldown 60 s)
```

`/email/dns` consulta el DNS real (cacheado 10 minutos) y devuelve qué falta para no caer en spam:

```json
{
  "domain": "tudominio.com",
  "spf":   { "found": true, "record": "v=spf1 include:_spf.google.com ~all", "multiple": false },
  "dkim":  { "found": true, "selector": "google" },
  "dmarc": { "found": true, "policy": "quarantine", "record": "v=DMARC1; p=quarantine; ..." },
  "mx":    { "found": true, "records": 5 },
  "warnings": []
}
```

`/email/test` no acepta destinatarios arbitrarios: solo el correo del administrador autenticado, para evitar que se use como relay.

### 5.3 Prueba de entregabilidad

1. Envía a una cuenta Gmail, una Outlook y una corporativa.
2. Revisa "Mostrar original" → `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.
3. Usa mail-tester.com: apunta a 10/10.
4. Si cae en spam, revisa en este orden: DKIM → SPF → DMARC → reputación del dominio → contenido.

---

## 6. Diagnóstico rápido

| Síntoma | Causa probable | Solución |
|---|---|---|
| `535 Authentication failed` | Contraseña normal en vez de "contraseña de aplicación" / SMTP AUTH deshabilitado | Genera App Password (Google) o habilita SMTP AUTH (M365) |
| `From` se reescribe o se rechaza | `MAIL_FROM` no es el usuario SMTP ni un alias autorizado | Usa el mismo buzón o configura el alias en el proveedor |
| Llega a spam en Gmail | DKIM/SPF/DMARC ausentes o mal alineados | Revisa DNS y alineación de dominios |
| `550 5.7.1` | IP/dominio sin reputación o PTR incorrecto | Usa el SMTP del proveedor, no un VPS directo |
| Correo omitido en logs | Sin proveedor configurado | Define `MAIL_PROVIDER` + credenciales |
| Funciona en local y no en Vercel | Variables no cargadas en Production | Configúralas en Vercel → Settings → Environment Variables y redeploy |
| Timeout en Vercel | Puerto SMTP bloqueado o proveedor lento | Usa Resend (HTTPS) o el SMTP de un proveedor con puerto 587 |

> **Vercel**: las funciones serverless pueden tardar en cerrar conexiones SMTP. Para volumen alto usa **Resend** (HTTP) o un backend persistente (Render/VPS). El código reintenta 3 veces con backoff y nunca bloquea la respuesta HTTP.

---

## 7. Checklist de activación

- [ ] Dominio corporativo comprado y DNS gestionado.
- [ ] Buzones `notificaciones@`, `soporte@`, `dmarc@` creados.
- [ ] SPF publicado (un solo registro).
- [ ] DKIM publicado y verificado en el proveedor.
- [ ] DMARC publicado (`p=none` → `quarantine` → `reject`).
- [ ] `MAIL_FROM` y `SMTP_USER` del mismo dominio.
- [ ] `MAIL_REPLY_TO=soporte@...` y `MAIL_BCC=auditoria@...`.
- [ ] Variables cargadas en Vercel/Render/Docker.
- [ ] `npm run email:test -- tu-correo@...` → llega a Recibidos.
- [ ] `GET /api/admin/email/status` sin warnings.
- [ ] Prueba real: crear pedido → el proveedor recibe correo; emitir factura → el cliente recibe correo.
- [ ] Revisar SPF/DKIM/DMARC en "Mostrar original".
- [ ] mail-tester.com ≥ 9/10.
