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

module.exports = {
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
      manual setup in the Developer Console.\n`,
    promptDocs: {
        checkIntegrationTokens: "https://docs.magento.com/user-guide/system/integrations.html",
        checkCommerceIntegration: "https://docs.magento.com/user-guide/system/integrations.html",
        checkEventProvider: "https://developer.adobe.com/events/docs/guides/using/custom_events/",
        checkEventRegistration: "https://developer.adobe.com/events/docs/guides/using/custom_events/"
    }
}