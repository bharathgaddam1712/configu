import 'reflect-metadata';
import { StoreQuery, StoreContents } from '@configu/ts';
import forge from 'node-forge';
import _ from 'lodash';
import { TypeOrmStore, Config } from './TypeORM';

export const hashObject = (object: Record<string, unknown>): string => {
  const objectAsString = JSON.stringify(object);
  const md = forge.md.md5.create();
  md.update(objectAsString);
  const md5HexString = md.digest().toHex();
  return md5HexString;
};

type MongoConfiguration = { host: string; database: string; port?: number; username?: string; password?: string };

// TODO: MongoStore? MongoDBStore?
export class MongoStore extends TypeOrmStore {
  static readonly protocol = 'mongodb'; // TODO: mongodb? mongo-db?
  constructor({ host, port = 27017, username, password, database }: MongoConfiguration) {
    super({
      type: 'mongodb',
      authSource: 'admin',
      host,
      port,
      username,
      password,
      database,
      useUnifiedTopology: true,
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

  calcId(entity: Pick<Config, 'set' | 'schema' | 'key'>) {
    return hashObject(_.pick(entity, ['set', 'schema', 'key']));
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
