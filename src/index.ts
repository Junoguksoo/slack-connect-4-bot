import { install } from 'source-map-support';

// Telling Node to use our compiled source maps. Very helpful when
// we get error stacks pointing to files.
install();

import { SlackApi } from './slack-api';

const slackApiToken: string = process.env.SLACK_API_TOKEN;

if (!slackApiToken) {
  console.error('Environment variable SLACK_API_TOKEN is required.');
  process.exit(2);
}

const slackApi: SlackApi = new SlackApi(slackApiToken);

slackApi.connect()
  .catch((error) => {
    console.error('Error connecting to Slack: ', error);
    process.exit(1);
  });

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
