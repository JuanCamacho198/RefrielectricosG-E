resource "aws_lb" "app" {
  name               = "refrielectricos-alb"
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids
  tags               = merge(var.tags, { Purpose = "load-balancer", Owner = "juan.camacho", Backup = "false" })
}

resource "aws_lb_target_group" "frontend" {
  name     = "refri-fe-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  health_check { path = "/" }
  tags = merge(var.tags, { Purpose = "frontend", Owner = "juan.camacho", Backup = "false" })
}

resource "aws_lb_target_group" "backend" {
  name     = "refri-be-tg"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  health_check { path = "/health" }
  tags = merge(var.tags, { Purpose = "backend", Owner = "jarlinson.montoya", Backup = "false" })
}

resource "aws_launch_template" "frontend" {
  name_prefix   = "refri-frontend-"
  image_id      = "ami-1234567890abcdef0"
  instance_type = var.frontend_instance_type
  vpc_security_group_ids = [var.app_security_group_id]
  tag_specifications {
    resource_type = "instance"
    tags = merge(var.tags, { Purpose = "frontend", Owner = "juan.camacho", Backup = "false" })
  }
}

resource "aws_launch_template" "backend" {
  name_prefix   = "refri-backend-"
  image_id      = "ami-1234567890abcdef0"
  instance_type = var.backend_instance_type
  vpc_security_group_ids = [var.app_security_group_id]
  tag_specifications {
    resource_type = "instance"
    tags = merge(var.tags, { Purpose = "backend", Owner = "jarlinson.montoya", Backup = "false" })
  }
}

resource "aws_autoscaling_group" "frontend" {
  name                = "refri-frontend-asg"
  min_size            = 2
  max_size            = var.environment == "growth" ? 25 : 10
  desired_capacity    = 2
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [aws_lb_target_group.frontend.arn]
  launch_template {
    id      = aws_launch_template.frontend.id
    version = "$Latest"
  }
  tag {
    key                 = "Project"
    value               = var.tags["Project"]
    propagate_at_launch = true
  }
}

resource "aws_autoscaling_group" "backend" {
  name                = "refri-backend-asg"
  min_size            = 2
  max_size            = var.environment == "growth" ? 10 : 6
  desired_capacity    = 2
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [aws_lb_target_group.backend.arn]
  launch_template {
    id      = aws_launch_template.backend.id
    version = "$Latest"
  }
  tag {
    key                 = "Project"
    value               = var.tags["Project"]
    propagate_at_launch = true
  }
}

