variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "alb_security_group_id" { type = string }
variable "app_security_group_id" { type = string }
variable "environment" { type = string }
variable "frontend_instance_type" { type = string }
variable "backend_instance_type" { type = string }
variable "tags" { type = map(string) }

