const Generator = require('yeoman-generator')
const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const fetch = require('node-fetch')
const fs = require('fs')
const inquirer = require('inquirer')
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

const commerceFileGenerator = require('./CommerceEventsFileGenerator')
const { templateInfo, pluginExtensionInfo, promptDocs } = require('./templates/prompts')

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

class CommerceEventsGenerator extends Generator {
  constructor (args, opts) {
    super(args, opts)

    // options are inputs from CLI or yeoman parent generator
    // this.option('src-folder', { type: String, default: path.resolve(__dirname, './templates/default-action.js') })
    this.option('src-folder', { type: String, default: './templates/default-action.js' })
    this.option('dest-folder', { type: String, default: '.' })

    // props are used by templates
    this.props = {
      srcFolder: this.options['src-folder'],
      destFolder: this.options['dest-folder'],
      dirName: path.basename(process.cwd())
    }

    // options are inputs from CLI or yeoman parent generator
    this.option('skip-prompt', { default: true })
  }

  initializing () {
    // all paths are relative to root
    this.appFolder = '.'
    this.actionFolder = path.join(this.appFolder, 'actions')
    this.configPath = path.join(this.appFolder, 'app.config.yaml')
    this.keyToManifest = 'application.' + constants.runtimeManifestKey

    this.log(templateInfo)
  }

  async prompting() {

    const skipPrechecksQuestion = {
      type: "confirm",
        name: "skipPrechecks",
        message: "Do you want to skip the questionnaire and create your project only?",
        default: false
    }

    const questions = [
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
    ];

    // Check for event provider in the Magento instance
    var skipAnswer = await this.prompt(skipPrechecksQuestion);
    var providerIdConfig;
    const spinner = ora()

    if (!skipAnswer.skipPrechecks) {
      do {
        do {
          var answers = await this.prompt(questions);
          if ('hasIntegrationTokens' in answers && !answers.hasIntegrationTokens) {
            this.log(chalk.blue(chalk.bold(`Please refer to:\n  -> ${promptDocs['checkIntegrationTokens']}`)) + '\n');
          }

        } while (!answers.hasIntegrationTokens);

        const CHECK_EVENTS_CONFIG_API = path.join(answers.storeURL, CHECK_EVENTS_CONFIG_ENDPOINT)
        const headers = {
          'Authorization': `Bearer ${answers.accessToken}`,
          'Content-Type': 'application/json'
        }

        // this.log("URL: " + configCheckURL)
        // const spinner = ora()
        try {
          spinner.start("Checking event provider configuration...")
          const response = await fetch(CHECK_EVENTS_CONFIG_API, {
            method: 'get',
            headers: headers
          })
          if (response.ok) {
            const content = await response.json()
            const jsonObj = JSON.parse(JSON.stringify(content))
            providerIdConfig = jsonObj.provider_id_configured
      
            if (jsonObj.status === 'ok') {
              spinner.succeed(`Verified Configuration for Event Provider\n`)
              // providerIdConfig = jsonObj.provider_id_configured
              // this.log(providerIdConfig)
              break
            } else {
              spinner.fail(`Verified Configuration for Event Provider`)
              if (providerIdConfig == "") {
                spinner.info("Adobe I/O Event Provider ID Not Found")
              }
              this.log(chalk.blue(chalk.bold(`To fix the issue, refer to this URL and try again:\n  -> ${promptDocs['checkEventProvider']}`)) + '\n');
      
              var answer = await this.prompt([
                {
                  type: "confirm",
                  name: "retry",
                  message: "Retry again?",
                  default: false
                }
              ])
            }
          } else {
            spinner.fail(`Verified Configuration for Event Provider`)
            const content = await response.json()
            const jsonObj = JSON.parse(JSON.stringify(content))
      
            this.log('\n' + jsonObj.message)
            // this.log(error.message)
            var answer = await this.prompt({
              type: "confirm",
              name: "retry",
              message: "Retry again?",
              default: true
            })
            answers.hasIntegrationTokens = false
            }
        } catch (error) {
          spinner.fail(`Verified Configuration for Event Provider`)
          this.log(error.message)
          var answer = await this.prompt({
            type: "confirm",
            name: "retry",
            message: "Retry again?",
            default: true
          })
          answers.hasIntegrationTokens = false
        }
      } while (answer?.retry);
    }
    
    if (!(providerIdConfig == undefined || providerIdConfig == "")) {
      const eventsClient = await getEventsClient()
      const eventCodes = await findEventCodesForProviderId(eventsClient, providerIdConfig)
      
      const choices = eventCodes.map(code => { return { name: code } })
      // this.log(choices)

      const eventCodesPrompt = await this.prompt({
        type: "checkbox",
        name: "eventCodes",
        message: "Select event codes of interest",
        choices: choices
      })

      this.props['eventCodes'] = eventCodesPrompt.eventCodes

      // this.log(pluginExtensionInfo)
      
      /**
       * Plugin installation
       */
      const oclifConfig = await Config.load(path.dirname(path.dirname(fs.realpathSync(process.argv[1]))))
      const pluginName = '@adobe/aio-cli-plugin-extension';
      const pluginsRegistry = new Plugins.default(oclifConfig);

      const plugins = await pluginsRegistry.list();
      const isInstalled = plugins.some(plugin => plugin.name == pluginName)

      // Nothing to do here, the plugin is already installed
      if (isInstalled) {
        spinner.info('aio-cli-plugin-extension is already installed. Skipping related dialog.')
      } else {
        
        this.log(pluginExtensionInfo)
        const answer = await this.prompt({
          type: "confirm",
          name: "installExtension",
          message: "Do you want to subscribe to specified events automatically during deploy phase? This will install aio-cli-plugin-extension.",
          default: false
        })

        if (answer['installExtension']) {
          process.stdout.write('Installing plugin @adobe/aio-cli-plugin-extension...');
          const originalYarnFork = pluginsRegistry.yarn.fork

          try {
            const silentFork = function (modulePath, args = [], options = {}) {
              options.stdio = 'ignore'
              return new Promise((resolve, reject) => {
                const { fork } = require('child_process');
                const forked = fork(modulePath, args, options);
                forked.on('exit', (code) => {
                    if (code === 0) {
                      resolve();
                    }
                    else {
                      reject(new Error(`yarn ${args.join(' ')} exited with code ${code}`));
                    }
                });
              });
            }

            pluginsRegistry.yarn.fork = silentFork
            await pluginsRegistry.install(pluginName)
            pluginsRegistry.yarn.fork = originalYarnFork
            process.stdout.write("Done\n")
          } catch (error) {
            pluginsRegistry.yarn.fork = originalYarnFork
            this.log('Error: ' + error)
            process.stdout.write(error + "\n")
          }
        }
      }
    }

    this.props.actionName = await promptForActionName('showcases how to develop Commerce event extensions', 'generic')
  }

  writing() {
    utils.writeKeyAppConfig(this, 'application.actions', path.relative(this.appFolder, this.actionFolder))
  }

  install() {
    // generate the generic action
    this.composeWith({
      Generator: commerceFileGenerator,
      path: 'unknown'
    },
    {
      // forward needed args
      'skip-prompt': true, // do not ask for action name
      'action-folder': this.actionFolder,
      'config-path': this.configPath,
      'full-key-to-manifest': this.keyToManifest,
      'action-name': this.props.actionName,
      'src-folder': this.props.srcFolder
    })
  }

  end() {
    const keyToEventCodes = this.keyToManifest + `.packages.${this.props.dirName}.actions.${this.props.actionName}.relations.event-listener-for`
    // this.log(keyToEventCodes)
    utils.writeKeyAppConfig(this, keyToEventCodes, this.props['eventCodes'])
  }

}

async function promptForActionName (actionPurpose, defaultValue) {

  let actionName = defaultValue
  if (true) {
    const promptProps = await inquirer.prompt([
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

async function getEventsClient() {
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

async function findEventCodesForProviderId (client, providerId) {
  const spinner = ora()
  spinner.start('Fetching event codes...')
  const providerInfo = await client.getAllEventMetadataForProvider(providerId)

  const eventCodes = providerInfo._embedded.eventmetadata.map(e => e.event_code)
  // const eventCodes = providerInfo._embedded.eventmetadata
  spinner.stop()
  
  // this.log('Event provider id doesn\'t exist in your organization ' + orgId)
  return eventCodes
}

module.exports = CommerceEventsGenerator