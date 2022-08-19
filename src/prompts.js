/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const promptDocs = {
  checkIntegrationTokens: "https://docs.magento.com/user-guide/system/integrations.html",
  checkCommerceIntegration: "https://docs.magento.com/user-guide/system/integrations.html",
  checkEventProvider: "https://developer.adobe.com/events/docs/guides/using/custom_events/",
  checkEventRegistration: "https://developer.adobe.com/events/docs/guides/using/custom_events/"
}

const briefOverviews = {
  templateInfo: `\nCommerce Events Extension Template Overview:\n
  * You will be guided through a questionnaire to help you set up your custom events with relevant documentation links.
  * Pre-check for a valid event provider will be performed in your Commerce instance.
  * You can install an optional plugin to enable App Builder Webhook Auto Subscriptions.
  * An App Builder project will be created with Node.js packages pre-configured.\n`,
  
  pluginExtensionInfo: `\nApp Builder Webhook Auto Subscriptions (aio-cli-plugin-extension) Overview:\n
  * The integration between [App builder project and I/O Events] allows to create applications that listen to Adobe events.
  * App Builder webhook auto subscriptions push this concept further by subscribing your newly deployed project to I/O Events
    automatically, so you can easily deploy your application in different environments or even share your application with 
    other organizations.
  * Also, this technology minimizes the manual routine work for admins and reduces the possibility to mess up things during 
    manual setup in the Developer Console.\n`
}

const skipPrechecksPrompt = {
  type: "confirm",
    name: "skipPrechecks",
    message: "Do you want to skip the questionnaire and create your project only?",
    default: false
}

const checkEventsConfigPrompt = [
  {
    type: "confirm",
    name: "hasIntegrationTokens",
    message: "Do you have your Commerce integration details?",
    default: false
  },
  {
    type: "input",
    name: "storeURL",
    message: "Enter Store URL:",
    store: true,
    validate: function(store_url) {
      const valid_url = /^(http|https):\/\/.*$/.test(store_url)

      if (valid_url) {
        return true
      }
      return "Invalid Web URL!"
    },
    when(answers) {
      return answers.hasIntegrationTokens;
    }
  },
  {
    type: "input",
    name: "accessToken",
    message: "Enter Access Token:",
    store: true,
    validate: function(access_token) {
      const valid_access_token = /^[a-zA-Z0-9]+$/.test(access_token)

      if (valid_access_token) {
        return true
      }
      return "Invalid Access Token!"
    },
    when(answers) {
      return answers.hasIntegrationTokens;
    }
  }
]

const retryPrompt = {
  type: "confirm",
  name: "retry",
  message: "Retry again?",
  default: false
}

module.exports = {
  briefOverviews,
  promptDocs,
  skipPrechecksPrompt,
  checkEventsConfigPrompt,
  retryPrompt
}