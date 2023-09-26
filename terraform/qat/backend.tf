terraform {
  backend "remote" {
    hostname     = "app.terraform.io"
    organization = "Facepro"

    workspaces {
      name = "blockchain-server-api-driven-qat"
    }
  }
}
