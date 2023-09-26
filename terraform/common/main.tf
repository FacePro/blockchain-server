
resource "aws_iam_role" "collect_tokens_lambda_role" {
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
  role          = aws_iam_role.collect_tokens_lambda_role.arn
  runtime       = "nodejs18.x"
  filename      = "collectTokens/lambda-packages/collectTokens.zip"

  source_code_hash = filebase64sha256("collectTokens/lambda-packages/collectTokens.zip")

}
