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

    * You will be guided through a questionnaire to make sure you have set up the prerequisites properly.
    * Automated pre-checks related to events configuration will be performed and their status will be reported.
    * An App Builder project will be created with Node.js packages pre-configured.\n`,
    promptQuestions: {
        checkIntegrationTokens: "Do you have your Commerce integration tokens?",
        checkCommerceIntegration: "Is the check for Commerce integration successful?",
        checkEventProvider: "Is the check for event provider successful?",
        checkEventRegistration: "Is the check for event registration sucessful?"
    },
    promptDocs: {
        checkIntegrationTokens: "https://docs.magento.com/user-guide/system/integrations.html",
        checkCommerceIntegration: "https://docs.magento.com/user-guide/system/integrations.html",
        checkEventProvider: "https://developer.adobe.com/events/docs/guides/using/custom_events/",
        checkEventRegistration: "https://developer.adobe.com/events/docs/guides/using/custom_events/"
    }
}