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

const helpers = require('yeoman-test')
const assert = require('yeoman-assert')
const cloneDeep = require('lodash.clonedeep')

const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')

const CommerceEventsActionGenerator = require('../src/generator-add-action-commerce-events')

const { ActionGenerator, constants } = require('@adobe/generator-app-common-lib')
const { runtimeManifestKey, defaultRuntimeKind } = constants
const { customExtensionManifest, demoExtensionManifest } = require('./test-manifests')

const appFolder = '.'
const actionFolder = path.join(appFolder, 'actions')
const configPath = path.join(appFolder, 'app.config.yaml')
const keyToManifest = 'application.' + constants.runtimeManifestKey
const actionName = 'generic'

const basicGeneratorOptions = {
  'action-folder': actionFolder,
  'config-path': configPath,
  'full-key-to-manifest': keyToManifest,
  'action-name': actionName,
  'extension-manifest': customExtensionManifest
}

describe('prototype', () => {
  test('exports a yeoman generator', () => {
    expect(CommerceEventsActionGenerator.prototype).toBeInstanceOf(ActionGenerator)
  })
})

/**
 * Checks that all the files are generated.
 *
 * @param {string} actionName an action name
 */
function assertGeneratedFiles (actionName) {
  assert.file(basicGeneratorOptions['config-path'])

  assert.file(`${basicGeneratorOptions['action-folder']}/${actionName}/index.js`)

  // assert.file(`test/${actionName}.test.js`)
  assert.file(`${appFolder}/e2e/${actionName}.e2e.test.js`)

  assert.file(`${basicGeneratorOptions['action-folder']}/utils.js`)
  assert.file(`${appFolder}/test/utils.test.js`)
}

/**
 * Checks that a correct action section has been added to the App Builder project configuration file.
 *
 * @param {string} actionName an action name
 */
function assertManifestContent (actionName, inputsContent, relationsContent) {
  const json = yaml.load(fs.readFileSync(basicGeneratorOptions['config-path']).toString())
  expect(json.application.runtimeManifest.packages).toBeDefined() // basicGeneratorOptions['full-key-to-manifest']
  const packages = json.application.runtimeManifest.packages
  const packageName = Object.keys(packages)[0]
  expect(json.application.runtimeManifest.packages[packageName].actions[actionName]).toEqual({
    function: `actions/${actionName}/index.js`,
    web: 'no',
    runtime: defaultRuntimeKind,
    inputs: inputsContent,
    annotations: {
      'final': true,
      'require-adobe-auth': false
    },
    relations: relationsContent
  })
}

/**
 * Checks that .env has the required environment variables.
 */
function assertEnvContent (content) {
  const theFile = '.env'
  assert.fileContent(
    theFile,
    content
  )
}

/**
 * Checks that an action file contains correct code snippets.
 *
 * @param {string} actionName an action name
 */
function assertActionCodeContent (actionName) {
  const theFile = `${basicGeneratorOptions['action-folder']}/${actionName}/index.js`
  assert.fileContent(
    theFile,
    'const apiEndpoint = `${params.API_ENDPOINT}`'
  )
  assert.fileContent(
    theFile,
    'const requiredHeaders = [\'Authorization\']'
  )
}

describe('run', () => {
  test('test a generator invocation with custom code generation', async () => {
    const actionName = 'order-created'
    const eventCodes = [ 'com.adobe.commerce.order.created' ]
    const options = cloneDeep(basicGeneratorOptions)
    options['action-name'] = actionName
    options['event-codes'] = eventCodes
    options['extension-manifest'] = customExtensionManifest
    await helpers.run(CommerceEventsActionGenerator)
      .withOptions(options)
      .inTmpDir(dir => {
        // ActionGenerator expects to have the '.env' file created
        fs.writeFileSync('.env', '')
      })

    assertGeneratedFiles(actionName)
    assertManifestContent(
      actionName,
      {
        'LOG_LEVEL': 'debug',
        'API_ENDPOINT': '$API_ENDPOINT'
      },
      { 'event-listener-for': eventCodes }
    )
    assertActionCodeContent(actionName)
    assertDependencies(
      fs,
      {
        '@adobe/aio-sdk': expect.any(String),
        'node-fetch': expect.any(String)
      },
      { '@openwhisk/wskdebug': expect.any(String) }
    )
    assertEnvContent('#API_ENDPOINT=')
    assertEnvContent('PREFERRED_PROVIDERS')
  })

  test('test a generator invocation with demo code generation', async () => {
    const actionName = 'product-created'
    const eventCodes = [ 'com.adobe.commerce.product.created' ]
    const options = cloneDeep(basicGeneratorOptions)
    options['action-name'] = actionName
    options['event-codes'] = eventCodes
    options['extension-manifest'] = demoExtensionManifest
    await helpers.run(CommerceEventsActionGenerator)
      .withOptions(options)
      .inTmpDir(dir => {
        // ActionGenerator expects to have the '.env' file created
        fs.writeFileSync('.env', '')
      })

    assertGeneratedFiles(actionName)
    assertManifestContent(
      actionName,
      {
        'LOG_LEVEL': 'debug',
        'SLACK_WEBHOOK': '$SLACK_WEBHOOK',
        'SLACK_CHANNEL': '$SLACK_CHANNEL'
      },
      { 'event-listener-for': eventCodes }
    )
    assertDependencies(
      fs,
      {
        '@adobe/aio-sdk': expect.any(String),
        'node-fetch': expect.any(String)
      },
      { '@openwhisk/wskdebug': expect.any(String) }
    )
    assertEnvContent('#SLACK_WEBHOOK=')
    assertEnvContent('#SLACK_CHANNEL=')
    assertEnvContent('#PREFERRED_PROVIDERS')
  })
})