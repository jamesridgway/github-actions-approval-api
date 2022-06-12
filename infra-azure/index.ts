import * as pulumi from "@pulumi/pulumi";

import * as resources from "@pulumi/azure-native/resources";
import * as storage from "@pulumi/azure-native/storage";
import * as web from "@pulumi/azure-native/web";
import * as keyvault from "@pulumi/azure-native/keyvault";
import * as authorization from "@pulumi/azure-native/authorization";
import * as dotenv from 'dotenv';

import { getConnectionString, signedBlobReadUrl } from "./helpers";

dotenv.config();

// Create a separate resource group for this example.
const resourceGroup = new resources.ResourceGroup("gh-approval-api");

// Storage account is required by Function App.
// Also, we will upload the function code to the same storage account.
const storageAccount = new storage.StorageAccount("ghapproval", {
    resourceGroupName: resourceGroup.name,
    sku: {
        name: storage.SkuName.Standard_LRS,
    },
    kind: storage.Kind.StorageV2,
});

const codeContainer = new storage.BlobContainer("ghapproval-code", {
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
});

const codeBlob = new storage.Blob("ghapproval-code", {
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
    containerName: codeContainer.name,
    source: new pulumi.asset.FileArchive("../app"),
});

const plan = new web.AppServicePlan("plan", {
    resourceGroupName: resourceGroup.name,
    sku: {
        name: "F1",
        tier: "Free",
    },
});

const table = new storage.Table("approvalsTable", {
    accountName: storageAccount.name,
    resourceGroupName: resourceGroup.name,
    tableName: "approvals",
});

const vault = new keyvault.Vault("vault", {
    properties: {
        enableRbacAuthorization: true,
        sku: {
            family: "A",
            name: keyvault.SkuName.Standard,
        },
        tenantId: process.env.AZURE_TENANT_ID!,
    },
    resourceGroupName: resourceGroup.name,
    vaultName: "ghapprovals"
});

const githubUsername = new keyvault.Secret("githubUsername", {
    properties: {
        value: process.env.AUTH_GITHUB_USERNAME,
    },
    resourceGroupName: resourceGroup.name,
    secretName: "github-username",
    vaultName: vault.name,
});
const githubToken = new keyvault.Secret("githubToken", {
    properties: {
        value: process.env.AUTH_GITHUB_TOKEN,
    },
    resourceGroupName: resourceGroup.name,
    secretName: "github-token",
    vaultName: vault.name,
});

const storageConnectionString = getConnectionString(resourceGroup.name, storageAccount.name);
const codeBlobUrl = signedBlobReadUrl(codeBlob, codeContainer, storageAccount, resourceGroup);

const app = new web.WebApp("ghapproval", {
    resourceGroupName: resourceGroup.name,
    serverFarmId: plan.id,
    kind: "functionapp",
    identity: {
        type: web.ManagedServiceIdentityType.SystemAssigned
    },
    siteConfig: {
        appSettings: [
            { name: "AzureWebJobsStorage", value: storageConnectionString },
            { name: "FUNCTIONS_EXTENSION_VERSION", value: "~4" },
            { name: "FUNCTIONS_WORKER_RUNTIME", value: "node" },
            { name: "WEBSITE_NODE_DEFAULT_VERSION", value: "~14" },
            { name: "WEBSITE_RUN_FROM_PACKAGE", value: codeBlobUrl },
            { name: "GHA_STORAGE_ACCOUNT", value: storageAccount.name },
            { name: "GHA_TABLE_NAME", value: table.name },
            { name: "AUTH_GITHUB_USERNAME", value: process.env.AUTH_GITHUB_USERNAME },
            { name: "AUTH_GITHUB_TOKEN", value: process.env.AUTH_GITHUB_TOKEN },
        ],
        http20Enabled: true,
        nodeVersion: "~14",
    },
});

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

storageAccount.id.apply(storageAccountId => {
    console.log(storageAccountId.substring(1));
    app.identity.apply(functionIdentity => {
        new authorization.RoleAssignment("ghapprovalStorageAccount", {
            principalId: functionIdentity!.principalId,
            principalType: authorization.PrincipalType.ServicePrincipal,
            roleAssignmentName: "4b4f34b6-d7b8-4552-9988-aa826c7a2d9c",
            roleDefinitionId: `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/ba92f5b4-2d11-453d-a403-e96b0029c9fe`,
            scope: storageAccountId.substring(1),
        })
        new authorization.RoleAssignment("ghapprovalStorageAccountQueue", {
            principalId: functionIdentity!.principalId,
            principalType: authorization.PrincipalType.ServicePrincipal,
            roleAssignmentName: "3b4055d1-4815-4dc9-a9d1-b528738ea4d7",
            roleDefinitionId: `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/974c5e8b-45b9-4653-ba55-5f855dd0fb88`,
            scope: storageAccountId.substring(1),
        })
    });
});


vault.id.apply(vaultId => {
    console.log(vaultId.substring(1));
    app.identity.apply(functionIdentity => {
        new authorization.RoleAssignment("ghapprovalVaultReader", {
            principalId: functionIdentity!.principalId,
            principalType: authorization.PrincipalType.ServicePrincipal,
            roleAssignmentName: "f23d6374-90f2-4488-97c0-cc5ccc8851da",
            roleDefinitionId: `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/21090545-7ca7-4776-b22c-e363652d74d2`,
            scope: vaultId.substring(1),
        })
    });
});

export const endpoint = pulumi.interpolate`https://${app.defaultHostName}`;