const Generator = require('yeoman-generator')
const path = require('path')
const chalk = require('chalk')
const ora = require('ora')
const fetch = require('node-fetch')

const { constants, utils } = require('@adobe/generator-app-common-lib')
// const genericAction = require('@adobe/generator-add-action-generic')
const commerceAction = require('./NewGenerator')
const { templateInfo, promptQuestions, promptDocs } = require('./templates/prompts')
// const inquirer = require('inquirer');

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
    this.option('dest-folder', { type: String, default: '.' })
    this.option('project-name', { type: String, default: 'project-name-not-set' })

    // props are used by templates
    this.props = {
      destFolder: this.options['dest-folder'],
      projectName: this.options['project-name']
    }

    // options are inputs from CLI or yeoman parent generator
    this.option('skip-prompt', { default: true })
  }

  async initializing () {
    // all paths are relative to root
    this.appFolder = '.'
    this.actionFolder = path.join(this.appFolder, 'actions')
    this.configPath = path.join(this.appFolder, 'app.config.yaml')
    this.keyToManifest = 'application.' + constants.runtimeManifestKey

    // generate the generic action
    this.composeWith({
      Generator: commerceAction,
      path: 'unknown'
    },
    {
      // forward needed args
      'skip-prompt': false, // do not ask for action name
      'action-folder': this.actionFolder,
      'config-path': this.configPath,
      'full-key-to-manifest': this.keyToManifest
    })
  }

  async prompting() {
    this.log(templateInfo);

    const skipPrechecksQuestion = {
      type: "confirm",
        name: "skipPrechecks",
        message: "Do you want to skip the pre-checks and only create your project?",
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
          // valid = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)
          const valid_url = /^(http|https):\/\/[a-zA-Z0-9@:%._\\+~#?&//=]*$/.test(store_url)

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
        when(answers) {
          return answers.hasIntegrationTokens;
        }
      }
    ];

    // var answers = {};
    // do {
    //   var answers = await this.prompt(questions);
    //   if ('hasIntegrationTokens' in answers && !answers.hasIntegrationTokens) {
    //     this.log(chalk.blue(chalk.bold(`Please refer to:\n  -> ${promptDocs['checkIntegrationTokens']}`)));
    //   }

    //   // this.log(answers)
    //   if (answers.skipPrechecks) {
    //     break;
    //   }
    // } while (!answers.hasIntegrationTokens);

    // Check for event provider in the Magento instance
    var skipAnswer = await this.prompt(skipPrechecksQuestion);

    if (!skipAnswer.skipPrechecks) {
      do {
        do {
          var answers = await this.prompt(questions);
          if ('hasIntegrationTokens' in answers && !answers.hasIntegrationTokens) {
            this.log(chalk.blue(chalk.bold(`Please refer to:\n  -> ${promptDocs['checkIntegrationTokens']}`)));
          }

        } while (!answers.hasIntegrationTokens);

        const configCheckApiEndpoint = "/rest/V1/adobe_io_events/check_configuration"
        const configCheckURL = answers.storeURL + configCheckApiEndpoint

        // if (!answers.skipPrechecks) {
        this.log(configCheckURL)
        const spinner = ora()
        const response = await fetch(configCheckURL, {
          method: 'get',
          headers: {
            'Authorization': 'Bearer ' + answers.accessToken,
            'Content-Type': 'application/json'
          }
        })
        if (response.ok) {
          const content = await response.json()
          const jsonObj = JSON.parse(JSON.stringify(content))
    
          if (jsonObj.status === 'ok') {
            spinner.succeed(`Verified Configuration for Event Provider`)
            break
          } else {
            spinner.fail(`Verified Configuration for Event Provider`)
            this.log(chalk.blue(chalk.bold(`To fix the issue, refer to this URL and try again:\n  -> ${promptDocs['checkEventProvider']}`)));
    
            var answer = await this.prompt([
              {
                type: "confirm",
                name: "checkEventProvider",
                message: "Retry again?",
                default: false
              }
            ])
          }
        } else {
          // throw new Error('Request to ' + configCheckURL + ' failed with status code: ' + response.status)
          this.log('Request to ' + configCheckURL + ' failed with status code: ' + response.status)
          var answer = await this.prompt({
            type: "confirm",
              name: "checkEventProvider",
              message: "Retry again?",
              default: false
          })
          answers.hasIntegrationTokens = false
        }
        
        // } 
      } while ('checkEventProvider' in answer && answer.checkEventProvider);
    }
    // spinner.fail(`Verified Configuration for Event Registration`)
    // this.log(chalk.blue(chalk.bold(`Please refer to:\n  -> ${promptDocs['checkEventRegistration']}`)));
  }

  async writing () {
    utils.writeKeyAppConfig(this, 'application.actions', path.relative(this.appFolder, this.actionFolder))

    const destFolder = this.props.destFolder
    this.sourceRoot(path.join(__dirname, './templates/'))

    // all files in the templates sub-folder will be copied to destFolder, except files with underscore
    if (true) {
      this.fs.copyTpl(
        this.templatePath('**/*'),
        this.destinationPath(destFolder),
        this.props,
        {},
        { globOptions: { ignore: ['**/_*.*'] } }
      )
    }
  }
}

module.exports = CommerceEventsGenerator
