import { Command } from '@statsify/discord';
import { TNTGamesModes, TNT_GAMES_MODES } from '@statsify/schemas';
import { BaseHypixelCommand, BaseProfileProps } from '../base.hypixel-command';
import { TNTGamesProfile } from './tntgames.profile';

@Command({ description: (t) => t('commands.tntgames') })
export class TNTGamesCommand extends BaseHypixelCommand<TNTGamesModes> {
  public constructor() {
    super(TNT_GAMES_MODES);
  }

  public getProfile(base: BaseProfileProps): JSX.Element {
    return <TNTGamesProfile {...base} />;
  }
}