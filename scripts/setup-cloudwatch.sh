#!/bin/bash
# scripts/setup-cloudwatch.sh
# ─────────────────────────────────────────────────────────────────────────────
# Sets up AWS CloudWatch Agent on EC2 to collect:
#   - System metrics: CPU, RAM, Disk
#   - Application logs: PM2 out/error, Nginx, deploy logs
#
# PRE-REQUISITES:
#   - EC2 must have an IAM Role with CloudWatchAgentServerPolicy attached
#   - AWS Console → EC2 → Instance → Actions → Security → Modify IAM role
#   - Create role: jinanam-ec2-role with CloudWatchAgentServerPolicy

set -euo pipefail
step() { echo ""; echo "── $1"; }

step "1. Installing CloudWatch Agent"
sudo dnf install -y amazon-cloudwatch-agent --quiet 2>/dev/null || \
  (wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm && \
   sudo rpm -U ./amazon-cloudwatch-agent.rpm --quiet && rm -f amazon-cloudwatch-agent.rpm)

step "2. Writing CloudWatch Agent config"
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json > /dev/null <<'CW_CONFIG'
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "cwagent",
    "logfile": "/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log"
  },
  "metrics": {
    "append_dimensions": {
      "AutoScalingGroupName": "${aws:AutoScalingGroupName}",
      "InstanceId": "${aws:InstanceId}"
    },
    "metrics_collected": {
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_user", "cpu_usage_system"],
        "metrics_collection_interval": 60,
        "totalcpu": true
      },
      "disk": {
        "measurement": ["used_percent", "inodes_free"],
        "metrics_collection_interval": 60,
        "resources": ["/"]
      },
      "diskio": {
        "measurement": ["io_time", "read_bytes", "write_bytes"],
        "metrics_collection_interval": 60,
        "resources": ["*"]
      },
      "mem": {
        "measurement": ["mem_used_percent", "mem_available", "mem_total"],
        "metrics_collection_interval": 60
      },
      "netstat": {
        "measurement": ["tcp_established", "tcp_time_wait"],
        "metrics_collection_interval": 60
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/home/ec2-user/logs/jinanam-out.log",
            "log_group_name": "/jinanam/app/stdout",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%d %H:%M:%S",
            "timezone": "UTC"
          },
          {
            "file_path": "/home/ec2-user/logs/jinanam-error.log",
            "log_group_name": "/jinanam/app/stderr",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%d %H:%M:%S",
            "timezone": "UTC"
          },
          {
            "file_path": "/home/ec2-user/logs/deploy.log",
            "log_group_name": "/jinanam/deploy",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%d %H:%M:%S",
            "timezone": "UTC"
          },
          {
            "file_path": "/home/ec2-user/logs/jinanam-worker-error.log",
            "log_group_name": "/jinanam/worker/stderr",
            "log_stream_name": "{instance_id}",
            "timezone": "UTC"
          },
          {
            "file_path": "/var/log/nginx/access.log",
            "log_group_name": "/jinanam/nginx/access",
            "log_stream_name": "{instance_id}",
            "timezone": "UTC"
          },
          {
            "file_path": "/var/log/nginx/error.log",
            "log_group_name": "/jinanam/nginx/error",
            "log_stream_name": "{instance_id}",
            "timezone": "UTC"
          }
        ]
      }
    },
    "log_stream_name": "jinanam-{instance_id}",
    "force_flush_interval": 15
  }
}
CW_CONFIG

step "3. Starting CloudWatch Agent"
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

sudo systemctl enable amazon-cloudwatch-agent
sudo systemctl start amazon-cloudwatch-agent

step "4. Verifying agent status"
sudo systemctl status amazon-cloudwatch-agent --no-pager | head -5

echo ""
echo "✅ CloudWatch Agent configured!"
echo ""
echo "View logs at:"
echo "  AWS Console → CloudWatch → Log groups → /jinanam/*"
echo ""
echo "Set up Alarms:"
echo "  AWS Console → CloudWatch → Alarms → Create Alarm"
echo "    - CPU > 80% for 5 min → SNS notification"
echo "    - mem_used_percent > 85% → SNS notification"
echo "    - disk used_percent > 85% → SNS notification"
