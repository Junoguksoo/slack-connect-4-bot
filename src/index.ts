import { install } from 'source-map-support';

// Telling Node to use our compiled source maps. Very helpful when
// we get error stacks pointing to files.
install();

import { SlackApi } from './slack-api';

const slackApiToken: string = 'xoxb-128374320711-Y61vxvfxwAAMsEfrqIyLRy1z';

const slackApi: SlackApi = new SlackApi(slackApiToken);

slackApi.connect();

function gracefulExit(): void {
  slackApi.disconnect()
    .then(() => process.exit())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

// Make sure we shutdown the server gracefully
process.on('SIGTERM', gracefulExit);
process.on('SIGINT', gracefulExit);
