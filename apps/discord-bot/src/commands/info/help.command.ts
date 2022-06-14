import { INFO_COLOR } from '#constants';
import { getLogoPath } from '@statsify/assets';
import { Command, EmbedBuilder, IMessage } from '@statsify/discord';
import { UserTier } from '@statsify/schemas';
import { readFile } from 'fs/promises';

@Command({ description: (t) => t('commands.help') })
export class HelpCommand {
  public async run(): Promise<IMessage> {
    const embed = new EmbedBuilder()
      .title((t) => t('embeds.help.title'))
      .field(
        (t) => t('embeds.help.games.title'),
        (t) => t('embeds.help.games.description')
      )
      .field(
        (t) => t('embeds.help.leaderboards.title'),
        (t) => t('embeds.help.leaderboards.description')
      )
      .field(
        (t) => t('embeds.help.historical.title'),
        (t) => t('embeds.help.historical.description')
      )
      .field(
        (t) => t('embeds.help.minecraft.title'),
        (t) => t('embeds.help.minecraft.description')
      )
      .field(
        (t) => t('embeds.help.misc.title'),
        (t) => t('embeds.help.misc.description')
      )
      .color(INFO_COLOR)
      .thumbnail('attachment://logo.png');

    const logo = await readFile(getLogoPath(UserTier.NONE, 64));

    return {
      embeds: [embed],
      files: [{ name: 'logo.png', data: logo, type: 'image/png' }],
    };
  }
}