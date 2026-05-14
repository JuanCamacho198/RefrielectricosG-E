resource "aws_db_subnet_group" "this" {
  name       = "refri-db-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = merge(var.tags, { Purpose = "database", Owner = "jarlinson.montoya", Backup = "true" })
}

resource "aws_db_instance" "postgres" {
  identifier             = "refrielectricos-postgres"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.db_security_group_id]
  multi_az               = true
  backup_retention_period = 7
  skip_final_snapshot    = true
  tags                   = merge(var.tags, { Purpose = "database", Owner = "jarlinson.montoya", Backup = "true" })
}

resource "aws_s3_bucket" "assets" {
  bucket = var.assets_bucket_name
  tags   = merge(var.tags, { Purpose = "storage", Owner = "yuli.montoya", Backup = "false" })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

