const defaultExtensionManifest = {
  "name": "Commerce Event-driven Test Extension",
  "id": "commerce-event-driven-test-extension",
  "description": "Test Extension for Commerce Event-driven Functionality",
  "version": "0.0.1",
  "runtimeActions": [
    {
      "name": "generic"
    }
  ]
}

const customExtensionManifest = {
  "name": "Commerce Event-driven Test Extension",
  "id": "commerce-event-driven-test-extension",
  "description": "Test Extension for Commerce Event-driven Functionality",
  "version": "0.0.1",
  "runtimeActions": [
    {
      "name": "order-created",
      "eventCodes": [ "com.adobe.commerce.order.created" ]
    },
    {
      "name": "order-delivered",
      "eventCodes": [ "com.adobe.commerce.order.delivered" ]
    }
  ],
  "templateInputs": {
    "LOG_LEVEL": "debug",
    "API_ENDPOINT": "$API_ENDPOINT"
  },
  "templateDotEnvVars": ["API_ENDPOINT", "PREFERRED_PROVIDERS"]
}

const demoExtensionManifest = {
  "name": "Slack Extension Demo",
  "id": "slack-extension-demo",
  "description": "Demo to showcase event-driven Commerce extension using Slack",
  "version": "1.0.0",
  "templateFolder": "slack-demo",
  "runtimeActions": [
    {
      "name": "product-created",
      "eventCodes": [ "com.adobe.commerce.product.created" ]
    },
    {
      "name": "product-updated",
      "eventCodes": [ "com.adobe.commerce.product.updated" ]
    }
  ],
  "templateInputs": {
    "LOG_LEVEL": "debug",
    "SLACK_WEBHOOK": "$SLACK_WEBHOOK",
    "SLACK_CHANNEL": "$SLACK_CHANNEL"
  },
  "templateDotEnvVars": ["SLACK_WEBHOOK", "SLACK_CHANNEL", "PREFERRED_PROVIDERS"]
}

module.exports = {
  defaultExtensionManifest,
  customExtensionManifest,
  demoExtensionManifest
}