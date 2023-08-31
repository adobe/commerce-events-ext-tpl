const fs = require('fs-extra')
const ora = require('ora')
const inquirer = require('inquirer')
const slugify = require('slugify')
const chalk = require('chalk')
const path = require('path')

const Plugins = require('@oclif/plugin-plugins')
const { Config } = require('@oclif/core')

const eventsSdk = require('@adobe/aio-lib-events')
const coreConfig = require('@adobe/aio-lib-core-config')
const { getToken, context } = require('@adobe/aio-lib-ims')
const { getCliEnv } = require('@adobe/aio-lib-env')
const { CLI } = require('@adobe/aio-lib-ims/src/context')
const LibConsoleCLI = require('@adobe/aio-cli-lib-console')

const { promptDocs, pluginExtensionOverview } = require('./info')

const CONSOLE_API_KEYS = {
  prod: 'aio-cli-console-auth',
  stage: 'aio-cli-console-auth-stage'
}

const PLUGIN_EXTENSION = '@adobe/aio-cli-plugin-extension'
const providersList = []

/**
 * Reads manifest file
 *
 * @param {string} manifestPath - path to the manifest file
 * @returns {*} - manifest object
 */
function readManifest (manifestPath) {
  try {
    return JSON.parse(
      fs.readFileSync(manifestPath, { encoding: 'utf8' })
    )
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {}
    } else {
      throw err
    }
  }
}

/**
 * Writes manifest file with appropriate indentation
 *
 * @param {*} manifest - manifest object
 * @param {string} manifestPath - path to the manifest file
 */
function writeManifest (manifest, manifestPath) {
  fs.writeJsonSync(manifestPath, manifest, { spaces: 2 })
}

/**
 * Configures an event api client from sdk
 *
 * @returns {*} - event api client from sdk
 */
async function getEventsClient () {
  // Load console configuration from .aio and .env files
  const projectConfig = coreConfig.get('project')
  if (!projectConfig) {
    throw new Error('Incomplete .aio configuration, please import a valid Adobe Developer Console configuration via `aio app use` first.')
  }

  const orgId = projectConfig.org.id
  const orgCode = projectConfig.org.ims_org_id
  const workspace = { name: projectConfig.workspace.name, id: projectConfig.workspace.id }

  const env = getCliEnv()
  await context.setCli({ 'cli.bare-output': true }, false) // Set this globally
  const accessToken = await getToken(CLI)
  const cliObject = await context.getCli()
  const apiKey = CONSOLE_API_KEYS[env]
  const consoleCLI = await LibConsoleCLI.init({ accessToken: cliObject.access_token.token, env, apiKey: apiKey })
  const workspaceCreds = await consoleCLI.getFirstWorkspaceCredential(orgId, projectConfig.id, workspace)
  const client = await eventsSdk.init(orgCode, workspaceCreds.client_id, accessToken)
  return client
}

/**
 * Fetches specific events information for an event provider id
 *
 * @param {*} client - event api client from sdk
 * @param {string} providerId - id of event provider
 * @returns {*} - specific events information
 */
async function fetchEventsMetadataForProviderId (client, providerId) {
  const spinner = ora()
  spinner.start('Fetching event codes...')
  try {
    const providerInfo = await client.getAllEventMetadataForProvider(providerId)
    // const eventCodes = providerInfo._embedded.eventmetadata.map(e => e.event_code)
    const events = providerInfo._embedded.eventmetadata.map(e => ({
      'eventName': slugify(e.label, {
        replacement: '-',  // replace spaces with replacement character, defaults to `-`
        remove: undefined, // remove characters that match regex, defaults to `undefined`
        lower: true,       // convert to lower case, defaults to `false`
        strict: true,      // strip special characters except replacement, defaults to `false`
        locale: 'vi',      // language code of the locale to use
        trim: true         // trim leading and trailing replacement chars, defaults to `true`
      }),
      'eventCode': e.event_code,
      'eventLabel': e.label
    }))
    spinner.stop()

    return events
  
  } catch (error) {
    console.log('\n' + error.message)
    console.log(chalk.blue(chalk.bold(`To fix the issue, refer to this URL and try again:\n  -> ${promptDocs['commerceConfigurationDoc']}`)) + '\n');
    spinner.stop()
    return []
  }
}

/**
 * Finds providers for Commerce events
 *
 * @param {*} client - Adobe events sdk client
 * @param {string} orgId - Adobe org id
 * @returns {*} - event provider(s) details
 */
async function findProvidersForCommerceEvents (client, orgId) {
  // const commerceProviderMetadata = "3rd_party_custom_events"
  const commerceProviderMetadata = "dx_commerce_events"
  // const providersList = []
  if (providersList.length === 0) {
    const spinner = ora()
    spinner.start('Fetching Commerce event providers...')
    const response = await client.getAllProviders(orgId)
    const providers = response._embedded.providers

    for (const provider of providers.values()) {
      const newProvider = {
        id: provider.id,
        label: provider.label,
        instance_id: provider.instance_id,
        metadata: provider.provider_metadata
      }

      const providerInfo = await client.getAllEventMetadataForProvider(provider.id)
      newProvider.events = providerInfo._embedded.eventmetadata.map(e => e.event_code)
      
      /* Filter based on Commerce event code prefix
      for (const event of newProvider.events.values()) {
        if (event.includes(commerceEventCodePrefix)) {
          providersList.push(newProvider)
          break
        }
      } */

      if (newProvider.metadata === commerceProviderMetadata) {
        providersList.push(newProvider)
      }
    }
    spinner.stop()
  }

  return providersList
}

/**
 * Asks user for event provider
 *
 * @param {*} providers - list of event providers
 * @returns {*} - returns provider details based on user input
 */
 async function selectEventProvider (providers) {
  if (providers.length === 0) {
    throw new Error('Event providers list is empty. You need to specify at least one provider to select from.')
  }
  if (providers.length === 1) {
    aioLogger.debug('There is a single matching event provider found for event')
    return providers[0]
  }

  const choices = providers.map(e => { return { name: e.label, value: e.id, instance_id: e.instance_id } })
  inquirer.registerPrompt('search-list', require('inquirer-search-list'))
  
  const answer = await inquirer.prompt([
    {
      type: 'search-list',
      name: 'eventProvider',
      message: "Please select an event provider to fetch event codes of interest:",
      choices
    }
  ])

  return providers.find(e => e.id === answer.eventProvider)
}

/**
 * Adds selected events information to manifest object
 *
 * @param {*} eventsClient - event api client from sdk
 * @param {string} eventProviderId - event provider id of the event
 * @param {*} manifest - manifest object
 * @param {string} manifestNodeName - node name to write events information
 */
async function addEventstoManifest(eventsClient, eventProviderId, manifest, manifestNodeName) {
  const eventsMetadata = await fetchEventsMetadataForProviderId(eventsClient, eventProviderId)

  if (eventsMetadata.length === 0) { return }

  const choices = eventsMetadata.map(metadata => {
    return {
      name: metadata.eventCode + ' (' + metadata.eventLabel + ')',
      value: {
        eventName: metadata.eventName,
        eventCode: metadata.eventCode
      }
    }
  })

  const checkBoxAnswer = await inquirer.prompt({
    type: "checkbox",
    name: "events",
    message: "Select event codes of interest:",
    choices: choices
  })

  // Set default action name and event codes depending on the number of selections
  if (checkBoxAnswer.events.length === 1) {
    var actionName = checkBoxAnswer.events[0].eventName
    var eventCodes = [ checkBoxAnswer.events[0].eventCode ]
  } else if (checkBoxAnswer.events.length > 1) {
    var actionName = 'generic'
    var eventCodes = checkBoxAnswer.events.map(event => event.eventCode)
  } else {
    return
  }

  manifest[manifestNodeName] = manifest[manifestNodeName] || []
  manifest['seenActionNames'] = manifest['seenActionNames'] || new Set()
  manifest['lastNameIdxs'] = manifest['lastNameIdxs'] || {}

  // Makes sure that the suggested action name is unique
  const actionNames = manifest[manifestNodeName].map(node => node.name)
  if (actionNames.includes(actionName)) {
    var [ actionName, seenActionNamesTemp, lastNameIdxsTemp ] = getIndexedAction(actionName, manifest['seenActionNames'], manifest['lastNameIdxs'])
  }

  // Repeats prompting until a unique runtime action name is entered
  var newActionName = await inputActionNamePrompt(actionName, false)
  while (actionNames.includes(newActionName)) {
    newActionName = await inputActionNamePrompt(actionName, true)
  }

  // Keeps track of the seen action names and their last name indices
  if (newActionName === actionName) {
    manifest['seenActionNames'] = seenActionNamesTemp
    manifest['lastNameIdxs'] = lastNameIdxsTemp
  }

  // Writes the node with the final action name and event codes
  manifest[manifestNodeName].push({
    name: newActionName,
    eventProviderId: eventProviderId,
    eventCodes: eventCodes
  })
}

/**
 * Modifies action name by suffixing an index if the action name already exists
 *
 * @param {string} actionName - name for the runtime action
 * @param {string} seenActionNames - runtime action names already entered
 * @param {string} lastNameIdxs - dictionary to store the last added index to an existing action name
 * @returns {list} - modified action name, seen action names and their last name indices
 */
function getIndexedAction(actionName, seenActionNames, lastNameIdxs) {
  const seenActionNamesTemp = new Set(seenActionNames)
  const lastNameIdxsTemp = Object.assign({}, lastNameIdxs)
  
  seenActionNamesTemp.add(actionName)
  if (!(actionName in lastNameIdxsTemp)) {
    lastNameIdxsTemp[actionName] = 0
  }

  let k = lastNameIdxsTemp[actionName]
  let idxActionName = actionName
  while (seenActionNamesTemp.has(idxActionName)) {
    k += 1
    idxActionName = `${actionName}-${k}`
  }

  lastNameIdxsTemp[actionName] = k
  seenActionNamesTemp.add(idxActionName)

  return [ idxActionName, seenActionNamesTemp, lastNameIdxsTemp ]
}

/**
 * Modifies action name by suffixing an index if the action name already exists
 *
 * @param {string} actionName - default name for the runtime action
 * @param {boolean} isRetry - boolean to identify a retry prompt
 * @returns {string} - entered action name or the default one
 */
async function inputActionNamePrompt (actionName, isRetry) {
  let promptMessage = "What do you want to name the serverless runtime action for listening to selected event(s)?"

  if (isRetry) {
    promptMessage = `The name is already taken. ${promptMessage}`
  }

  const answer = await inquirer.prompt({
    type: 'input',
    name: 'actionName',
    message: promptMessage,
    default: actionName,
    validate (input) {
    // Must be a valid openwhisk action name, this is a simplified set see:
    // https://github.com/apache/openwhisk/blob/master/docs/reference.md#entity-names
      const valid = /^[a-zA-Z0-9][a-zA-Z0-9-]{2,31}$/
      if (valid.test(input)) {
        return true
      }
      return `'${input}' is not a valid action name, please make sure that:
              The name has at least 3 characters or less than 33 characters.
              The first character is an alphanumeric character.
              The subsequent characters are alphanumeric.
              The last character isn't a space.
              Note: characters can only be split by '-'.`
    }
  })

  return answer.actionName
}

/**
 * Checks if @adobe/aio-cli-plugin-extension is already installed
 */
async function isPluginExtensionInstalled () {
  const oclifConfig = await Config.load(path.dirname(path.dirname(fs.realpathSync(process.argv[1]))))
  const pluginsRegistry = new Plugins.default(oclifConfig)
  const plugins = await pluginsRegistry.list()
  const isInstalled = plugins.some(plugin => plugin.name === PLUGIN_EXTENSION)

  return isInstalled
}

/**
 * Prompts for installing @adobe/aio-cli-plugin-extension if not already installed
 */
async function installPluginExtension () {
  const spinner = ora()
  const oclifConfig = await Config.load(path.dirname(path.dirname(fs.realpathSync(process.argv[1]))))
  const pluginsRegistry = new Plugins.default(oclifConfig)

  let isInstalled = await isPluginExtensionInstalled()

  // Nothing to do here, the plugin is already installed
  if (isInstalled) {
    spinner.info(`${PLUGIN_EXTENSION} is already installed and lets you subscribe to specified events automatically during the deploy phase. Skipping related prompt.`)
  } else {
    console.log(pluginExtensionOverview)
    const answer = await inquirer.prompt({
      type: "confirm",
      name: "installExtension",
      message: `Do you want to subscribe to specified events automatically during the deploy phase? This will install ${PLUGIN_EXTENSION}.`,
      default: false
    })

    if (answer['installExtension']) {
      spinner.start(`Installing plugin ${PLUGIN_EXTENSION}...`)
      const originalYarnFork = pluginsRegistry.yarn.fork

      try {
        const silentFork = function (modulePath, args = [], options = {}) {
          options.stdio = 'ignore'
          return new Promise((resolve, reject) => {
            const { fork } = require('child_process')
            const forked = fork(modulePath, args, options)
            forked.on('exit', (code) => {
              if (code === 0) {
                resolve()
              }
              else {
                reject(new Error(`yarn ${args.join(' ')} exited with code ${code}`))
              }
            })
          })
        }

        pluginsRegistry.yarn.fork = silentFork
        await pluginsRegistry.install(PLUGIN_EXTENSION)
        pluginsRegistry.yarn.fork = originalYarnFork
        spinner.succeed(`Installed plugin ${PLUGIN_EXTENSION}.`)
        spinner.info(`Please uninstall ${PLUGIN_EXTENSION} to remove webhook auto subscriptions capability.\n`)
      
      } catch (error) {
        pluginsRegistry.yarn.fork = originalYarnFork
        console.log('Error: ' + error)
        spinner.stop()
      }
    }
  }
}

module.exports = {
  readManifest,
  writeManifest,
  getEventsClient,
  fetchEventsMetadataForProviderId,
  findProvidersForCommerceEvents,
  selectEventProvider,
  addEventstoManifest,
  isPluginExtensionInstalled,
  installPluginExtension
}
