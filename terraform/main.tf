provider "aws" {
  region = "us-east-1" // Replace with your desired AWS region
}

resource "aws_iam_role" "lambda_role" {
  name = "collectTokens_lambda_role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
        Effect = "Allow",
      }
    ]
  })
}

resource "aws_lambda_function" "collectTokens" {
  function_name = "collectTokens"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs14.x"
  
  filename      = "path/to/your/collectTokens.zip" // Replace with the actual path to your Lambda package
}

