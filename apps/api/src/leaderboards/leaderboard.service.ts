/**
 * Copyright (c) Statsify
 *
 * This source code is licensed under the GNU GPL v3 license found in the
 * LICENSE file in the root directory of this source tree.
 * https://github.com/Statsify/statsify/blob/main/LICENSE
 */

import * as Sentry from "@sentry/node";
import { Constructor, Flatten } from "@statsify/util";
import { InjectRedis, Redis } from "@nestjs-modules/ioredis";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { LeaderboardEnabledMetadata, LeaderboardScanner } from "@statsify/schemas";
import { LeaderboardQuery } from "@statsify/api-client";

export type LeaderboardAdditionalStats = Record<string, any> & { name: string };

@Injectable()
export abstract class LeaderboardService {
  public constructor(@InjectRedis() private readonly redis: Redis) {}

  public async addLeaderboards<T>(
    constructor: Constructor<T>,
    instance: Flatten<T>,
    idField: keyof T,
    fields: string[] = LeaderboardScanner.getLeaderboardFields(constructor),
    remove = false
  ) {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();

    const child = transaction?.startChild({
      op: "redis",
      description: `add ${constructor.name} leaderboards`,
    });

    const pipeline = this.redis.pipeline();
    const name = constructor.name.toLowerCase();

    const id = instance[idField] as unknown as string;

    fields
      .filter((field) => remove || typeof instance[field] === "number")
      .forEach((field) => {
        const value = instance[field] as unknown as number;

        if (remove || value === 0 || Number.isNaN(value)) {
          pipeline.zrem(`${name}.${String(field)}`, id);
        } else {
          pipeline.zadd(`${name}.${String(field)}`, value, id);
        }
      });

    await pipeline.exec();

    child?.finish();
  }

  public async getLeaderboard<T>(
    constructor: Constructor<T>,
    field: string,
    input: number | string,
    type: LeaderboardQuery
  ) {
    const PAGE_SIZE = 10;

    const {
      fieldName,
      additionalFields = [],
      extraDisplay,
      formatter,
      sort,
      name,
      hidden,
    } = LeaderboardScanner.getLeaderboardField(
      constructor,
      field
    ) as LeaderboardEnabledMetadata;

    let top: number;
    let bottom: number;
    let highlight: number | undefined = undefined;

    switch (type) {
      case LeaderboardQuery.PAGE:
        top = (input as number) * PAGE_SIZE;
        bottom = top + PAGE_SIZE;
        break;
      case LeaderboardQuery.INPUT: {
        const ranking = await this.searchLeaderboardInput(input as string, field);
        highlight = ranking - 1;
        top = ranking - (ranking % 10);
        bottom = top + PAGE_SIZE;
        break;
      }
      case LeaderboardQuery.POSITION: {
        const position = (input as number) - 1;
        highlight = position;
        top = position - (position % 10);
        bottom = top + PAGE_SIZE;
        break;
      }
    }

    const leaderboard = await this.getLeaderboardFromRedis(
      constructor,
      field,
      top,
      bottom - 1,
      sort
    );

    const additionalFieldMetadata = additionalFields.map((key) =>
      LeaderboardScanner.getLeaderboardField(constructor, key, false)
    );

    const additionalStats = await this.getAdditionalStats(
      leaderboard.map(({ id }) => id),
      [...additionalFields, ...(extraDisplay ? [extraDisplay] : [])]
    );

    const data = leaderboard.map((doc, index) => {
      const stats = additionalStats[index];

      if (extraDisplay) stats.name = `${stats[extraDisplay]}§r ${stats.name}`;

      const field = formatter ? formatter(doc.score) : doc.score;

      const additionalValues = additionalFields.map((key, index) => {
        if (additionalFieldMetadata[index].formatter)
          return additionalFieldMetadata[index].formatter?.(stats[key]);

        return stats[key];
      });

      const fields = [];

      if (!hidden) fields.push(field);
      fields.push(...additionalValues);

      return {
        id: doc.id,
        fields,
        name: stats.name,
        position: doc.index + 1,
        highlight: doc.index === highlight,
      };
    });

    const fields = [];
    if (!hidden) fields.push(fieldName);
    fields.push(...additionalFieldMetadata.map(({ fieldName }) => fieldName));

    return {
      name,
      fields,
      data,
      page: top / PAGE_SIZE,
    };
  }

  public async getLeaderboardRankings<T>(
    constructor: Constructor<T>,
    fields: string[],
    id: string
  ) {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();

    const child = transaction?.startChild({
      op: "redis",
      description: `get ${constructor.name} rankigns`,
    });

    const pipeline = this.redis.pipeline();
    const constructorName = constructor.name.toLowerCase();

    fields.forEach((field) => {
      const { sort } = LeaderboardScanner.getLeaderboardField(constructor, field);

      if (sort === "ASC") {
        pipeline.zrank(`${constructorName}.${field}`, id);
      } else {
        pipeline.zrevrank(`${constructorName}.${field}`, id);
      }
    });

    const responses = await pipeline.exec();

    child?.finish();

    if (!responses) throw new InternalServerErrorException();

    return responses.map((response, index) => {
      const field = fields[index];
      const rank = Number(response[1] ?? -1) + 1;

      return { field, rank };
    });
  }

  protected abstract searchLeaderboardInput(
    input: string,
    field: string
  ): Promise<number>;

  protected abstract getAdditionalStats(
    ids: string[],
    fields: string[]
  ): Promise<LeaderboardAdditionalStats[]>;

  private async getLeaderboardFromRedis<T>(
    constructor: Constructor<T>,
    field: string,
    top: number,
    bottom: number,
    sort = "DESC"
  ) {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();

    const child = transaction?.startChild({
      op: "redis",
      description: `get ${constructor.name} leaderboards`,
    });

    const name = constructor.name.toLowerCase();
    field = `${name}.${field}`;

    const scores = await (sort === "ASC"
      ? this.redis.zrange(field, top, bottom, "WITHSCORES")
      : this.redis.zrevrange(field, top, bottom, "WITHSCORES"));

    child?.finish();

    const response: { id: string; score: number; index: number }[] = [];

    for (let i = 0; i < scores.length; i += 2) {
      const id = scores[i];
      const score = Number(scores[i + 1]);

      response.push({ id, score, index: i / 2 + top });
    }

    return response;
  }
}
