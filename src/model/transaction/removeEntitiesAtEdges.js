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

import type {BlockNodeRecord} from 'BlockNodeRecord';
import type ContentState from 'ContentState';
import type SelectionState from 'SelectionState';
import type {List} from 'immutable';

const CharacterMetadata = require('CharacterMetadata');
const Immutable = require('immutable');

const findRangesImmutable = require('findRangesImmutable');
const invariant = require('invariant');

function removeEntitiesAtEdges(
  contentState: ContentState,
  selectionState: SelectionState,
): ContentState {
  const blockMap = contentState.getBlockMap();

  const updatedBlocks: {[string]: BlockNodeRecord} = {};

  const startKey = selectionState.getStartKey();
  const startOffset = selectionState.getStartOffset();
  const startBlock = blockMap.get(startKey);
  const updatedStart = removeForBlock(contentState, startBlock, startOffset);

  if (updatedStart !== startBlock) {
    updatedBlocks[startKey] = updatedStart;
  }

  const endKey = selectionState.getEndKey();
  const endOffset = selectionState.getEndOffset();
  let endBlock = blockMap.get(endKey);
  if (startKey === endKey) {
    endBlock = updatedStart;
  }

  const updatedEnd = removeForBlock(contentState, endBlock, endOffset);

  if (updatedEnd !== endBlock) {
    updatedBlocks[endKey] = updatedEnd;
  }

  if (!Object.keys(updatedBlocks).length) {
    return contentState.setSelectionAfter(selectionState);
  }

  return contentState.merge({
    blockMap: blockMap.merge(updatedBlocks),
    selectionAfter: selectionState,
  });
}

/**
 * Given a list of characters and an offset that is in the middle of an entity,
 * returns the start and end of the entity that is overlapping the offset.
 * Note: This method requires that the offset be in an entity range.
 */
function getRemovalRange(
  characters: List<CharacterMetadata>,
  entityKey: string,
  offset: number,
): {
  start: number,
  end: number,
  ...
} {
  let removalRange;

  findRangesImmutable(
    characters,
    (a, b) => Immutable.is(a.get('entity'), b.get('entity')),
    element => element.getEntity().indexOf(entityKey) >= 0,
    (start: number, end: number) => {
      if (start <= offset && end >= offset) {
        removalRange = {start, end};
      }
    },
  );
  invariant(
    typeof removalRange === 'object',
    'Removal range must exist within character list.',
  );
  return removalRange;
}

function removeForBlock(
  contentState: ContentState,
  block: BlockNodeRecord,
  offset: number,
): BlockNodeRecord {
  let chars = block.getCharacterList();
  const charBefore = offset > 0 ? chars.get(offset - 1) : undefined;
  const charAfter = offset < chars.count() ? chars.get(offset) : undefined;
  const entitiesBefore = charBefore ? charBefore.getEntity() : [];
  const entitiesAfter = charAfter ? charAfter.getEntity() : [];

  const commonEntities = entitiesAfter.filter(e => entitiesBefore.indexOf(e) >= 0);

  for (let idx = 0; idx < commonEntities.length; idx++) {
    const entityKey = commonEntities[idx];
    const entity = contentState.getEntity(entityKey);
    if (entity.getMutability() !== 'MUTABLE') {
      let {start, end} = getRemovalRange(chars, entityKey, offset);
      while (start < end) {
        const current = chars.get(start);
        const filtered = current.get('entity').filter(e => e !== entityKey);
        chars = chars.set(
          start,
          CharacterMetadata.create(current.set('entity', filtered)),
        );
        start++;
      }
    }
  }

  if (chars !== block.getCharacterList()) {
    return block.set('characterList', chars);
  }

  return block;
}

module.exports = removeEntitiesAtEdges;
