import {BootableState, Channel, Message, PlatformClient} from '@majobot/api';
import {TwitchChannel} from './twitch-channel';
import net from 'net';
import {TwitchMessage} from './twitch-message';

export class TwitchPlatformClient implements PlatformClient {
  private _username: string = '';
  private _socket: net.Socket = new net.Socket();
  private _joinedChannels: Array<Channel> = [];
  private _bootableState: BootableState = 'uninitialized';
  private _eventListeners: { [key:string]: Array<Function> } = { };
  private _channelRegister: Array<Channel> = [];

  private pingListener = (line: string) => {
    if (line === 'PING :tmi.twitch.tv') {
      this.writeLine('PONG :tmi.twitch.tv');
    }
  };

  channelRegister(): Array<Channel> {
    return this._channelRegister;
  }

  username(): string {
    return this._username;
  }

  boot(): Promise<any> {
    this._bootableState = 'boot';
    return new Promise(resolve => {
      this.on('line', this.pingListener);
      this._bootableState = 'initialized';
      resolve();
    });
  }

  channel(name: string): Channel {
    name = name.toLowerCase();
    const channel = this.channelRegister().filter(x => x.name() === name)[0];
    if (channel) {
      return channel;
    }
    const newChannel = new TwitchChannel(this, name);
    this.channelRegister().push(newChannel);
    return newChannel;
  }

  connect(username: string, password: string, host?: string, port?: number): Promise<any> {
    const checkLogin = (data: Buffer) => {
      if (data.toString('utf8').includes('failed')) {
        throw new Error('Twitch login failed! Please check your credentials.');
      }
      this._socket.on('data', this.dataHandler.bind(this));
      this._socket.removeListener('data', checkLogin);
    };
    return new Promise((resolve, reject) => {
      this._socket.connect(port || 6667, host || 'irc.twitch.tv', (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    })
      .then(() => this._socket.on('data', checkLogin))
      .then(() => this._username = username)
      .then(() => this.writeLine('PASS ' + password))
      .then(() => this.writeLine('NICK ' + username))
      .then(() => this.writeLine('CAP REQ :twitch.tv/tags'))
      .then(() => this);
  }

  disconnect(): Promise<any> {
    this._socket.destroy();
    return Promise.resolve();
  }

  joinedChannels(): Array<Channel> {
    return this._joinedChannels;
  }

  on(event: 'line', callback: (line: string) => (any | Promise<any>)): PlatformClient;
  on(event: 'message', callback: (message: Message) => (any | Promise<any>)): PlatformClient;
  on(event: 'line' | 'message', callback: ((line: string) => (any | Promise<any>)) | ((message: Message) => (any | Promise<any>))): PlatformClient {
    if (!this._eventListeners[event]) {
      this._eventListeners[event] = [];
    }
    this._eventListeners[event].push(callback);
    return this;
  }

  platformCommandTrigger(): string {
    return '!';
  }

  platformName(): string {
    return 'Twitch';
  }

  removeListener(event: 'line' | 'message', listener: Function): PlatformClient {
    if (!this._eventListeners.hasOwnProperty(event)) return this;
    if (!this._eventListeners[event].includes(listener)) return this;
    const listenerIndex = this._eventListeners[event].indexOf(listener);
    this._eventListeners[event].splice(listenerIndex, 1);
    return this;
  }

  state(): BootableState {
    return this._bootableState;
  }

  teardown(): Promise<any> {
    return Promise.resolve();
  }

  vendorName(): string {
    return '';
  }

  write(data: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this._socket.write(data, 'utf8', (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      })
    });
  }

  writeLine(data: string): Promise<any> {
    return this.write(data + '\r\n');
  }

  private dataHandler(data: Buffer) {
    const line = data.toString('utf8').trimRight();
    this.notifySubscribers('line', line);
    if (line.includes('.tmi.twitch.tv PRIVMSG #')) {
      const message = this.parseLine(line);
      this.notifySubscribers('message', message);
    }
  }

  private notifySubscribers(event: string, ...args: Array<any>) {
    if (!this._eventListeners.hasOwnProperty(event)) return;

    for (const callback of this._eventListeners[event]) {
      callback(...args);
    }
  }

  parseLine(line: string): Message {
    const [, messageSenderAndChannelString, ...messageParts] = line.split(' :');
    const messageContent = messageParts.join(' :');
    const username = messageSenderAndChannelString.substr(0, messageSenderAndChannelString.indexOf('!'));
    const channelName = messageSenderAndChannelString.substr(messageSenderAndChannelString.indexOf('#') + 1);
    const mentions = messageContent.split(' ').filter(x => x.startsWith('@'));

    return new TwitchMessage(
      this.channel(channelName),
      messageContent,
      mentions,
      username
    );
  }
}