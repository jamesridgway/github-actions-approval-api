# GitHub Actions Approval API
This is the API used by [github-actions-approval-request](https://github.com/jamesridgway/github-actions-approval-request).

The API is responsible for triggering webhooks in API teams and receiving requests from Teams message cards to deploy a specific build.

## Repository Structure

`./app` contains all the API code. The API is designed to run as an Azure Function.

`./infra-azure` uses [Pulumi](https://www.pulumi.com/) to deploy the API

## Required configuration
In `./infra-azure` create a `.env` file based on the `.env.example`. Provide the details for a [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) that has permission to trigger workflows.
