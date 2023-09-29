const chalk = require('chalk')

module.exports = {
  templateOverview: `\n${chalk.bold(chalk.blue("Commerce Events Extension Template Overview:"))}\n
  * You have the option to generate boilerplate code for listening and acting on Commerce events.
  * You can add the Commerce event listeners that you are interested in two ways:
    -> Connect to your Adobe Commerce instance and select available events.
    -> Choose one of the Commerce event providers available in your organization.\n
  * You can get help regarding documentation at any time from the menu.
  * You can check out a sample demo project.
  * An App Builder project will be created with Node.js packages pre-configured.\n`,
  
  promptDocs: {
    mainDoc: "https://developer.adobe.com/commerce/events/get-started/",
    commerceIntegrationDoc: "https://docs.magento.com/user-guide/system/integrations.html",
    commerceConfigurationDoc: "https://developer.adobe.com/commerce/events/get-started/configure-commerce/"
  }
}