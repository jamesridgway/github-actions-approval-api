import * as pulumi from "@pulumi/pulumi";

import * as resources from "@pulumi/azure-native/resources";
import * as storage from "@pulumi/azure-native/storage";
import * as web from "@pulumi/azure-native/web";

import { getConnectionString, signedBlobReadUrl } from "./helpers";

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

const codeContainer = new storage.BlobContainer("zips", {
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
});

const codeBlob = new storage.Blob("zip", {
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

// Build the connection string and zip archive's SAS URL. They will go to Function App's settings.
const storageConnectionString = getConnectionString(resourceGroup.name, storageAccount.name);
const codeBlobUrl = signedBlobReadUrl(codeBlob, codeContainer, storageAccount, resourceGroup);

const app = new web.WebApp("fa", {
    resourceGroupName: resourceGroup.name,
    serverFarmId: plan.id,
    kind: "functionapp",
    siteConfig: {
        appSettings: [
            { name: "AzureWebJobsStorage", value: storageConnectionString },
            { name: "FUNCTIONS_EXTENSION_VERSION", value: "~4" },
            { name: "FUNCTIONS_WORKER_RUNTIME", value: "node" },
            { name: "WEBSITE_NODE_DEFAULT_VERSION", value: "~14" },
            { name: "WEBSITE_RUN_FROM_PACKAGE", value: codeBlobUrl },
            { name: "GHA_STORAGE_ACCOUNT", value: storageAccount.name },
            { name: "GHA_TABLE_NAME", value: table.name },
        ],
        http20Enabled: true,
        nodeVersion: "~14",
    },
});

export const endpoint = pulumi.interpolate`https://${app.defaultHostName}`;