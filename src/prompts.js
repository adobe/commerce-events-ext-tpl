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

const inquirer = require('inquirer')
const slugify = require('slugify')
const chalk = require('chalk')
const ora = require('ora')
const path = require('path')

const coreConfig = require('@adobe/aio-lib-core-config')

const { readManifest, getEventsClient, findProvidersForCommerceEvents, selectEventProvider, addEventstoManifest, isPluginExtensionInstalled, installPluginExtension } = require('./utils')

const CHECK_EVENTS_CONFIG_ENDPOINT = "/rest/V1/adobe_io_events/check_configuration"
const SLACK_DEMO_MANIFEST_PATH = path.join(__dirname, './templates/slack-demo/extension-manifest.json')

var exitMenu = false

const verifyEventsConfigPrompt = [
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
    }
  }
]

const retryPrompt = {
  type: "confirm",
  name: "retry",
  message: "Retry again?",
  default: false
}

const briefOverviews = {
  templateInfo: `\n${chalk.bold(chalk.blue("Commerce Events Extension Template Overview:"))}\n
  * You have the option to generate boilerplate code for listening and acting on Commerce events.
  * You can add the Commerce event listeners that you are interested in two ways:
    -> Connect to your Adobe Commerce instance and select available events.
    -> Choose one of the Commerce event providers available in your organization.\n
  * You can install an optional plugin extension to enable App Builder webhook auto subscriptions.
  * You can get help regarding documentation at any time from the menu.
  * You can check out a sample demo project.
  * An App Builder project will be created with Node.js packages pre-configured.\n`
}

const promptDocs = {
  mainDoc: "https://developer-stage.adobe.com/commerce/events/events/",
  commerceIntegrationDoc: "https://docs.magento.com/user-guide/system/integrations.html",
  commerceEventsSetupDoc: "https://developer-stage.adobe.com/commerce/events/events/project-setup/"
}

// Top Level prompts
const promptTopLevelFields = (manifest) => {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: "What do you want to name your extension?",
      validate(answer) {
        if (!answer.length) {
          return 'Required.'
        }

        return true
      }
    },
    {
      type: 'input',
      name: 'description',
      message: "Please provide a short description of your extension:",
      validate(answer) {
        if (!answer.length) {
          return 'Required.'
        }

        return true
      }
    },
    {
      type: 'input',
      name: 'version',
      message: "What version would you like to start with?",
      default: '0.0.1',
      validate(answer) {
        if (!new RegExp("^\\bv?(?:0|[1-9][0-9]*)(?:\\.(?:0|[1-9][0-9]*)){2}(?:-[\\da-z\\-]+(?:\\.[\\da-z\\-]+)*)?(?:\\+[\\da-z\\-]+(?:\\.[\\da-z\\-]+)*)?\\b$").test(answer)) {
          return 'Required. Must match semantic versioning rules.'
        }

        return true
      }
    }
  ])
  .then((answers) => {
    if (answers.name) {
      manifest.name = answers.name
      manifest.id = slugify(answers.name, {
        replacement: '-',  // replace spaces with replacement character, defaults to `-`
        remove: undefined, // remove characters that match regex, defaults to `undefined`
        lower: true,       // convert to lower case, defaults to `false`
        strict: true,      // strip special characters except replacement, defaults to `false`
        locale: 'vi',      // language code of the locale to use
        trim: true         // trim leading and trailing replacement chars, defaults to `true`
      })
    }

    if (answers.description) {
      manifest.description = answers.description
    }

    if (answers.version) {
      manifest.version = answers.version
    }
  })
}

// Main Menu prompts
const promptMainMenu = async (manifest) => {
  const choices = []

  choices.push(
    new inquirer.Separator(),
    {
      name: "Add event listener for the event provider configured in your Adobe Commerce store",
      value: addEventListenerForCommerceInstance.bind(this, manifest, 'runtimeActions'),
    },
    {
      name: "Add event listener for an existing Commerce event provider",
      value: addEventListenerForEventProvider.bind(this, manifest, 'runtimeActions'),
    }
  )

  if (!await isPluginExtensionInstalled()) {
    choices.push(
      {
        name: "Subscribe to events automatically during deployment",
        value: installPluginExtension.bind(this)
      }
    )
  }

  choices.push(
    new inquirer.Separator(),
      {
        name: "I'm done",
        value: () => {
          return Promise.resolve(true)
        }
      },
      {
        name: "I don't know",
        value: promptGuideMenu.bind(this, manifest)
      }
  )

  return inquirer
    .prompt({
      type: 'list',
      name: 'execute',
      message: "What would you like to do next?",
      choices,
    })
    .then((answers) => answers.execute())
    .then((endMainMenu) => {
      if (!endMainMenu && !exitMenu) {
        return promptMainMenu(manifest)
      }

      // Add a generic action in case the user doesn't add one
      if (!manifest.runtimeActions) {
        manifest['runtimeActions'] = manifest['runtimeActions'] || []
        manifest['runtimeActions'].push({
          'name': 'generic',
          'eventCodes': []
        })
      }

      // Remove temporary manifest nodes
      delete manifest.seenActionNames
      delete manifest.lastNameIdxs
    })
    .catch((error) => {
      console.log(error)
    })
}

// Prompts to verify the Event Provider configuration
const addEventListenerForCommerceInstance = async (manifest, manifestNodeName) => {
  var retryAnswer
  var isConfigured = false
  const spinner = ora()

  // Prompts to verify the Event Provider configuration
  do {
    console.log(chalk.blue(chalk.bold(`  Please refer to the link below for setting up your Commerce integration:\n    -> ${promptDocs['commerceIntegrationDoc']}`)) + '\n')
    
    var answers = await inquirer.prompt(verifyEventsConfigPrompt)
    const CHECK_EVENTS_CONFIG_API = path.join(answers.storeURL, CHECK_EVENTS_CONFIG_ENDPOINT)
    const headers = {
      'Authorization': `Bearer ${answers.accessToken}`,
      'Content-Type': 'application/json'
    }

    try {
      spinner.start("Checking Adobe I/O Event Provider configuration...")
      const response = await fetch(CHECK_EVENTS_CONFIG_API, {
        method: 'get',
        headers: headers
      })
      if (response.ok) {
        const content = await response.json()
        const responseObj = JSON.parse(JSON.stringify(content))
        const serviceAccountConfig = responseObj.technical_service_account_configured
        const serviceAccountConnect = responseObj.technical_service_account_can_connect_to_io_events
        var eventProviderId = responseObj.provider_id_configured
        const providerIdValid = responseObj.provider_id_valid
  
        // Success Case: Commerce instance is configured correctly for Adobe I/O Events
        if (responseObj.status === 'ok') {
          isConfigured = true
          spinner.succeed(`Verified configuration for Adobe I/O Event Provider\n`)
          break
        
        } else {
          // Failure Case #1: Event Provider ID is not configured correctly for Adobe I/O Events
          spinner.fail(`Verified configuration for Adobe I/O Event Provider\n`)
          if (!serviceAccountConfig) {
            spinner.warn(`Adobe I/O Service Account Private Key not valid`)
          } else if (!serviceAccountConnect) {
            spinner.warn(`Adobe I/O Workspace Configuration not valid`)
          } else if (eventProviderId === "") {
            spinner.warn(`Adobe I/O Event Provider ID not found`)
          } else if (!providerIdValid) {
            spinner.warn(`Adobe I/O Event Provider ID '${eventProviderId}' doesn't exist in your organization`)
          }
          console.log(chalk.blue(chalk.bold(`To fix the issue, refer to this URL and try again:\n  -> ${promptDocs['commerceEventsSetupDoc']}`)) + '\n');
          retryAnswer = await inquirer.prompt(retryPrompt)
        }
      } else {
        // Failure Case #2: Something is wrong with the Commerce Integration access token
        spinner.fail(`Verified configuration for Adobe I/O Event Provider\n`)
        const content = await response.json()
        const responseObj = JSON.parse(JSON.stringify(content))
  
        spinner.warn(responseObj.message)
        retryAnswer = await inquirer.prompt(retryPrompt)
        }
    } catch (error) {
      // Failure Case #3: Any other errors
      spinner.fail(`Verified configuration for Adobe I/O Event Provider\n`)
      spinner.warn(error.message)
      retryAnswer = await inquirer.prompt(retryPrompt)
    }
  } while (retryAnswer?.retry);
  
  // Prompt to setup event codes in the app.config.yaml file
  if (isConfigured) {
    const eventsClient = await getEventsClient()
    await addEventstoManifest(eventsClient, eventProviderId, manifest, manifestNodeName)

    // Prompt to install @adobe/aio-cli-plugin-extension if it's not already installed
    if (!await isPluginExtensionInstalled()) {
      await installPluginExtension()
    }
  }  
}

const addEventListenerForEventProvider = async (manifest, manifestNodeName) => {
  const eventsClient = await getEventsClient()
  const projectConfig = coreConfig.get('project')
  const providers = await findProvidersForCommerceEvents(eventsClient, projectConfig.org.id)
  const eventProvider = await selectEventProvider(providers)

  await addEventstoManifest(eventsClient, eventProvider.id, manifest, manifestNodeName)

  // Prompt to install @adobe/aio-cli-plugin-extension if it's not already installed
  if (!await isPluginExtensionInstalled()) {
    await installPluginExtension()
  }
}

// Guide Menu Prompts
const promptGuideMenu = (manifest) => {
  const choices = []

  choices.push(
    new inquirer.Separator(),
    {
      name: "Try a demo project",
      value: () => {
        const slackDemoManifest = readManifest(SLACK_DEMO_MANIFEST_PATH)

        // Update the extension manifest object
        manifest['name'] = slackDemoManifest['name'] || null
        manifest['id'] = slackDemoManifest['id'] || null
        manifest['description'] = slackDemoManifest['description'] || null
        manifest['version'] = slackDemoManifest['version'] || null
        manifest['templateFolder'] = slackDemoManifest['templateFolder'] || null
        manifest['eventProviderId'] = slackDemoManifest['eventProviderId'] || null
        manifest['runtimeActions'] = slackDemoManifest['runtimeActions'] || null
        manifest['templateInputs'] = slackDemoManifest['templateInputs'] || null
        manifest['templateDotEnvVars'] = slackDemoManifest['templateDotEnvVars'] || null
        exitMenu = true

        return Promise.resolve(true)
      }
    },
    {
      name: "Find some help",
      value: helpPrompts.bind(this)
    },
    new inquirer.Separator(),
    {
      name: "Go back",
      value: () => {
        return Promise.resolve(true)
      }
    }
  )

  return inquirer
    .prompt({
      type: 'list',
      name: 'execute',
      message: "What about this then?",
      choices,
    })
    .then((answers) => answers.execute())
    .then((endGuideMenu) => {
      if (!endGuideMenu) {
        return promptGuideMenu(manifest)
      }
    })
    .catch((error) => {
      console.log(error)
    })
}

// Helper prompts for Guide Menu
const helpPrompts = () => {
  console.log('  Please refer to:')
  console.log(chalk.blue(chalk.bold(`  -> ${promptDocs['mainDoc']}`)) + '\n')
}

const dummyPrompt = () => {
  console.log(chalk.blue(chalk.bold("  Please stay tuned for this feature!")+ '\n'))
}

module.exports = {
  briefOverviews,
  promptTopLevelFields,
  promptMainMenu,
  promptDocs
}