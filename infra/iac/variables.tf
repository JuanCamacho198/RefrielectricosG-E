variable "aws_region" { type = string }
variable "project_name" { type = string }
variable "environment" { type = string }
variable "cost_center" { type = string }
variable "vpc_cidr" { type = string }
variable "public_subnets" { type = list(string) }
variable "private_subnets" { type = list(string) }
variable "allowed_payment_cidrs" { type = list(string) }
variable "frontend_instance_type" { type = string }
variable "backend_instance_type" { type = string }
variable "db_instance_class" { type = string }
variable "db_allocated_storage" { type = number }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "db_password" {
  type      = string
  sensitive = true
}
variable "assets_bucket_name" { type = string }
variable "budget_limit_usd" { type = number }
variable "alert_emails" { type = list(string) }

