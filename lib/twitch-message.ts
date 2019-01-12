import {Channel, Message} from '@majobot/api';

export class TwitchMessage implements Message {
  constructor(
    private _channel: Channel,
    private _content: string,
    private _mentionedUsers: Array<string>,
    private _senderName: string
  ) { }

  channel(): Channel {
    return this._channel;
  }

  content(): string {
    return this._content;
  }

  mentionedUsers(): Array<string> {
    return this._mentionedUsers;
  }

  senderName(): string {
    return this._senderName;
  }

}