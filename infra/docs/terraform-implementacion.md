# Implementación IaC con Terraform — Refrielectricos

## Qué se hizo

Se implementó una **línea base de infraestructura como código (IaC)** usando Terraform en:

- `infra/iac/`

Con esta estructura:

- `main.tf`, `variables.tf`, `versions.tf`, `outputs.tf`
- `environments/initial/terraform.tfvars.example`
- `environments/growth/terraform.tfvars.example`
- `modules/network`
- `modules/compute`
- `modules/data`
- `modules/observability`
- `modules/finops`
- `README.md`

## Por qué se hizo así

Se hizo con enfoque **tag-first + modular** para cumplir lo definido en la documentacion, especialmente:

1. **Etiquetado obligatorio** para trazabilidad, accountability y FinOps.
2. **Separación por dominios** (red, cómputo, datos, observabilidad, presupuesto) para mantener una arquitectura limpia.
3. **Parámetros por ambiente** (`initial` y `growth`) para escalar sin duplicar infraestructura.

## Cómo se tradujo el documento a Terraform

### 1) Red y seguridad (`modules/network`)

- VPC y subredes públicas/privadas.
- Security Groups para:
  - ALB con ingreso 80/443 desde internet.
  - App con ingreso interno desde ALB.
  - DB con acceso solo desde App por 5432.
- Restricción de acceso directo a base de datos desde internet.

### 2) Cómputo y disponibilidad (`modules/compute`)

- Application Load Balancer (ALB).
- Target groups para frontend y backend.
- Launch templates para instancias.
- Auto Scaling Groups para frontend/backend con límites por ambiente.

### 3) Datos (`modules/data`)

- RDS PostgreSQL con **Multi-AZ** y backup retention.
- S3 para assets con cifrado server-side y bloqueo de acceso público.

### 4) Observabilidad (`modules/observability`)

- Alarma de CloudWatch para latencia ALB (>300ms).

### 5) FinOps (`modules/finops`)

- AWS Budgets con alertas en umbrales:
  - 80%
  - 100%
  - 120%

## Estrategia de etiquetas aplicada

Se estandarizó la política de tags en recursos con claves:

- `Project`
- `Owner`
- `Environment`
- `Purpose`
- `CostCenter`
- `Backup`

Además, se dejó un check base para validar consistencia de tags globales.

## Beneficios de esta implementación

- Base reproducible de infraestructura.
- Mejor gobernanza de costos y ownership.
- Menos riesgo de configuraciones manuales inconsistentes.
- Escalabilidad por ambiente sin rehacer arquitectura.

## Limitaciones actuales (antes de producción)

- AMIs placeholders en launch templates (deben reemplazarse por AMIs reales endurecidas).
- Se requiere ajuste fino de egress por dominios/IP reales de pasarela de pagos.
- Falta completar validaciones más estrictas de tags en **todos** los recursos al nivel más granular.
- Falta pipeline de CI para `terraform fmt/validate/plan` por ambiente.

## Siguiente paso recomendado

Endurecer la baseline para producción:

1. Reemplazar AMIs placeholder.
2. Cerrar reglas de red al mínimo real.
3. Agregar validaciones de compliance de tags por módulo.
4. Integrar validación/plan en CI.
5. Ejecutar plan por ambiente y revisión de costos proyectados.
