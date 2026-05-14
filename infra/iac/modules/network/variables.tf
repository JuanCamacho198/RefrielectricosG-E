variable "vpc_cidr" { type = string }
variable "public_subnets" { type = list(string) }
variable "private_subnets" { type = list(string) }
variable "allowed_payments" { type = list(string) }
variable "tags" { type = map(string) }

