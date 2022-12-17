const chalk = require('chalk')

module.exports = {
  templateOverview: `\n${chalk.bold(chalk.blue("Commerce Events Extension Template Overview:"))}\n
  * You have the option to generate boilerplate code for listening and acting on Commerce events.
  * You can add the Commerce event listeners that you are interested in two ways:
    -> Connect to your Adobe Commerce instance and select available events.
    -> Choose one of the Commerce event providers available in your organization.\n
  * You can install an optional plugin extension to enable App Builder webhook auto subscriptions.
  * You can get help regarding documentation at any time from the menu.
  * You can check out a sample demo project.
  * An App Builder project will be created with Node.js packages pre-configured.\n`,
  
  pluginExtensionOverview: `\n${chalk.bold(chalk.blue(`App Builder Webhook Auto Subscriptions (@adobe/aio-cli-plugin-extension) Overview:`))}\n
  * The integration between Adobe App Builder project and I/O Events simplifies creation of applications that listen to these events.
  * App Builder webhook auto subscriptions push this concept further by subscribing your newly deployed project to I/O Events
    automatically, so you can easily deploy your application in different environments.
  * This technology minimizes the manual routine work for admins and reduces the possibility to mess up things during 
    manual setup in the Developer Console.\n`,

  promptDocs: {
    mainDoc: "https://developer-stage.adobe.com/commerce/events/events/",
    commerceIntegrationDoc: "https://docs.magento.com/user-guide/system/integrations.html",
    commerceEventsSetupDoc: "https://developer-stage.adobe.com/commerce/events/events/project-setup/"
  }
}