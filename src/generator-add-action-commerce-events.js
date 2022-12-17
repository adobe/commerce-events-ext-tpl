/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const path = require('path')
const { EOL } = require('os')

const { constants, ActionGenerator, commonTemplates } = require('@adobe/generator-app-common-lib')
const { commonDependencyVersions } = constants

class CommerceEventsActionGenerator extends ActionGenerator {
  constructor (args, opts) {
    super(args, opts)
    this.props = {
      description: 'This is a sample action showcasing how to access an external API',
      // eslint-disable-next-line quotes
      requiredParams: `[/* add required params */]`,
      // eslint-disable-next-line quotes
      requiredHeaders: `['Authorization']`,
      // eslint-disable-next-line quotes
      importCode: `const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')`,

      responseCode: `// replace this with the api you want to access
    const apiEndpoint = \`\${params.API_ENDPOINT}\`

    // fetch content from external api endpoint
    const res = await fetch(apiEndpoint)
    if (!res.ok) {
      throw new Error('request to ' + apiEndpoint + ' failed with status code ' + res.status)
    }
    const content = await res.json()
    const response = {
      statusCode: 200,
      body: content
    }`
    }
    this.props['actionName'] = this.options['action-name']
    this.props['eventCodes'] = this.options['event-codes']
    this.props['extensionManifest'] = this.options['extension-manifest']
  }

  // async prompting () {
    // this.props.actionName = await this.promptForActionName('showcases how to develop Commerce event extensions', GENERIC_ACTION_NAME)
  // }

  writing () {
    this.sourceRoot(path.join(__dirname, '.'))

    // Generic Project
    var templateActionPath = commonTemplates['stub-action']
    var templateInputs = { 
      LOG_LEVEL: 'debug',
      API_ENDPOINT: '$API_ENDPOINT'
    }
    var templateDotEnvVars = ['API_ENDPOINT']

    // Demo Project
    if (this.props.extensionManifest.templateFolder) {
      templateActionPath = `./templates/${this.props.extensionManifest.templateFolder}/${this.props.actionName}-action.js`
      templateInputs = this.props.extensionManifest.templateInputs || {}
      templateDotEnvVars = this.props.extensionManifest.templateDotEnvVars || []
    }
    
    this.addAction(this.props.actionName, templateActionPath, {
      // testFile: templates['stub-action.test'],
      sharedLibFile: commonTemplates.utils,
      sharedLibTestFile: commonTemplates['utils.test'],
      e2eTestFile: commonTemplates['stub-action.e2e'],
      tplContext: this.props,
      dependencies: {
        '@adobe/aio-sdk': commonDependencyVersions['@adobe/aio-sdk'],
        'node-fetch': '^2.6.0'
      },
      actionManifestConfig: {
        web: 'no',
        inputs: templateInputs,
        annotations: { 
          final: true, 
          'require-adobe-auth': false 
        }, // makes sure loglevel cannot be overwritten by request param
        relations: {
          'event-listener-for': this.props.eventCodes
        }
      },
      dotenvStub: { label: 'Place your local environment variables here', vars: templateDotEnvVars }
    })

    if (!this.props.extensionManifest.templateFolder) {
      const providerIds = `${[...new Set(this.props.extensionManifest.runtimeActions.map(action => action.eventProviderId))].join(',')}${EOL}`
      appendStubVarsToDotenv(this, 'PREFERRED_PROVIDERS', providerIds)
    }
  }
}

function appendStubVarsToDotenv (generator, key, val) {
  const content = `${key}=${val}`
  const file = generator.destinationPath('.env')

  const prevContent = (generator.fs.exists(file) || '') && generator.fs.read(file)
  if (prevContent.includes(key)) {
    // if already there do nothing
    return
  }
  generator.fs.append(file, content)
}

module.exports = CommerceEventsActionGenerator
