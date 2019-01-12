import {Channel, Command, PlatformClient} from '@majobot/api';
import {TwitchPlatformClient} from "..";

export class TwitchChannel implements Channel {
  private _commands: Array<Command> = [];

  constructor(private _client: TwitchPlatformClient, private readonly _name: string) {
    this._name = this._name.toLowerCase();
  }

  join(): Promise<any> {
    if (this.platform().joinedChannels().includes(this)) {
      return Promise.resolve();
    }

    return this
      .platform()
      .writeLine('JOIN #' + this._name)
      .then(() => {
        return new Promise(resolve => {
          const lineListener = (x: string) => {
            if (x.includes(`tmi.twitch.tv 366 ${this._client.username()} #${this.name()}`)) {
              this.platform().removeListener('line', lineListener);
              this.platform().joinedChannels().push(this);
              resolve();
            }
          };
          this.platform().on('line', lineListener);
        });
      });
  }

  leave(): Promise<any> {
    if (!this.platform().joinedChannels().includes(this)) {
      return Promise.resolve();
    }

    return this
      .platform()
      .writeLine('PART #' + this._name)
      .then(() => {
        return new Promise(resolve => {
          const lineListener = (x: string) => {
            if (x === `:${this._client.username()}!${this._client.username()}@${this._client.username()}.tmi.twitch.tv PART #${this.name()}`) {
              this.platform().removeListener('line', lineListener);
              const index = this.platform().joinedChannels().indexOf(this);
              this.platform().joinedChannels().splice(index, 1);
              resolve();
            }
          };
          this.platform().on('line', lineListener);
        });
      });
  }

  name(): string {
    return this._name;
  }

  platform(): PlatformClient {
    return this._client;
  }

  sendMessage(message: string): Promise<any> {
    return this._client.writeLine(`:${this._client.username()}!${this._client.username()}@${this._client.username()}.tmi.twitch.tv #${this.name()} :${message}`).then(() => undefined);
  }

  addCommand(command: { new(): Command }): Channel {
    if (this._commands.some(x => x instanceof command)) {
      return this;
    }
    const newCommandInstance = new command();
    this._commands.push(newCommandInstance);
    newCommandInstance.boot();
    return this;
  }

  commands(): Array<Command> {
    return this._commands;
  }

  removeCommand(command: { new(): Command }): Channel {
    const commandInstance = this._commands.filter(x => x instanceof command)[0];
    if (!commandInstance) {
      return this;
    }
    this._commands.splice(this._commands.indexOf(commandInstance), 1);
    commandInstance.teardown();
    return this;
  }
}