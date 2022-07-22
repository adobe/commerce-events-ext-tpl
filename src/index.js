const Generator = require('yeoman-generator')
const path = require('path')
const chalk = require('chalk')

const { constants, utils } = require('@adobe/generator-app-common-lib')
const genericAction = require('@adobe/generator-add-action-generic')
const { templateInfo, promptQuestions, promptDocs } = require('./templates/prompts')

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
      Generator: genericAction,
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

    const precheckAnswer = await this.prompt([
      {
        type: "confirm",
        name: "response",
        message: "Do you want to skip all the pre-checks and only create your project?",
        default: false
      }
    ]);

    // Perform pre-checks if you don't want to skip it
    if (!precheckAnswer.response) {
      for(let [promptId, promptQuestion] of Object.entries(promptQuestions)) {
        do {
          var answer = await this.prompt([
            {
              type: "confirm",
              name: "response",
              message: promptQuestion,
              default: false
            }
          ]);
  
          if (!answer.response) {
            // this.log("Please refer to " + promptDocs[promptId]);
            this.log(chalk.blue(chalk.bold(`Please refer to:\n  -> ${promptDocs[promptId]}`)))
          }
        } while (!answer.response);
      }
    }
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
