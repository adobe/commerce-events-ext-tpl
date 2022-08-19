const Generator = require('yeoman-generator')
const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const fetch = require('node-fetch')
const fs = require('fs')
// const inquirer = require('inquirer')
const Plugins = require('@oclif/plugin-plugins')
const { Config } = require('@oclif/core')

// const { constants, utils } = require('@adobe/generator-app-common-lib')
const { constants, utils } = require('@askayastha/generator-app-common-lib')
const eventsSdk = require('@adobe/aio-lib-events')
const coreConfig = require('@adobe/aio-lib-core-config')
const { getToken, context } = require('@adobe/aio-lib-ims')
const { getCliEnv } = require('@adobe/aio-lib-env')
const { CLI } = require('@adobe/aio-lib-ims/src/context')
const LibConsoleCLI = require('@adobe/aio-cli-lib-console')

const commerceGenerator = require('./generator-add-action-commerce')
const { briefOverviews, promptDocs, skipPrechecksPrompt, checkEventsConfigPrompt, retryPrompt } = require('./prompts')

const CHECK_EVENTS_CONFIG_ENDPOINT = "/rest/V1/adobe_io_events/check_configuration"
const CONSOLE_API_KEYS = {
  prod: 'aio-cli-console-auth',
  stage: 'aio-cli-console-auth-stage'
}

/*
'initializing',
'prompting',
'configuring',
'default',
'writing',
'conflicts',
'install',
'end'
*/

class MainGenerator extends Generator {
  constructor (args, opts) {
    super(args, opts)

    // options are inputs from CLI or yeoman parent generator
    // this.option('src-folder', { type: String, default: path.resolve(__dirname, './templates/default-action.js') })
    // this.option('src-folder', { type: String, default: './templates/default-action.js' })
    // this.option('dest-folder', { type: String, default: '.' })

    // props is used by the template later on
    this.props = {
      // srcFolder: this.options['src-folder'],
      // destFolder: this.options['dest-folder'],
      dirName: path.basename(process.cwd())
    }

    // Options are inputs from CLI or yeoman parent generator
    this.option('skip-prompt', { default: true })
  }

  initializing () {
    // All paths are relative to root
    this.appFolder = '.'
    this.actionFolder = path.join(this.appFolder, 'actions')
    this.configPath = path.join(this.appFolder, 'app.config.yaml')
    this.keyToManifest = 'application.' + constants.runtimeManifestKey
  }

  async prompting () {
    var retryAnswer
    var configStatus = false
    var providerIdConfig
    const spinner = ora()

    // Prompts to verify the Event Provider configuration
    this.log(briefOverviews['templateInfo'])
    
    var firstAnswer = await this.prompt(skipPrechecksPrompt)
    if (!firstAnswer.skipPrechecks) {
      do {
        do {
          var answers = await this.prompt(checkEventsConfigPrompt)
          if ('hasIntegrationTokens' in answers && !answers.hasIntegrationTokens) {
            this.log(chalk.blue(chalk.bold(`Please refer to:\n  -> ${promptDocs['checkIntegrationTokens']}`)) + '\n')
          }
        } while (!answers.hasIntegrationTokens);

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
            providerIdConfig = responseObj.provider_id_configured
            const providerIdValid = responseObj.provider_id_valid
      
            // Success Case: Commerce instance is configured correctly for Adobe I/O Events
            if (responseObj.status === 'ok') {
              configStatus = true
              spinner.succeed(`Verified configuration for Adobe I/O Event Provider\n`)
              break
            
            } else {
              // Failure Case #1: Event Provider ID is not configured correctly for Adobe I/O Events
              spinner.fail(`Verified configuration for Adobe I/O Event Provider\n`)
              if (!serviceAccountConfig) {
                spinner.warn(`Adobe I/O Service Account Private Key not valid`)
              } else if (!serviceAccountConnect) {
                spinner.warn(`Adobe I/O Workspace Configuration not valid`)
              } else if (providerIdConfig == "") {
                spinner.warn(`Adobe I/O Event Provider ID not found`)
              } else if (!providerIdValid) {
                spinner.warn(`Adobe I/O Event Provider ID '${providerIdConfig}' doesn't exist in your organization`)
              }
              this.log(chalk.blue(chalk.bold(`To fix the issue, refer to this URL and try again:\n  -> ${promptDocs['checkEventProvider']}`)) + '\n');
              retryAnswer = await this.prompt(retryPrompt)
            }
          } else {
            // Failure Case #2: Something is wrong with the Commerce Integration access token
            spinner.fail(`Verified configuration for Adobe I/O Event Provider\n`)
            const content = await response.json()
            const responseObj = JSON.parse(JSON.stringify(content))
      
            spinner.warn(responseObj.message)
            retryAnswer = await this.prompt(retryPrompt)
            answers.hasIntegrationTokens = false
            }
        } catch (error) {
          // Failure Case #3: Any other errors
          spinner.fail(`Verified configuration for Adobe I/O Event Provider\n`)
          spinner.warn(error.message)
          retryAnswer = await this.prompt(retryPrompt)
          answers.hasIntegrationTokens = false
        }
      } while (retryAnswer?.retry);
    }
    
    // Prompt to setup event codes in the app.config.yaml file
    // if (!(providerIdConfig == undefined || providerIdConfig == "" || !providerIdValid)) {
    if (configStatus) {
      const eventsClient = await this._getEventsClient()
      const eventCodes = await this._fetchEventCodesForProviderId(eventsClient, providerIdConfig)
      const choices = eventCodes.map(code => { return { name: code } })

      const checkBoxAnswer = await this.prompt({
        type: "checkbox",
        name: "eventCodes",
        message: "Select event codes of interest",
        choices: choices
      })

      this.props['eventCodes'] = checkBoxAnswer.eventCodes
      
      await this._installPluginExtension()
    }

    // Prompt to setup App Builder actions
    // this.props.actionName = await this._promptForActionName('showcases how to develop Commerce event extensions', 'generic')
    const listAnswer = await this.prompt({
      type: 'list',
      name: 'actionType',
      message: 'Which action do you want?',
      choices: ['Generic', 'Slack Demo'],
      filter(val) {
        return val.toLowerCase();
      },
    })

    if (listAnswer.actionType == 'generic') {
      this.props['actionName'] = await this._promptForActionName('showcases how to develop Commerce event extensions', 'generic')
    } else if (listAnswer.actionType == 'slack demo') {
      this.props['actionName'] = await this._promptForActionName('showcases how to send Slack notifications', 'slack')
    }
    this.props['actionType'] = listAnswer.actionType
  }

  writing () {
    utils.writeKeyAppConfig(this, 'application.actions', path.relative(this.appFolder, this.actionFolder))
  }

  install () {
    // Compose this template with a helper Commerce file generator
    this.composeWith({
      Generator: commerceGenerator,
      path: 'unknown'
    },
    {
      // Forward needed args
      'skip-prompt': true, // do not ask for action name
      'action-folder': this.actionFolder,
      'config-path': this.configPath,
      'full-key-to-manifest': this.keyToManifest,
      'action-name': this.props['actionName'],
      'event-codes': this.props['eventCodes'],
      'action-type': this.props['actionType']
    })
  }

  end () {
    const keyToEventCodes = this.keyToManifest + `.packages.${this.props.dirName}.actions.${this.props.actionName}.relations.event-listener-for`
    utils.writeKeyAppConfig(this, keyToEventCodes, this.props['eventCodes'])
  }

  /**
   * Prompts for installing aio-cli-plugin-extension if not already installed
   */
  async _installPluginExtension () {
    const spinner = ora()
    const oclifConfig = await Config.load(path.dirname(path.dirname(fs.realpathSync(process.argv[1]))))
    const pluginName = '@adobe/aio-cli-plugin-extension'
    const pluginsRegistry = new Plugins.default(oclifConfig)

    const plugins = await pluginsRegistry.list()
    const isInstalled = plugins.some(plugin => plugin.name == pluginName)

    // Nothing to do here, the plugin is already installed
    if (isInstalled) {
      spinner.info(`${pluginName} is already installed and lets you subscribe to specified events automatically during the deploy phase. Skipping related prompt.`)
    } else {
      this.log(briefOverviews['pluginExtensionInfo'])
      const answer = await this.prompt({
        type: "confirm",
        name: "installExtension",
        message: `Do you want to subscribe to specified events automatically during the deploy phase? This will install ${pluginName}.`,
        default: false
      })

      if (answer['installExtension']) {
        // process.stdout.write('Installing plugin @adobe/aio-cli-plugin-extension...')
        spinner.start(`Installing plugin ${pluginName}...`)
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
          await pluginsRegistry.install(pluginName)
          pluginsRegistry.yarn.fork = originalYarnFork
          // process.stdout.write("Done\n")
          spinner.succeed(`Installed plugin ${pluginName}...`)
          spinner.info(`Please uninstall ${pluginName} to remove Webhook Auto Subscription capability.`)
        
        } catch (error) {
          pluginsRegistry.yarn.fork = originalYarnFork
          this.log('Error: ' + error)
          // process.stdout.write(error + "\n")
          spinner.stop()
        }
      }
    }
  }

  /**
   * Prompt for action name
   *
   * @param {string} actionPurpose - brief description of the action
   * @param {string} defaultValue - default action name
   */
  async _promptForActionName (actionPurpose, defaultValue) {
    let actionName = defaultValue
    if (true) {
      const promptProps = await this.prompt([
        {
          type: 'input',
          name: 'actionName',
          message: `We are about to create a new sample action that ${actionPurpose}.\nHow would you like to name this action?`,
          default: actionName,
          // when: !this.options['skip-prompt'],
          validate (input) {
          // must be a valid openwhisk action name, this is a simplified set see:
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
        }
      ])
      actionName = promptProps.actionName
    }
  
    return actionName
  }
  
  /**
   * Configures an event api client from sdk
   *
   * @returns {*} - event api client from sdk
   */
  async _getEventsClient () {
    // load console configuration from .aio and .env files
    const projectConfig = coreConfig.get('project')
    if (!projectConfig) {
      throw new Error('Incomplete .aio configuration, please import a valid Adobe Developer Console configuration via `aio app use` first.')
    }
  
    const orgId = projectConfig.org.id
    const orgCode = projectConfig.org.ims_org_id
    const workspace = { name: projectConfig.workspace.name, id: projectConfig.workspace.id }
  
    const env = getCliEnv()
    await context.setCli({ 'cli.bare-output': true }, false) // set this globally
    const accessToken = await getToken(CLI)
    const cliObject = await context.getCli()
    const apiKey = CONSOLE_API_KEYS[env]
    const consoleCLI = await LibConsoleCLI.init({ accessToken: cliObject.access_token.token, env, apiKey: apiKey })
    const workspaceCreds = await consoleCLI.getFirstEntpCredentials(orgId, projectConfig.id, workspace)
    const client = await eventsSdk.init(orgCode, workspaceCreds.client_id, accessToken)
  
    return client
  }
  
  /**
   * Fetches event codes for an Event Provider ID
   *
   * @param {*} client - event api client from sdk
   * @param {string} providerId - id of Event Provider
   */
  async _fetchEventCodesForProviderId (client, providerId) {
    const spinner = ora()
    spinner.start('Fetching event codes...')
    try {
      const providerInfo = await client.getAllEventMetadataForProvider(providerId)
      const eventCodes = providerInfo._embedded.eventmetadata.map(e => e.event_code)
      spinner.stop()
  
      return eventCodes
    
    } catch (error) {
      this.log('\n' + error.message)
      
      if (error.code == 'ERROR_GET_ALL_EVENTMETADATA') {
        spinner.warn(`Adobe I/O Event Provider ID '${providerId}' doesn't exist in your organization`)
      }
      this.log(chalk.blue(chalk.bold(`To fix the issue, refer to this URL and try again:\n  -> ${promptDocs['checkEventProvider']}`)) + '\n');
      process.exit(1)
    }
  }
}

module.exports = MainGenerator