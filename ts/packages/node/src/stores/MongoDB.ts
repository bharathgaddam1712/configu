import 'reflect-metadata';
import { Store, StoreQuery, StoreContents } from '@configu/ts';
import { Entity, PrimaryColumn, ObjectIdColumn, Column, DataSource, ObjectID } from 'typeorm';
import forge from 'node-forge';
import _ from 'lodash';

export const hashObject = (object: Record<string, unknown>): string => {
  const objectAsString = JSON.stringify(object);
  const md = forge.md.md5.create();
  md.update(objectAsString);
  const md5HexString = md.digest().toHex();
  return md5HexString;
};

// TODO: reuse Config from /ts somehow
@Entity()
class Config {
  /**
   * TODO: decide the following:
   * - what should be within the config table
   * - what should be a column
   * - Indexing?
   * - PrimaryColumn('text') vs ObjectIdColumn()
   */

  // @ObjectIdColumn()
  // _id: ObjectID;

  @PrimaryColumn('text')
  _id: string;

  @Column('text')
  key: string;

  @Column('text')
  schema: string;

  @Column('text')
  set: string;

  @Column('text')
  value: string;

  // // TODO: decide if relevant here
  // @Column('timestamp')
  // createdAt: string;

  // // TODO: decide if relevant here
  // @Column('timestamp')
  // updatedAt: string;
}

type MongoConfiguration = { host: string; database: string; port?: number; username?: string; password?: string };

// TODO: MongoStore? MongoDBStore?
export class MongoStore extends Store {
  static readonly protocol = 'mongodb'; // TODO: mongodb? mongo-db?
  private dataSource: DataSource;
  constructor({ host, port = 27017, username, password, database }: MongoConfiguration) {
    super(MongoStore.protocol, { supportsGlobQuery: false });

    this.dataSource = new DataSource({
      type: 'mongodb',
      authSource: 'admin',
      host,
      port,
      username,
      password,
      database,
      useUnifiedTopology: true,
      synchronize: true, // TODO: relevant? - remove in prod
      logging: true, // TODO: relevant?
      entities: [Config],
      subscribers: [], // TODO: relevant?
      migrations: [], // TODO: relevant?
    });

    this.dataSource
      .initialize()
      .then()
      .catch((err) => {
        console.log(err);
      });
  }

  async initialize() {
    try {
      await this.dataSource.initialize();
    } catch (err) {
      // TODO: decide what to do with the error
      throw new Error(`failed to initialize ${this.constructor.name} - ${err.message}`);
    }
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
    return [];
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
