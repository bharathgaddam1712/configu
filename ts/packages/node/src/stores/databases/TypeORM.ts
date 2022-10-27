import 'reflect-metadata';
import { Store, StoreQuery, StoreContents } from '@configu/ts';
import { Entity, PrimaryColumn, ObjectIdColumn, Column, DataSource, DataSourceOptions } from 'typeorm';
import _ from 'lodash';
import forge from 'node-forge';

// TODO: reuse Config from /ts somehow
@Entity()
export class Config {
  /**
   * TODO: decide the following:
   * - what should be within the config table
   * - what should be a column
   * - Indexing?
   * - PrimaryColumn('text') vs ObjectIdColumn()
   * - _id vs id as the key for the PK
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

export abstract class TypeOrmStore extends Store {
  readonly dataSource: DataSource;

  constructor(public protocol: string, dataSourceOptions: DataSourceOptions) {
    super(protocol, { supportsGlobQuery: false });

    this.dataSource = new DataSource({
      ...dataSourceOptions,
      entities: [Config],
      synchronize: true, // TODO: relevant? - remove in prod
      logging: true, // TODO: relevant?
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

  private hashObject = (object: Record<string, unknown>): string => {
    const objectAsString = JSON.stringify(object);
    const md = forge.md.md5.create();
    md.update(objectAsString);
    const md5HexString = md.digest().toHex();
    return md5HexString;
  };

  async initialize() {
    try {
      await this.dataSource.initialize();
    } catch (err) {
      // TODO: decide what to do with the error
      throw new Error(`failed to initialize ${this.constructor.name} - ${err.message}`);
    }
  }

  calcId(entity: Pick<Config, 'set' | 'schema' | 'key'>) {
    return this.hashObject(_.pick(entity, ['set', 'schema', 'key']));
  }

  async get(query: StoreQuery): Promise<StoreContents> {
    if (!this.dataSource.isInitialized) {
      throw new Error(`${this.constructor.name} is not initialized`);
    }

    const configRepository = this.dataSource.getRepository(Config);

    const adjustedQuery = query.map((entry) => ({
      ...(entry.set !== '*' && { set: entry.set }),
      ...(entry.schema !== '*' && { schema: entry.schema }),
      ...(entry.key !== '*' && { key: entry.key }),
    }));

    return configRepository.find({ where: adjustedQuery });
  }

  async set(configs: StoreContents): Promise<void> {
    if (!this.dataSource.isInitialized) {
      throw new Error(`${this.constructor.name} is not initialized`);
    }

    const configRepository = this.dataSource.getRepository(Config);
    const configEntities = configs.map((config) => ({
      ...config,
      _id: this.calcId(_.pick(config, ['set', 'schema', 'key'])),
    }));

    // Upsert is supported by AuroraDataApi, Cockroach, Mysql, Postgres, and Sqlite database drivers.
    const [configsToUpsert, configsToDelete] = _.partition(configEntities, 'value');
    if (configsToDelete.length > 0) {
      await configRepository.delete(_.map(configsToDelete, '_id'));
    }
    if (configsToUpsert.length > 0) {
      await configRepository.upsert(configsToUpsert, ['_id']);
    }
  }
}
