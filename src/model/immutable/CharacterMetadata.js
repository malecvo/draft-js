/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall draft_js
 */

'use strict';

import type {DraftInlineStyle} from 'DraftInlineStyle';

const {List, Map, OrderedSet, Record} = require('immutable');

// Immutable.map is typed such that the value for every key in the map
// must be the same type
type CharacterMetadataConfigValueType = DraftInlineStyle | ?string;
type CharacterMetadataConfigRawValueType = Array<string> | ?string;

export type CharacterMetadataRawConfig = {
  style?: CharacterMetadataConfigRawValueType,
  entity?: CharacterMetadataConfigRawValueType,
  ...
};

type CharacterMetadataConfig = interface {
  style?: CharacterMetadataConfigValueType,
  entity?: CharacterMetadataConfigValueType,
};

const EMPTY_SET = OrderedSet<string>();
const EMPTY_LIST = List();

const defaultRecord: CharacterMetadataConfig = {
  style: EMPTY_SET,
  entity: EMPTY_LIST,
};

const CharacterMetadataRecord = (Record(defaultRecord): any);

class CharacterMetadata extends CharacterMetadataRecord {
  getStyle(): DraftInlineStyle {
    return this.get('style');
  }

  getEntity(): Array<string> {
    return this.get('entity').toArray();
  }

  hasStyle(style: string): boolean {
    return this.getStyle().includes(style);
  }

  static applyStyle(
    record: CharacterMetadata,
    style: string,
  ): CharacterMetadata {
    const withStyle = record.set('style', record.getStyle().add(style));
    return CharacterMetadata.create(withStyle);
  }

  static removeStyle(
    record: CharacterMetadata,
    style: string,
  ): CharacterMetadata {
    const withoutStyle = record.set('style', record.getStyle().remove(style));
    return CharacterMetadata.create(withoutStyle);
  }

  static applyEntity(
    record: CharacterMetadata,
    entityKey: ?string,
  ): CharacterMetadata {
    if (entityKey === null) {
      const cleared = record.set('entity', EMPTY_LIST);
      return CharacterMetadata.create(cleared);
    }
    const currentEntities = record.get('entity');
    if (currentEntities.includes(entityKey)) {
      return record;
    }
    const withEntity = record.set('entity', currentEntities.push(entityKey));
    return CharacterMetadata.create(withEntity);
  }

  /**
   * Use this function instead of the `CharacterMetadata` constructor.
   * Since most content generally uses only a very small number of
   * style/entity permutations, we can reuse these objects as often as
   * possible.
   */
  static create(config?: CharacterMetadataConfig): CharacterMetadata {
    if (!config) {
      return EMPTY;
    }

    const defaultConfig: CharacterMetadataConfig = {
      style: EMPTY_SET,
      entity: EMPTY_LIST,
    };

    // Fill in unspecified properties, if necessary.
    // $FlowFixMe[incompatible-call] added when improving typing for this parameters
    const configMap = Map(defaultConfig).merge(config);

    // Normalize entity to List
    let normalizedMap = configMap;
    const entity = configMap.get('entity');
    if (typeof entity === 'string') {
      normalizedMap = configMap.set('entity', List([entity]));
    } else if (entity === null || entity === undefined) {
      normalizedMap = configMap.set('entity', EMPTY_LIST);
    } else if (Array.isArray(entity)) {
      normalizedMap = configMap.set('entity', List(entity));
    }

    const existing: ?CharacterMetadata = pool.get(normalizedMap);
    if (existing) {
      return existing;
    }

    const newCharacter = new CharacterMetadata(normalizedMap);
    pool = pool.set(normalizedMap, newCharacter);
    return newCharacter;
  }

  static fromJS({
    style,
    entity,
  }: CharacterMetadataRawConfig): CharacterMetadata {
    return new CharacterMetadata({
      style: Array.isArray(style) ? OrderedSet(style) : style,
      entity: Array.isArray(entity) ? List(entity) : typeof entity === 'string' ? List([entity]) : entity === null ? EMPTY_LIST : entity,
    });
  }
}

const EMPTY = new CharacterMetadata();
let pool: Map<Map<any, any>, CharacterMetadata> = Map([
  // $FlowFixMe[incompatible-call] added when improving typing for this parameters
  [Map(defaultRecord), EMPTY],
]);

CharacterMetadata.EMPTY = EMPTY;

module.exports = CharacterMetadata;
