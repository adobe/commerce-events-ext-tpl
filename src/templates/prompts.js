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
    templateInfo: `\nCommerce Events Extension Template:

    * You will be guided through a questionnaire to make sure you have the prerequisites setup properly.
    * Automated pre-checks will be performed and their status will be reported.
    * An App Builder project will be created with Node.js packages pre-configured.\n`,
    promptQuestions: {
        commerceIntegrationTokens: "Do you have your Commerce integration tokens?",
        commerceIntegration: "Is the check for Commerce integration successful?",
        eventProvider: "Is the check for event provider successful?",
        eventRegistration: "Is the check for event registration sucessful?"
    },
    promptDocs: {
        commerceIntegrationTokens: "https://docs.magento.com/user-guide/system/integrations.html",
        commerceIntegration: "https://docs.magento.com/user-guide/system/integrations.html",
        eventProvider: "https://developer.adobe.com/events/docs/guides/using/custom_events/",
        eventRegistration: "https://developer.adobe.com/events/docs/guides/using/custom_events/"
    }
}