data "aws_availability_zones" "available" {}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(var.tags, { Name = "refrielectricos-vpc", Purpose = "network", Owner = "yuli.montoya", Backup = "false" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "refrielectricos-igw", Purpose = "network", Owner = "yuli.montoya", Backup = "false" })
}

resource "aws_subnet" "public" {
  for_each                = { for i, cidr in var.public_subnets : i => cidr }
  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value
  availability_zone       = data.aws_availability_zones.available.names[tonumber(each.key)]
  map_public_ip_on_launch = true
  tags                    = merge(var.tags, { Name = "public-${each.key}", Purpose = "load-balancer", Owner = "juan.camacho", Backup = "false" })
}

resource "aws_subnet" "private" {
  for_each          = { for i, cidr in var.private_subnets : i => cidr }
  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value
  availability_zone = data.aws_availability_zones.available.names[tonumber(each.key)]
  tags              = merge(var.tags, { Name = "private-${each.key}", Purpose = "backend", Owner = "jarlinson.montoya", Backup = "false" })
}

resource "aws_security_group" "alb" {
  name   = "refrielectricos-alb-sg"
  vpc_id = aws_vpc.this.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Purpose = "load-balancer", Owner = "juan.camacho", Backup = "false" })
}

resource "aws_security_group" "app" {
  name   = "refrielectricos-app-sg"
  vpc_id = aws_vpc.this.id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_payments
  }

  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.this.cidr_block]
  }

  tags = merge(var.tags, { Purpose = "backend", Owner = "jarlinson.montoya", Backup = "false" })
}

resource "aws_security_group" "db" {
  name   = "refrielectricos-db-sg"
  vpc_id = aws_vpc.this.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = merge(var.tags, { Purpose = "database", Owner = "jarlinson.montoya", Backup = "true" })
}

