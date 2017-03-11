import * as rp from 'request-promise';

import { Game } from './game';

export class SlackApi {
  private _apiToken: string;
  private _messageIdCounter: number;
  private _game: Game;

  constructor (apiToken: string) {
    this._apiToken = apiToken;
    this._messageIdCounter = 0;
  }

  public connect () {
    const requestOptions = {
      token: this._apiToken
    };

    return this.makeApiRequest('rtm.start', requestOptions)
      .then((response) => {
        if (!response.ok) {
          throw Error(response.error);
        }

        this._game = new Game(response.url, response.users, response.ims)
      });
  }

  public disconnect (): Promise<void> {
    if (!this._game) {
      return Promise.resolve();
    }

    return this._game.disconnect();
  }

  private makeApiRequest (method: string, data: any): Promise<any> {
    const requestOptions: rp.Options = {
      method: 'POST',
      uri: 'https://slack.com/api/' + method,
      form: data,
      json: true
    };

    return Promise.resolve(rp(requestOptions));
  }
}
