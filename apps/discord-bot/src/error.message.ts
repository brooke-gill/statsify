import { ERROR_COLOR } from '#constants';
import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  IMessage,
  LocalizationString,
  Message,
} from '@statsify/discord';
import type { APIAttachment } from 'discord-api-types/v10';

interface ErrorMessageOptions {
  color?: number;
  buttons?: ButtonBuilder[];
  attachments?: APIAttachment[];
}

export class ErrorMessage extends Message {
  public constructor(
    title: LocalizationString,
    description: LocalizationString,
    { attachments = [], buttons = [], color = ERROR_COLOR }: ErrorMessageOptions = {}
  ) {
    const embed = new EmbedBuilder().title(title).description(description).color(color);

    const data: IMessage = { embeds: [embed] };

    if (buttons.length > 0) data.components = [new ActionRowBuilder(buttons)];
    if (attachments.length > 0) data.attachments = attachments;

    super(data);
  }
}