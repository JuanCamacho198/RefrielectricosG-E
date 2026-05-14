# Refrielectricos AWS IaC

Infraestructura base en AWS con enfoque **tag-first** y seguridad por mínimo privilegio.

## Estructura

- `environments/initial` y `environments/growth`: parámetros por fase.
- `modules/network`: VPC, subredes y security groups.
- `modules/compute`: ALB, target groups y Auto Scaling Groups.
- `modules/data`: RDS PostgreSQL Multi-AZ y S3.
- `modules/observability`: CloudWatch alarms.
- `modules/finops`: AWS Budgets.

## Tags obligatorios

Todos los recursos incluiyen:

- `Project`
- `Owner`
- `Environment`
- `Purpose`
- `CostCenter`
- `Backup`

