# 🔵 Azure OpenAI Setup for Simple Sales Agent

This guide shows you how to configure the simple-sales-agent to use Azure OpenAI instead of regular OpenAI.

## 📋 Prerequisites

1. **Azure OpenAI Resource**: You need an Azure OpenAI resource deployed in Azure
2. **Model Deployment**: You need to have deployed a model (like GPT-4) in your Azure OpenAI resource
3. **API Key & Endpoint**: You need your Azure OpenAI API key and endpoint URL

## 🔧 Configuration Options

### **Option 1: Custom Client (Recommended)**

Use the provided `azure-agent-example.ts` which creates a custom Azure OpenAI client.

#### Steps:
1. **Copy environment file:**
   ```bash
   cp env.azure.example .env
   ```

2. **Fill in your Azure OpenAI details in `.env`:**
   ```env
   AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
   AZURE_OPENAI_API_KEY=your-azure-openai-api-key
   AZURE_OPENAI_API_VERSION=2024-02-15-preview
   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
   ```

3. **Run the Azure example:**
   ```bash
   # Standard mode
   npx ts-node azure-agent-example.ts
   
   # With streaming events
   npx ts-node azure-agent-example.ts --stream
   ```

### **Option 2: Patch Base LLM Node**

Modify the framework to automatically detect and use Azure OpenAI when environment variables are present.

#### Steps:
1. **Update `src/nodes/base-llm-node.ts`:**
   
   Replace the `getDefaultInstructorClient` function with the code from `azure-base-llm-patch.ts`:

   ```typescript
   export function getDefaultInstructorClient() {
       const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
       const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
       const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
       const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

       if (azureEndpoint && azureApiKey && azureDeploymentName) {
           console.log('🔵 Using Azure OpenAI configuration');
           
           const azureOpenAI = new OpenAI({
               apiKey: azureApiKey,
               baseURL: `${azureEndpoint}/openai/deployments/${azureDeploymentName}`,
               defaultQuery: { 'api-version': azureApiVersion },
               defaultHeaders: {
                   'api-key': azureApiKey,
               },
           });

           return Instructor({
               client: azureOpenAI,
               mode: "TOOLS"
           });
       } else {
           // Fallback to standard OpenAI
           const oai = new OpenAI({
               apiKey: process.env.OPENAI_API_KEY || 'your-api-key'
           });

           return Instructor({
               client: oai,
               mode: "TOOLS"
           });
       }
   }
   ```

2. **Set environment variables and run normally:**
   ```bash
   npx ts-node agent-example.ts --stream
   ```

### **Option 3: Environment Variables Only**

If you're using the OpenAI SDK v4.20.0+, you can use environment variables directly:

```env
# Set these instead of OPENAI_API_KEY
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
```

## 🔍 Key Differences

### **Azure OpenAI vs Regular OpenAI:**

| Aspect | Regular OpenAI | Azure OpenAI |
|--------|---------------|--------------|
| **Base URL** | `https://api.openai.com/v1` | `https://your-resource.openai.azure.com/openai/deployments/your-deployment` |
| **Authentication** | `Authorization: Bearer <api-key>` | `api-key: <azure-api-key>` |
| **Model Names** | `gpt-4o`, `gpt-3.5-turbo` | Your deployment name (e.g., `my-gpt4-deployment`) |
| **API Version** | Not required | Required (e.g., `2024-02-15-preview`) |

### **Configuration Parameters:**

- **`AZURE_OPENAI_ENDPOINT`**: Your Azure OpenAI resource endpoint
- **`AZURE_OPENAI_API_KEY`**: Your Azure OpenAI API key (not the same as OpenAI API key)
- **`AZURE_OPENAI_DEPLOYMENT_NAME`**: The name of your deployed model (not the base model name)
- **`AZURE_OPENAI_API_VERSION`**: The API version to use

## 🚀 Testing

Run with streaming to see real-time events:

```bash
npx ts-node azure-agent-example.ts --stream
```

You should see:
```
🔵 Using Azure OpenAI configuration
🤖 Starting Azure OpenAI Sales Agent...

Agent Info: {
  agentName: 'AzureSalesAgent',
  llmProvider: 'Azure OpenAI',
  endpoint: 'https://your-resource.openai.azure.com',
  deployment: 'gpt-4o'
}
```

## 🔧 Troubleshooting

### **Common Issues:**

1. **"Invalid API Key"**: Make sure you're using the Azure OpenAI API key, not the regular OpenAI key
2. **"Deployment not found"**: Check that your `AZURE_OPENAI_DEPLOYMENT_NAME` matches exactly
3. **"API version not supported"**: Try a different `AZURE_OPENAI_API_VERSION`

### **Debug Mode:**

Add debug logging to see what's happening:

```typescript
console.log('Azure Config:', {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    hasApiKey: !!process.env.AZURE_OPENAI_API_KEY
});
```

## 📚 Additional Resources

- [Azure OpenAI Service Documentation](https://docs.microsoft.com/en-us/azure/cognitive-services/openai/)
- [OpenAI Node.js SDK with Azure](https://github.com/openai/openai-node#azure-openai)
- [Instructor AI Documentation](https://instructor-ai.github.io/instructor-js/)

## 🎯 Benefits of Azure OpenAI

- **Enterprise Security**: Built on Azure's enterprise-grade security
- **Data Residency**: Keep your data in specific geographic regions
- **Private Networking**: Use Azure Virtual Networks for additional security
- **Compliance**: Meets various compliance standards (SOC 2, HIPAA, etc.)
- **Cost Management**: Better cost control and budgeting through Azure

