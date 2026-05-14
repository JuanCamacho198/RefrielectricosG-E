provider "aws" {
  region = var.aws_region

  # Los siguientes flags permiten que terraform plan funcione sin credenciales
  # reales, validando solo la sintaxis y las referencias entre recursos.
  # En producción estos flags deben eliminarse.
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
}

locals {
  required_tag_keys = toset(["Project", "Owner", "Environment", "Purpose", "CostCenter", "Backup"])

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    CostCenter  = var.cost_center
  }
}

check "required_global_tags_present" {
  assert {
    condition = alltrue([
      contains(keys(local.common_tags), "Project"),
      contains(keys(local.common_tags), "Environment"),
      contains(keys(local.common_tags), "CostCenter")
    ])
    error_message = "Faltan tags globales obligatorios."
  }
}

module "network" {
  source = "./modules/network"

  vpc_cidr         = var.vpc_cidr
  public_subnets   = var.public_subnets
  private_subnets  = var.private_subnets
  allowed_payments = var.allowed_payment_cidrs
  tags             = local.common_tags
}

module "compute" {
  source = "./modules/compute"

  vpc_id                 = module.network.vpc_id
  public_subnet_ids      = module.network.public_subnet_ids
  private_subnet_ids     = module.network.private_subnet_ids
  alb_security_group_id  = module.network.alb_security_group_id
  app_security_group_id  = module.network.app_security_group_id
  environment            = var.environment
  frontend_instance_type = var.frontend_instance_type
  backend_instance_type  = var.backend_instance_type
  tags                   = local.common_tags
}

module "data" {
  source = "./modules/data"

  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.private_subnet_ids
  db_security_group_id  = module.network.db_security_group_id
  db_instance_class     = var.db_instance_class
  db_allocated_storage  = var.db_allocated_storage
  db_name               = var.db_name
  db_username           = var.db_username
  db_password           = var.db_password
  assets_bucket_name    = var.assets_bucket_name
  tags                  = local.common_tags
}

module "observability" {
  source = "./modules/observability"

  alb_arn_suffix = module.compute.alb_arn_suffix
  tags           = local.common_tags
}

module "finops" {
  source = "./modules/finops"

  budget_limit_usd = var.budget_limit_usd
  alert_emails     = var.alert_emails
  tags             = local.common_tags
}

