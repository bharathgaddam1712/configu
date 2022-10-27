import { StoreQuery, StoreContents } from '@configu/ts';
import _ from 'lodash';
import { MongoConnectionOptions } from 'typeorm/driver/mongodb/MongoConnectionOptions';
import { TypeOrmStore, Config } from './TypeORM';

export class MongoStore extends TypeOrmStore {
  static readonly protocol = 'mongodb';
  constructor({
    port = 27017,
    authSource = 'admin',
    useUnifiedTopology = true,
    ...rest
  }: Omit<MongoConnectionOptions, 'type'>) {
    super(MongoStore.protocol, {
      type: 'mongodb',
      authSource,
      port,
      useUnifiedTopology,
      ...rest,
    });
  }

  shouldUnset(value: unknown): boolean {
    return value === undefined;
  }

  private prepareUpsert(entity: Partial<Config>) {
    const $set = _.pickBy(entity, (v) => !this.shouldUnset(v)) as Record<Partial<keyof Config>, unknown>;
    const $unset = _.chain(entity)
      .pickBy((v) => this.shouldUnset(v))
      .mapValues(() => '')
      .value() as Record<Partial<keyof Config>, ''>;

    if (_.isEmpty($unset)) {
      return { $set };
    }
    return { $set, $unset };
  }

  async get(query: StoreQuery): Promise<StoreContents> {
    if (!this.dataSource.isInitialized) {
      throw new Error(`${this.constructor.name} is not initialized`);
    }

    const configRepository = this.dataSource.getMongoRepository(Config);

    const adjustedQuery = query.map((entry) => ({
      ...(entry.set !== '*' && { set: entry.set }),
      ...(entry.schema !== '*' && { schema: entry.schema }),
      ...(entry.key !== '*' && { key: entry.key }),
    }));

    return configRepository.findBy({ $or: adjustedQuery });
  }

  async set(configs: StoreContents): Promise<void> {
    if (!this.dataSource.isInitialized) {
      throw new Error(`${this.constructor.name} is not initialized`);
    }

    const configRepository = this.dataSource.getMongoRepository(Config);
    const configEntities = configs.map((config) => ({
      ...config,
      _id: this.calcId(_.pick(config, ['set', 'schema', 'key'])),
    }));

    const bulkOperations = configEntities.map((configEntity) => {
      if (_.isEmpty(configEntity.value)) {
        return {
          deleteOne: {
            filter: { _id: configEntity._id },
          },
        };
      }
      return {
        updateOne: {
          filter: { _id: configEntity._id },
          update: this.prepareUpsert(configEntity),
          upsert: true,
        },
      };
    });
    await configRepository.bulkWrite(bulkOperations);
  }
}
