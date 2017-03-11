import * as _ from 'lodash';
import * as WebSocket from 'ws';

const WIDTH = 7;
const HEIGHT = 6;

export enum Slot {
  FREE,
  RED,
  BLACK
}

export enum Status {
  PLAYING,
  OPEN
}

export interface Dictionary<T> {
  [key: string]: T;
}

export interface ISocketMessage {
  id?: number;
  type: string;
  channel?: string;
  text?: string;
}

export interface IInstantMessage {
  user: string;
  id: string;
}

export interface ISlackUser {
  id: string;
  name: string;
  isPlaying?: boolean;
}

class Player {
  private _name: string;
  private _userId: string;
  private _color: Slot;

  constructor (slackUser: ISlackUser, color: Slot) {
    this._name = slackUser.name;
    this._userId = slackUser.id;
    this._color = color;
  }

  public get name (): string {
    return this._name;
  }

  public get userId (): string {
    return this._userId;
  }

  public get color (): Slot {
    return this._color;
  }
}

export class Game {
  private static MESSAGE_COUNTER: number = 0;

  private _board: Array<Array<Slot>>;
  private _status: Status;
  private _player1: Player;
  private _player2: Player;
  private _webSocket: WebSocket;
  private _imsByUserId: Dictionary<IInstantMessage>;
  private _usersByUserId: Dictionary<ISlackUser>;
  private _currentTurnUserId: string;

  constructor (webSocketUrl: string, users: Array<ISlackUser>, ims: Array<IInstantMessage>) {
    this.initializeBoard();
    this._status = Status.OPEN;

    this._usersByUserId = _.keyBy<ISlackUser>(users, 'id');
    this._imsByUserId = _.keyBy<IInstantMessage>(ims, 'user');

    this._webSocket = this.connectWebsocket(webSocketUrl);
  }

  private static isValidColumn (column: number): boolean {
    return column < WIDTH && column >= 0;
  }

  public play (column: number, player: Player): boolean {
    if (this.isColumnFull(column)) {
      this.sendInstantMessage(player.userId, 'That column is full. Try another one.');
      return;
    }

    let row: number;
    for (row = 0; row < HEIGHT; ++row) {
      if (this._board[row][column] === Slot.FREE) {
        this._board[row][column] = player.color;
        break;
      }
    }

    const opponent: Player = (player === this._player1) ? this._player2 : this._player1;

    if (this.checkWinner(row, column, player.color)) {
      const board: string = this.diplayBoard();
      const message: string = board + '\n' + player.name + ' has won the game!';
      this.sendInstantMessage(player.userId, message);
      this.sendInstantMessage(opponent.userId, message);
      this.reset();

      return;
    }

    if (this.isBoardFull()) {
      const board: string = this.diplayBoard();
      const message: string = board + '\nThe game has ended in a DRAW.';
      this.sendInstantMessage(player.userId, message);
      this.sendInstantMessage(opponent.userId, message);
      this.reset();

      return;
    }

    const board: string = this.diplayBoard();

    this.sendInstantMessage(player.userId, board + '\nGreat move! It\'s your opponent\'s turn.');
    this.sendInstantMessage(opponent.userId, board + '\nIt\'s your turn. `choose a # between 1-7 to select a column`');

    this._currentTurnUserId = opponent.userId;
  }

  public disconnect (): Promise<void> {
    if (!this._webSocket || this._webSocket.readyState !== WebSocket.OPEN) {
      return Promise.resolve();
    }

    this._webSocket.close();

    // Check websocket state after 1 second and resolve
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (this._webSocket.readyState === WebSocket.CLOSED) {
          return resolve();
        }

        reject(Error('Failed to disconnect.'));
      }, 1000);
    });
  }

  private connectWebsocket (webSocketUrl: string) {
    const ws: WebSocket = new WebSocket(webSocketUrl);

    ws.on('open', () => {
      console.log('Socket opened');
    })
      .on('close', () => {
        console.log('Socket closed');
      })
      .on('error', (data) => {
        console.error('Error: ', data);
      })
      .on('message', (data) => {
        const dataObj = JSON.parse(data);

        if (dataObj.type !== 'message') {
          return;
        }

        switch (this._status) {
          case Status.PLAYING:
            this.updateGame(dataObj);
            break;
          case Status.OPEN:
            this.startGame(dataObj);
            break;
        }
      });

    return ws;
  }

  /**
   * Checks whether the counter just played was a winning move for that player.
   * Only looks at the winning positions the most recent counter is in, and only checks if the player
   * that just played has won, not both players.
   * @returns {boolean}
   */
  private checkWinner (row: number, column: number, slot: Slot): boolean {
    // TODO
    return false;
  }

  private diplayBoard (): string {
    let display = "";
    for (let i = HEIGHT - 1; i >= 0; i--) {
      for (let j = 0; j < WIDTH; ++j) {
        display += this.getSymbolForPosition(i, j);
      }
      display += '\n';
    }

    return display;
  }

  private getSymbolForPosition (row: number, column: number): string {
    const slot: Slot = this._board[row][column];

    switch (slot) {
      case Slot.FREE:
        return ':white_large_square:';
      case Slot.BLACK:
        return ':black_circle:';
      case Slot.RED:
        return ':red_circle:';
    }
  }

  private isColumnFull (column: number): boolean {
    const topRow: Array<Slot> = this._board[this._board.length - 1];

    return topRow[column] !== Slot.FREE;
  }

  private initializeBoard (): void {
    this._board = _.times(HEIGHT, () => {
      return _.times(WIDTH, () => {
        return Slot.FREE;
      });
    });
  }

  private sendInstantMessage (userId: string, text: string): void {
    this.sendSocketMessage({
      type: 'message',
      channel: this._imsByUserId[userId].id,
      text: text
    });
  }

  private sendSocketMessage (data: ISocketMessage): void {
    const socketMessageData = _.merge(data, {
      id: Game.MESSAGE_COUNTER++
    });

    this._webSocket.send(JSON.stringify(socketMessageData));
  };

  private isUserPlaying (userId: string): boolean {
    return (!!this._player1 && this._player1.userId === userId) ||
      (!!this._player2 && this._player2.userId === userId);
  }

  private updateGame (dataObj: any): void {
    if (!this.isUserPlaying(dataObj.user)) {
      this.sendInstantMessage(dataObj.user, 'There is a game currently in session. Please try again later.');
      return;
    }

    const player: Player = this.getPlayerForUserId(dataObj.user);

    if (!player) {
      this.sendInstantMessage(dataObj.user, 'Something terrible has happened. Please try again later');
      return
    }

    if (dataObj.text === 'quit') {
      this.sendInstantMessage(this._player1.userId, player.name + ' has quit. The match is over.');
      this.sendInstantMessage(this._player2.userId, player.name + ' has quit. The match is over.');
      this.reset();
      return
    }

    if (player.userId !== this._currentTurnUserId) {
      this.sendInstantMessage(player.userId, 'Hey ' + player.name + '! Wait your turn!');
      return;
    }

    const column = parseInt(dataObj.text) - 1;

    if (!Game.isValidColumn(column)) {
      this.sendInstantMessage(dataObj.user, 'Invalid column. `choose a # between 1-7 to select a column`');
      return;
    }

    this.play(column, player);
  }

  private startGame (dataObj: any): void {
    const words: Array<string> = dataObj.text.split(' ');

    if (words.length > 2) {
      return;
    }

    if (words[0] !== 'play') {
      return;
    }

    const opponent: ISlackUser = this._usersByUserId[extractUserId(words[1])];

    if (!opponent) {
      this.sendInstantMessage(dataObj.user,
        'That\'s not a valid opponent.');
      return;
    }

    this._currentTurnUserId = dataObj.user;

    const challenger: ISlackUser = this._usersByUserId[dataObj.user];

    challenger.isPlaying = true;
    opponent.isPlaying = true;

    this._player1 = new Player(challenger, Slot.RED);
    this._player2 = new Player(opponent, Slot.BLACK);

    this._status = Status.PLAYING;

    const board: string = this.diplayBoard();

    this.sendInstantMessage(this._player1.userId,
      board + '\nMake your move. `choose a # between 1-7 to select a column`');
    this.sendInstantMessage(this._player2.userId,
      this._player1.name + ' has challenged you to a game of Connect 4! Get ready to make your move.');
  }

  private getPlayerForUserId (userId: string): Player {
    if (!this._player1 || !this._player2) {
      return null;
    }

    if (this._player1.userId === userId) {
      return this._player1;
    } else if (this._player2.userId === userId) {
      return this._player2;
    }

    return null;
  }

  private isBoardFull (): boolean {
    const topRow: Array<Slot> = this._board[this._board.length - 1];

    return _.every(topRow, (slot) => {
      return slot !== Slot.FREE;
    });
  }

  private reset (): void {
    this._player1 = null;
    this._player2 = null;
    this._status = Status.OPEN;
    this.initializeBoard();
  }
}

function extractUserId (annotatedName: string): string {
  return annotatedName.slice(2, 11);
}
