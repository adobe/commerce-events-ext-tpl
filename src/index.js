/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const Generator = require('yeoman-generator')
const path = require('path')
const chalk = require('chalk')

const CommerceEventsActionGenerator = require('./generator-add-action-commerce-events')

const { constants, utils } = require('@adobe/generator-app-common-lib')
const { promptTopLevelFields, promptMainMenu } = require('./prompts')
const { readManifest, writeManifest } = require('./utils')
const { templateOverview } = require('./info')

const EXTENSION_MANIFEST_PATH = path.join(process.cwd(), 'extension-manifest.json')

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

    // props is used by the template later on
    this.props = {
      dirName: path.basename(process.cwd())
    }
    
    // options are inputs from CLI or yeoman parent generator
    this.option('skip-prompt', { default: false })
    this.option('is-test', { default: false })
  }

  initializing () {
    // All paths are relative to root
    this.appFolder = '.'
    this.actionFolder = path.join(this.appFolder, 'actions')
    this.configPath = path.join(this.appFolder, 'app.config.yaml')
    this.keyToManifest = 'application.' + constants.runtimeManifestKey

    if (!this.options['is-test']) {
      this.extensionManifest = readManifest(EXTENSION_MANIFEST_PATH)
    } else {
      this.extensionManifest = this.options['extension-manifest']
    }
  }

  async prompting () {
    if (!this.options['is-test']) {
      this.log(templateOverview)
      await promptTopLevelFields(this.extensionManifest)
        .then(() => promptMainMenu(this.extensionManifest))
        .then(() => writeManifest(this.extensionManifest, EXTENSION_MANIFEST_PATH))
        .then(() => {
          this.log("\nExtension Manifest for Code Pre-generation")
          this.log("------------------------------------------")
          this.log(JSON.stringify(this.extensionManifest, null, '  '))
        })
    }
  }

  writing () {
    // generate the generic action
    if (this.extensionManifest.runtimeActions) {
      this.extensionManifest.runtimeActions.forEach((action) => {
        this.composeWith({
          Generator: CommerceEventsActionGenerator,
          path: 'unknown'
        },
        {
          // forward needed args
          'skip-prompt': this.options['skip-prompt'],
          'action-folder': this.actionFolder,
          'config-path': this.configPath,
          'full-key-to-manifest': this.keyToManifest,
          'action-name': action.name,
          'event-codes': action.eventCodes,
          'extension-manifest': this.extensionManifest
        })
      })
    }

    utils.writeKeyAppConfig(this, 'application.actions', path.relative(this.appFolder, this.actionFolder))
  }

  async conflicts () {
    const content = utils.readPackageJson(this)
    content['description'] = this.extensionManifest['description']
    content['version'] = this.extensionManifest['version']
    utils.writePackageJson(this, content)
  }

  end () {
    this.log(chalk.bold('\nSample code files have been generated.\n'))
    this.log(chalk.bold('Next Steps:'))
    this.log(chalk.bold('-----------'))
    this.log(chalk.bold('1) Populate your local environment variables in the ".env" file.'))
    this.log(chalk.bold('2) You can add your preferred event provider id in the ".env" file to simplify extension deployment.'))
    this.log(chalk.bold('3) You can modify the event codes in the "app.config.yaml" file.'))
    this.log(chalk.bold('4) You can use `aio app run` or `aio app deploy` to see the sample code files in action.'))
    this.log('\n')
  }
}

module.exports = MainGenerator
