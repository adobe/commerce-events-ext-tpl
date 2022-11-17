const helpers = require('yeoman-test')
const Generator = require('yeoman-generator')
const path = require('path')

const CommerceEventsMainGenerator = require('../src/index')
const CommerceEventsActionGenerator = require('../src/generator-add-action-commerce-events')
const { utils } = require('@adobe/generator-app-common-lib')

const { defaultExtensionManifest, customExtensionManifest } = require('./test-manifests')

const composeWith = jest.spyOn(Generator.prototype, 'composeWith').mockImplementation(jest.fn())
const prompt = jest.spyOn(Generator.prototype, 'prompt') // prompt answers are mocked by "yeoman-test"
const writeKeyAppConfig = jest.spyOn(utils, 'writeKeyAppConfig').mockImplementation(jest.fn())
const writeKeyYAMLConfig = jest.spyOn(utils, 'writeKeyYAMLConfig').mockImplementation(jest.fn())

beforeEach(() => {
  composeWith.mockClear()
  prompt.mockClear()
  writeKeyAppConfig.mockClear()
  // writeKeyYAMLConfig.mockClear()
})

describe('prototype', () => {
  test('exports a yeoman generator', () => {
    expect(CommerceEventsMainGenerator.prototype).toBeInstanceOf(Generator)
  })
})

describe('run', () => {
  const appFolder = '.'
  const actionFolder = path.join(appFolder, 'actions')
  
  test('test a generator invocation with default code generation', async () => {
    const options = {
      'is-test': true,
      'extension-manifest': defaultExtensionManifest
    }
    await helpers.run(CommerceEventsMainGenerator)
      .withOptions(options)
    expect(prompt).not.toHaveBeenCalled()
    expect(composeWith).toHaveBeenCalledTimes(1)

    expect(writeKeyAppConfig).toHaveBeenCalledTimes(1)
    expect(writeKeyAppConfig).toHaveBeenCalledWith(expect.any(CommerceEventsMainGenerator), 'application.actions', path.relative(appFolder, actionFolder))
  })

  test('test a generator invocation with custom code generation', async () => {
    const options = {
      'is-test': true,
      'extension-manifest': customExtensionManifest
    }
    await helpers.run(CommerceEventsMainGenerator)
      .withOptions(options)
    expect(prompt).not.toHaveBeenCalled()
    expect(composeWith).toHaveBeenCalledTimes(2)
    expect(composeWith).toHaveBeenCalledWith(
      expect.objectContaining({
        Generator: CommerceEventsActionGenerator,
        path: 'unknown'
      }),
      expect.any(Object)
    )
    expect(composeWith).toHaveBeenCalledWith(
      expect.objectContaining({
        Generator: CommerceEventsActionGenerator,
        path: 'unknown'
      }),
      expect.any(Object)
    )
    expect(writeKeyAppConfig).toHaveBeenCalledTimes(1)
    expect(writeKeyAppConfig).toHaveBeenCalledWith(expect.any(CommerceEventsMainGenerator), 'application.actions', path.relative(appFolder, actionFolder))
  })
})
