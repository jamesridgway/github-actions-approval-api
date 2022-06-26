# GitHub Actions Approval API
This is the API used by [github-actions-approval-request](https://github.com/jamesridgway/github-actions-approval-request).

The API is responsible for triggering webhooks in API teams and receiving requests from Teams message cards to deploy a specific build.

## Repository Structure

`./app` contains all the API code. The API is designed to run as an Azure Function.

`./infra-azure` uses [Pulumi](https://www.pulumi.com/) to deploy the API

## How does this work?

For a detailed explanation of how this works checkout this blog post:

* Approving Builds and Workflows with GitHub Actions and Microsoft Teams

## Required configuration
In `./infra-azure` create a `.env` file based on the `.env.example`. Provide the details for a [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) that has permission to trigger workflows.

| Environment Variable        | Description                   |
| --------------------------- | ----------------------------- |
| `AUTH_GITHUB_USERNAME`      | GitHub Username               |
| `AUTH_GITHUB_TOKEN`         | GitHub Personal Access Token  |
| `AZURE_TENANT_ID`           | Azure Tenant ID               |
| `AZURE_SUBSCRIPTION_ID`     | Azure Subscription ID         |
| `ACTIONS_APPROVAL_API_KEY`  | API Key for the API to accept |
