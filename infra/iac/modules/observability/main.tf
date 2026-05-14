resource "aws_cloudwatch_metric_alarm" "alb_high_latency" {
  alarm_name          = "refrielectricos-alb-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0.3
  alarm_description   = "Latencia ALB > 300ms"
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }
  tags = merge(var.tags, { Purpose = "backend", Owner = "jarlinson.montoya", Backup = "false" })
}

